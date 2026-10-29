import { TradeRow } from '../types';
import { groupTradesByPosition, determineSession, NOISE_VOLUME_THRESHOLD } from './tradeCalculations';
import { toDisplayDate } from './reportPeriods';

/**
 * VỊ THẾ CHUẨN HÓA CHO TAB BÁO CÁO
 * Cắt từng phần (1.1, 1.2, 1.3...) vẫn là 1 vị thế; các lần cắt nằm trong `legs`.
 * Mọi con số của Tab Báo Cáo đều tính từ danh sách Position này.
 */

export interface PositionLeg {
  index: string;        // 1.1, 1.2...
  ticket: string;
  volume: number;
  closePrice: number;
  closeTime: Date | null;
  net: number;
  r: number | null;     // lãi/lỗ của lần cắt này tính theo R của cả vị thế
}

export interface Position {
  id: string;
  ticket: string;
  accountId: string;
  symbol: string;
  isBuy: boolean;
  volume: number;
  openPrice: number;
  closePrice: number;
  sl: number;              // SL ban đầu (0 = không đặt)
  openTime: Date;          // giờ hiển thị (đã bù múi giờ)
  closeTime: Date;
  durationMin: number;
  session: 'Á' | 'Âu' | 'Mỹ';
  net: number;             // lãi/lỗ ròng (gồm phí, swap)
  gross: number;           // lãi/lỗ trước phí
  fees: number;            // commission + swap
  risk: number;            // số $ của 1R (0 = không có SL)
  r: number | null;        // R thực nhận ròng
  grossR: number | null;   // R thực nhận trước phí (so cùng thước đo với MFE)
  mfeR: number | null;     // đỉnh lãi chạy được, theo R
  maeR: number | null;     // đáy lỗ phải gồng, theo R
  legs: PositionLeg[];
  isScaled: boolean;
  isNoise: boolean;
  planId: string | null;
  setup: string;
  timeframe: string;
  checklist: string[];
  mistakes: string[];
  raw: TradeRow;           // lệnh gốc để mở chi tiết
}

function excursionR(price: number | null | undefined, open: number, sl: number, isBuy: boolean, favorable: boolean): number | null {
  const p = Number(price);
  if (!(p > 0 && open > 0 && sl > 0)) return null;
  if (Math.abs(p - open) >= open * 0.5) return null; // dữ liệu giá lỗi
  const slDist = Math.abs(open - sl);
  if (slDist <= 0) return null;
  const move = isBuy ? p - open : open - p;
  return Math.max(0, favorable ? move : -move) / slDist;
}

/**
 * Giá trị $ của 1 đơn vị giá trên 1 lot, suy ra từ chính lãi/lỗ thật của các lần đóng lệnh
 * (đúng cho mọi mã: vàng, forex, chỉ số, crypto, kể cả quy đổi tiền tệ của sàn).
 */
function pointValuePerLot(legs: TradeRow[], openPrice: number): number | null {
  for (const s of legs) {
    const move = Math.abs((Number(s.close_price) || 0) - openPrice);
    const vol = Number(s.volume) || 0;
    if (move > openPrice * 1e-6 && vol > 0 && Number(s.pnl)) {
      return Math.abs(Number(s.pnl)) / (move * vol);
    }
  }
  return null;
}

const toArr = (v: any): string[] => (Array.isArray(v) ? v.map(String) : typeof v === 'string' && v ? [v] : []);

export function buildPositions(trades: TradeRow[], offsetHours: number, hideNoise: boolean): Position[] {
  const closed = trades.filter(t => (t.status || 'CLOSED').toUpperCase() === 'CLOSED');
  const groups = groupTradesByPosition(closed);
  const out: Position[] = [];

  groups.forEach(g => {
    const m = g.master_trade;
    const openTime = toDisplayDate(g.open_time, offsetHours);
    const closeTime = toDisplayDate(g.close_time || g.open_time, offsetHours);
    if (!openTime || !closeTime) return;
    const isNoise = g.total_volume > 0 && g.total_volume <= NOISE_VOLUME_THRESHOLD;
    if (hideNoise && isNoise) return;

    const isBuy = String(g.type || '').toUpperCase().startsWith('BUY');
    const sl = Number(g.initial_sl) > 0 ? Number(g.initial_sl) : 0;
    const gross = Number(g.total_gross_pnl ?? 0);
    const net = Number(g.net_pnl ?? 0);
    const openPrice = Number(m.open_price) || Number(g.avg_open_price) || 0;
    // 1R = khoảng cách SL × tổng lot × giá trị 1 giá/lot (lấy từ lệnh thật).
    // Lệnh đóng đúng giá vào (không suy ra được) thì dùng cách tính cũ theo mã.
    const pv = pointValuePerLot(g.trades || [], openPrice);
    const risk = sl > 0 && openPrice > 0
      ? (pv !== null ? Math.abs(openPrice - sl) * (Number(g.total_volume) || 0) * pv : Number(g.total_risk_1r) || 0)
      : 0;

    const legs: PositionLeg[] = (g.trades || []).map((s, i) => ({
      index: s.sub_index || `1.${i + 1}`,
      ticket: String(s.ticket),
      volume: Number(s.volume) || 0,
      closePrice: Number(s.close_price) || 0,
      closeTime: toDisplayDate(s.close_time, offsetHours),
      net: Number(s.net_pnl ?? 0),
      r: risk > 0 ? Number(s.net_pnl ?? 0) / risk : null,
    }));

    out.push({
      id: `${g.account_id || ''}|${g.position_id}`,
      ticket: String(g.ticket),
      accountId: String(g.account_id || ''),
      symbol: g.symbol,
      isBuy,
      volume: Number(g.total_volume) || 0,
      openPrice,
      closePrice: Number(g.avg_close_price) || 0,
      sl,
      openTime,
      closeTime,
      durationMin: Math.max(0, (closeTime.getTime() - openTime.getTime()) / 60000),
      session: determineSession(g.open_time, offsetHours),
      net,
      gross,
      fees: Number(g.total_commission ?? 0) + Number(g.total_swap ?? 0),
      risk,
      r: risk > 0 ? net / risk : null,
      grossR: risk > 0 ? gross / risk : null,
      mfeR: excursionR(m.mfe_price, openPrice, sl, isBuy, true),
      maeR: excursionR(m.mae_price, openPrice, sl, isBuy, false),
      legs,
      isScaled: legs.length > 1,
      isNoise,
      planId: g.plan_id || m.plan_id || null,
      setup: m.setup || (m.setups && m.setups[0]) || '',
      timeframe: m.timeframe || '',
      checklist: toArr(m.pre_checklist_ids),
      mistakes: toArr(m.post_checklist_ids),
      raw: m,
    });
  });

  out.sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());
  return out;
}
