import { TradeRow, TradeGroup, TradeResult, TradeSession, TradeType } from '../types';
import { SupabaseTradeRow } from '../lib/supabase';
import { normalizeImageSource } from './imageUtils';

export const TIMEZONE_STORAGE_KEY = 'trade_journal_timezone_offset';
export const TIMEFRAME_STORAGE_KEY = 'trade_journal_timeframe_options';
export const DEFAULT_TIMEFRAME_OPTIONS = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1', 'MN'];

/**
 * Lấy danh sách khung thời gian (Timeframes) từ LocalStorage
 */
export function getSavedTimeframeOptions(): string[] {
  try {
    const saved = localStorage.getItem(TIMEFRAME_STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.warn('Cannot read timeframe options from localStorage', e);
  }
  return DEFAULT_TIMEFRAME_OPTIONS;
}

/**
 * Lưu danh sách khung thời gian vào LocalStorage
 */
export function saveTimeframeOptions(options: string[]): void {
  try {
    localStorage.setItem(TIMEFRAME_STORAGE_KEY, JSON.stringify(options));
  } catch (e) {
    console.warn('Cannot save timeframe options to localStorage', e);
  }
}

/**
 * Lấy timezone offset đã lưu trong LocalStorage (mặc định 0 hoặc giá trị đã lưu)
 */
export function getSavedTimezoneOffset(): number {
  try {
    const saved = localStorage.getItem(TIMEZONE_STORAGE_KEY);
    if (saved !== null && saved !== undefined && saved !== '') {
      const parsed = parseFloat(saved);
      if (!isNaN(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Cannot read timezone from localStorage', e);
  }
  return 0;
}

/**
 * Lưu timezone offset vào LocalStorage
 */
export function saveTimezoneOffset(offset: number): void {
  try {
    localStorage.setItem(TIMEZONE_STORAGE_KEY, String(offset));
  } catch (e) {
    console.warn('Cannot save timezone to localStorage', e);
  }
}

/**
 * Chuẩn hóa an toàn dữ liệu checklist / mistake tags từ Supabase hoặc Plan thành string[]:
 * - Hỗ trợ Array thông thường: ['bias', 'poi']
 * - Hỗ trợ JSON String: '["bias", "poi"]'
 * - Hỗ trợ Postgres Array string: '{"bias", "poi"}' hoặc '{bias,poi}'
 * - Hỗ trợ chuỗi phân tách bằng dấu phẩy: 'bias, poi'
 * - Không bao giờ trả về null/undefined, luôn trả về mảng string hợp lệ
 */
export function parseChecklistArray(val: any): string[] {
  if (!val) return [];
  if (Array.isArray(val)) {
    return val.map(x => String(x).trim()).filter(Boolean);
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed || trimmed === '[]' || trimmed === '{}' || trimmed === 'null' || trimmed === 'undefined') {
      return [];
    }
    // Hỗ trợ JSON Array
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed.map(x => String(x).trim()).filter(Boolean);
        }
      } catch {}
    }
    // Hỗ trợ Postgres Array {a,b,c}
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) return [];
      return inner
        .split(',')
        .map(item => item.replace(/^["']|["']$/g, '').trim())
        .filter(Boolean);
    }
    // Chuỗi phân tách dấu phẩy
    if (trimmed.includes(',')) {
      return trimmed.split(',').map(item => item.trim()).filter(Boolean);
    }
    return [trimmed];
  }
  return [];
}

export const DEFAULT_CONTRACT_SIZES: Record<string, number> = {
  'XAU/USD': 100,
  'GOLD': 100,
  'EUR/USD': 100000,
  'GBP/USD': 100000,
  'USD/JPY': 100000,
  'BTC/USD': 1,
  'US30': 1,
  'NAS100': 1,
};

/**
 * Tính toán phiên Á / Âu / Mỹ dựa trên Open Time và Timezone Offset
 */
export function determineSession(
  openTimeStr: string,
  timezoneOffsetHours: number = 0
): 'Á' | 'Âu' | 'Mỹ' {
  try {
    const cleanStr = (openTimeStr || '').trim();
    if (!cleanStr) return 'Âu';

    let hour = 0;
    // Parse hour directly from string "YYYY-MM-DD HH:mm:ss" or "YYYY.MM.DD HH:mm:ss" to avoid JS local timezone skew
    const timeMatch = cleanStr.match(/(?:\s|T)(\d{1,2}):(\d{1,2})/);
    if (timeMatch) {
      hour = parseInt(timeMatch[1], 10);
    } else {
      const d = new Date(cleanStr.replace(/-/g, '/'));
      if (!isNaN(d.getTime())) hour = d.getHours();
    }

    // MT5 Broker Server Time (thường là EET/EEST: UTC+2 mùa đông / UTC+3 mùa hè):
    // Nếu timezoneOffsetHours = 0 (chưa cấu hình trong Settings):
    // Giờ MT5:
    // - Phiên Á (Tokyo: 00:00 - 08:00 UTC) -> 02:00 - 10:00 MT5
    // - Phiên Âu (London: 08:00 - 16:30 UTC) -> 10:00 - 18:30 MT5
    // - Phiên Mỹ (New York: 13:00 - 22:00 UTC) -> 15:00 - 24:00 MT5
    if (timezoneOffsetHours === 0) {
      if (hour >= 2 && hour < 10) {
        return 'Á';
      } else if (hour >= 10 && hour < 16) {
        return 'Âu';
      } else {
        return 'Mỹ';
      }
    }

    // Nếu người dùng đã cấu hình offset từ MT5 sang Giờ Việt Nam (UTC+7, ví dụ offset = +4 hoặc +5):
    const adjustedHour = (hour + timezoneOffsetHours + 24) % 24;
    // Giờ Việt Nam (UTC+7):
    // - Phiên Á (Tokyo): 06:00 - 14:00 VN
    // - Phiên Âu (London): 14:00 - 19:30 VN
    // - Phiên Mỹ (New York): 19:30 - 04:00 sáng hôm sau VN
    if (adjustedHour >= 6 && adjustedHour < 14) {
      return 'Á';
    } else if (adjustedHour >= 14 && adjustedHour < 20) {
      return 'Âu';
    } else {
      return 'Mỹ';
    }
  } catch {
    return 'Âu';
  }
}

export function formatSessionLabel(session: 'Á' | 'Âu' | 'Mỹ'): string {
  switch (session) {
    case 'Á':
      return 'Tokyo';
    case 'Âu':
      return 'London';
    case 'Mỹ':
      return 'New York';
    default:
      return session;
  }
}

/**
 * ====================================================================
 * LOGIC TÍNH TOÁN TÀI CHÍNH CHUẨN XÁC (FINTECH STANDARD):
 * 1. Net PnL = pnl + commission + swap (cộng đúng dấu đại số, trừ phí & swap)
 * 2. Khoảng Cách Giá SL (Price Risk) = Math.abs(open_price - initial_sl)
 *    - XAUUSD (Vàng):
 *      * Risk 1R ($) = Price_Risk * volume * 100
 *      * Pip SL hiển thị: Price_Risk ("10.5 giá")
 *    - Forex (EURUSD, GBPUSD...):
 *      * Risk 1R ($) = Price_Risk * volume * 100000
 *      * Pip SL hiển thị: Price_Risk * 10000 ("35 pips")
 *    - Nếu initial_sl = 0 (Lệnh không đặt SL):
 *      * Risk 1R ($) = $100 (hoặc Fixed Risk từ Settings)
 *      * Pip SL hiển thị: "N/A"
 * 3. R:R Đạt Được = Net_PnL / Risk_1R_Amount (làm tròn 2 chữ số thập phân: +2.35R, -1.00R)
 * 4. Bộ Lọc Lệnh Rác (Noise Filter):
 *    - Lệnh rác: volume <= 0.01 Lot
 *    - Khi bật: Winrate, Tổng R:R, Profit Factor, Average Win/Loss BẮT BUỘC loại bỏ lệnh rác!
 * 5. Running Balance = initial_balance + tổng Net PnL lũy kế (tính theo thời gian tăng dần)
 * ====================================================================
 */

/**
 * Kiểm tra mã giao dịch có phải là Vàng (Gold) hay không
 */
export function isGoldSymbol(symbol?: string): boolean {
  if (!symbol) return true;
  const sym = symbol.toUpperCase().trim();
  return sym.includes('XAU') || sym.includes('GOLD');
}

/**
 * 1. Net PnL = pnl + commission + swap
 * Lưu ý: commission và swap từ MT5 thường là số ÂM, cộng đúng dấu đại số để trừ chi phí.
 */
export function calculateNetPnl(pnl: number, commission: number = 0, swap: number = 0): number {
  return Number(((pnl || 0) + (commission || 0) + (swap || 0)).toFixed(2));
}

/**
 * 2. Tính Pip SL:
 * - Khoảng Cách Giá SL (Price Risk) = Math.abs(open_price - initial_sl)
 * - Nếu initial_sl > 0:
 *   + XAUUSD: Pip_SL = Price_Risk (ví dụ: 10.5)
 *   + Forex: Pip_SL = Price_Risk * 10000 (ví dụ: 35.0 pips)
 * - Nếu initial_sl <= 0: trả về 0
 */
export function calculatePipSl(
  openPrice: number,
  initialSl: number = 0,
  symbol: string = 'XAU/USD'
): number {
  if (!initialSl || initialSl <= 0 || !openPrice || openPrice <= 0) return 0;
  const priceRisk = Math.abs(openPrice - initialSl);
  if (priceRisk <= 0) return 0;

  if (isGoldSymbol(symbol)) {
    // Đối với Vàng: Trả về khoảng cách giá trực tiếp (ví dụ: 10.5)
    return Number(priceRisk.toFixed(2));
  } else {
    // Đối với Forex: Nhân 10000 để ra số pips chuẩn
    return Number((priceRisk * 10000).toFixed(1));
  }
}

/**
 * Format hiển thị Pip SL theo quy tắc đề bài:
 * - XAUUSD: "10.5 giá"
 * - Forex: "35.0 pips"
 * - Không có SL: "N/A"
 */
export function formatPipSl(
  pipSl: number,
  symbol: string = 'XAU/USD',
  initialSl?: number
): string {
  if (!initialSl || initialSl <= 0 || !pipSl || pipSl <= 0) {
    return 'N/A';
  }
  if (isGoldSymbol(symbol)) {
    return `${pipSl.toFixed(1)} giá`;
  } else {
    return `${pipSl.toFixed(1)} pips`;
  }
}

/**
 * 3. Mức rủi ro 1R ($USD):
 * - Xác định Khoảng Cách Giá SL (Price Risk) = Math.abs(open_price - initial_sl).
 * - Nếu initial_sl > 0:
 *   + Đối với XAUUSD (Vàng): Risk_1R_Amount = Price_Risk * volume * 100
 *   + Đối với Forex (EURUSD, GBPUSD...): Risk_1R_Amount = Price_Risk * volume * 100000
 * - Nếu initial_sl = 0 (Lệnh không đặt SL):
 *   + Mặc định Risk_1R_Amount = $100 (hoặc lấy theo Fixed Risk $100 cài trong Settings)
 */
export function calculateRisk1R(
  openPrice: number,
  initialSl?: number,
  volume: number = 1,
  contractSize: number = 100,
  fixed1RUsd: number = 100,
  symbol: string = 'XAU/USD'
): number {
  if (initialSl && initialSl > 0 && openPrice > 0) {
    const priceRisk = Math.abs(openPrice - initialSl);
    if (priceRisk > 0 && volume > 0) {
      const isGold = isGoldSymbol(symbol);
      let riskAmount: number;
      if (isGold) {
        riskAmount = priceRisk * volume * 100;
      } else {
        const effectiveContract = contractSize > 100 ? contractSize : 100000;
        riskAmount = priceRisk * volume * effectiveContract;
      }

      if (riskAmount > 0) {
        return Number(riskAmount.toFixed(2));
      }
    }
  }
  // Mặc định Fixed Risk $100 nếu SL = 0
  return fixed1RUsd > 0 ? fixed1RUsd : 100;
}

/**
 * 4. R:R Thực Tế Đạt Được:
 * R:R = Net_PnL / Risk_1R_Amount. (Làm tròn 2 chữ số thập phân, ví dụ: +2.35R, -1.00R)
 */
export function calculateActualRR(netPnl: number, risk1R: number): number {
  if (!risk1R || risk1R <= 0) return 0;
  return Number((netPnl / risk1R).toFixed(2));
}

export function formatRR(rr: number | null | undefined): string {
  if (rr == null || isNaN(Number(rr)) || !isFinite(Number(rr))) return '0.00R';
  const num = Number(rr);
  const sign = num > 0 ? '+' : '';
  return `${sign}${num.toFixed(2)}R`;
}

/**
 * ====================================================================
 * TÍNH TOÁN MFE & MAE CHUẨN XÁC THEO BUY / SELL:
 * - MFE (Maximum Favorable Excursion): Mức giá đi thuận lợi nhất sau Entry.
 * - MAE (Maximum Adverse Excursion): Mức giá đi ngược bất lợi nhất sau Entry.
 *
 * BUY:
 *   favorable = highest price sau entry (High)
 *   adverse = lowest price sau entry (Low)
 *   mfe_price = favorable - open_price
 *   mae_price = open_price - adverse
 *
 * SELL:
 *   favorable = lowest price sau entry (Low)
 *   adverse = highest price sau entry (High)
 *   mfe_price = open_price - favorable
 *   mae_price = adverse - open_price
 *
 * Quy đổi sang R (nếu có Initial SL > 0 và Price Risk > 0):
 *   Price Risk = |open_price - initial_sl|
 *   mfe_r = mfe_price / Price Risk
 *   mae_r = mae_price / Price Risk
 *
 * Nếu High/Low không có hoặc null -> trả về null, KHÔNG giả định số liệu!
 * ====================================================================
 */
export function calculateMfeMae(
  openPrice: number,
  initialSl: number,
  type: 'BUY' | 'SELL',
  high?: number | null,
  low?: number | null,
  rawMfePrice?: number | null,
  rawMaePrice?: number | null
): {
  high: number | null;
  low: number | null;
  mfe_price: number | null;
  mae_price: number | null;
  mfe_dist: number | null;
  mae_dist: number | null;
  mfe_r: number | null;
  mae_r: number | null;
} {
  const hasHigh = high !== undefined && high !== null && !isNaN(Number(high)) && Number(high) > 0;
  const hasLow = low !== undefined && low !== null && !isNaN(Number(low)) && Number(low) > 0;
  const hasRawMfe = rawMfePrice !== undefined && rawMfePrice !== null && !isNaN(Number(rawMfePrice)) && Number(rawMfePrice) > 0;
  const hasRawMae = rawMaePrice !== undefined && rawMaePrice !== null && !isNaN(Number(rawMaePrice)) && Number(rawMaePrice) > 0;

  if (!hasHigh && !hasLow && !hasRawMfe && !hasRawMae) {
    return {
      high: null,
      low: null,
      mfe_price: null,
      mae_price: null,
      mfe_dist: null,
      mae_dist: null,
      mfe_r: null,
      mae_r: null,
    };
  }

  // Trường hợp 1: Có rawMfePrice / rawMaePrice từ database (EA MT5 lưu mức giá thị trường tuyệt đối)
  let mfeDist: number | null = null;
  let maeDist: number | null = null;
  let marketMfePrice: number | null = null;
  let marketMaePrice: number | null = null;

  if (hasRawMfe) {
    const val = Number(rawMfePrice);
    marketMfePrice = val;
    if (openPrice > 0 && Math.abs(val - openPrice) < openPrice * 0.5) {
      // val là mức giá thị trường tuyệt đối (Market Price, ví dụ 4394.70 khi open là 4392.81)
      // Khoảng cách MFE = chênh lệch giá tuyệt đối giữa giá đỉnh và giá vào
      mfeDist = Math.abs(val - openPrice);
    } else {
      // val là khoảng cách giá chênh lệch sẵn
      mfeDist = Math.max(0, val);
    }
  }

  if (hasRawMae) {
    const val = Number(rawMaePrice);
    marketMaePrice = val;
    if (openPrice > 0 && Math.abs(val - openPrice) < openPrice * 0.5) {
      // val là mức giá thị trường tuyệt đối (Market Price, ví dụ 4415.48 khi open là 4392.81)
      // Khoảng cách MAE = chênh lệch giá tuyệt đối giữa giá đáy/ngược chiều và giá vào
      maeDist = Math.abs(val - openPrice);
    } else {
      // val là khoảng cách giá chênh lệch sẵn
      maeDist = Math.max(0, val);
    }
  }

  // Trường hợp 2: Có High / Low từ thanh nến
  if (hasHigh || hasLow) {
    const numHigh = hasHigh ? Number(high) : openPrice;
    const numLow = hasLow ? Number(low) : openPrice;
    const distFromHighLow = type === 'BUY' ? Math.max(0, numHigh - openPrice) : Math.max(0, openPrice - numLow);
    const maeFromHighLow = type === 'BUY' ? Math.max(0, openPrice - numLow) : Math.max(0, numHigh - openPrice);
    if (mfeDist === null || distFromHighLow > mfeDist) {
      mfeDist = distFromHighLow;
      marketMfePrice = type === 'BUY' ? numHigh : numLow;
    }
    if (maeDist === null || maeFromHighLow > maeDist) {
      maeDist = maeFromHighLow;
      marketMaePrice = type === 'BUY' ? numLow : numHigh;
    }
  }

  const finalMfeDist = mfeDist !== null ? Number(mfeDist.toFixed(2)) : null;
  const finalMaeDist = maeDist !== null ? Number(maeDist.toFixed(2)) : null;

  let mfeR: number | null = null;
  let maeR: number | null = null;

  if (initialSl > 0 && openPrice > 0) {
    const priceRisk = Math.abs(openPrice - initialSl);
    if (priceRisk > 0) {
      if (finalMfeDist !== null) mfeR = Number((finalMfeDist / priceRisk).toFixed(2));
      if (finalMaeDist !== null) maeR = Number((finalMaeDist / priceRisk).toFixed(2));
    }
  }

  return {
    high: hasHigh ? Number(high) : null,
    low: hasLow ? Number(low) : null,
    mfe_price: marketMfePrice !== null ? Number(marketMfePrice.toFixed(2)) : finalMfeDist,
    mae_price: marketMaePrice !== null ? Number(marketMaePrice.toFixed(2)) : finalMaeDist,
    mfe_dist: finalMfeDist,
    mae_dist: finalMaeDist,
    mfe_r: mfeR,
    mae_r: maeR,
  };
}

/**
 * ====================================================================
 * BỘ LỌC LỆNH RÁC (NOISE / SCRATCH FILTER):
 * Lệnh rác (Noise Trade): Volume <= 0.01 Lot (Lệnh test / dò sóng).
 * ====================================================================
 */
export const NOISE_VOLUME_THRESHOLD = 0.01;

export function isNoiseTrade(trade: { volume?: number } | { total_volume?: number }): boolean {
  if ('total_volume' in trade && typeof trade.total_volume === 'number') {
    return trade.total_volume <= NOISE_VOLUME_THRESHOLD;
  }
  if ('volume' in trade && typeof trade.volume === 'number') {
    return trade.volume <= NOISE_VOLUME_THRESHOLD;
  }
  return false;
}

const NOISE_FILTER_STORAGE_KEY = 'trade_journal_noise_filter';
const HIDE_NOISE_ROWS_STORAGE_KEY = 'trade_journal_hide_noise_rows';

export function getSavedNoiseFilter(): boolean {
  if (typeof window === 'undefined') return true;
  const saved = localStorage.getItem(NOISE_FILTER_STORAGE_KEY);
  return saved !== null ? saved === 'true' : true; // Mặc định BẬT
}

export function saveNoiseFilter(enabled: boolean): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(NOISE_FILTER_STORAGE_KEY, String(enabled));
  }
}

