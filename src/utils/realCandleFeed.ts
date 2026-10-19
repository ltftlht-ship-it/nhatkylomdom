export interface RealCandle {
  time: number; // Unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface MarketFeed {
  type: 'binance' | 'yahoo';
  ticker: string;
}

const FX_CURRENCIES = ['EUR', 'GBP', 'USD', 'JPY', 'AUD', 'NZD', 'CAD', 'CHF'];

/**
 * Ánh xạ Symbol sang Ticker của Binance hoặc Yahoo Finance.
 * Trả về null nếu không có nguồn nến thật cho mã này (không tự gán sang mã khác).
 */
export function mapSymbolToRealMarketFeed(symbol?: string): MarketFeed | null {
  const clean = (symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (!clean) return null;

  // 1. Vàng (Gold): Binance không có XAUUSD giao ngay, PAXG là token neo theo giá vàng
  // nên giá nến có thể lệch vài giá so với báo giá của sàn MT5
  if (clean.includes('XAU') || clean.includes('GOLD')) {
    return { type: 'binance', ticker: 'PAXGUSDT' };
  }

  // 2. Crypto
  if (clean.includes('BTC')) return { type: 'binance', ticker: 'BTCUSDT' };
  if (clean.includes('ETH')) return { type: 'binance', ticker: 'ETHUSDT' };
  if (clean.includes('SOL')) return { type: 'binance', ticker: 'SOLUSDT' };

  // 3. Chỉ số Indices
  if (clean.includes('US30') || clean.includes('DJI')) return { type: 'yahoo', ticker: '^DJI' };
  if (clean.includes('US100') || clean.includes('NAS') || clean.includes('NDX')) return { type: 'yahoo', ticker: '^NDX' };
  if (clean.includes('US500') || clean.includes('SPX')) return { type: 'yahoo', ticker: '^GSPC' };

  // 4. Forex: mọi cặp 6 ký tự giữa các đồng tiền chính (EURUSD, GBPJPY, EURGBP...), bỏ hậu tố sàn (.m, pro...)
  const pair = clean.match(new RegExp(`(${FX_CURRENCIES.join('|')})(${FX_CURRENCIES.join('|')})`));
  if (pair && pair[1] !== pair[2]) {
    return { type: 'yahoo', ticker: `${pair[1]}${pair[2]}=X` };
  }

  return null;
}

/**
 * Lấy nến thật từ Binance API (Vàng PAXGUSDT và Crypto)
 */
async function fetchBinanceCandles(
  ticker: string,
  intervalStr: string = '15m',
  limit: number = 500,
  startTimeMs?: number
): Promise<RealCandle[]> {
  let url = `https://api.binance.com/api/v3/klines?symbol=${ticker}&interval=${intervalStr}&limit=${limit}`;
  if (startTimeMs && startTimeMs > 0) {
    url += `&startTime=${startTimeMs}`;
  }

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Binance HTTP ${res.status}`);
  const data = await res.json();

  const candles: RealCandle[] = [];
  for (const item of data) {
    const openTimeMs = Number(item[0]);
    const o = parseFloat(item[1]);
    const h = parseFloat(item[2]);
    const l = parseFloat(item[3]);
    const c = parseFloat(item[4]);
    const vol = parseFloat(item[5]);
    if (!isNaN(openTimeMs) && !isNaN(o) && !isNaN(c)) {
      candles.push({
        time: Math.floor(openTimeMs / 1000),
        open: o,
        high: h,
        low: l,
        close: c,
        volume: vol,
      });
    }
  }
  return candles;
}

/**
 * Lấy nến thật từ Yahoo Finance API (Forex và Chỉ số) theo khoảng thời gian cụ thể.
 * Giới hạn của Yahoo: nến 1m chỉ có ~30 ngày gần nhất, 5m/15m ~60 ngày, 1h ~2 năm.
 */
async function fetchYahooCandles(
  ticker: string,
  intervalStr: string,
  period1Sec: number,
  period2Sec: number
): Promise<RealCandle[]> {
  const query = `v8/finance/chart/${encodeURIComponent(ticker)}?interval=${intervalStr}&period1=${period1Sec}&period2=${period2Sec}`;
  let res: Response | null = null;

  try {
    res = await fetch(`/api/yahoo/${query}`);
  } catch {
    res = null;
  }

  // Dự phòng qua AllOrigins nếu proxy /api/yahoo gặp lỗi
  if (!res || !res.ok) {
    try {
      res = await fetch(
        `https://api.allorigins.win/raw?url=` +
          encodeURIComponent(`https://query1.finance.yahoo.com/${query}`)
      );
    } catch {
      res = null;
    }
  }

  if (!res || !res.ok) {
    throw new Error('Không thể tải nến Yahoo Finance');
  }

  const data = await res.json();
  const result = data.chart?.result?.[0];
  if (!result || !result.timestamp || !result.indicators?.quote?.[0]) {
    throw new Error('Yahoo không có dữ liệu nến cho khoảng thời gian này');
  }

  const timestamps: number[] = result.timestamp;
  const quote = result.indicators.quote[0];
  const opens = quote.open || [];
  const highs = quote.high || [];
  const lows = quote.low || [];
  const closes = quote.close || [];

  const candles: RealCandle[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const t = timestamps[i];
    const o = opens[i];
    const h = highs[i];
    const l = lows[i];
    const c = closes[i];
    if (t && o != null && h != null && l != null && c != null) {
      candles.push({
        time: t,
        open: Number(o),
        high: Number(h),
        low: Number(l),
        close: Number(c),
      });
    }
  }
  return candles;
}

