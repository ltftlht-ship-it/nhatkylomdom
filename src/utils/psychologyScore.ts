import { TradeRow } from '../types';
import { toDisplayDate, getPeriodRange, filterTradesByRange } from './reportPeriods';

/**
 * ĐIỂM TÂM LÝ: mọi chỉ số tính 100% từ lệnh thật (đã gộp cắt từng phần thành 1 vị thế).
 * Ngưỡng là luật do Thầy đặt (chỉnh được), không phải số liệu giả định.
 * Chỉ số thiếu dữ liệu thì để trống (null), không lấp số.
 */

export interface PsySettings {
  revengeMinutes: number;   // Vào lệnh trong X phút sau lệnh thua = trả thù
  maxTradesPerDay: number;  // Số lệnh tối đa / ngày
  greedGapR: number;        // Đỉnh MFE − thực nhận ≥ X R = hụt ăn
  earlyExitMfeR: number;    // Cắt non: đỉnh MFE đã chạy ≥ X R
  earlyExitMaxR: number;    // ... nhưng chỉ chốt < X R
  slTolerancePct: number;   // Lỗ vượt 1R quá X% (trừ hao trượt giá) = không tôn trọng SL
}

export const DEFAULT_PSY_SETTINGS: PsySettings = {
  revengeMinutes: 15,
  maxTradesPerDay: 3,
  greedGapR: 1.5,
  earlyExitMfeR: 2,
  earlyExitMaxR: 1,
  slTolerancePct: 10,
};

const PSY_SETTINGS_KEY = 'bd_psychology_settings';

export function loadPsySettings(): PsySettings {
  try {
    const saved = JSON.parse(localStorage.getItem(PSY_SETTINGS_KEY) || '{}');
    return { ...DEFAULT_PSY_SETTINGS, ...saved };
  } catch {
    return DEFAULT_PSY_SETTINGS;
  }
}

export function savePsySettings(s: PsySettings) {
  try { localStorage.setItem(PSY_SETTINGS_KEY, JSON.stringify(s)); } catch {}
}

export interface PsyMetric {
  id: string;
  name: string;
  value: number | null;     // % (0-100) hoặc tỷ lệ lần (x)
  unit: '%' | 'x';
  score: number | null;     // 0-100, null = chưa đủ dữ liệu
  sample: number;           // số lệnh / ngày dùng để đo
  sampleUnit: 'lệnh' | 'ngày';
  total: number;            // tổng số vị thế trong kỳ
  offenders: TradeRow[];    // lệnh vi phạm (để bấm xem)
  note?: string;
  excluded?: boolean;       // không tính vào điểm tổng (mẫu nhỏ)
}

// Số lệnh / ngày tối thiểu để một chỉ số được tính vào điểm tổng
export const MIN_SAMPLE = 5;

export interface PsyResult {
  metrics: PsyMetric[];
  score: number | null;
  level: string;
}

const net = (t: TradeRow) => (t.net_pnl !== undefined ? t.net_pnl : (t.pnl || 0));

function riskOf(t: TradeRow): number {
  return Number(t.initial_sl) > 0 && Number(t.risk_1r_usd) > 0 ? Number(t.risk_1r_usd) : 0;
}

/** R thực nhận theo lãi/lỗ gộp (trước phí) để so cùng thước đo giá với MFE */
export function realizedR(t: TradeRow): number | null {
  const risk = riskOf(t);
  return risk > 0 ? (t.pnl || 0) / risk : null;
}

