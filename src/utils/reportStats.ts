import { Position } from './reportPositions';

/**
 * THỐNG KÊ TAB BÁO CÁO: một chỗ tính duy nhất, 100% từ vị thế thật.
 * Thắng khi Net > 0, Thua khi Net < 0, Hòa khi Net = 0. Winrate = Thắng / Tổng vị thế.
 */

export interface Summary {
  count: number;
  wins: number;
  losses: number;
  be: number;
  winRate: number;          // %
  net: number;
  grossProfit: number;
  grossLoss: number;        // số dương
  profitFactor: number | null; // null = không có lệnh thua
  avgWin: number;
  avgLoss: number;          // số dương
  payoff: number | null;    // Lãi TB / Lỗ TB
  expectancy: number;       // $ kỳ vọng mỗi lệnh = Net / số lệnh
  avgR: number | null;      // R TB trên các lệnh có SL
  totalR: number;
  rCount: number;           // số lệnh có SL (đo được R)
  fees: number;
  maxWinStreak: number;
  maxLossStreak: number;
  best: Position | null;
  worst: Position | null;
}

export function summarize(list: Position[]): Summary {
  let wins = 0, losses = 0, be = 0, gp = 0, gl = 0, totalR = 0, rCount = 0, fees = 0;
  let streakW = 0, streakL = 0, maxW = 0, maxL = 0;
  let best: Position | null = null, worst: Position | null = null;
  const sorted = [...list].sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());
  sorted.forEach(p => {
    if (p.net > 0) { wins++; gp += p.net; streakW++; streakL = 0; }
    else if (p.net < 0) { losses++; gl += -p.net; streakL++; streakW = 0; }
    else { be++; }
    maxW = Math.max(maxW, streakW);
    maxL = Math.max(maxL, streakL);
    if (p.r !== null) { totalR += p.r; rCount++; }
    fees += p.fees;
    if (!best || p.net > best.net) best = p;
    if (!worst || p.net < worst.net) worst = p;
  });
  const count = list.length;
  const avgWin = wins ? gp / wins : 0;
  const avgLoss = losses ? gl / losses : 0;
  return {
    count, wins, losses, be,
    winRate: count ? (wins / count) * 100 : 0,
    net: gp - gl,
    grossProfit: gp,
    grossLoss: gl,
    profitFactor: gl > 0 ? gp / gl : null,
    avgWin, avgLoss,
    payoff: avgLoss > 0 ? avgWin / avgLoss : null,
    expectancy: count ? (gp - gl) / count : 0,
    avgR: rCount ? totalR / rCount : null,
    totalR, rCount, fees,
    maxWinStreak: maxW,
    maxLossStreak: maxL,
    best, worst,
  };
}

export interface EquityPoint {
  i: number;
  label: string;
  balance: number;
  drawdown: number;      // $ đang dưới đỉnh (số âm hoặc 0)
}

export function equityCurve(list: Position[], initialBalance: number) {
  const sorted = [...list].sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());
  let bal = initialBalance;
  let peak = initialBalance;
  let maxDd = 0;
  let maxDdPctOfPeak = 0;
  const points: EquityPoint[] = [{ i: 0, label: 'Bắt đầu', balance: bal, drawdown: 0 }];
  sorted.forEach((p, idx) => {
    bal += p.net;
    peak = Math.max(peak, bal);
    const dd = bal - peak;
    if (-dd > maxDd) maxDd = -dd;
    if (peak > 0) maxDdPctOfPeak = Math.max(maxDdPctOfPeak, (-dd / peak) * 100);
    const d = p.closeTime;
    points.push({ i: idx + 1, label: `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`, balance: round2(bal), drawdown: round2(dd) });
  });
  return { points, endBalance: bal, maxDrawdown: maxDd, maxDrawdownPct: maxDdPctOfPeak };
}

export interface GroupRow extends Summary { key: string; label: string }

export function groupBy(list: Position[], keyFn: (p: Position) => string, labelFn: (k: string) => string = k => k, order?: string[]): GroupRow[] {
  const map = new Map<string, Position[]>();
  list.forEach(p => {
    const k = keyFn(p);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(p);
  });
  const keys = order ? order.filter(k => map.has(k)) : Array.from(map.keys());
  const rows = keys.map(k => ({ key: k, label: labelFn(k), ...summarize(map.get(k)!) }));
  return order ? rows : rows.sort((a, b) => b.count - a.count);
}

export const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
export const weekdayIndex = (d: Date) => (d.getDay() + 6) % 7;

/** Lưới 7 ngày × 24 giờ theo giờ vào lệnh (giờ hiển thị) */
export function hourWeekHeatmap(list: Position[]) {
  const cells = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => ({ count: 0, net: 0, wins: 0 })));
  list.forEach(p => {
    const c = cells[weekdayIndex(p.openTime)][p.openTime.getHours()];
    c.count++;
    c.net += p.net;
    if (p.net > 0) c.wins++;
  });
  const maxAbs = Math.max(1, ...cells.flat().map(c => Math.abs(c.net)));
  return { cells, maxAbs };
}

/** Lãi/lỗ theo ngày đóng lệnh */
export function dailyNet(list: Position[]) {
  const map = new Map<string, { date: Date; net: number; count: number }>();
  list.forEach(p => {
    const d = p.closeTime;
    const k = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const cur = map.get(k) || { date: new Date(d.getFullYear(), d.getMonth(), d.getDate()), net: 0, count: 0 };
    cur.net += p.net;
    cur.count++;
    map.set(k, cur);
  });
  return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1)).map(([key, v]) => ({ key, ...v }));
}

// ============================ MFE / MAE ============================