export function getSavedHideNoiseRows(): boolean {
  if (typeof window === 'undefined') return false; // Mặc định hiển thị làm mờ
  const saved = localStorage.getItem(HIDE_NOISE_ROWS_STORAGE_KEY);
  return saved === 'true';
}

export function saveHideNoiseRows(hide: boolean): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem(HIDE_NOISE_ROWS_STORAGE_KEY, String(hide));
  }
}

export interface TradeStatistics {
  filteredTrades: TradeRow[];
  totalTrades: number;
  filteredTradesCount: number;
  noiseTradesCount: number;
  wins: number;
  losses: number;
  breakeven: number;
  winRate: number;
  totalWinUsd: number;
  totalLossUsd: number;
  totalNetPnl: number;
  totalGrossPnl: number;
  totalCommission: number;
  totalSwap: number;
  totalFees: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  totalRR: number;
  avgRR: number;
  realizedRR: number;
}

/**
 * Tính toán toàn bộ các chỉ số thống kê hiệu suất:
 * Khi isNoiseFilterActive = true, BẮT BUỘC loại bỏ hoàn toàn các lệnh rác (volume <= 0.01)
 * ra khỏi Winrate, Tổng R:R, Profit Factor, Average Win/Loss!
 */
export function computeTradeStatistics(
  trades: TradeRow[],
  isNoiseFilterActive: boolean = true
): TradeStatistics {
  const noiseTradesCount = trades.filter(t => isNoiseTrade(t)).length;
  const filteredTrades = isNoiseFilterActive
    ? trades.filter(t => !isNoiseTrade(t))
    : trades;

  const winTrades = filteredTrades.filter(t => t.result === 'Win');
  const lossTrades = filteredTrades.filter(t => t.result === 'Loss');
  const beTrades = filteredTrades.filter(t => t.result === 'BE');

  const wins = winTrades.length;
  const losses = lossTrades.length;
  const breakeven = beTrades.length;
  const winRate = (wins + losses) > 0 ? (wins / (wins + losses)) * 100 : (wins > 0 ? 100 : 0);

  const totalWinUsd = winTrades.reduce((acc, t) => acc + (t.net_pnl || 0), 0);
  const totalLossUsd = Math.abs(lossTrades.reduce((acc, t) => acc + (t.net_pnl || 0), 0));

  const totalNetPnl = Number(filteredTrades.reduce((acc, t) => acc + (t.net_pnl || 0), 0).toFixed(2));
  const totalCommission = Number(filteredTrades.reduce((acc, t) => acc + (t.commission || 0), 0).toFixed(2));
  const totalSwap = Number(filteredTrades.reduce((acc, t) => acc + (t.swap || 0), 0).toFixed(2));
  const totalFees = Number((totalCommission + totalSwap).toFixed(2));
  const totalGrossPnl = Number(filteredTrades.reduce((acc, t) => acc + (t.pnl || 0), 0).toFixed(2));

  const profitFactor = totalLossUsd > 0
    ? Number((totalWinUsd / totalLossUsd).toFixed(2))
    : (totalWinUsd > 0 ? 99.9 : 0);

  const avgWin = wins > 0 ? Number((totalWinUsd / wins).toFixed(2)) : 0;
  const avgLoss = losses > 0 ? Number((totalLossUsd / losses).toFixed(2)) : 0;

  const totalRR = Number(filteredTrades.reduce((sum, t) => sum + (t.weighted_rr || 0), 0).toFixed(2));
  const avgRR = filteredTrades.length > 0 ? Number((totalRR / filteredTrades.length).toFixed(2)) : 0;
  const realizedRR = avgLoss > 0 ? Number((avgWin / avgLoss).toFixed(2)) : 0;

  return {
    filteredTrades,
    totalTrades: trades.length,
    filteredTradesCount: filteredTrades.length,
    noiseTradesCount,
    wins,
    losses,
    breakeven,
    winRate: Number(winRate.toFixed(1)),
    totalWinUsd: Number(totalWinUsd.toFixed(2)),
    totalLossUsd: Number(totalLossUsd.toFixed(2)),
    totalNetPnl,
    totalGrossPnl,
    totalCommission,
    totalSwap,
    totalFees,
    profitFactor,
    avgWin,
    avgLoss,
    totalRR,
    avgRR,
    realizedRR,
  };
}