/** Đỉnh MFE quy ra R từ giá MFE thật do EA ghi */
export function mfeR(t: TradeRow): number | null {
  const open = Number(t.open_price);
  const sl = Number(t.initial_sl);
  const mfe = Number(t.mfe_price);
  if (!(open > 0 && sl > 0 && mfe > 0)) return null;
  if (Math.abs(mfe - open) >= open * 0.5) return null; // dữ liệu MFE lỗi
  const slDist = Math.abs(open - sl);
  if (slDist <= 0) return null;
  const isBuy = String(t.type || '').toUpperCase().startsWith('BUY');
  const fav = isBuy ? mfe - open : open - mfe;
  return Math.max(0, fav) / slDist;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const rateScore = (bad: number, sample: number) => (sample > 0 ? Math.round(100 - (bad / sample) * 100) : null);

export function psyLevel(score: number | null): string {
  if (score === null) return 'Chưa đủ dữ liệu';
  if (score >= 80) return 'Vững';
  if (score >= 60) return 'Cần chú ý';
  if (score >= 40) return 'Dao động';
  return 'Mất kiểm soát';
}

export function computePsychology(
  positions: TradeRow[],
  settings: PsySettings,
  offsetHours: number,
  plansCount: number
): PsyResult {
  const rows = positions
    .map(t => ({ t, o: toDisplayDate(t.open_time, offsetHours), c: toDisplayDate(t.close_time || t.open_time, offsetHours) }))
    .filter(r => r.o && r.c) as { t: TradeRow; o: Date; c: Date }[];
  rows.sort((a, b) => a.o.getTime() - b.o.getTime());
  const total = rows.length;
  const metrics: PsyMetric[] = [];
  const base = { total, offenders: [] as TradeRow[] };

  // 1. Trả thù: vào lệnh trong X phút sau khi một lệnh thua đóng
  {
    const winMs = settings.revengeMinutes * 60 * 1000;
    const losses = rows.filter(r => net(r.t) < 0);
    const offenders = rows.filter(r => losses.some(l => l !== r && r.o.getTime() - l.c.getTime() >= 0 && r.o.getTime() - l.c.getTime() <= winMs)).map(r => r.t);
    metrics.push({ ...base, id: 'revenge', name: 'Trả thù', unit: '%', sample: total, sampleUnit: 'lệnh',
      value: total ? (offenders.length / total) * 100 : null, score: rateScore(offenders.length, total), offenders });
  }

  // 2. Tăng lot sau thua: lệnh kế tiếp sau một lệnh thua có lot lớn hơn lệnh vừa thua
  {
    let sample = 0;
    const offenders: TradeRow[] = [];
    rows.forEach(l => {
      if (net(l.t) >= 0) return;
      const next = rows.find(r => r.o.getTime() >= l.c.getTime() && r !== l);
      if (!next) return;
      sample++;
      if ((next.t.volume || 0) > (l.t.volume || 0)) offenders.push(next.t);
    });
    metrics.push({ ...base, id: 'lot_after_loss', name: 'Tăng lot sau thua', unit: '%', sample, sampleUnit: 'lệnh',
      value: sample ? (offenders.length / sample) * 100 : null, score: rateScore(offenders.length, sample), offenders });
  }

  // 3 & 4. Theo ngày: đánh quá tay, thua 2 lệnh liền vẫn đánh
  const byDay = new Map<string, typeof rows>();
  rows.forEach(r => {
    const k = dayKey(r.o);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(r);
  });
  {
    let badDays = 0;
    const offenders: TradeRow[] = [];
    byDay.forEach(list => {
      if (list.length > settings.maxTradesPerDay) {
        badDays++;
        offenders.push(...list.slice(settings.maxTradesPerDay).map(r => r.t));
      }
    });
    const extraNet = offenders.reduce((s, t) => s + net(t), 0);
    metrics.push({ ...base, id: 'overtrade', name: 'Đánh quá tay', unit: '%', sample: byDay.size, sampleUnit: 'ngày',
      value: byDay.size ? (badDays / byDay.size) * 100 : null, score: rateScore(badDays, byDay.size), offenders,
      note: offenders.length ? `Lệnh vượt mức: ${offenders.length} lệnh, PnL ${extraNet >= 0 ? '+' : ''}${extraNet.toFixed(2)}$` : undefined });
  }
  {
    let streakDays = 0;
    let continuedDays = 0;
    const offenders: TradeRow[] = [];
    byDay.forEach(list => {
      const byClose = [...list].sort((a, b) => a.c.getTime() - b.c.getTime());
      for (let i = 1; i < byClose.length; i++) {
        if (net(byClose[i - 1].t) < 0 && net(byClose[i].t) < 0) {
          streakDays++;
          const after = list.filter(r => r.o.getTime() >= byClose[i].c.getTime());
          if (after.length) {
            continuedDays++;
            offenders.push(...after.map(r => r.t));
          }
          break;
        }
      }
    });
    const afterNet = offenders.reduce((s, t) => s + net(t), 0);
    metrics.push({ ...base, id: 'continue_after_losses', name: 'Thua 2 lệnh liền vẫn đánh', unit: '%', sample: streakDays, sampleUnit: 'ngày',
      value: streakDays ? (continuedDays / streakDays) * 100 : null, score: rateScore(continuedDays, streakDays), offenders,
      note: offenders.length ? `Lệnh đánh tiếp: ${offenders.length} lệnh, PnL ${afterNet >= 0 ? '+' : ''}${afterNet.toFixed(2)}$` : undefined });
  }

  // 5. Không đặt SL
  {
    const offenders = rows.filter(r => !(Number(r.t.initial_sl) > 0)).map(r => r.t);
    metrics.push({ ...base, id: 'no_sl', name: 'Không đặt SL', unit: '%', sample: total, sampleUnit: 'lệnh',
      value: total ? (offenders.length / total) * 100 : null, score: rateScore(offenders.length, total), offenders });
  }

  // 6. Không tôn trọng SL: lệnh lỗ vượt quá 1R (đã trừ hao trượt giá)
  {
    const losers = rows.filter(r => net(r.t) < 0 && riskOf(r.t) > 0);
    const offenders = losers.filter(r => -(r.t.pnl || 0) > riskOf(r.t) * (1 + settings.slTolerancePct / 100)).map(r => r.t);
    metrics.push({ ...base, id: 'sl_violation', name: 'Lỗ vượt 1R', unit: '%', sample: losers.length, sampleUnit: 'lệnh',
      value: losers.length ? (offenders.length / losers.length) * 100 : null, score: rateScore(offenders.length, losers.length), offenders });
  }

  // 7. Gồng lỗ: thời gian giữ lệnh thua ÷ thời gian giữ lệnh thắng
  {
    const dur = (r: { o: Date; c: Date }) => Math.max(0, r.c.getTime() - r.o.getTime());
    const w = rows.filter(r => net(r.t) > 0 && dur(r) > 0);
    const l = rows.filter(r => net(r.t) < 0 && dur(r) > 0);
    let value: number | null = null;
    let score: number | null = null;
    let offenders: TradeRow[] = [];
    if (w.length && l.length) {
      const avgW = w.reduce((s, r) => s + dur(r), 0) / w.length;
      const avgL = l.reduce((s, r) => s + dur(r), 0) / l.length;
      value = avgW > 0 ? avgL / avgW : null;
      if (value !== null) {
        score = Math.round(Math.min(100, 100 / Math.max(value, 0.0001)));
        offenders = l.filter(r => dur(r) > avgW).map(r => r.t);
      }
    }
    metrics.push({ ...base, id: 'hold_losers', name: 'Gồng lỗ', unit: 'x', sample: w.length + l.length, sampleUnit: 'lệnh',
      value, score, offenders });
  }

  // 8 & 9. Cần dữ liệu MFE thật từ EA
  const withMfe = rows.filter(r => mfeR(r.t) !== null && realizedR(r.t) !== null);
  {
    const offenders = withMfe.filter(r => (mfeR(r.t)! - realizedR(r.t)!) >= settings.greedGapR).map(r => r.t);
    metrics.push({ ...base, id: 'greed', name: 'Hụt ăn', unit: '%', sample: withMfe.length, sampleUnit: 'lệnh',
      value: withMfe.length ? (offenders.length / withMfe.length) * 100 : null, score: rateScore(offenders.length, withMfe.length), offenders });
  }
  {
    const winners = withMfe.filter(r => net(r.t) > 0);
    const offenders = winners.filter(r => realizedR(r.t)! < settings.earlyExitMaxR && mfeR(r.t)! >= settings.earlyExitMfeR).map(r => r.t);
    metrics.push({ ...base, id: 'early_exit', name: 'Cắt non', unit: '%', sample: winners.length, sampleUnit: 'lệnh',
      value: winners.length ? (offenders.length / winners.length) * 100 : null, score: rateScore(offenders.length, winners.length), offenders });
  }

  // 10. Tuân thủ Plan (chỉ tính khi Thầy đã dùng Tab Kế Hoạch)
  {
    const offenders = rows.filter(r => !r.t.plan_id).map(r => r.t);
    const active = plansCount > 0 && total > 0;
    metrics.push({ ...base, id: 'no_plan', name: 'Vào lệnh ngoài plan', unit: '%', sample: active ? total : 0, sampleUnit: 'lệnh',
      value: active ? (offenders.length / total) * 100 : null, score: active ? rateScore(offenders.length, total) : null,
      offenders: active ? offenders : [], note: active ? undefined : 'Chưa có plan nào' });
  }

  // Mẫu quá nhỏ thì vẫn hiện số nhưng không tính vào điểm tổng (tránh 1-2 lệnh kéo lệch điểm)
  metrics.forEach(m => {
    if (m.score !== null && m.sample < MIN_SAMPLE) {
      m.note = `Mẫu nhỏ (${m.sample} ${m.sampleUnit}), không tính vào điểm tổng`;
      m.excluded = true;
    }
  });
  const scored = metrics.filter(m => m.score !== null && !m.excluded);
  const score = scored.length ? Math.round(scored.reduce((s, m) => s + (m.score as number), 0) / scored.length) : null;
  return { metrics, score, level: psyLevel(score) };
}

export interface PeriodStats {
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  net: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number | null;
  avgR: number | null;
  rCount: number;
}

export function computePeriodStats(positions: TradeRow[]): PeriodStats {
  let wins = 0, losses = 0, gp = 0, gl = 0, sumR = 0, rCount = 0;
  positions.forEach(t => {
    const n = net(t);
    if (n > 0) { wins++; gp += n; } else if (n < 0) { losses++; gl += -n; }
    const risk = riskOf(t);
    if (risk > 0) { sumR += n / risk; rCount++; }
  });
  const count = positions.length;
  return {
    count, wins, losses,
    winRate: count ? (wins / count) * 100 : 0,
    net: gp - gl,
    grossProfit: gp,
    grossLoss: gl,
    profitFactor: gl > 0 ? gp / gl : (gp > 0 ? null : 0),
    avgR: rCount ? sumR / rCount : null,
    rCount,
  };
}

export function computePlanAdherence(positions: TradeRow[], checklistSize: number) {
  const withPlan = positions.filter(t => t.plan_id);
  const noPlan = positions.filter(t => !t.plan_id);
  const withChecklist = positions.filter(t => Array.isArray(t.pre_checklist_ids) && t.pre_checklist_ids.length > 0);
  const avgChecklist = checklistSize > 0 && withChecklist.length
    ? withChecklist.reduce((s, t) => s + Math.min(1, t.pre_checklist_ids.length / checklistSize), 0) / withChecklist.length * 100
    : null;
  return {
    withPlan: computePeriodStats(withPlan),
    noPlan: computePeriodStats(noPlan),
    pctWithPlan: positions.length ? (withPlan.length / positions.length) * 100 : 0,
    checklistCount: withChecklist.length,
    avgChecklist,
  };
}

/** Điểm tâm lý từng tuần (8 tuần gần nhất) để xem xu hướng */
export function computeWeeklyScores(
  allPositions: TradeRow[],
  settings: PsySettings,
  offsetHours: number,
  plansCount: number,
  weeks = 8
) {
  const out: { label: string; score: number | null; count: number }[] = [];
  for (let s = -(weeks - 1); s <= 0; s++) {
    const range = getPeriodRange('WEEK', s);
    const list = filterTradesByRange(allPositions, range, offsetHours);
    const res = computePsychology(list, settings, offsetHours, plansCount);
    const d = range.start!;
    out.push({ label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`, score: list.length ? res.score : null, count: list.length });
  }
  return out;
}

// ============================ LUẬT QUỸ (PROP FIRM) ============================

export interface PropRules {
  dailyLossPct: number | null;   // Lỗ tối đa trong ngày (% vốn ban đầu)
  maxDdPct: number | null;       // Lỗ tối đa toàn tài khoản (% vốn ban đầu)
  targetPct: number | null;      // Mục tiêu lợi nhuận (% vốn ban đầu)
  minDays: number | null;        // Số ngày giao dịch tối thiểu
  consistencyPct: number | null; // Ngày lãi lớn nhất không vượt quá X% tổng lãi
}

export const EMPTY_PROP_RULES: PropRules = { dailyLossPct: null, maxDdPct: null, targetPct: null, minDays: null, consistencyPct: null };

const propKey = (acc: string) => `bd_prop_rules_${acc}`;

export function loadPropRules(acc: string): PropRules {
  try {
    return { ...EMPTY_PROP_RULES, ...JSON.parse(localStorage.getItem(propKey(acc)) || '{}') };
  } catch {
    return EMPTY_PROP_RULES;
  }
}

export function savePropRules(acc: string, rules: PropRules) {
  try { localStorage.setItem(propKey(acc), JSON.stringify(rules)); } catch {}
}

export function computePropStatus(allPositions: TradeRow[], initialBalance: number, offsetHours: number, now: Date = new Date()) {
  const dayNet = new Map<string, number>();
  const sorted = [...allPositions]
    .map(t => ({ t, c: toDisplayDate(t.close_time || t.open_time, offsetHours) }))
    .filter(r => r.c) as { t: TradeRow; c: Date }[];
  sorted.sort((a, b) => a.c.getTime() - b.c.getTime());

  let balance = initialBalance;
  let lowest = initialBalance;
  sorted.forEach(r => {
    const n = net(r.t);
    balance += n;
    if (balance < lowest) lowest = balance;
    const k = dayKey(r.c);
    dayNet.set(k, (dayNet.get(k) || 0) + n);
  });

  const todayNet = dayNet.get(dayKey(now)) || 0;
  const days = Array.from(dayNet.values());
  const worstDay = days.length ? Math.min(...days) : 0;
  const bestDay = days.length ? Math.max(...days) : 0;
  const totalProfit = balance - initialBalance;
  return {
    balance,
    lowestBalance: lowest,
    todayNet,
    worstDay,
    bestDay,
    tradingDays: dayNet.size,
    totalProfit,
    bestDaySharePct: totalProfit > 0 && bestDay > 0 ? (bestDay / totalProfit) * 100 : null,
  };
}