export interface RealCandleResult {
  candles: RealCandle[];
  feed: MarketFeed | null;
  error?: string;
}

const CANDLES_TOTAL = 500;
const CANDLES_BEFORE = 200;

/**
 * Lấy nến thật cho mã giao dịch, khoảng 200 nến trước và 300 nến sau thời điểm lệnh.
 * Đảm bảo 100% nến thật đúng mã: lỗi hoặc không có nguồn thì trả về rỗng kèm lý do,
 * không thay bằng nến của mã khác.
 */
export async function fetchRealMarketCandles(
  symbol: string,
  timeframeMinutes: number = 15,
  targetTimeSec?: number
): Promise<RealCandleResult> {
  const feed = mapSymbolToRealMarketFeed(symbol);
  if (!feed) {
    return { candles: [], feed: null, error: `Chưa có nguồn nến thật cho mã ${symbol}` };
  }

  // Quy đổi khung thời gian
  let binanceTf = '15m';
  let yahooTf = '15m';
  let tfSec = 15 * 60;

  if (timeframeMinutes <= 1) {
    binanceTf = '1m'; yahooTf = '1m'; tfSec = 60;
  } else if (timeframeMinutes <= 5) {
    binanceTf = '5m'; yahooTf = '5m'; tfSec = 5 * 60;
  } else if (timeframeMinutes <= 15) {
    binanceTf = '15m'; yahooTf = '15m'; tfSec = 15 * 60;
  } else if (timeframeMinutes <= 60) {
    binanceTf = '1h'; yahooTf = '60m'; tfSec = 3600;
  } else if (timeframeMinutes <= 240) {
    // Yahoo không có nến 4h: Forex/Chỉ số dùng nến 1h
    binanceTf = '4h'; yahooTf = '60m'; tfSec = 4 * 3600;
  } else {
    binanceTf = '1d'; yahooTf = '1d'; tfSec = 86400;
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const target = targetTimeSec && targetTimeSec > 0 ? targetTimeSec : nowSec;
  const yahooTfSec = yahooTf === '60m' ? 3600 : tfSec;

  let candles: RealCandle[] = [];
  try {
    if (feed.type === 'binance') {
      const startSec = target - CANDLES_BEFORE * tfSec;
      candles = await fetchBinanceCandles(feed.ticker, binanceTf, CANDLES_TOTAL, startSec * 1000);
    } else {
      const period1 = target - CANDLES_BEFORE * yahooTfSec;
      const period2 = Math.min(nowSec, target + (CANDLES_TOTAL - CANDLES_BEFORE) * yahooTfSec);
      candles = await fetchYahooCandles(feed.ticker, yahooTf, period1, period2);
    }
  } catch (err: any) {
    console.warn(`Lỗi nguồn nến ${feed.type} ${feed.ticker}:`, err);
    return { candles: [], feed, error: err?.message || 'Không tải được nến' };
  }

  // Sắp xếp tăng dần theo thời gian và lọc bỏ trùng
  candles.sort((a, b) => a.time - b.time);
  const uniqueCandles: RealCandle[] = [];
  const seenTimes = new Set<number>();

  for (const c of candles) {
    if (!seenTimes.has(c.time)) {
      seenTimes.add(c.time);
      uniqueCandles.push(c);
    }
  }

  if (uniqueCandles.length === 0) {
    return { candles: [], feed, error: 'Nguồn nến không có dữ liệu cho thời điểm lệnh' };
  }
  return { candles: uniqueCandles, feed };
}