/**
 * 5. Xử lý toàn bộ danh sách lệnh từ Supabase:
 * - CHỈ xử lý các lệnh có status = 'CLOSED'
 * - Sắp xếp mảng theo thời gian tăng dần ĐỂ TÍNH Running Balance lũy kế:
 *   Running Balance = initial_balance + tổng Net PnL tích lũy.
 * - Sau khi tính xong Balance lũy kế mới đảo ngược mảng (reverse) để hiển thị lệnh mới nhất lên đầu.
 * - Giữ nguyên thời gian thô (raw timestamp) trong object.
 */
export function processSupabaseClosedTrades(
  rawTrades: SupabaseTradeRow[],
  initialBalanceFallback: number = 10000,
  fixed1RUsd: number = 100,
  contractSizes: Record<string, number> = DEFAULT_CONTRACT_SIZES,
  timezoneOffset: number = 0
): TradeRow[] {
  // Lọc chỉ lấy các lệnh CLOSED và khử trùng lặp (Deduplicate) vé lệnh MT5 ticket
  const ticketMap = new Map<string, SupabaseTradeRow>();
  rawTrades.forEach(t => {
    const st = (t.status || 'CLOSED').toUpperCase().trim();
    if (st !== 'CLOSED') return;
    // Lọc bỏ các bản ghi phantom/rác không có close_time và pnl null (bản ghi OPEN sót lại bị đánh dấu CLOSED nhầm)
    if ((t.pnl === null || t.pnl === undefined) && !t.close_time) return;
    const key = String(t.ticket || t.id || '').trim();
    if (key) {
      ticketMap.set(key, t);
    } else {
      ticketMap.set(`row-${Math.random()}`, t);
    }
  });
  const closedTradesOnly = Array.from(ticketMap.values());

  // 1. Sắp xếp theo thời gian TĂNG DẦN (chronological order) để tính lũy kế
  const sorted = [...closedTradesOnly].sort((a, b) => {
    const timeA = new Date((a.close_time || a.open_time || '').replace(/-/g, '/')).getTime() || 0;
    const timeB = new Date((b.close_time || b.open_time || '').replace(/-/g, '/')).getTime() || 0;
    return timeA - timeB;
  });

  // Xác định initial_balance từ record đầu tiên nếu có, hoặc fallback
  const firstWithInitial = sorted.find(
    t => t.initial_balance !== undefined && t.initial_balance !== null && !isNaN(Number(t.initial_balance))
  );
  const initialBalance = firstWithInitial ? Number(firstWithInitial.initial_balance) : initialBalanceFallback;

  let cumulativeNetPnl = 0;

  // 2. Tính toán lũy kế từng bước từ lệnh cũ nhất đến mới nhất
  const processedAscending: TradeRow[] = sorted.map((t, index) => {
    const pnl = Number(t.pnl || 0);
    const commission = Number(t.commission || 0);
    const swap = Number(t.swap || 0);
    
    // Net PnL = pnl + commission + swap
    const netPnl = calculateNetPnl(pnl, commission, swap);

    // Running Balance = initial_balance + tổng Net PnL tích lũy qua từng lệnh
    cumulativeNetPnl = Number((cumulativeNetPnl + netPnl).toFixed(2));
    const runningBalance = Number((initialBalance + cumulativeNetPnl).toFixed(2));

    const symbol = t.symbol || 'XAU/USD';
    const contractSize = contractSizes[symbol] || (symbol.includes('XAU') || symbol.includes('GOLD') ? 100 : 100000);
    const openPrice = Number(t.open_price || 0);
    const closePrice = Number(t.close_price || 0);
    const initialSl = t.initial_sl ? Number(t.initial_sl) : 0;
    const volume = Number(t.volume || 0);

    // Tính Pip SL & Risk 1R & R:R
    const pipSl = calculatePipSl(openPrice, initialSl, symbol);
    const risk1rUsd = calculateRisk1R(openPrice, initialSl, volume, contractSize, fixed1RUsd, symbol);
    const weightedRr = calculateActualRR(netPnl, risk1rUsd);

    const typeStr = String(t.type || 'BUY').toUpperCase();
    let tradeType: TradeType = typeStr.includes('SELL') ? 'SELL' : 'BUY';

    // BẢO VỆ TOÁN HỌC (Self-Healing Direction):
    // Với lệnh đã đóng có open_price, close_price và pnl rõ ràng:
    // Nếu giá tăng (close > open) mà lỗ => chắc chắn 100% là lệnh SELL
    // Nếu giá giảm (close < open) mà lãi => chắc chắn 100% là lệnh SELL
    // Nếu giá tăng (close > open) mà lãi => chắc chắn 100% là lệnh BUY
    // Nếu giá giảm (close < open) mà lỗ => chắc chắn 100% là lệnh BUY
    if (openPrice > 0 && closePrice > 0 && Math.abs(openPrice - closePrice) > 0.05 && Math.abs(pnl) > 1) {
      if (closePrice > openPrice) {
        tradeType = pnl > 0 ? 'BUY' : 'SELL';
      } else if (closePrice < openPrice) {
        tradeType = pnl > 0 ? 'SELL' : 'BUY';
      }
    }

    let result: TradeResult = 'BE';
    if (netPnl > 5) result = 'Win';
    else if (netPnl < -5) result = 'Loss';

    const pnlPercentage = initialBalance > 0
      ? Number(((netPnl / initialBalance) * 100).toFixed(2))
      : 0;

    const session = determineSession(t.open_time || '', timezoneOffset);

    // MFE & MAE: Trích xuất High / Low hoặc mfe_price / mae_price do EA gửi về và tính toán chuẩn xác theo BUY / SELL
    const rawHigh = (t as any).high ?? (t as any).trade_high ?? (t as any).max_price ?? (t as any).highest_price;
    const rawLow = (t as any).low ?? (t as any).trade_low ?? (t as any).min_price ?? (t as any).lowest_price;
    const rawMfe = (t as any).mfe_price ?? (t as any).mfe;
    const rawMae = (t as any).mae_price ?? (t as any).mae;
    const mfeMae = calculateMfeMae(openPrice, initialSl, tradeType, rawHigh, rawLow, rawMfe, rawMae);

    // Xử lý checklist kỷ luật & lỗi tâm lý (hỗ trợ cả schema pre_checklist_ids/post_checklist_ids và checklist/mistake_tags)
    const preChecklistIds = parseChecklistArray(t.pre_checklist_ids ?? (t as any).checklist);
    const postChecklistIds = parseChecklistArray(t.post_checklist_ids ?? (t as any).mistake_tags);

    // Xử lý lost_profit từ database hoặc tự động tính nếu có plan_pnl
    const lostProfit = t.lost_profit !== undefined && t.lost_profit !== null
      ? Number(t.lost_profit)
      : (t.plan_pnl && t.plan_pnl > netPnl ? Number((t.plan_pnl - netPnl).toFixed(2)) : 0);

    const rawAccId = t.account_id ?? (t as any).account ?? (t as any).login ?? (t as any).mt5_account ?? (t as any).user_id;
    const accountId = rawAccId ? String(rawAccId).replace(/^acc-/, '').trim() : undefined;

    // Trích xuất hình ảnh lúc mở lệnh (Pre-Trade) và lúc đóng lệnh (Post-Trade / Close) với mọi tên cột alias
    // Box 2 (Post-trade): Ảnh đóng lệnh từ MT5 EA (image_base64, ltf_image_url, image_url_1, image_url...)
    const rawPostImg = (
      t.ltf_image_url ||
      t.image_base64 ||
      t.image_url_1 ||
      (t as any).close_image ||
      (t as any).image_close ||
      (t as any).close_image_url ||
      (t as any).close_chart ||
      (t as any).exit_image ||
      (t as any).exit_image_url ||
      (t as any).image_url_2 ||
      (t as any).post_image ||
      (t as any).chart_close ||
      (t as any).close_screenshot ||
      (t as any).screenshot_close ||
      (t as any).image_url ||
      ''
    );
    const postTradeImg = normalizeImageSource(rawPostImg);

    // Box 1 (Pre-trade / Plan): CHỈ lấy htf_image_url hoặc plan image do user tự dán/map
    // TUYỆT ĐỐI KHÔNG lấy image_url_1 hay screenshot đóng lệnh từ MT5!
    const rawPreCandidate = t.htf_image_url || (t as any).pre_image || '';
    const rawPreImg = (rawPreCandidate && rawPreCandidate !== rawPostImg) ? rawPreCandidate : '';
    const preTradeImg = normalizeImageSource(rawPreImg);

    return {
      id: t.id ? String(t.id) : `sb-${t.ticket || index}-${index}`,
      ticket: String(t.ticket || '000000'),
      position_id: String(t.position_id || t.ticket || '000000'),
      account_id: accountId,
      symbol,
      type: tradeType,
      volume,
      open_price: openPrice,
      close_price: closePrice,
      initial_sl: initialSl,
      pnl,
      commission,
      swap,
      // GIỮ NGUYÊN RAW TIMESTAMP TRONG SUPABASE, KHÔNG GHI ĐÈ OFFSET VÀO ĐÂY
      open_time: t.open_time || '',
      close_time: t.close_time || '',

      pip_sl: pipSl,
      risk_1r_usd: risk1rUsd,
      net_pnl: netPnl,
      weighted_rr: weightedRr,
      lost_profit: lostProfit,

      timeframe: (t.timeframe as any) || 'M15',
      session,
      image_url_1: postTradeImg,
      image_base64: postTradeImg,
      htf_image_url: preTradeImg,
      ltf_image_url: postTradeImg,
      pre_checklist_ids: preChecklistIds,
      post_checklist_ids: postChecklistIds,
      notes: t.notes || '',
      plan_id: t.plan_id || null,
      plan_name: t.plan_name,
      plan_pnl: t.plan_pnl,

      // MFE / MAE Data
      high: mfeMae.high,
      low: mfeMae.low,
      mfe_price: (t as any).mfe_price ?? (t as any).mfe ?? mfeMae.mfe_price,
      mae_price: (t as any).mae_price ?? (t as any).mae ?? mfeMae.mae_price,
      mfe_dist: mfeMae.mfe_dist,
      mae_dist: mfeMae.mae_dist,
      mfe_r: mfeMae.mfe_r ?? (t as any).mfe_r,
      mae_r: mfeMae.mae_r ?? (t as any).mae_r,

      status: 'CLOSED',
      sub_index: t.sub_index,
      tp1_r: t.tp1_r ?? 2.5,
      tp2_r: t.tp2_r ?? 0,
      tp3_r: t.tp3_r ?? 0,
      setup: t.setup || (Array.isArray(t.setups) ? t.setups[0] : undefined),
      setups: Array.isArray(t.setups) ? t.setups : (t.setup ? [t.setup] : []),
      result,
      pnl_percentage: pnlPercentage,
      running_balance: runningBalance,
      is_noise: volume <= NOISE_VOLUME_THRESHOLD,
      candles: (t as any).candles || undefined,
    };
  });

  // 3. ĐẢO NGƯỢC MẢNG (Reverse) để hiển thị lệnh mới nhất lên đầu tiên trên Bảng Lịch Sử
  return processedAscending.reverse();
}

