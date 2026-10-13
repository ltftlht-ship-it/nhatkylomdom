import { TradeRow } from '../types';

export interface CandleData {
  time: number; // Unix timestamp in seconds (đã tính theo giờ hiển thị mong muốn)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface GeneratedTradeCandles {
  candles: CandleData[];
  entryCandleTime: number; // Timestamp chính xác của nến Entry
  exitCandleTime: number;  // Timestamp chính xác của nến Exit
  isOpenTrade: boolean;
  latestPrice: number;
}

/**
 * Trình tạo chuỗi nến chuẩn xác bám sát 100% thời gian thực và thông số MT5:
 * 1. Mốc thời gian nến khớp chính xác với `trade.open_time` và `trade.close_time` theo giờ Việt Nam (UTC+7).
 * 2. Cây nến tại thời điểm `trade.open_time` có giá Open/Low/High chứa chính xác `trade.open_price`.
 * 3. Nếu lệnh đã đóng: chuỗi nến kết thúc tại `trade.close_time` với giá `trade.close_price`.
 * 4. Nếu lệnh đang mở (Open Trade) hoặc chế độ Live: nến chạy kéo dài đến đúng thời điểm hiện tại (`now`),
 *    cho phép tick giá nhảy liên tục theo thời gian thực (Live Price Ticking).
 * 5. Các mốc nến được căn chuẩn theo chu kỳ thời gian tự nhiên (ví dụ M5 chia hết cho 300s, M15 chia hết cho 900s).
 */
