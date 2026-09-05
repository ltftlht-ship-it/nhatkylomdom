import { TradeRow, TradeGroup, TradeResult, TradeSession } from '../types';
import { SupabaseTradeRow } from '../lib/supabase';

export const TIMEZONE_STORAGE_KEY = 'trade_journal_timezone_offset';

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
    let dateObj: Date;

    if (cleanStr.includes('T')) {
      dateObj = new Date(cleanStr);
    } else {
      dateObj = new Date(cleanStr.replace(/-/g, '/'));
    }

    let hour = 0;
    if (!isNaN(dateObj.getTime())) {
      hour = dateObj.getHours();
    } else {
      const parts = cleanStr.split(/[\s:]/);
      if (parts.length >= 4) {
        hour = parseInt(parts[parts.length - 2], 10) || 0;
      }
    }

    // Áp dụng offset từ MT5 Server sang Giờ địa phương
    const adjustedHour = (hour + timezoneOffsetHours + 24) % 24;

    // Phân loại phiên (Giờ VN UTC+7):
    // Phiên Á (Tokyo/Sydney): 06:00 - 14:00
    // Phiên Âu (London): 14:00 - 19:00
    // Phiên Mỹ (New York): 19:00 - 04:00 sáng hôm sau
    if (adjustedHour >= 6 && adjustedHour < 14) {
      return 'Á';
    } else if (adjustedHour >= 14 && adjustedHour < 19) {
      return 'Âu';
    } else {
      return 'Mỹ';
    }
  } catch {
    return 'Mỹ';
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

export function formatRR(rr: number): string {
  if (isNaN(rr) || !isFinite(rr)) return '0.00R';
  const sign = rr > 0 ? '+' : '';
  return `${sign}${rr.toFixed(2)}R`;
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
  // Lọc chỉ lấy các lệnh CLOSED (Loại bỏ PENDING_PLAN, OPEN, PENDING)
  const closedTradesOnly = rawTrades.filter(t => {
    const st = (t.status || 'CLOSED').toUpperCase().trim();
    return st === 'CLOSED';
  });

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
    const tradeType = typeStr.includes('SELL') ? 'SELL' : 'BUY';

    let result: TradeResult = 'BE';
    if (netPnl > 5) result = 'Win';
    else if (netPnl < -5) result = 'Loss';

    const pnlPercentage = initialBalance > 0
      ? Number(((netPnl / initialBalance) * 100).toFixed(2))
      : 0;

    const session = determineSession(t.open_time || '', timezoneOffset);

    return {
      id: t.id ? String(t.id) : `sb-${t.ticket || index}-${index}`,
      ticket: String(t.ticket || '000000'),
      position_id: String(t.position_id || t.ticket || '000000'),
      account_id: t.account_id ? String(t.account_id) : undefined,
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
      lost_profit: 0,

      timeframe: (t.timeframe as any) || 'M15',
      session,
      image_url_1: t.image_url_1 || t.htf_image_url || '',
      image_base64: t.image_base64 || t.ltf_image_url || '',
      htf_image_url: t.image_url_1 || t.htf_image_url || '',
      ltf_image_url: t.image_base64 || t.ltf_image_url || '',
      pre_checklist_ids: Array.isArray(t.pre_checklist_ids) ? t.pre_checklist_ids : [],
      post_checklist_ids: Array.isArray(t.post_checklist_ids) ? t.post_checklist_ids : [],
      notes: t.notes || '',
      plan_id: t.plan_id || null,
      plan_name: t.plan_name,
      plan_pnl: t.plan_pnl,

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
  const isEarlyExit = (raw.post_checklist_ids || []).includes('cut_early');
  let lostProfit = 0;
  if (isEarlyExit && raw.plan_pnl && raw.plan_pnl > netPnl) {
    lostProfit = Number((raw.plan_pnl - netPnl).toFixed(2));
  }

  // Session
  const session = raw.session || determineSession(raw.open_time || '', timezoneOffset);

  // Result
  let result: TradeResult = 'BE';
  if (netPnl > 5) result = 'Win';
  else if (netPnl < -5) result = 'Loss';

  const percentage = raw.pnl_percentage ?? (netPnl >= 0 ? Number(((netPnl / 10000) * 100).toFixed(2)) : -Number(((Math.abs(netPnl) / 10000) * 100).toFixed(2)));

  return {
    id: raw.id || `trade-${Date.now()}-${Math.random()}`,
    ticket: raw.ticket || '000000',
    position_id: raw.position_id || raw.ticket || '000000',
    account_id: raw.account_id ? String(raw.account_id) : undefined,
    symbol,
    type: raw.type || 'BUY',
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
    image_url_1: raw.image_url_1 || raw.htf_image_url || '',
    image_base64: raw.image_base64 || raw.ltf_image_url || '',
    htf_image_url: raw.image_url_1 || raw.htf_image_url || '',
    ltf_image_url: raw.image_base64 || raw.ltf_image_url || '',
    pre_checklist_ids: raw.pre_checklist_ids || [],
    post_checklist_ids: raw.post_checklist_ids || [],
    notes: raw.notes || '',
    plan_id: raw.plan_id || null,
    plan_name: raw.plan_name,
    plan_pnl: raw.plan_pnl,

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

  groupsMap.forEach((subTrades, posId) => {
    // Sắp xếp subTrades tăng dần theo open_time (để 1.1 trước, 1.2 sau)
    subTrades.sort((a, b) => {
      if (a.sub_index && b.sub_index) {
        return a.sub_index.localeCompare(b.sub_index);
      }
      const timeA = new Date((a.open_time || '').replace(/-/g, '/')).getTime() || 0;
      const timeB = new Date((b.open_time || '').replace(/-/g, '/')).getTime() || 0;
      return timeA - timeB;
    });

    const master = subTrades[0];
    const latestSubTrade = subTrades[subTrades.length - 1];

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
    const totalRisk1r = Number(subTrades.reduce((acc, curr) => acc + (curr.risk_1r_usd || 0), 0).toFixed(2));

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
): { score: number; maxScore: number; grade: string; badgeClass: string } {
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

  return { score, maxScore, grade, badgeClass };
}

/**
 * Format tiền tệ USD
 */
export function formatCurrency(val: number, withSign: boolean = true): string {
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(val));

  if (!withSign) return formatted;
  if (val > 0) return `+${formatted}`;
  if (val < 0) return `-${formatted}`;
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