// Alias for processSupabaseClosedTrades
export const processSupabaseTrades = processSupabaseClosedTrades;

/**
 * Tính toán các chỉ số phái sinh chuẩn xác cho từng TradeRow đơn lẻ
 */
export function computeTradeMetrics(
  raw: Partial<TradeRow>,
  contractSizes = DEFAULT_CONTRACT_SIZES,
  timezoneOffset = 0
): TradeRow {
  const symbol = raw.symbol || 'XAU/USD';
  const isGold = isGoldSymbol(symbol);
  const contractSize = contractSizes[symbol] || (isGold ? 100 : 100000);
  const volume = raw.volume || 0;
  const openPrice = raw.open_price || 0;
  const closePrice = raw.close_price || 0;
  const initialSl = raw.initial_sl || 0;
  const pnl = raw.pnl || 0;
  const commission = raw.commission || 0;
  const swap = raw.swap || 0;

  // 1. pip_sl chuẩn xác
  const pipSl = calculatePipSl(openPrice, initialSl, symbol);

  // 2. risk_1r_usd
  const risk1rUsd = calculateRisk1R(openPrice, initialSl, volume, contractSize, 100, symbol);

  // 3. net_pnl = pnl + commission + swap
  const netPnl = calculateNetPnl(pnl, commission, swap);

  // 4. weighted_rr = net_pnl / risk_1r_usd
  const weightedRr = calculateActualRR(netPnl, risk1rUsd);

  // 5. lost_profit = plan_pnl - net_pnl (Nếu có lỗi Cắt Non)
  const postChecklist = parseChecklistArray(raw.post_checklist_ids ?? (raw as any).mistake_tags);
  const isEarlyExit = postChecklist.includes('cut_early');
  let lostProfit = 0;
  if (isEarlyExit && raw.plan_pnl && raw.plan_pnl > netPnl) {
    lostProfit = Number((raw.plan_pnl - netPnl).toFixed(2));
  }

  // Session
  const session = raw.session || determineSession(raw.open_time || '', timezoneOffset);

  // MFE & MAE Calculation
  let tradeType = (raw.type || 'BUY').toUpperCase().includes('SELL') ? 'SELL' : 'BUY';
  if (openPrice > 0 && closePrice > 0 && Math.abs(openPrice - closePrice) > 0.05 && Math.abs(pnl) > 1) {
    if (closePrice > openPrice) {
      tradeType = pnl > 0 ? 'BUY' : 'SELL';
    } else if (closePrice < openPrice) {
      tradeType = pnl > 0 ? 'SELL' : 'BUY';
    }
  }
  const mfeMae = calculateMfeMae(openPrice, initialSl, tradeType as TradeType, raw.high, raw.low, raw.mfe_price, raw.mae_price);

  // Result
  let result: TradeResult = 'BE';
  if (netPnl > 5) result = 'Win';
  else if (netPnl < -5) result = 'Loss';

  const percentage = raw.pnl_percentage ?? (netPnl >= 0 ? Number(((netPnl / 10000) * 100).toFixed(2)) : -Number(((Math.abs(netPnl) / 10000) * 100).toFixed(2)));

  const preChecklist = parseChecklistArray(raw.pre_checklist_ids ?? (raw as any).checklist);

  return {
    id: raw.id || `trade-${Date.now()}-${Math.random()}`,
    ticket: raw.ticket || '000000',
    position_id: raw.position_id || raw.ticket || '000000',
    account_id: raw.account_id ? String(raw.account_id) : undefined,
    symbol,
    type: tradeType as TradeType,
    volume,
    open_price: openPrice,
    close_price: closePrice,
    initial_sl: initialSl,
    pnl,
    commission,
    swap,
    open_time: raw.open_time || '2026-05-30 02:41:00',
    close_time: raw.close_time || '2026-05-30 04:53:00',

    pip_sl: pipSl,
    risk_1r_usd: risk1rUsd,
    net_pnl: netPnl,
    weighted_rr: weightedRr,
    lost_profit: lostProfit,

    timeframe: raw.timeframe || 'M15',
    session,
    image_url_1: normalizeImageSource(
      raw.plan_id 
        ? (raw.image_url_1 || '') 
        : ((raw.htf_image_url && raw.htf_image_url !== (raw.image_base64 || raw.ltf_image_url || raw.image_url_1)) ? raw.htf_image_url : '')
    ),
    image_base64: normalizeImageSource(
      raw.image_base64 || raw.ltf_image_url || (raw as any).close_image || (raw as any).image_close || (raw as any).close_image_url || (raw as any).close_chart || (raw as any).exit_image || (raw as any).exit_image_url || (raw as any).image_url_2 || (raw as any).post_image || (raw as any).chart_close || (String(raw.status || '').toUpperCase() === 'CLOSED' ? (raw.image_url_1 || '') : '')
    ),
    htf_image_url: normalizeImageSource(
      raw.plan_id 
        ? (raw.image_url_1 || '') 
        : ((raw.htf_image_url && raw.htf_image_url !== (raw.image_base64 || raw.ltf_image_url || raw.image_url_1)) ? raw.htf_image_url : '')
    ),
    ltf_image_url: normalizeImageSource(
      raw.image_base64 || raw.ltf_image_url || (raw as any).close_image || (raw as any).image_close || (raw as any).close_image_url || (raw as any).close_chart || (raw as any).exit_image || (raw as any).exit_image_url || (raw as any).image_url_2 || (String(raw.status || '').toUpperCase() === 'CLOSED' ? (raw.image_url_1 || '') : '')
    ),
    pre_checklist_ids: preChecklist,
    post_checklist_ids: postChecklist,
    notes: raw.notes || '',
    plan_id: raw.plan_id || null,
    plan_name: raw.plan_name,
    plan_pnl: raw.plan_pnl,

    // MFE / MAE Data
    high: raw.high ?? mfeMae.high,
    low: raw.low ?? mfeMae.low,
    mfe_price: raw.mfe_price ?? mfeMae.mfe_price,
    mae_price: raw.mae_price ?? mfeMae.mae_price,
    mfe_dist: mfeMae.mfe_dist ?? raw.mfe_dist,
    mae_dist: mfeMae.mae_dist ?? raw.mae_dist,
    mfe_r: mfeMae.mfe_r ?? raw.mfe_r,
    mae_r: mfeMae.mae_r ?? raw.mae_r,

    status: raw.status || 'CLOSED',
    sub_index: raw.sub_index,
    tp1_r: raw.tp1_r ?? 2.5,
    tp2_r: raw.tp2_r ?? 0,
    tp3_r: raw.tp3_r ?? 0,
    setup: raw.setup || (raw.setups && raw.setups[0]),
    setups: raw.setups || (raw.setup ? [raw.setup] : []),
    result,
    pnl_percentage: percentage,
    running_balance: raw.running_balance,
    is_noise: volume <= NOISE_VOLUME_THRESHOLD,
    candles: raw.candles || undefined,
  };
}

