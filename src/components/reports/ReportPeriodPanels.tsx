import React, { useMemo, useState, useEffect } from 'react';
import { TradeRow } from '../../types';
import {
  PsySettings, PsyMetric, loadPsySettings, savePsySettings, computePsychology, computePeriodStats,
  computePlanAdherence, computeWeeklyScores, computePropStatus, loadPropRules, savePropRules, PropRules, PeriodStats,
} from '../../utils/psychologyScore';
import { toDisplayDate } from '../../utils/reportPeriods';

interface Props {
  periodPositions: TradeRow[];
  prevPositions: TradeRow[] | null;
  allPositions: TradeRow[];
  periodLabel: string;
  prevLabel: string | null;
  offsetHours: number;
  plansCount: number;
  checklistSize: number;
  initialBalance: number;
  accountId: string;
  onSelectTrade?: (t: TradeRow) => void;
}

const WIN = 'text-[#4a6152]';
const LOSS = 'text-[#825249]';
const MUTED = 'text-[#737973]';

const money = (v: number) => `${v >= 0 ? '+' : '-'}$${Math.abs(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const pnlClass = (v: number) => (v > 0 ? WIN : v < 0 ? LOSS : MUTED);
const scoreClass = (s: number | null) =>
  s === null ? MUTED : s >= 80 ? WIN : s >= 60 ? 'text-amber-600' : s >= 40 ? 'text-orange-600' : LOSS;

const Card: React.FC<{ title: string; right?: React.ReactNode; children: React.ReactNode }> = ({ title, right, children }) => (
  <div className="bg-[var(--bg-card)] rounded-3xl p-5 clay-card border border-[var(--border-main)]">
    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
      <span className="font-black text-[var(--text-primary)] text-xs tracking-wider uppercase">{title}</span>
      {right}
    </div>
    {children}
  </div>
);

function Delta({ cur, prev, fmt, higherIsBetter = true, neutral = false }: { cur: number | null; prev: number | null; fmt: (v: number) => string; higherIsBetter?: boolean; neutral?: boolean }) {
  if (cur === null || prev === null) return <span className={`text-[10px] font-mono ${MUTED}`}>—</span>;
  const d = cur - prev;
  if (Math.abs(d) < 1e-9) return <span className={`text-[10px] font-mono ${MUTED}`}>= kỳ trước</span>;
  const good = higherIsBetter ? d > 0 : d < 0;
  return <span className={`text-[10px] font-mono font-bold ${neutral ? MUTED : good ? WIN : LOSS}`}>{d > 0 ? '▲' : '▼'} {fmt(Math.abs(d))}</span>;
}

function OffenderList({ list, offsetHours, onSelectTrade }: { list: TradeRow[]; offsetHours: number; onSelectTrade?: (t: TradeRow) => void }) {
  if (!list.length) return <div className={`text-xs ${MUTED} py-2`}>Không có lệnh vi phạm</div>;
  return (
    <div className="mt-3 max-h-56 overflow-y-auto rounded-xl border border-[var(--border-main)]">
      <table className="w-full text-xs font-mono">
        <tbody>
          {list.map((t, i) => {
            const d = toDisplayDate(t.open_time, offsetHours);
            const n = t.net_pnl !== undefined ? t.net_pnl : (t.pnl || 0);
            return (
              <tr key={`${t.ticket}-${i}`} onClick={() => onSelectTrade?.(t)}
                className="border-b border-[var(--border-main)] last:border-0 hover:text-[#4a6152] cursor-pointer">
                <td className="px-3 py-1.5">#{t.ticket}</td>
                <td className="px-3 py-1.5">{d ? d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td className="px-3 py-1.5">{t.symbol} {t.type}</td>
                <td className="px-3 py-1.5">{t.volume}L</td>
                <td className={`px-3 py-1.5 text-right font-bold ${pnlClass(n)}`}>{money(n)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const NumInput: React.FC<{ label: string; value: number | null; onChange: (v: number | null) => void; step?: number }> = ({ label, value, onChange, step = 1 }) => (
  <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--text-secondary)]">
    {label}
    <input type="number" step={step} value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className="w-16 px-2 py-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-primary)] font-mono text-xs focus:outline-none focus:border-[#4a6152]" />
  </label>
);

export const ReportPeriodPanels: React.FC<Props> = ({
  periodPositions, prevPositions, allPositions, periodLabel, prevLabel, offsetHours,
  plansCount, checklistSize, initialBalance, accountId, onSelectTrade,
}) => {
  const [psy, setPsy] = useState<PsySettings>(() => loadPsySettings());
  const [showPsySettings, setShowPsySettings] = useState(false);
  const [openMetric, setOpenMetric] = useState<string | null>(null);
  const [rules, setRules] = useState<PropRules>(() => loadPropRules(accountId));

  useEffect(() => { setRules(loadPropRules(accountId)); }, [accountId]);

  const updatePsy = (patch: Partial<PsySettings>) => {
    const next = { ...psy, ...patch };
    setPsy(next);
    savePsySettings(next);
  };
  const updateRules = (patch: Partial<PropRules>) => {
    const next = { ...rules, ...patch };
    setRules(next);
    savePropRules(accountId, next);
  };

  const cur = useMemo(() => computePeriodStats(periodPositions), [periodPositions]);
  const prev = useMemo(() => (prevPositions ? computePeriodStats(prevPositions) : null), [prevPositions]);
  const psyCur = useMemo(() => computePsychology(periodPositions, psy, offsetHours, plansCount), [periodPositions, psy, offsetHours, plansCount]);
  const psyPrev = useMemo(() => (prevPositions ? computePsychology(prevPositions, psy, offsetHours, plansCount) : null), [prevPositions, psy, offsetHours, plansCount]);
  const weekly = useMemo(() => computeWeeklyScores(allPositions, psy, offsetHours, plansCount), [allPositions, psy, offsetHours, plansCount]);
  const plan = useMemo(() => computePlanAdherence(periodPositions, checklistSize), [periodPositions, checklistSize]);
  const prop = useMemo(() => computePropStatus(allPositions, initialBalance, offsetHours), [allPositions, initialBalance, offsetHours]);

  const summary: { label: string; cur: number | null; prev: number | null; show: (v: number) => string; cls?: string; fmtD: (v: number) => string; lowerBetter?: boolean; neutral?: boolean }[] = [
    { label: 'Số lệnh', cur: cur.count, prev: prev?.count ?? null, show: v => String(v), fmtD: v => String(v), neutral: true },
    { label: 'Win Rate', cur: cur.count ? cur.winRate : null, prev: prev && prev.count ? prev.winRate : null, show: v => `${v.toFixed(1)}%`, fmtD: v => `${v.toFixed(1)}%` },
    { label: 'PnL Net', cur: cur.net, prev: prev?.net ?? null, show: money, cls: pnlClass(cur.net), fmtD: v => `$${v.toFixed(2)}` },
    { label: 'Profit Factor', cur: cur.profitFactor, prev: prev?.profitFactor ?? null, show: v => v.toFixed(2), fmtD: v => v.toFixed(2) },
    { label: 'R TB / lệnh', cur: cur.avgR, prev: prev?.avgR ?? null, show: v => `${v >= 0 ? '+' : ''}${v.toFixed(2)}R`, cls: cur.avgR !== null ? pnlClass(cur.avgR) : MUTED, fmtD: v => `${v.toFixed(2)}R` },
    { label: 'Điểm Tâm Lý', cur: psyCur.score, prev: psyPrev?.score ?? null, show: v => String(v), cls: scoreClass(psyCur.score), fmtD: v => String(v) },
  ];

  const planRow = (name: string, s: PeriodStats) => (
    <tr className="border-b border-[var(--border-main)] last:border-0">
      <td className="px-3 py-2 font-bold">{name}</td>
      <td className="px-3 py-2 text-right">{s.count}</td>
      <td className="px-3 py-2 text-right">{s.count ? `${s.winRate.toFixed(1)}%` : '—'}</td>
      <td className={`px-3 py-2 text-right font-bold ${pnlClass(s.net)}`}>{s.count ? money(s.net) : '—'}</td>
      <td className="px-3 py-2 text-right">{s.avgR !== null ? `${s.avgR >= 0 ? '+' : ''}${s.avgR.toFixed(2)}R` : '—'}</td>
    </tr>
  );

  const propRows: { label: string; value: string; limit: string; status: 'ok' | 'warn' | 'bad' | 'none' }[] = [];
  {
    const lim = rules.dailyLossPct !== null ? initialBalance * rules.dailyLossPct / 100 : null;
    const lossToday = Math.max(0, -prop.todayNet);
    propRows.push({
      label: 'Lỗ hôm nay',
      value: money(prop.todayNet),
      limit: lim !== null ? `Giới hạn ${money(-lim)} · còn ${money(Math.max(0, lim - lossToday)).replace('+', '')}` : 'Chưa đặt luật',
      status: lim === null ? 'none' : lossToday >= lim ? 'bad' : lossToday >= lim * 0.7 ? 'warn' : 'ok',
    });
    propRows.push({
      label: 'Ngày lỗ nặng nhất',
      value: money(prop.worstDay),
      limit: lim !== null ? `Giới hạn ${money(-lim)}` : 'Chưa đặt luật',
      status: lim === null ? 'none' : -prop.worstDay >= lim ? 'bad' : -prop.worstDay >= lim * 0.7 ? 'warn' : 'ok',
    });
    const floor = rules.maxDdPct !== null ? initialBalance * (1 - rules.maxDdPct / 100) : null;
    propRows.push({
      label: 'Số dư / Đáy cho phép',
      value: `$${prop.balance.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
      limit: floor !== null ? `Đáy $${floor.toLocaleString('en-US', { maximumFractionDigits: 2 })} · cách ${money(prop.balance - floor).replace('+', '')} · thấp nhất từng chạm $${prop.lowestBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}` : 'Chưa đặt luật',
      status: floor === null ? 'none' : prop.lowestBalance <= floor ? 'bad' : (prop.balance - floor) <= initialBalance * (rules.maxDdPct as number) / 100 * 0.3 ? 'warn' : 'ok',
    });
    const profitPct = initialBalance > 0 ? (prop.totalProfit / initialBalance) * 100 : 0;
    propRows.push({
      label: 'Mục tiêu lợi nhuận',
      value: `${profitPct >= 0 ? '+' : ''}${profitPct.toFixed(2)}%`,
      limit: rules.targetPct !== null ? `Mục tiêu ${rules.targetPct}% · đạt ${Math.max(0, Math.min(100, profitPct / rules.targetPct * 100)).toFixed(0)}%` : 'Chưa đặt luật',
      status: rules.targetPct === null ? 'none' : profitPct >= rules.targetPct ? 'ok' : 'warn',
    });
    propRows.push({
      label: 'Số ngày giao dịch',
      value: String(prop.tradingDays),
      limit: rules.minDays !== null ? `Tối thiểu ${rules.minDays} ngày` : 'Chưa đặt luật',
      status: rules.minDays === null ? 'none' : prop.tradingDays >= rules.minDays ? 'ok' : 'warn',
    });
    propRows.push({
      label: 'Ngày lãi lớn nhất / Tổng lãi',
      value: prop.bestDaySharePct !== null ? `${prop.bestDaySharePct.toFixed(1)}%` : '—',
      limit: rules.consistencyPct !== null ? `Tối đa ${rules.consistencyPct}%` : 'Chưa đặt luật',
      status: rules.consistencyPct === null || prop.bestDaySharePct === null ? 'none' : prop.bestDaySharePct > rules.consistencyPct ? 'bad' : prop.bestDaySharePct > rules.consistencyPct * 0.8 ? 'warn' : 'ok',
    });
  }
  const statusCls = { ok: WIN, warn: 'text-amber-600', bad: LOSS, none: MUTED };
  const statusText = { ok: 'Đạt', warn: 'Cảnh báo', bad: 'Vi phạm', none: '—' };

  const metricText = (m: PsyMetric) => (m.value === null ? '—' : m.unit === '%' ? `${m.value.toFixed(1)}%` : `${m.value.toFixed(2)}x`);

  return (
    <div className="flex flex-col gap-5">
      {/* TỔNG QUAN KỲ */}
      <Card title={`Tổng quan · ${periodLabel}`} right={prevLabel ? <span className={`text-[11px] font-bold ${MUTED}`}>So với {prevLabel}</span> : undefined}>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {summary.map(s => (
            <div key={s.label} className="rounded-2xl p-3 bg-[var(--bg-subtle)] clay-well">
              <div className={`text-[11px] font-bold uppercase tracking-wider ${MUTED}`}>{s.label}</div>
              <div className={`text-lg font-black font-mono mt-1 ${s.cls || 'text-[var(--text-primary)]'}`}>{s.cur === null ? '—' : s.show(s.cur)}</div>
              {prevLabel && <Delta cur={s.cur} prev={s.prev} fmt={s.fmtD} higherIsBetter={!s.lowerBetter} neutral={s.neutral} />}
            </div>
          ))}
        </div>
      </Card>

      {/* ĐIỂM TÂM LÝ */}
      <Card title="Điểm Tâm Lý" right={
        <button type="button" onClick={() => setShowPsySettings(v => !v)}
          className="px-3 py-1 rounded-full text-xs font-bold bg-[var(--bg-subtle)] clay-well text-[var(--text-secondary)] hover:text-[#4a6152] cursor-pointer">
          Ngưỡng
        </button>
      }>
        {showPsySettings && (
          <div className="flex flex-wrap gap-4 mb-4 p-3 rounded-2xl bg-[var(--bg-subtle)] clay-well">
            <NumInput label="Trả thù trong (phút)" value={psy.revengeMinutes} onChange={v => updatePsy({ revengeMinutes: v ?? 0 })} />
            <NumInput label="Tối đa lệnh/ngày" value={psy.maxTradesPerDay} onChange={v => updatePsy({ maxTradesPerDay: v ?? 0 })} />
            <NumInput label="Hụt ăn ≥ (R)" value={psy.greedGapR} step={0.1} onChange={v => updatePsy({ greedGapR: v ?? 0 })} />
            <NumInput label="Cắt non: MFE ≥ (R)" value={psy.earlyExitMfeR} step={0.1} onChange={v => updatePsy({ earlyExitMfeR: v ?? 0 })} />
            <NumInput label="Cắt non: chốt < (R)" value={psy.earlyExitMaxR} step={0.1} onChange={v => updatePsy({ earlyExitMaxR: v ?? 0 })} />
            <NumInput label="Lỗ vượt 1R quá (%)" value={psy.slTolerancePct} onChange={v => updatePsy({ slTolerancePct: v ?? 0 })} />
          </div>
        )}

        <div className="flex flex-col lg:flex-row gap-5">
          <div className="flex flex-col items-center justify-center rounded-2xl p-5 bg-[var(--bg-subtle)] clay-well min-w-[180px]">
            <div className={`text-5xl font-black font-mono ${scoreClass(psyCur.score)}`}>{psyCur.score ?? '—'}</div>
            <div className={`text-sm font-black mt-1 ${scoreClass(psyCur.score)}`}>{psyCur.level}</div>
          </div>
          <div className="flex-1">
            <div className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${MUTED}`}>8 tuần gần nhất</div>
            <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
              {weekly.map(w => (
                <div key={w.label} className="rounded-xl p-2 bg-[var(--bg-subtle)] text-center">
                  <div className={`text-[10px] font-mono ${MUTED}`}>{w.label}</div>
                  <div className={`text-base font-black font-mono ${scoreClass(w.score)}`}>{w.score ?? '—'}</div>
                  <div className={`text-[10px] font-mono ${MUTED}`}>{w.count} lệnh</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-3 mt-5">
          {psyCur.metrics.map(m => {
            const prevM = psyPrev?.metrics.find(p => p.id === m.id);
            return (
              <button key={m.id} type="button" onClick={() => setOpenMetric(openMetric === m.id ? null : m.id)}
                className={`text-left rounded-2xl p-3 bg-[var(--bg-subtle)] clay-well cursor-pointer hover:text-[#4a6152] ${openMetric === m.id ? 'ring-2 ring-[#4a6152]' : ''}`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-bold uppercase tracking-wider ${MUTED}`}>{m.name}</span>
                  <span className={`text-sm font-black font-mono ${m.excluded ? MUTED : scoreClass(m.score)}`}>{m.score ?? '—'}</span>
                </div>
                <div className="text-lg font-black font-mono text-[var(--text-primary)] mt-1">{metricText(m)}</div>
                <div className={`text-[10px] font-mono ${MUTED}`}>
                  {m.note && m.score === null ? m.note : `${m.offenders.length} vi phạm · đo trên ${m.sample} ${m.sampleUnit}`}
                </div>
                {m.excluded && <div className="text-[10px] font-mono text-amber-600">Mẫu nhỏ, không tính điểm tổng</div>}
                {prevLabel && <Delta cur={m.score} prev={prevM?.score ?? null} fmt={v => `${v} điểm`} />}
              </button>
            );
          })}
        </div>

        {openMetric && (() => {
          const m = psyCur.metrics.find(x => x.id === openMetric)!;
          return (
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-[var(--text-primary)]">{m.name}</span>
                {m.note && <span className={`text-[11px] font-mono ${MUTED}`}>{m.note}</span>}
              </div>
              <OffenderList list={m.offenders} offsetHours={offsetHours} onSelectTrade={onSelectTrade} />
            </div>
          );
        })()}
      </Card>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* TUÂN THỦ PLAN */}
        <Card title="Tuân thủ Plan">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-2xl p-3 bg-[var(--bg-subtle)] clay-well">
              <div className={`text-[11px] font-bold uppercase tracking-wider ${MUTED}`}>Lệnh có plan</div>
              <div className="text-lg font-black font-mono text-[var(--text-primary)]">{plan.pctWithPlan.toFixed(1)}%</div>
            </div>
            <div className="rounded-2xl p-3 bg-[var(--bg-subtle)] clay-well">
              <div className={`text-[11px] font-bold uppercase tracking-wider ${MUTED}`}>Checklist TB</div>
              <div className="text-lg font-black font-mono text-[var(--text-primary)]">{plan.avgChecklist !== null ? `${plan.avgChecklist.toFixed(0)}%` : '—'}</div>
              <div className={`text-[10px] font-mono ${MUTED}`}>{plan.checklistCount} lệnh có checklist</div>
            </div>
          </div>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className={`${MUTED} text-[10px] uppercase`}>
                <th className="px-3 py-1 text-left"></th>
                <th className="px-3 py-1 text-right">Lệnh</th>
                <th className="px-3 py-1 text-right">Win Rate</th>
                <th className="px-3 py-1 text-right">PnL</th>
                <th className="px-3 py-1 text-right">R TB</th>
              </tr>
            </thead>
            <tbody>
              {planRow('Theo plan', plan.withPlan)}
              {planRow('Ngoài plan', plan.noPlan)}
            </tbody>
          </table>
        </Card>

        {/* LUẬT QUỸ */}
        <Card title="Luật Quỹ · Toàn tài khoản">
          <div className="flex flex-wrap gap-4 mb-4 p-3 rounded-2xl bg-[var(--bg-subtle)] clay-well">
            <NumInput label="Lỗ ngày tối đa (%)" value={rules.dailyLossPct} step={0.5} onChange={v => updateRules({ dailyLossPct: v })} />
            <NumInput label="Lỗ tối đa (%)" value={rules.maxDdPct} step={0.5} onChange={v => updateRules({ maxDdPct: v })} />
            <NumInput label="Mục tiêu (%)" value={rules.targetPct} step={0.5} onChange={v => updateRules({ targetPct: v })} />
            <NumInput label="Ngày tối thiểu" value={rules.minDays} onChange={v => updateRules({ minDays: v })} />
            <NumInput label="Ngày lãi lớn nhất ≤ (%)" value={rules.consistencyPct} onChange={v => updateRules({ consistencyPct: v })} />
          </div>
          <table className="w-full text-xs font-mono">
            <tbody>
              {propRows.map(r => (
                <tr key={r.label} className="border-b border-[var(--border-main)] last:border-0">
                  <td className="px-3 py-2 font-bold">{r.label}</td>
                  <td className="px-3 py-2 text-right font-bold">{r.value}</td>
                  <td className={`px-3 py-2 ${MUTED}`}>{r.limit}</td>
                  <td className={`px-3 py-2 text-right font-black ${statusCls[r.status]}`}>{statusText[r.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>
    </div>
  );
};