const BUCKETS: [number, number, string][] = [[0, 0.5, '<0.5R'], [0.5, 1, '0.5–1R'], [1, 2, '1–2R'], [2, 3, '2–3R'], [3, Infinity, '≥3R']];

function bucketize(values: number[]) {
  return BUCKETS.map(([lo, hi, label]) => ({ label, count: values.filter(v => v >= lo && v < hi).length }));
}

export function mfeMaeStats(list: Position[]) {
  const withMfe = list.filter(p => p.mfeR !== null && p.grossR !== null);
  const winners = withMfe.filter(p => p.net > 0);
  const losers = withMfe.filter(p => p.net < 0);
  const withMae = list.filter(p => p.maeR !== null && p.net > 0);
  const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
  // Phần lãi để tuột mất ở lệnh thắng: (đỉnh MFE − thực nhận) × 1R
  const leftOnTable = winners.reduce((s, p) => s + Math.max(0, (p.mfeR! - p.grossR!) * p.risk), 0);
  return {
    sample: withMfe.length,
    total: list.length,
    avgMfeWinners: avg(winners.map(p => p.mfeR!)),
    avgMfeLosers: avg(losers.map(p => p.mfeR!)),
    avgCaptureWinners: avg(winners.filter(p => p.mfeR! > 0).map(p => Math.min(1, p.grossR! / p.mfeR!) * 100)),
    avgMaeWinners: avg(withMae.map(p => p.maeR!)),
    losersThatWereInProfit1R: losers.filter(p => p.mfeR! >= 1).length,
    losersCount: losers.length,
    leftOnTable,
    mfeBuckets: bucketize(withMfe.map(p => p.mfeR!)),
    maeWinnerBuckets: bucketize(withMae.map(p => p.maeR!)),
    maeSample: withMae.length,
  };
}

// ============================ CẮT TỪNG PHẦN ============================

export function partialStats(list: Position[]) {
  const scaled = list.filter(p => p.isScaled);
  const single = list.filter(p => !p.isScaled);
  const maxLegs = scaled.reduce((m, p) => Math.max(m, p.legs.length), 0);
  const byLeg = Array.from({ length: maxLegs }, (_, i) => {
    const legs = scaled.map(p => p.legs[i]).filter(Boolean);
    const withR = legs.filter(l => l.r !== null);
    return {
      index: `Lần cắt ${i + 1}`,
      count: legs.length,
      net: legs.reduce((s, l) => s + l.net, 0),
      avgR: withR.length ? withR.reduce((s, l) => s + (l.r as number), 0) / withR.length : null,
      wins: legs.filter(l => l.net > 0).length,
    };
  });
  return {
    scaled: summarize(scaled),
    single: summarize(single),
    scaledPct: list.length ? (scaled.length / list.length) * 100 : 0,
    avgLegs: scaled.length ? scaled.reduce((s, p) => s + p.legs.length, 0) / scaled.length : 0,
    byLeg,
  };
}

// ============================ GIẢ LẬP WHAT-IF ============================

export interface WhatIfResult {
  id: string;
  name: string;
  actual: number;
  simulated: number;
  affected: number;   // số lệnh bị thay đổi kết quả
  sample: number;     // số lệnh đủ dữ liệu để giả lập
}

/** Tôn trọng SL: mọi lệnh lỗ có SL bị giới hạn ở −1R (cộng phí thực tế) */
export function whatIfRespectSl(list: Position[]): WhatIfResult {
  let sim = 0, affected = 0, sample = 0;
  list.forEach(p => {
    if (p.risk > 0 && p.gross < -p.risk) {
      sim += -p.risk + p.fees;
      affected++;
    } else sim += p.net;
    if (p.risk > 0) sample++;
  });
  return { id: 'respect_sl', name: 'Tôn trọng SL (lỗ tối đa 1R)', actual: sumNet(list), simulated: sim, affected, sample };
}

/** Chốt cố định X R: lệnh có MFE ≥ X thì chốt đúng X R; còn lại giữ kết quả thật */
export function whatIfFixedTp(list: Position[], targetR: number): WhatIfResult {
  let sim = 0, affected = 0, sample = 0;
  list.forEach(p => {
    if (p.mfeR !== null && p.risk > 0) {
      sample++;
      if (p.mfeR >= targetR) {
        sim += targetR * p.risk + p.fees;
        affected++;
        return;
      }
    }
    sim += p.net;
  });
  return { id: 'fixed_tp', name: `Chốt cố định ${targetR}R`, actual: sumNet(list), simulated: sim, affected, sample };
}

/** Bỏ các lệnh chỉ định (vd lệnh vi phạm tâm lý, lệnh ngoài plan) */
export function whatIfExclude(list: Position[], excludeIds: Set<string>, id: string, name: string): WhatIfResult {
  const kept = list.filter(p => !excludeIds.has(p.id));
  return { id, name, actual: sumNet(list), simulated: sumNet(kept), affected: list.length - kept.length, sample: list.length };
}

// ============================ TIỆN ÍCH ============================

export const sumNet = (list: Position[]) => list.reduce((s, p) => s + p.net, 0);
const pad = (n: number) => String(n).padStart(2, '0');
const round2 = (n: number) => Math.round(n * 100) / 100;

export function fmtMoney(v: number) {
  return `${v >= 0 ? '+' : '-'}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
export function fmtR(v: number | null) {
  return v === null ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`;
}
export function fmtDuration(min: number) {
  if (min < 60) return `${Math.round(min)} phút`;
  if (min < 60 * 24) return `${(min / 60).toFixed(1)} giờ`;
  return `${(min / 1440).toFixed(1)} ngày`;
}