/**
 * Gom cụm các dòng lệnh có cùng position_id thành 1 dòng master (Scaling 1.1, 1.2 / Cắt từng phần)
 * - Đảm bảo cộng dồn đầy đủ commission và swap của TẤT CẢ các deal con vào Net PnL tổng
 * - Đảm bảo tổng Risk 1R và R:R tính toán chính xác
 * - Đảm bảo thứ tự danh sách hiển thị là MỚI NHẤT lên đầu tiên (Descending by close_time / open_time)
 */
export function groupTradesByPosition(trades: TradeRow[]): TradeGroup[] {
  const groupsMap = new Map<string, TradeRow[]>();

  trades.forEach(t => {
    const key = t.position_id || t.ticket;
    if (!groupsMap.has(key)) {
      groupsMap.set(key, []);
    }
    groupsMap.get(key)!.push(t);
  });

  const groups: TradeGroup[] = [];

  groupsMap.forEach((rawSubTrades, posId) => {
    // Khử trùng lặp deal theo ticket trong cùng 1 vị thế (chống chồng lệnh MT5)
    const uniqueDealsMap = new Map<string, TradeRow>();
    rawSubTrades.forEach(st => {
      const tKey = String(st.ticket || st.id || '').trim();
      if (tKey && !uniqueDealsMap.has(tKey)) {
        uniqueDealsMap.set(tKey, st);
      } else if (!tKey) {
        uniqueDealsMap.set(`deal-${Math.random()}`, st);
      }
    });
    let subTrades = Array.from(uniqueDealsMap.values());

    // Nếu vị thế có nhiều hơn 1 deal, lọc bỏ các deal phantom không có PnL/volume hoặc close_time
    if (subTrades.length > 1) {
      const hasRealDeals = subTrades.some(st => (st.pnl !== null && st.pnl !== undefined && st.close_time));
      if (hasRealDeals) {
        subTrades = subTrades.filter(st => (st.pnl !== null && st.pnl !== undefined && Boolean(st.close_time)));
      }
    }

    // Sắp xếp subTrades tăng dần theo close_time / open_time (để 1.1 trước, 1.2 sau)
    subTrades.sort((a, b) => {
      if (a.sub_index && b.sub_index) {
        return a.sub_index.localeCompare(b.sub_index);
      }
      const timeA = new Date((a.close_time || a.open_time || '').replace(/-/g, '/')).getTime() || 0;
      const timeB = new Date((b.close_time || b.open_time || '').replace(/-/g, '/')).getTime() || 0;
      return timeA - timeB;
    });

    if (!subTrades || subTrades.length === 0) return;
    const master = subTrades[0];
    if (!master) return;
    const latestSubTrade = subTrades[subTrades.length - 1] || master;

    // Gán sub_index chính xác (1.1, 1.2...) nếu thực sự có nhiều lần cắt
    if (subTrades.length > 1) {
      subTrades.forEach((st, idx) => {
        st.sub_index = `1.${idx + 1}`;
      });
    }

    // Trích xuất ảnh đóng lệnh (post-trade close) và ảnh mở lệnh (pre-trade) từ bất kỳ lệnh con nào có ảnh
    const subTradePostImg = subTrades
      .map(s => s.image_base64 || s.ltf_image_url || (s as any).close_image || (s as any).image_close || (s as any).close_image_url || (s as any).image_url_2 || (String(s.status || '').toUpperCase() === 'CLOSED' ? s.image_url_1 : ''))
      .find(img => Boolean(img)) || master.image_base64 || master.ltf_image_url || '';

    const subTradePreImg = subTrades
      .map(s => (s.plan_id ? s.image_url_1 : '') || (s.htf_image_url && s.htf_image_url !== subTradePostImg ? s.htf_image_url : ''))
      .find(img => Boolean(img)) || (master.plan_id ? master.image_url_1 : '') || (master.htf_image_url && master.htf_image_url !== subTradePostImg ? master.htf_image_url : '') || '';

    master.image_base64 = subTradePostImg || master.image_base64 || '';
    master.ltf_image_url = subTradePostImg || master.ltf_image_url || '';
    master.image_url_1 = subTradePreImg || '';

    // Trích xuất mảng nến M5 candles từ bất kỳ deal con nào có nến
    const subTradeCandles = subTrades
      .map(s => s.candles)
      .find(c => c && (Array.isArray(c) ? c.length > 0 : String(c).length > 2)) || master.candles;
    if (subTradeCandles) {
      master.candles = subTradeCandles;
    }
    // Khởi tạo MFE/MAE tổng hợp từ các deal con chuẩn xác theo BUY / SELL
    const isBuy = master.type === 'BUY';
    const highs = subTrades.map(s => Number(s.high)).filter(h => !isNaN(h) && h > 0);
    const lows = subTrades.map(s => Number(s.low)).filter(l => !isNaN(l) && l > 0);
    const mfePrices = subTrades.map(s => Number(s.mfe_price)).filter(m => !isNaN(m) && m > 0);
    const maePrices = subTrades.map(s => Number(s.mae_price)).filter(m => !isNaN(m) && m > 0);
    const mfeRs = subTrades.map(s => Number(s.mfe_r)).filter(r => !isNaN(r) && r >= 0);
    const maeRs = subTrades.map(s => Number(s.mae_r)).filter(r => !isNaN(r) && r >= 0);
    const mfeDists = subTrades.map(s => Number(s.mfe_dist)).filter(d => !isNaN(d) && d > 0);
    const maeDists = subTrades.map(s => Number(s.mae_dist)).filter(d => !isNaN(d) && d > 0);

    const maxHigh = highs.length > 0 ? Math.max(...highs) : (master.high || null);
    const minLow = lows.length > 0 ? Math.min(...lows) : (master.low || null);

    // MFE Price: BUY lấy giá cao nhất, SELL lấy giá thấp nhất (lãi nhất)
    const bestMfePrice = mfePrices.length > 0
      ? (isBuy ? Math.max(...mfePrices) : Math.min(...mfePrices))
      : (master.mfe_price || null);

    // MAE Price: BUY lấy giá thấp nhất (drawdown nhất), SELL lấy giá cao nhất
    const worstMaePrice = maePrices.length > 0
      ? (isBuy ? Math.min(...maePrices) : Math.max(...maePrices))
      : (master.mae_price || null);

    const maxMfeR = mfeRs.length > 0 ? Math.max(...mfeRs) : (master.mfe_r || null);
    const maxMaeR = maeRs.length > 0 ? Math.max(...maeRs) : (master.mae_r || null);
    let bestMfeDist = mfeDists.length > 0 ? Math.max(...mfeDists) : (master.mfe_dist || null);
    let worstMaeDist = maeDists.length > 0 ? Math.max(...maeDists) : (master.mae_dist || null);

    if (bestMfePrice !== null && master.open_price > 0) {
      const calcDist = isBuy ? Math.max(0, bestMfePrice - master.open_price) : Math.max(0, master.open_price - bestMfePrice);
      if (bestMfeDist === null || calcDist > bestMfeDist) {
        bestMfeDist = Number(calcDist.toFixed(2));
      }
    }

    master.high = maxHigh;
    master.low = minLow;
    master.mfe_price = bestMfePrice;
    master.mae_price = worstMaePrice;
    master.mfe_dist = bestMfeDist;
    master.mae_dist = worstMaeDist;
    master.mfe_r = maxMfeR;
    master.mae_r = maxMaeR;

    // Chuẩn hóa initial_sl và risk_1r nếu subTrade kế thừa từ master
    subTrades.forEach(st => {
      if ((!st.initial_sl || st.initial_sl <= 0) && master.initial_sl > 0) {
        st.initial_sl = master.initial_sl;
        st.pip_sl = calculatePipSl(st.open_price, st.initial_sl, st.symbol);
        st.risk_1r_usd = calculateRisk1R(st.open_price, st.initial_sl, st.volume, 100, 100, st.symbol);
        st.weighted_rr = calculateActualRR(st.net_pnl, st.risk_1r_usd);
      }
      st.is_noise = isNoiseTrade(st);
    });

    const totalVolume = Number(subTrades.reduce((acc, curr) => acc + curr.volume, 0).toFixed(2));
    const totalGrossPnl = Number(subTrades.reduce((acc, curr) => acc + (curr.pnl || 0), 0).toFixed(2));
    const totalCommission = Number(subTrades.reduce((acc, curr) => acc + (curr.commission || 0), 0).toFixed(2));
    const totalSwap = Number(subTrades.reduce((acc, curr) => acc + (curr.swap || 0), 0).toFixed(2));

    // Đảm bảo Net PnL = pnl + commission + swap của TẤT CẢ các deal con được cộng dồn chuẩn xác
    const totalNetPnl = Number((totalGrossPnl + totalCommission + totalSwap).toFixed(2));
    
    // Risk 1R của toàn bộ vị thế: Chuẩn xác theo tổng volume ban đầu và khoảng cách SL gốc của master
    const totalRisk1r = master.initial_sl > 0 && master.open_price > 0 && totalVolume > 0
      ? calculateRisk1R(master.open_price, master.initial_sl, totalVolume, 100, 100, master.symbol)
      : Number(subTrades.reduce((acc, curr) => acc + (curr.risk_1r_usd || 0), 0).toFixed(2));

    // Giá vào trung bình có trọng số theo volume
    const weightedOpenPrice = totalVolume > 0
      ? Number((subTrades.reduce((acc, curr) => acc + (curr.open_price * curr.volume), 0) / totalVolume).toFixed(2))
      : master.open_price;

    // Giá đóng trung bình
    const weightedClosePrice = totalVolume > 0
      ? Number((subTrades.reduce((acc, curr) => acc + (curr.close_price * curr.volume), 0) / totalVolume).toFixed(2))
      : master.close_price;

    // R:R đạt được của toàn bộ vị thế = Tổng Net PnL / Tổng Risk 1R
    const combinedRr = totalRisk1r > 0 ? Number((totalNetPnl / totalRisk1r).toFixed(2)) : master.weighted_rr;

    let result: TradeResult = 'BE';
    if (totalNetPnl > 5) result = 'Win';
    else if (totalNetPnl < -5) result = 'Loss';

    // Tính % pnl gộp
    const pnlPercent = subTrades.reduce((acc, curr) => acc + (curr.pnl_percentage || 0), 0);

    const isGroupNoise = totalVolume <= NOISE_VOLUME_THRESHOLD;

    groups.push({
      position_id: posId,
      ticket: master.ticket,
      account_id: master.account_id,
      symbol: master.symbol,
      type: master.type,
      total_volume: totalVolume,
      avg_open_price: weightedOpenPrice,
      avg_close_price: weightedClosePrice,
      pip_sl: master.pip_sl,
      initial_sl: master.initial_sl,
      open_time: master.open_time,
      close_time: latestSubTrade.close_time || master.close_time,
      net_pnl: totalNetPnl,
      total_gross_pnl: totalGrossPnl,
      total_commission: totalCommission,
      total_swap: totalSwap,
      total_risk_1r: totalRisk1r,
      weighted_rr: combinedRr,
      pnl_percentage: Number(pnlPercent.toFixed(2)),
      result,
      session: master.session,
      // Running balance của vị thế gom cụm lấy từ lệnh đóng sau cùng
      running_balance: latestSubTrade.running_balance || master.running_balance || 0,
      is_noise: isGroupNoise,
      plan_id: master.plan_id || subTrades.find(s => s.plan_id)?.plan_id || null,
      plan_name: master.plan_name || subTrades.find(s => s.plan_name)?.plan_name,
      trades: subTrades,
      master_trade: master,
    });
  });

  // Đảm bảo các group hiển thị MỚI NHẤT lên đầu tiên (Descending by close_time / open_time)
  groups.sort((a, b) => {
    const timeA = new Date((a.close_time || a.open_time || '').replace(/-/g, '/')).getTime() || 0;
    const timeB = new Date((b.close_time || b.open_time || '').replace(/-/g, '/')).getTime() || 0;
    return timeB - timeA;
  });

  return groups;
}

