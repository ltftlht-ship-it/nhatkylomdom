import { Position } from './reportPositions';
import { summarize, equityCurve, fmtMoney, fmtR } from './reportStats';
import { computePsychology, computePropStatus, PsySettings, PropRules } from './psychologyScore';
import { PeriodKind, getPeriodRange, toDisplayDate } from './reportPeriods';

/**
 * NỘI DUNG THÔNG BÁO (Telegram / email): dùng đúng bộ công thức của Tab Báo Cáo.
 * Trả về văn bản HTML đơn giản (<b>, <i>) dùng chung cho Telegram và email.
 */

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const pct = (v: number) => `${v.toFixed(1)}%`;

function deltaText(cur: number | null, prev: number | null, fmt: (v: number) => string) {
  if (cur === null || prev === null) return '';
  const d = cur - prev;
  if (Math.abs(d) < 1e-9) return ' (= kỳ trước)';
  return ` (${d > 0 ? '▲' : '▼'} ${fmt(Math.abs(d))} so với kỳ trước)`;
}

const KIND_LABEL: Record<string, string> = { WEEK: 'TUẦN', MONTH: 'THÁNG', QUARTER: 'QUÝ' };

export interface PeriodReportInput {
  accountLabel: string;
  all: Position[];
  kind: Exclude<PeriodKind, 'ALL' | 'CUSTOM'>;
  now: Date;                 // giờ hiển thị (đã bù múi giờ) lúc gửi
  psy: PsySettings;
  prop: PropRules;
  initialBalance: number;
  plansCount: number;
}

/** Báo cáo kỳ vừa kết thúc (tuần / tháng / quý trước), so với kỳ liền trước nữa */
export function buildPeriodReport(i: PeriodReportInput): string | null {
  const range = getPeriodRange(i.kind, -1, i.now);
  const prevRange = getPeriodRange(i.kind, -2, i.now);
  const inR = (p: Position, r: typeof range) => p.closeTime >= r.start! && p.closeTime < r.end!;
  const list = i.all.filter(p => inR(p, range));
  const prevList = i.all.filter(p => inR(p, prevRange));
  if (!list.length) return null;

  const s = summarize(list);
  const ps = prevList.length ? summarize(prevList) : null;
  const psy = computePsychology(list, i.psy, i.plansCount);
  const psyPrev = prevList.length ? computePsychology(prevList, i.psy, i.plansCount) : null;
  const startBal = i.initialBalance + i.all.filter(p => p.closeTime < range.start!).reduce((t, p) => t + p.net, 0);
  const eq = equityCurve(list, startBal);

  const lines: string[] = [];
  lines.push(`<b>BÁO CÁO ${KIND_LABEL[i.kind]} · ${esc(range.label)}</b>`);
  lines.push(esc(i.accountLabel));
  lines.push('');
  lines.push(`PnL: <b>${fmtMoney(s.net)}</b>${deltaText(s.net, ps?.net ?? null, v => `$${v.toFixed(2)}`)}`);
  lines.push(`Lệnh: ${s.count} · Thắng ${s.wins} · Thua ${s.losses} · Win Rate ${pct(s.winRate)}${deltaText(s.winRate, ps ? ps.winRate : null, pct)}`);
  lines.push(`Profit Factor: ${s.profitFactor === null ? '—' : s.profitFactor.toFixed(2)} · R TB: ${fmtR(s.avgR)} · Tổng R: ${s.rCount ? fmtR(s.totalR) : '—'}`);
  lines.push(`Sụt giảm lớn nhất: -$${eq.maxDrawdown.toFixed(2)} · Chuỗi thua dài nhất: ${s.maxLossStreak}`);
  lines.push('');
  lines.push(`<b>Điểm Tâm Lý: ${psy.score ?? '—'} (${psy.level})</b>${deltaText(psy.score, psyPrev?.score ?? null, v => `${v} điểm`)}`);
  const bad = psy.metrics
    .filter(m => !m.excluded && m.score !== null && m.score < 80 && m.offenders.length)
    .sort((a, b) => (a.score as number) - (b.score as number))
    .slice(0, 4);
  bad.forEach(m => {
    const v = m.value === null ? '' : m.unit === '%' ? pct(m.value) : `${m.value.toFixed(2)}x`;
    lines.push(`• ${m.name}: ${v} (${m.offenders.length} lệnh)${m.note ? ` · ${esc(m.note)}` : ''}`);
  });
  if (!bad.length) lines.push('• Không có chỉ số tâm lý nào dưới 80');

  const st = computePropStatus(i.all, i.initialBalance, i.now);
  if (i.prop.maxDdPct !== null || i.prop.targetPct !== null) {
    lines.push('');
    lines.push('<b>Luật quỹ</b>');
    if (i.prop.maxDdPct !== null) {
      const floor = i.initialBalance * (1 - i.prop.maxDdPct / 100);
      lines.push(`Số dư $${st.balance.toFixed(2)} · cách đáy cho phép $${(st.balance - floor).toFixed(2)}`);
    }
    if (i.prop.targetPct !== null && i.initialBalance > 0) {
      lines.push(`Lợi nhuận ${pct(st.totalProfit / i.initialBalance * 100)} / mục tiêu ${i.prop.targetPct}%`);
    }
  }
  return lines.join('\n');
}

