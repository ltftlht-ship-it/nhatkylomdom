import { Position } from './reportPositions';
import { getPeriodRange } from './reportPeriods';

/**
 * ĐIỂM TÂM LÝ: mọi chỉ số tính 100% từ vị thế thật (cắt từng phần = 1 vị thế).
 * Ngưỡng là luật do Thầy đặt (chỉnh được), không phải số liệu giả định.
 * Chỉ số thiếu dữ liệu để trống (null); mẫu nhỏ hơn MIN_SAMPLE không tính vào điểm tổng.
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

export const MIN_SAMPLE = 5;

const PSY_SETTINGS_KEY = 'bd_psychology_settings';

export function loadPsySettings(): PsySettings {
  try {
    return { ...DEFAULT_PSY_SETTINGS, ...JSON.parse(localStorage.getItem(PSY_SETTINGS_KEY) || '{}') };
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
  value: number | null;     // % (0-100) hoặc số lần (x)
  unit: '%' | 'x';
  score: number | null;     // 0-100, null = chưa đủ dữ liệu
  sample: number;
  sampleUnit: 'lệnh' | 'ngày';
  offenders: Position[];
  note?: string;
  excluded?: boolean;       // mẫu nhỏ, không tính điểm tổng
}

export interface PsyResult {
  metrics: PsyMetric[];
  score: number | null;
  level: string;
}

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
const rateScore = (bad: number, sample: number) => (sample > 0 ? Math.round(100 - (bad / sample) * 100) : null);
const rate = (bad: number, sample: number) => (sample > 0 ? (bad / sample) * 100 : null);
const sumNet = (list: Position[]) => list.reduce((s, p) => s + p.net, 0);
const money = (v: number) => `${v >= 0 ? '+' : '-'}$${Math.abs(v).toFixed(2)}`;

export function psyLevel(score: number | null): string {
  if (score === null) return 'Chưa đủ dữ liệu';
  if (score >= 80) return 'Vững';
  if (score >= 60) return 'Cần chú ý';
  if (score >= 40) return 'Dao động';
  return 'Mất kiểm soát';
}

export function computePsychology(positions: Position[], s: PsySettings, plansCount: number): PsyResult {
  const rows = [...positions].sort((a, b) => a.openTime.getTime() - b.openTime.getTime());
  const total = rows.length;
  const metrics: PsyMetric[] = [];
  const losses = rows.filter(p => p.net < 0);

  // 1. Trả thù: vào lệnh trong X phút sau khi một lệnh thua đóng
  {
    const win = s.revengeMinutes * 60000;
    const offenders = rows.filter(p => losses.some(l => l !== p && p.openTime.getTime() - l.closeTime.getTime() >= 0 && p.openTime.getTime() - l.closeTime.getTime() <= win));
    metrics.push({ id: 'revenge', name: 'Trả thù', unit: '%', sample: total, sampleUnit: 'lệnh', value: rate(offenders.length, total), score: rateScore(offenders.length, total), offenders });
  }

  // 2. Tăng lot sau thua: lệnh kế tiếp sau một lệnh thua có lot lớn hơn
  {
    let sample = 0;
    const offenders: Position[] = [];
    losses.forEach(l => {
      const next = rows.find(p => p !== l && p.openTime.getTime() >= l.closeTime.getTime());
      if (!next) return;
      sample++;
      if (next.volume > l.volume) offenders.push(next);
    });
    metrics.push({ id: 'lot_after_loss', name: 'Tăng lot sau thua', unit: '%', sample, sampleUnit: 'lệnh', value: rate(offenders.length, sample), score: rateScore(offenders.length, sample), offenders });
  }

  // 3 & 4. Theo ngày vào lệnh
  const byDay = new Map<string, Position[]>();
  rows.forEach(p => {
    const k = dayKey(p.openTime);
    if (!byDay.has(k)) byDay.set(k, []);
    byDay.get(k)!.push(p);
  });
  {
    let badDays = 0;
    const offenders: Position[] = [];
    byDay.forEach(list => {
      if (list.length > s.maxTradesPerDay) {
        badDays++;
        offenders.push(...list.slice(s.maxTradesPerDay));
      }
    });
    metrics.push({ id: 'overtrade', name: 'Đánh quá tay', unit: '%', sample: byDay.size, sampleUnit: 'ngày', value: rate(badDays, byDay.size), score: rateScore(badDays, byDay.size), offenders,
      note: offenders.length ? `Lệnh vượt mức: ${offenders.length} lệnh, PnL ${money(sumNet(offenders))}` : undefined });
  }
  {
    let streakDays = 0, continued = 0;
    const offenders: Position[] = [];
    byDay.forEach(list => {
      const byClose = [...list].sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());
      for (let i = 1; i < byClose.length; i++) {
        if (byClose[i - 1].net < 0 && byClose[i].net < 0) {
          streakDays++;
          const after = list.filter(p => p.openTime.getTime() >= byClose[i].closeTime.getTime());
          if (after.length) { continued++; offenders.push(...after); }
          break;
        }
      }
    });
    metrics.push({ id: 'continue_after_losses', name: 'Thua 2 lệnh liền vẫn đánh', unit: '%', sample: streakDays, sampleUnit: 'ngày', value: rate(continued, streakDays), score: rateScore(continued, streakDays), offenders,
      note: offenders.length ? `Lệnh đánh tiếp: ${offenders.length} lệnh, PnL ${money(sumNet(offenders))}` : undefined });
  }

  // 5. Không đặt SL
  {
    const offenders = rows.filter(p => !(p.sl > 0));
    metrics.push({ id: 'no_sl', name: 'Không đặt SL', unit: '%', sample: total, sampleUnit: 'lệnh', value: rate(offenders.length, total), score: rateScore(offenders.length, total), offenders });
  }

  // 6. Lỗ vượt 1R (SL bị dời / xóa / không tôn trọng)
  {
    const withSl = losses.filter(p => p.risk > 0);
    const offenders = withSl.filter(p => -p.gross > p.risk * (1 + s.slTolerancePct / 100));
    metrics.push({ id: 'sl_violation', name: 'Lỗ vượt 1R', unit: '%', sample: withSl.length, sampleUnit: 'lệnh', value: rate(offenders.length, withSl.length), score: rateScore(offenders.length, withSl.length), offenders,
      note: offenders.length ? `Lỗ thêm ngoài 1R: ${money(offenders.reduce((t, p) => t + (p.gross + p.risk), 0))}` : undefined });
  }

  // 7. Gồng lỗ: thời gian giữ lệnh thua ÷ thời gian giữ lệnh thắng
  {
    const w = rows.filter(p => p.net > 0 && p.durationMin > 0);
    const l = rows.filter(p => p.net < 0 && p.durationMin > 0);
    let value: number | null = null, score: number | null = null, offenders: Position[] = [];
    if (w.length && l.length) {
      const avgW = w.reduce((t, p) => t + p.durationMin, 0) / w.length;
      const avgL = l.reduce((t, p) => t + p.durationMin, 0) / l.length;
      if (avgW > 0) {
        value = avgL / avgW;
        score = Math.round(Math.min(100, 100 / Math.max(value, 0.0001)));
        offenders = l.filter(p => p.durationMin > avgW);
      }
    }
    metrics.push({ id: 'hold_losers', name: 'Gồng lỗ', unit: 'x', sample: w.length + l.length, sampleUnit: 'lệnh', value, score, offenders });
  }

  // 8 & 9. Cần MFE thật do EA ghi
  const withMfe = rows.filter(p => p.mfeR !== null && p.grossR !== null);
  {
    const offenders = withMfe.filter(p => p.mfeR! - p.grossR! >= s.greedGapR);
    metrics.push({ id: 'greed', name: 'Hụt ăn', unit: '%', sample: withMfe.length, sampleUnit: 'lệnh', value: rate(offenders.length, withMfe.length), score: rateScore(offenders.length, withMfe.length), offenders });
  }
  {
    const winners = withMfe.filter(p => p.net > 0);
    const offenders = winners.filter(p => p.grossR! < s.earlyExitMaxR && p.mfeR! >= s.earlyExitMfeR);
    metrics.push({ id: 'early_exit', name: 'Cắt non', unit: '%', sample: winners.length, sampleUnit: 'lệnh', value: rate(offenders.length, winners.length), score: rateScore(offenders.length, winners.length), offenders });
  }

  // 10. Vào lệnh ngoài plan (chỉ tính khi đã dùng Tab Kế Hoạch)
  {
    const active = plansCount > 0 && total > 0;
    const offenders = active ? rows.filter(p => !p.planId) : [];
    metrics.push({ id: 'no_plan', name: 'Vào lệnh ngoài plan', unit: '%', sample: active ? total : 0, sampleUnit: 'lệnh',
      value: active ? rate(offenders.length, total) : null, score: active ? rateScore(offenders.length, total) : null, offenders,
      note: active ? undefined : 'Chưa có plan nào' });
  }

  metrics.forEach(m => {
    if (m.score !== null && m.sample < MIN_SAMPLE) {
      m.excluded = true;
      m.note = `Mẫu nhỏ (${m.sample} ${m.sampleUnit}), không tính điểm tổng`;
    }
  });
  const scored = metrics.filter(m => m.score !== null && !m.excluded);
  const score = scored.length ? Math.round(scored.reduce((t, m) => t + (m.score as number), 0) / scored.length) : null;
  return { metrics, score, level: psyLevel(score) };
}

/** Điểm tâm lý từng tuần (theo giờ đóng lệnh) để xem xu hướng */
export function computeWeeklyScores(all: Position[], s: PsySettings, plansCount: number, weeks = 8) {
  const out: { label: string; score: number | null; count: number }[] = [];
  for (let step = -(weeks - 1); step <= 0; step++) {
    const r = getPeriodRange('WEEK', step);
    const list = all.filter(p => p.closeTime >= r.start! && p.closeTime < r.end!);
    const d = r.start!;
    out.push({
      label: `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`,
      score: list.length ? computePsychology(list, s, plansCount).score : null,
      count: list.length,
    });
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

export function computePropStatus(all: Position[], initialBalance: number, now: Date = new Date()) {
  const sorted = [...all].sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());
  const dayNet = new Map<string, number>();
  let balance = initialBalance;
  let lowest = initialBalance;
  sorted.forEach(p => {
    balance += p.net;
    lowest = Math.min(lowest, balance);
    const k = dayKey(p.closeTime);
    dayNet.set(k, (dayNet.get(k) || 0) + p.net);
  });
  const days = Array.from(dayNet.values());
  const bestDay = days.length ? Math.max(...days) : 0;
  const totalProfit = balance - initialBalance;
  return {
    balance,
    lowestBalance: lowest,
    todayNet: dayNet.get(dayKey(now)) || 0,
    worstDay: days.length ? Math.min(...days) : 0,
    bestDay,
    tradingDays: dayNet.size,
    totalProfit,
    bestDaySharePct: totalProfit > 0 && bestDay > 0 ? (bestDay / totalProfit) * 100 : null,
  };
}