/**
 * Tính Grade điểm số Pre-trade
 */
export function calculatePreTradeScore(
  selectedIds: string[],
  items: { id: string; points: number }[]
): { score: number; maxScore: number; percentage: number; grade: string; badgeClass: string } {
  const maxScore = items.reduce((sum, item) => sum + item.points, 0);
  const score = items
    .filter(item => selectedIds.includes(item.id))
    .reduce((sum, item) => sum + item.points, 0);

  const percentage = maxScore > 0 ? (score / maxScore) * 100 : 0;

  let grade = 'Grade F';
  let badgeClass = 'bg-rose-500/15 text-rose-400 border-rose-500/30';

  if (percentage >= 95) {
    grade = 'Grade A+';
    badgeClass = 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30';
  } else if (percentage >= 85) {
    grade = 'Grade A';
    badgeClass = 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30';
  } else if (percentage >= 70) {
    grade = 'Grade B';
    badgeClass = 'bg-blue-500/15 text-blue-400 border-blue-500/30';
  } else if (percentage >= 50) {
    grade = 'Grade C';
    badgeClass = 'bg-amber-500/15 text-amber-400 border-amber-500/30';
  }

  return { score, maxScore, percentage, grade, badgeClass };
}

/**
 * Format tiền tệ USD
 */