export interface AlertInput {
  accountLabel: string;
  all: Position[];                 // vị thế đã đóng (giờ hiển thị)
  event: 'OPEN' | 'CLOSED';
  trade: { ticket: string; symbol: string; type: string; volume: number; open_time: string; position_id?: string | null };
  offsetHours: number;
  psy: PsySettings;
  prop: PropRules;
  initialBalance: number;
}

const sameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

/** Cảnh báo tức thì khi EA gửi lệnh mới vào / lệnh vừa đóng. Trả về danh sách câu cảnh báo (rỗng = không có gì) */
export function buildAlerts(i: AlertInput): string[] {
  const out: string[] = [];
  const sorted = [...i.all].sort((a, b) => a.closeTime.getTime() - b.closeTime.getTime());

  if (i.event === 'OPEN') {
    const openAt = toDisplayDate(i.trade.open_time, i.offsetHours);
    if (!openAt) return out;
    const before = sorted.filter(p => p.closeTime.getTime() <= openAt.getTime());
    const last = before[before.length - 1];
    if (last && last.net < 0) {
      const mins = (openAt.getTime() - last.closeTime.getTime()) / 60000;
      if (mins <= i.psy.revengeMinutes) {
        out.push(`<b>Cảnh báo trả thù</b>: vào ${esc(i.trade.symbol)} ${i.trade.type} ${i.trade.volume}L chỉ ${Math.round(mins)} phút sau lệnh thua ${fmtMoney(last.net)}`);
      }
      if (i.trade.volume > last.volume) {
        out.push(`<b>Tăng lot sau thua</b>: ${i.trade.volume}L lớn hơn lệnh vừa thua ${last.volume}L`);
      }
    }
    const today = before.filter(p => sameDay(p.closeTime, openAt));
    const n = i.all.filter(p => sameDay(p.openTime, openAt)).length + 1;
    if (n > i.psy.maxTradesPerDay) out.push(`<b>Đánh quá tay</b>: đây là lệnh thứ ${n} hôm nay (giới hạn ${i.psy.maxTradesPerDay})`);
    if (today.length >= 2 && today[today.length - 1].net < 0 && today[today.length - 2].net < 0) {
      out.push('<b>Đã thua 2 lệnh liền hôm nay</b> mà vẫn vào lệnh tiếp');
    }
  } else {
    const key = String(i.trade.position_id || i.trade.ticket);
    const p = sorted.find(x => x.id.endsWith(`|${key}`) || x.ticket === String(i.trade.ticket));
    if (!p) return out;
    if (p.risk > 0 && -p.gross > p.risk * (1 + i.psy.slTolerancePct / 100)) {
      out.push(`<b>Lỗ vượt 1R</b>: ${esc(p.symbol)} lỗ ${fmtMoney(p.net)} = ${fmtR(p.r)} (SL bị dời / không tôn trọng?)`);
    }
    const today = sorted.filter(x => sameDay(x.closeTime, p.closeTime));
    if (today.length >= 2 && today[today.length - 1].net < 0 && today[today.length - 2].net < 0) {
      out.push(`<b>Thua 2 lệnh liền hôm nay</b> (tổng ${fmtMoney(today[today.length - 1].net + today[today.length - 2].net)}). Nên dừng lại.`);
    }
    if (i.prop.dailyLossPct !== null && i.initialBalance > 0) {
      const limit = i.initialBalance * i.prop.dailyLossPct / 100;
      const dayNet = today.reduce((t, x) => t + x.net, 0);
      if (-dayNet >= limit * 0.7) {
        out.push(`<b>Gần chạm lỗ tối đa ngày</b>: hôm nay ${fmtMoney(dayNet)} / giới hạn -$${limit.toFixed(2)} · còn $${Math.max(0, limit + dayNet).toFixed(2)}`);
      }
    }
  }
  if (out.length) out.unshift(esc(i.accountLabel));
  return out;
}
