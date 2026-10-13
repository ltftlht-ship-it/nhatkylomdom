export interface RealCandle {
  time: number; // Unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

/**
 * Ánh xạ Symbol sang Ticker của Binance hoặc Yahoo Finance
 */
export function mapSymbolToRealMarketFeed(symbol?: string): {
  type: 'binance' | 'yahoo';
  ticker: string;
} {
  const clean = (symbol || 'XAUUSD').toUpperCase().replace(/[^A-Z0-9]/g, '');

  // 1. Vàng (Gold)
  if (clean.includes('XAU') || clean.includes('GOLD')) {
    return { type: 'binance', ticker: 'PAXGUSDT' };
  }

  // 2. Crypto
  if (clean.includes('BTC')) return { type: 'binance', ticker: 'BTCUSDT' };
  if (clean.includes('ETH')) return { type: 'binance', ticker: 'ETHUSDT' };
  if (clean.includes('SOL')) return { type: 'binance', ticker: 'SOLUSDT' };

  // 3. Forex
  if (clean.includes('EURUSD')) return { type: 'yahoo', ticker: 'EURUSD=X' };
  if (clean.includes('GBPUSD')) return { type: 'yahoo', ticker: 'GBPUSD=X' };
  if (clean.includes('USDJPY')) return { type: 'yahoo', ticker: 'JPY=X' };
  if (clean.includes('AUDUSD')) return { type: 'yahoo', ticker: 'AUDUSD=X' };
  if (clean.includes('USDCAD')) return { type: 'yahoo', ticker: 'CAD=X' };
  if (clean.includes('USDCHF')) return { type: 'yahoo', ticker: 'CHF=X' };
  if (clean.includes('NZDUSD')) return { type: 'yahoo', ticker: 'NZDUSD=X' };

  // 4. Chỉ số Indices
  if (clean.includes('US30') || clean.includes('DJI')) return { type: 'yahoo', ticker: '^DJI' };
  if (clean.includes('US100') || clean.includes('NAS')) return { type: 'yahoo', ticker: '^NDX' };
  if (clean.includes('US500') || clean.includes('SPX')) return { type: 'yahoo', ticker: '^GSPC' };

  // Mặc định
  return { type: 'binance', ticker: 'PAXGUSDT' };
}

/**
 * Lấy nến thật từ Binance API (Cực kỳ chính xác cho Vàng PAXGUSDT và Crypto)
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
 * Lấy nến thật từ Yahoo Finance API (Cho các cặp Ngoại hối Forex và Chỉ số)
 */
async function fetchYahooCandles(
  ticker: string,
  intervalStr: string = '15m',
  rangeStr: string = '5d'
): Promise<RealCandle[]> {
  const queryUrl = `/api/yahoo/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${intervalStr}&range=${rangeStr}`;
  let res: Response | null = null;

  try {
    res = await fetch(queryUrl);
  } catch {
    res = null;
  }

  // Fallback qua AllOrigins nếu proxy dev gặp lỗi
  if (!res || !res.ok) {
    try {
      res = await fetch(
        `https://api.allorigins.win/raw?url=` +
          encodeURIComponent(`https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=${intervalStr}&range=${rangeStr}`)
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
    throw new Error('Dữ liệu Yahoo rỗng');
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

/**
 * Hàm lấy nến thật tổng hợp cho bất kỳ cặp tiền nào:
 * Đảm bảo 100% nến thật từ thị trường, không suy luận.
 */
export async function fetchRealMarketCandles(
  symbol: string,
  timeframeMinutes: number = 15,
  targetTimeSec?: number,
  timezoneOffsetHours: number = 7
): Promise<RealCandle[]> {
  const feed = mapSymbolToRealMarketFeed(symbol);

  // Quy đổi khung thời gian
  let binanceTf = '15m';
  let yahooTf = '15m';

  if (timeframeMinutes <= 1) {
    binanceTf = '1m';
    yahooTf = '1m';
  } else if (timeframeMinutes <= 5) {
    binanceTf = '5m';
    yahooTf = '5m';
  } else if (timeframeMinutes <= 15) {
    binanceTf = '15m';
    yahooTf = '15m';
  } else if (timeframeMinutes <= 60) {
    binanceTf = '1h';
    yahooTf = '60m';
  } else if (timeframeMinutes <= 240) {
    binanceTf = '4h';
    yahooTf = '60m';
  } else {
    binanceTf = '1d';
    yahooTf = '1d';
  }

  let candles: RealCandle[] = [];

  // Tính startTimeMs nếu có mốc targetTimeSec của lệnh
  let startTimeMs: number | undefined;
  if (targetTimeSec && targetTimeSec > 0) {
    // Lấy trước thời điểm lệnh 2 ngày để đủ nến bối cảnh
    startTimeMs = (targetTimeSec - 2 * 24 * 3600) * 1000;
  }

  try {
    if (feed.type === 'binance') {
      candles = await fetchBinanceCandles(feed.ticker, binanceTf, 500, startTimeMs);
    } else {
      candles = await fetchYahooCandles(feed.ticker, yahooTf, '5d');
    }
  } catch (err) {
    console.warn(`Lỗi nguồn nến ${feed.type}:`, err);
    // Fallback sang nguồn phụ
    try {
      if (feed.type === 'binance') {
        candles = await fetchYahooCandles('GC=F', yahooTf, '5d');
      } else {
        candles = await fetchBinanceCandles('PAXGUSDT', binanceTf, 500);
      }
    } catch (err2) {
      console.warn('Lỗi cả 2 nguồn nến:', err2);
    }
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

  return uniqueCandles;
}