export function formatCurrency(val: number | null | undefined, withSign: boolean = true): string {
  const num = Number(val || 0);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(num));

  if (!withSign) return formatted;
  if (num > 0) return `+${formatted}`;
  if (num < 0) return `-${formatted}`;
  return formatted;
}

/**
 * Format thời lượng giữ lệnh (HH:mm)
 */
export function formatDuration(openStr: string, closeStr: string): string {
  try {
    const o = new Date((openStr || '').replace(/-/g, '/')).getTime();
    const c = new Date((closeStr || '').replace(/-/g, '/')).getTime();
    if (isNaN(o) || isNaN(c) || c < o) return '00:15';
    const diffMin = Math.floor((c - o) / (1000 * 60));
    const hours = Math.floor(diffMin / 60);
    const mins = diffMin % 60;
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  } catch {
    return '01:30';
  }
}

/**
 * ====================================================================
 * QUY ĐỔI MÚI GIỜ & HIỂN THỊ THỜI GIAN CHUẨN XÁC:
 * 1. Giữ nguyên gốc timestamp trong Supabase, chỉ tính toán offset ở tầng Render UI.
 * 2. Cộng/Trừ thêm số giờ từ Server Time Offset (offsetHours).
 * 3. Đảm bảo hiển thị đầy đủ cả Ngày và Giờ:Phút (ví dụ: 'MM-DD HH:mm')
 *    KHÔNG được cắt bỏ bớt phần giờ phút để tránh việc các lệnh cùng ngày bị trùng.
 * ====================================================================
 */