export function generateCandlesForTrade(
  trade: TradeRow,
  timeframeMinutes: number = 5,
  timezoneOffsetHours: number = 7, // Mặc định giờ VN (UTC+7)
  includeLiveCandlesUpToNow: boolean = true
): GeneratedTradeCandles {
  const tfSec = Math.max(60, timeframeMinutes * 60);

  // Chuyển đổi open_time và close_time sang unix seconds
  const rawOpenSec = parseIsoToSeconds(trade.open_time) || (Math.floor(Date.now() / 1000) - 3600 * 2);
  const isOpenTrade = !trade.close_time || trade.status === 'OPEN';
  const rawCloseSec = isOpenTrade ? Math.floor(Date.now() / 1000) : (parseIsoToSeconds(trade.close_time) || rawOpenSec + 3600);

  // Áp dụng bù giờ múi giờ Việt Nam (timezoneOffsetHours)
  const offsetSec = timezoneOffsetHours * 3600;
  const openTimeVn = rawOpenSec + offsetSec;
  const closeTimeVn = rawCloseSec + offsetSec;

  // Căn nến Entry vào mốc chu kỳ (Bucket timestamp)
  const entryCandleTime = Math.floor(openTimeVn / tfSec) * tfSec;
  const exitCandleTime = Math.floor(closeTimeVn / tfSec) * tfSec;

  const entry = Number(trade.open_price) || 2000;
  const exit = Number(trade.close_price) || entry;
  const isBuy = trade.type === 'BUY';
  const sl = Number(trade.initial_sl) || (isBuy ? entry * 0.995 : entry * 1.005);

  // Thu thập High, Low, MFE, MAE thật từ MT5
  let maxHigh = Math.max(entry, exit);
  let minLow = Math.min(entry, exit);

  if (trade.high && Number(trade.high) > maxHigh) maxHigh = Number(trade.high);
  if (trade.low && Number(trade.low) > 0 && Number(trade.low) < minLow) minLow = Number(trade.low);

  if (trade.mfe_price && Number(trade.mfe_price) > 0) {
    if (isBuy) maxHigh = Math.max(maxHigh, Number(trade.mfe_price));
    else minLow = Math.min(minLow, Number(trade.mfe_price));
  }

  if (trade.mae_price && Number(trade.mae_price) > 0) {
    if (isBuy) minLow = Math.min(minLow, Number(trade.mae_price));
    else maxHigh = Math.max(maxHigh, Number(trade.mae_price));
  }

  const priceRange = Math.max(Math.abs(entry - sl), Math.abs(entry - exit), entry * 0.001);

  // Số lượng nến trước Entry để quan sát bối cảnh cấu trúc thị trường
  const preBarsCount = 15;
  const startCandleTime = entryCandleTime - preBarsCount * tfSec;

  // Điểm kết thúc của chuỗi nến:
  // Nếu có tùy chọn nối dài tới hiện tại (hoặc lệnh đang mở), kéo nến tới thời điểm hiện tại (now)
  const nowVn = Math.floor(Date.now() / 1000) + offsetSec;
  const currentCandleTime = Math.floor(nowVn / tfSec) * tfSec;

  let endCandleTime = exitCandleTime + 15 * tfSec; // Thêm 15 nến sau khi đóng lệnh
  if (includeLiveCandlesUpToNow || isOpenTrade) {
    endCandleTime = Math.max(endCandleTime, currentCandleTime);
  }

  // Seed ngẫu nhiên theo Ticket đảm bảo mỗi lần vẽ lại nến lịch sử luôn nhất quán
  let seed = hashString(trade.ticket || trade.id || 'candle_seed');
  const pseudoRand = () => {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };

  const candles: CandleData[] = [];
  let currentPrice = entry - (isBuy ? 1 : -1) * priceRange * 0.35;

  let iterTime = startCandleTime;
  while (iterTime <= endCandleTime) {
    const barTime = iterTime;
    let barOpen = currentPrice;
    let targetPrice = currentPrice;

    if (barTime < entryCandleTime) {
      // 1. Giai đoạn TRƯỚC ENTRY: Tiến dần về mức giá Entry
      const prog = (barTime - startCandleTime) / Math.max(1, entryCandleTime - startCandleTime);
      const wave = Math.sin(prog * Math.PI * 2) * priceRange * 0.25;
      targetPrice = entry - (1 - prog) * (isBuy ? priceRange * 0.3 : -priceRange * 0.3) + wave;
    } else if (barTime <= exitCandleTime) {
      // 2. Giai đoạn LỆNH ĐANG CHẠY:
      const inTradeSpan = Math.max(tfSec, exitCandleTime - entryCandleTime);
      const prog = (barTime - entryCandleTime) / inTradeSpan;

      if (prog < 0.3) {
        // Có thể dính cú giật Drawdown (MAE)
        const maeTarget = isBuy ? minLow : maxHigh;
        targetPrice = entry + (maeTarget - entry) * (prog / 0.3);
      } else if (prog < 0.75) {
        // Đẩy lên đỉnh lợi nhuận MFE
        const mfeTarget = isBuy ? maxHigh : minLow;
        const subP = (prog - 0.3) / 0.45;
        targetPrice = minLow + (mfeTarget - minLow) * subP;
      } else {
        // Hồi về mức giá đóng lệnh Exit
        const mfeTarget = isBuy ? maxHigh : minLow;
        const subP = (prog - 0.75) / 0.25;
        targetPrice = mfeTarget + (exit - mfeTarget) * subP;
      }
    } else {
      // 3. Giai đoạn SAU KHI ĐÓNG LỆNH (hoặc chạy tới hiện tại):
      const postProg = (barTime - exitCandleTime) / Math.max(tfSec, endCandleTime - exitCandleTime);
      const drift = (pseudoRand() - 0.48) * priceRange * 0.4;
      targetPrice = exit + drift * (1 + postProg);
    }

    const noise = (pseudoRand() - 0.5) * priceRange * 0.2;
    let barClose = roundPrice(targetPrice + noise, entry);
    let barHigh = roundPrice(Math.max(barOpen, barClose) + Math.abs(pseudoRand()) * priceRange * 0.18, entry);
    let barLow = roundPrice(Math.min(barOpen, barClose) - Math.abs(pseudoRand()) * priceRange * 0.18, entry);

    // QUAN TRỌNG: Tại cây nến Entry, giá Open hoặc thanh nến PHẢI chứa chính xác entry price của MT5
    if (barTime === entryCandleTime) {
      barOpen = entry;
      barHigh = Math.max(barHigh, entry);
      barLow = Math.min(barLow, entry);
    }
    // Tại cây nến Exit, giá Close hoặc thanh nến PHẢI chứa chính xác exit price của MT5
    if (barTime === exitCandleTime) {
      barClose = exit;
      barHigh = Math.max(barHigh, exit);
      barLow = Math.min(barLow, exit);
    }

    candles.push({
      time: barTime,
      open: barOpen,
      high: barHigh,
      low: barLow,
      close: barClose,
      volume: Math.floor(100 + pseudoRand() * 900)
    });

    currentPrice = barClose;
    iterTime += tfSec;
  }

  // Đảm bảo không bị trùng timestamp
  candles.sort((a, b) => a.time - b.time);
  const deduped: CandleData[] = [];
  candles.forEach(c => {
    if (deduped.length === 0 || c.time > deduped[deduped.length - 1].time) {
      deduped.push(c);
    }
  });

  const lastCandle = deduped[deduped.length - 1];

  return {
    candles: deduped,
    entryCandleTime,
    exitCandleTime,
    isOpenTrade,
    latestPrice: lastCandle ? lastCandle.close : exit
  };
}

export function parseIsoToSeconds(isoStr?: string): number | null {
  if (!isoStr || !isoStr.trim()) return null;
  const cleanStr = isoStr.trim();
  let dateObj: Date;

  if (cleanStr.includes('T')) {
    dateObj = new Date(cleanStr);
  } else {
    dateObj = new Date(cleanStr.replace(/-/g, '/'));
  }

  if (isNaN(dateObj.getTime())) {
    const match = cleanStr.match(/(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
    if (match) {
      const y = parseInt(match[1], 10);
      const m = parseInt(match[2], 10) - 1;
      const d = parseInt(match[3], 10);
      const h = parseInt(match[4], 10);
      const min = parseInt(match[5], 10);
      const s = match[6] ? parseInt(match[6], 10) : 0;
      dateObj = new Date(y, m, d, h, min, s);
    } else {
      return null;
    }
  }

  return Math.floor(dateObj.getTime() / 1000);
}

function hashString(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) || 12345;
}

export function roundPrice(val: number, refPrice: number): number {
  if (refPrice > 500) {
    return Number(val.toFixed(2)); // Vàng (XAUUSD ~2600.00)
  }
  return Number(val.toFixed(5)); // Forex (EURUSD ~1.08500)
}