export function formatDateTimeWithOffset(
  rawTimeString: string,
  offsetHours: number = 0,
  formatStyle: 'MM-DD HH:mm' | 'YYYY-MM-DD HH:mm' | 'HH:mm' = 'MM-DD HH:mm'
): string {
  if (!rawTimeString || !rawTimeString.trim()) return '-';

  try {
    const cleanStr = rawTimeString.trim();
    let dateObj: Date;

    if (cleanStr.includes('T')) {
      dateObj = new Date(cleanStr);
    } else {
      dateObj = new Date(cleanStr.replace(/-/g, '/'));
    }

    if (isNaN(dateObj.getTime())) {
      const match = cleanStr.match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})[\sT](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/);
      if (match) {
        const y = parseInt(match[1], 10);
        const m = parseInt(match[2], 10) - 1;
        const d = parseInt(match[3], 10);
        const h = parseInt(match[4], 10);
        const min = parseInt(match[5], 10);
        const s = match[6] ? parseInt(match[6], 10) : 0;
        dateObj = new Date(y, m, d, h, min, s);
      } else {
        return rawTimeString;
      }
    }

    // Cộng thêm số giờ Offset từ Settings
    const shifted = new Date(dateObj.getTime() + offsetHours * 3600 * 1000);

    const year = shifted.getFullYear();
    const month = String(shifted.getMonth() + 1).padStart(2, '0');
    const day = String(shifted.getDate()).padStart(2, '0');
    const hours = String(shifted.getHours()).padStart(2, '0');
    const minutes = String(shifted.getMinutes()).padStart(2, '0');

    if (formatStyle === 'YYYY-MM-DD HH:mm') {
      return `${year}-${month}-${day} ${hours}:${minutes}`;
    }
    if (formatStyle === 'HH:mm') {
      return `${hours}:${minutes}`;
    }

    // Mặc định: 'MM-DD HH:mm' đầy đủ cả Ngày và Giờ:Phút
    return `${month}-${day} ${hours}:${minutes}`;
  } catch {
    return rawTimeString;
  }
}

/**
 * Backward-compatible helper with optional offsetHours
 */
export function formatDateTimeShort(dtStr: string, offsetHours: number = 0): string {
  return formatDateTimeWithOffset(dtStr, offsetHours, 'MM-DD HH:mm');
}


/**
 * Thống kê Thắng / Thua / Hòa theo VỊ THẾ (gộp cắt từng phần thành 1 lệnh).
 * Cùng công thức với Tab Tổng Quan và Tab Báo Cáo: Thắng khi Net > 0, Thua khi Net < 0,
 * Winrate = Số lệnh thắng / Tổng số vị thế đã đóng.
 */
export function computePositionWinStats(trades: TradeRow[], hideNoise: boolean) {
  const closed = trades.filter(t => (t.status || 'CLOSED').toUpperCase() === 'CLOSED');
  const groups = groupTradesByPosition(closed).filter(g => !hideNoise || !(
    g.is_noise || (g.total_volume != null && Number(g.total_volume) <= 0.01 && Number(g.total_volume) > 0)
  ));
  let wins = 0;
  let losses = 0;
  let breakeven = 0;
  groups.forEach(g => {
    const net = Number(g.net_pnl || 0);
    if (net > 0) wins++;
    else if (net < 0) losses++;
    else breakeven++;
  });
  const total = groups.length;
  return { wins, losses, breakeven, total, winRate: total > 0 ? (wins / total) * 100 : 0 };
}