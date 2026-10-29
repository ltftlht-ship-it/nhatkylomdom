import React, { useMemo, useState, useEffect } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ReferenceLine } from 'recharts';
import { Position } from '../../utils/reportPositions';
import {
  summarize, groupBy, hourWeekHeatmap, mfeMaeStats, partialStats, whatIfRespectSl, whatIfFixedTp, whatIfExclude,
  WEEKDAYS, weekdayIndex, fmtMoney, fmtR, fmtDuration, Summary,
} from '../../utils/reportStats';
import {
  PsySettings, PsyResult, computeWeeklyScores, computePropStatus, loadPropRules, savePropRules, PropRules,
} from '../../utils/psychologyScore';
import { Card, Stat, Delta, NumInput, PositionList, GroupTable, Pills, WIN, LOSS, MUTED, WARN, pnlClass, scoreClass } from './ui';

type Select = (p: Position) => void;

// ============================ TÂM LÝ ============================

export function PsychologySection({ psy, psyPrev, all, settings, onSettings, plansCount, onSelect }: {
  psy: PsyResult; psyPrev: PsyResult | null; all: Position[]; settings: PsySettings; onSettings: (s: PsySettings) => void;
  plansCount: number; onSelect: Select;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const weekly = useMemo(() => computeWeeklyScores(all, settings, plansCount), [all, settings, plansCount]);
  const set = (patch: Partial<PsySettings>) => onSettings({ ...settings, ...patch });
  const opened = psy.metrics.find(m => m.id === open);

  return (
    <Card id="tam-ly" title="Điểm Tâm Lý" right={
      <button type="button" onClick={() => setShowSettings(v => !v)}
        className="px-3 py-1 rounded-full text-xs font-bold bg-[var(--bg-subtle)] clay-well text-[var(--text-secondary)] hover:text-[#4a6152] cursor-pointer">Ngưỡng</button>
    }>
      {showSettings && (
        <div className="flex flex-wrap gap-4 mb-4 p-3 rounded-2xl bg-[var(--bg-subtle)] clay-well">
          <NumInput label="Trả thù trong (phút)" value={settings.revengeMinutes} onChange={v => set({ revengeMinutes: v ?? 0 })} />
          <NumInput label="Tối đa lệnh/ngày" value={settings.maxTradesPerDay} onChange={v => set({ maxTradesPerDay: v ?? 0 })} />
          <NumInput label="Hụt ăn ≥ (R)" value={settings.greedGapR} step={0.1} onChange={v => set({ greedGapR: v ?? 0 })} />
          <NumInput label="Cắt non: MFE ≥ (R)" value={settings.earlyExitMfeR} step={0.1} onChange={v => set({ earlyExitMfeR: v ?? 0 })} />
          <NumInput label="Cắt non: chốt < (R)" value={settings.earlyExitMaxR} step={0.1} onChange={v => set({ earlyExitMaxR: v ?? 0 })} />
          <NumInput label="Lỗ vượt 1R quá (%)" value={settings.slTolerancePct} onChange={v => set({ slTolerancePct: v ?? 0 })} />
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="flex flex-col items-center justify-center rounded-2xl p-5 bg-[var(--bg-subtle)] clay-well min-w-[170px]">
          <div className={`text-5xl font-black font-mono ${scoreClass(psy.score)}`}>{psy.score ?? '—'}</div>
          <div className={`text-sm font-black mt-1 ${scoreClass(psy.score)}`}>{psy.level}</div>
          {psyPrev && <div className="text-[11px] font-mono mt-1"><Delta cur={psy.score} prev={psyPrev.score} fmt={v => `${v} điểm`} /></div>}
        </div>
        <div className="flex-1 min-w-0">
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

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 mt-4">
        {psy.metrics.map(m => {
          const prev = psyPrev?.metrics.find(p => p.id === m.id);
          return (
            <button key={m.id} type="button" onClick={() => setOpen(open === m.id ? null : m.id)}
              className={`text-left rounded-2xl p-3 bg-[var(--bg-subtle)] clay-well cursor-pointer hover:text-[#4a6152] ${open === m.id ? 'ring-2 ring-[#4a6152]' : ''}`}>
              <div className="flex items-center justify-between gap-2">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${MUTED} truncate`}>{m.name}</span>
                <span className={`text-sm font-black font-mono ${m.excluded ? MUTED : scoreClass(m.score)}`}>{m.score ?? '—'}</span>
              </div>
              <div className="text-lg font-black font-mono text-[var(--text-primary)] mt-1">
                {m.value === null ? '—' : m.unit === '%' ? `${m.value.toFixed(1)}%` : `${m.value.toFixed(2)}x`}
              </div>
              <div className={`text-[10px] font-mono ${MUTED}`}>
                {m.score === null && m.note ? m.note : `${m.offenders.length} vi phạm · ${m.sample} ${m.sampleUnit}`}
              </div>
              {m.excluded && <div className={`text-[10px] font-mono ${WARN}`}>Mẫu nhỏ</div>}
              {psyPrev && !m.excluded && <div className="text-[10px] font-mono"><Delta cur={m.score} prev={prev && !prev.excluded ? prev.score : null} fmt={v => `${v}`} /></div>}
            </button>
          );
        })}
      </div>

      {opened && (
        <div className="mt-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span className="text-xs font-black text-[var(--text-primary)]">{opened.name}</span>
            {opened.note && <span className={`text-[11px] font-mono ${MUTED}`}>{opened.note}</span>}
          </div>
          <PositionList list={opened.offenders} onSelect={onSelect} />
        </div>
      )}
    </Card>
  );
}

// ============================ TUÂN THỦ PLAN ============================

export function PlanSection({ list, checklistSize }: { list: Position[]; checklistSize: number }) {
  const withPlan = list.filter(p => p.planId);
  const noPlan = list.filter(p => !p.planId);
  const withChecklist = list.filter(p => p.checklist.length > 0);
  const avgChecklist = checklistSize > 0 && withChecklist.length
    ? withChecklist.reduce((s, p) => s + Math.min(1, p.checklist.length / checklistSize), 0) / withChecklist.length * 100 : null;
  const rows = [
    { key: 'plan', label: 'Theo plan', ...summarize(withPlan) },
    { key: 'noplan', label: 'Ngoài plan', ...summarize(noPlan) },
  ];
  const mistakeRows = groupBy(list.flatMap(p => p.mistakes.map(m => ({ ...p, setup: m }))), p => p.setup);
  return (
    <Card id="plan" title="Tuân thủ Plan">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <Stat label="Lệnh có plan" value={list.length ? `${(withPlan.length / list.length * 100).toFixed(1)}%` : '—'} sub={<span className={MUTED}>{withPlan.length}/{list.length} lệnh</span>} />
        <Stat label="Checklist TB" value={avgChecklist !== null ? `${avgChecklist.toFixed(0)}%` : '—'} sub={<span className={MUTED}>{withChecklist.length} lệnh có checklist</span>} />
        <Stat label="Lệnh có ghi lỗi" value={list.filter(p => p.mistakes.length).length} />
      </div>
      <GroupTable rows={rows} keyLabel="" />
      {mistakeRows.length > 0 && (
        <div className="mt-4">
          <div className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${MUTED}`}>Theo lỗi Thầy ghi</div>
          <GroupTable rows={mistakeRows} keyLabel="Lỗi" />
        </div>
      )}
    </Card>
  );
}

// ============================ LUẬT QUỸ ============================

export function PropSection({ all, initialBalance, accountId }: { all: Position[]; initialBalance: number; accountId: string }) {
  const [rules, setRules] = useState<PropRules>(() => loadPropRules(accountId));
  useEffect(() => { setRules(loadPropRules(accountId)); }, [accountId]);
  const update = (patch: Partial<PropRules>) => { const n = { ...rules, ...patch }; setRules(n); savePropRules(accountId, n); };
  const s = useMemo(() => computePropStatus(all, initialBalance), [all, initialBalance]);

  type Row = { label: string; value: string; limit: string; status: 'ok' | 'warn' | 'bad' | 'none' };
  const rows: Row[] = [];
  const lim = rules.dailyLossPct !== null ? initialBalance * rules.dailyLossPct / 100 : null;
  const lossToday = Math.max(0, -s.todayNet);
  rows.push({ label: 'Lỗ hôm nay', value: fmtMoney(s.todayNet),
    limit: lim !== null ? `Giới hạn -$${lim.toFixed(2)} · còn $${Math.max(0, lim - lossToday).toFixed(2)}` : 'Chưa đặt luật',
    status: lim === null ? 'none' : lossToday >= lim ? 'bad' : lossToday >= lim * 0.7 ? 'warn' : 'ok' });
  rows.push({ label: 'Ngày lỗ nặng nhất', value: fmtMoney(s.worstDay), limit: lim !== null ? `Giới hạn -$${lim.toFixed(2)}` : 'Chưa đặt luật',
    status: lim === null ? 'none' : -s.worstDay >= lim ? 'bad' : -s.worstDay >= lim * 0.7 ? 'warn' : 'ok' });
  const floor = rules.maxDdPct !== null ? initialBalance * (1 - rules.maxDdPct / 100) : null;
  rows.push({ label: 'Số dư / Đáy cho phép', value: `$${s.balance.toFixed(2)}`,
    limit: floor !== null ? `Đáy $${floor.toFixed(2)} · cách $${(s.balance - floor).toFixed(2)} · thấp nhất $${s.lowestBalance.toFixed(2)}` : 'Chưa đặt luật',
    status: floor === null ? 'none' : s.lowestBalance <= floor ? 'bad' : (s.balance - floor) <= (initialBalance - floor) * 0.3 ? 'warn' : 'ok' });
  const pct = initialBalance > 0 ? s.totalProfit / initialBalance * 100 : 0;
  rows.push({ label: 'Mục tiêu lợi nhuận', value: `${pct >= 0 ? '+' : ''}${pct.toFixed(2)}%`,
    limit: rules.targetPct !== null ? `Mục tiêu ${rules.targetPct}% · đạt ${Math.max(0, Math.min(100, pct / rules.targetPct * 100)).toFixed(0)}%` : 'Chưa đặt luật',
    status: rules.targetPct === null ? 'none' : pct >= rules.targetPct ? 'ok' : 'warn' });
  rows.push({ label: 'Số ngày giao dịch', value: String(s.tradingDays), limit: rules.minDays !== null ? `Tối thiểu ${rules.minDays} ngày` : 'Chưa đặt luật',
    status: rules.minDays === null ? 'none' : s.tradingDays >= rules.minDays ? 'ok' : 'warn' });
  rows.push({ label: 'Ngày lãi lớn nhất / Tổng lãi', value: s.bestDaySharePct !== null ? `${s.bestDaySharePct.toFixed(1)}%` : '—',
    limit: rules.consistencyPct !== null ? `Tối đa ${rules.consistencyPct}%` : 'Chưa đặt luật',
    status: rules.consistencyPct === null || s.bestDaySharePct === null ? 'none' : s.bestDaySharePct > rules.consistencyPct ? 'bad' : s.bestDaySharePct > rules.consistencyPct * 0.8 ? 'warn' : 'ok' });
  const cls = { ok: WIN, warn: WARN, bad: LOSS, none: MUTED };
  const txt = { ok: 'Đạt', warn: 'Cảnh báo', bad: 'Vi phạm', none: '—' };

  return (
    <Card id="luat-quy" title="Luật Quỹ · Toàn tài khoản">
      <div className="flex flex-wrap gap-4 mb-4 p-3 rounded-2xl bg-[var(--bg-subtle)] clay-well">
        <NumInput label="Lỗ ngày tối đa (%)" value={rules.dailyLossPct} step={0.5} onChange={v => update({ dailyLossPct: v })} />
        <NumInput label="Lỗ tối đa (%)" value={rules.maxDdPct} step={0.5} onChange={v => update({ maxDdPct: v })} />
        <NumInput label="Mục tiêu (%)" value={rules.targetPct} step={0.5} onChange={v => update({ targetPct: v })} />
        <NumInput label="Ngày tối thiểu" value={rules.minDays} onChange={v => update({ minDays: v })} />
        <NumInput label="Ngày lãi lớn nhất ≤ (%)" value={rules.consistencyPct} onChange={v => update({ consistencyPct: v })} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <tbody>
            {rows.map(r => (
              <tr key={r.label} className="border-b border-[var(--border-main)] last:border-0">
                <td className="px-2 py-2 font-bold whitespace-nowrap">{r.label}</td>
                <td className="px-2 py-2 text-right font-bold whitespace-nowrap">{r.value}</td>
                <td className={`px-2 py-2 ${MUTED}`}>{r.limit}</td>
                <td className={`px-2 py-2 text-right font-black ${cls[r.status]}`}>{txt[r.status]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================ HIỆU SUẤT ============================

export function PerformanceSection({ list, onSelect }: { list: Position[]; onSelect: Select }) {
  const [by, setBy] = useState('session');
  const rows = useMemo(() => {
    switch (by) {
      case 'session': return groupBy(list, p => p.session, k => ({ 'Á': 'Phiên Á', 'Âu': 'Phiên Âu', 'Mỹ': 'Phiên Mỹ' } as any)[k] || k, ['Á', 'Âu', 'Mỹ']);
      case 'weekday': return groupBy(list, p => String(weekdayIndex(p.openTime)), k => WEEKDAYS[Number(k)], ['0', '1', '2', '3', '4', '5', '6']);
      case 'symbol': return groupBy(list, p => p.symbol);
      case 'setup': return groupBy(list, p => p.setup || 'Chưa gắn setup');
      case 'timeframe': return groupBy(list, p => p.timeframe || 'Không rõ');
      case 'direction': return groupBy(list, p => (p.isBuy ? 'BUY' : 'SELL'), k => k, ['BUY', 'SELL']);
      case 'duration': return groupBy(list, p => (p.durationMin < 15 ? '0' : p.durationMin < 60 ? '1' : p.durationMin < 240 ? '2' : p.durationMin < 1440 ? '3' : '4'),
        k => ['< 15 phút', '15–60 phút', '1–4 giờ', '4–24 giờ', '> 1 ngày'][Number(k)], ['0', '1', '2', '3', '4']);
      default: return [];
    }
  }, [list, by]);
  const heat = useMemo(() => hourWeekHeatmap(list), [list]);
  const s = useMemo(() => summarize(list), [list]);
  const avgDur = (f: (p: Position) => boolean) => { const a = list.filter(f); return a.length ? a.reduce((t, p) => t + p.durationMin, 0) / a.length : null; };
  const durW = avgDur(p => p.net > 0), durL = avgDur(p => p.net < 0);

  return (
    <Card id="hieu-suat" title="Hiệu suất">
      <Pills value={by} onChange={setBy} options={[['session', 'Phiên'], ['weekday', 'Thứ'], ['symbol', 'Cặp'], ['setup', 'Setup'], ['timeframe', 'Khung'], ['direction', 'BUY/SELL'], ['duration', 'Thời gian giữ']]} />
      <div className="mt-3"><GroupTable rows={rows} keyLabel="" /></div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
        <Stat label="Giữ lệnh thắng TB" value={durW !== null ? fmtDuration(durW) : '—'} cls={WIN} />
        <Stat label="Giữ lệnh thua TB" value={durL !== null ? fmtDuration(durL) : '—'} cls={LOSS} />
        <button type="button" className="text-left" onClick={() => s.best && onSelect(s.best)}>
          <Stat label="Lệnh thắng lớn nhất" value={s.best && s.best.net > 0 ? fmtMoney(s.best.net) : '—'} cls={WIN} sub={s.best && s.best.net > 0 ? <span className={MUTED}>#{s.best.ticket} · {fmtR(s.best.r)}</span> : undefined} />
        </button>
        <button type="button" className="text-left" onClick={() => s.worst && onSelect(s.worst)}>
          <Stat label="Lệnh thua lớn nhất" value={s.worst && s.worst.net < 0 ? fmtMoney(s.worst.net) : '—'} cls={LOSS} sub={s.worst && s.worst.net < 0 ? <span className={MUTED}>#{s.worst.ticket} · {fmtR(s.worst.r)}</span> : undefined} />
        </button>
      </div>

      <div className={`text-[11px] font-bold uppercase tracking-wider mt-5 mb-2 ${MUTED}`}>Giờ vào lệnh × Thứ</div>
      <div className="overflow-x-auto">
        <table className="text-[9px] font-mono border-separate border-spacing-0.5">
          <thead>
            <tr><th></th>{Array.from({ length: 24 }, (_, h) => <th key={h} className={`${MUTED} font-normal w-6`}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {heat.cells.map((row, d) => (
              <tr key={d}>
                <td className={`${MUTED} pr-1 font-bold`}>{WEEKDAYS[d]}</td>
                {row.map((c, h) => {
                  const a = c.count ? Math.max(0.15, Math.abs(c.net) / heat.maxAbs) : 0;
                  return (
                    <td key={h} title={c.count ? `${WEEKDAYS[d]} ${h}h: ${c.count} lệnh, ${fmtMoney(c.net)}, thắng ${c.wins}` : ''}
                      className="w-6 h-6 rounded text-center align-middle text-[var(--text-primary)]"
                      style={{ background: c.count ? (c.net >= 0 ? `rgba(74,97,82,${a})` : `rgba(130,82,73,${a})`) : 'var(--bg-subtle)' }}>
                      {c.count || ''}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================ MFE / MAE ============================

export function MfeMaeSection({ list }: { list: Position[] }) {
  const m = useMemo(() => mfeMaeStats(list), [list]);
  const pct = (v: number | null) => (v === null ? '—' : `${v.toFixed(0)}%`);
  const r = (v: number | null) => (v === null ? '—' : `${v.toFixed(2)}R`);
  return (
    <Card id="mfe-mae" title="MFE & MAE" right={<span className={`text-[11px] font-mono ${MUTED}`}>Đo trên {m.sample}/{m.total} lệnh có dữ liệu đỉnh/đáy từ EA</span>}>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <Stat label="Đỉnh MFE TB · lệnh thắng" value={r(m.avgMfeWinners)} />
        <Stat label="Giữ được TB · lệnh thắng" value={pct(m.avgCaptureWinners)} />
        <Stat label="Lãi để tuột mất" value={fmtMoney(-m.leftOnTable)} cls={LOSS} />
        <Stat label="Đỉnh MFE TB · lệnh thua" value={r(m.avgMfeLosers)} />
        <Stat label="Lệnh thua từng lãi ≥1R" value={m.losersCount ? `${m.losersThatWereInProfit1R}/${m.losersCount}` : '—'} cls={m.losersThatWereInProfit1R ? LOSS : undefined} />
        <Stat label="Đáy MAE TB · lệnh thắng" value={r(m.avgMaeWinners)} sub={<span className={MUTED}>{m.maeSample} lệnh</span>} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
        {[['Đỉnh MFE chạy được', m.mfeBuckets, '#4a6152'], ['Đáy MAE phải gồng (lệnh thắng)', m.maeWinnerBuckets, '#825249']].map(([title, data, color]: any) => (
          <div key={title}>
            <div className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${MUTED}`}>{title}</div>
            <div className="h-40">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={(v: any) => [`${v} lệnh`, '']} />
                  <Bar dataKey="count" fill={color} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================ CẮT TỪNG PHẦN ============================

export function PartialSection({ list }: { list: Position[] }) {
  const p = useMemo(() => partialStats(list), [list]);
  const rows = [
    { key: 'scaled', label: 'Có cắt từng phần', ...p.scaled },
    { key: 'single', label: 'Đóng 1 lần', ...p.single },
  ];
  return (
    <Card id="cat-tung-phan" title="Cắt từng phần">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        <Stat label="Lệnh có cắt từng phần" value={`${p.scaledPct.toFixed(1)}%`} sub={<span className={MUTED}>{p.scaled.count}/{list.length} lệnh</span>} />
        <Stat label="Số lần cắt TB" value={p.avgLegs ? p.avgLegs.toFixed(1) : '—'} />
        <Stat label="R TB · có cắt / 1 lần" value={`${fmtR(p.scaled.avgR)} / ${fmtR(p.single.avgR)}`} />
      </div>
      <GroupTable rows={rows} keyLabel="" />
      {p.byLeg.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <div className={`text-[11px] font-bold uppercase tracking-wider mb-2 ${MUTED}`}>Theo từng lần cắt</div>
          <table className="w-full text-xs font-mono whitespace-nowrap">
            <thead><tr className={`${MUTED} text-[10px] uppercase`}><th className="px-2 py-1 text-left"></th><th className="px-2 py-1 text-right">Lệnh</th><th className="px-2 py-1 text-right">Lần cắt lãi</th><th className="px-2 py-1 text-right">R TB</th><th className="px-2 py-1 text-right">PnL</th></tr></thead>
            <tbody>
              {p.byLeg.map(l => (
                <tr key={l.index} className="border-t border-[var(--border-main)]">
                  <td className="px-2 py-1.5 font-bold">{l.index}</td>
                  <td className="px-2 py-1.5 text-right">{l.count}</td>
                  <td className="px-2 py-1.5 text-right">{l.count ? `${(l.wins / l.count * 100).toFixed(0)}%` : '—'}</td>
                  <td className={`px-2 py-1.5 text-right ${pnlClass(l.avgR)}`}>{fmtR(l.avgR)}</td>
                  <td className={`px-2 py-1.5 text-right font-bold ${pnlClass(l.net)}`}>{fmtMoney(l.net)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

// ============================ GIẢ LẬP ============================

export function WhatIfSection({ list, psy, plansCount }: { list: Position[]; psy: PsyResult; plansCount: number }) {
  const [targetR, setTargetR] = useState<number | null>(2);
  const results = useMemo(() => {
    const offenders = new Set<string>();
    psy.metrics.filter(m => m.id !== 'no_plan' && m.id !== 'hold_losers').forEach(m => m.offenders.forEach(p => offenders.add(p.id)));
    const out = [
      whatIfRespectSl(list),
      whatIfFixedTp(list, targetR && targetR > 0 ? targetR : 2),
      whatIfExclude(list, offenders, 'no_psy', 'Bỏ các lệnh vi phạm tâm lý'),
    ];
    if (plansCount > 0) out.push(whatIfExclude(list, new Set(list.filter(p => !p.planId).map(p => p.id)), 'plan_only', 'Chỉ đánh lệnh theo plan'));
    return out;
  }, [list, psy, targetR, plansCount]);
  const chart = results.map(r => ({ name: r.name, delta: Number((r.simulated - r.actual).toFixed(2)) }));

  return (
    <Card id="gia-lap" title="Giả lập What-If" right={<NumInput label="Chốt cố định (R)" value={targetR} step={0.5} onChange={setTargetR} />}>
      <div className="overflow-x-auto">
        <table className="w-full text-xs font-mono whitespace-nowrap">
          <thead><tr className={`${MUTED} text-[10px] uppercase`}><th className="px-2 py-1 text-left">Kịch bản</th><th className="px-2 py-1 text-right">Thực tế</th><th className="px-2 py-1 text-right">Giả lập</th><th className="px-2 py-1 text-right">Chênh lệch</th><th className="px-2 py-1 text-right">Lệnh thay đổi</th></tr></thead>
          <tbody>
            {results.map(r => (
              <tr key={r.id} className="border-t border-[var(--border-main)]">
                <td className="px-2 py-1.5 font-bold">{r.name}</td>
                <td className={`px-2 py-1.5 text-right ${pnlClass(r.actual)}`}>{fmtMoney(r.actual)}</td>
                <td className={`px-2 py-1.5 text-right ${pnlClass(r.simulated)}`}>{fmtMoney(r.simulated)}</td>
                <td className={`px-2 py-1.5 text-right font-black ${pnlClass(r.simulated - r.actual)}`}>{fmtMoney(r.simulated - r.actual)}</td>
                <td className={`px-2 py-1.5 text-right ${MUTED}`}>{r.affected}/{r.sample}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="h-40 mt-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chart} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 0 }}>
            <XAxis type="number" tick={{ fontSize: 10 }} />
            <YAxis type="category" dataKey="name" width={170} tick={{ fontSize: 10 }} />
            <Tooltip formatter={(v: any) => [fmtMoney(Number(v)), 'Chênh lệch']} />
            <ReferenceLine x={0} stroke="var(--border-main)" />
            <Bar dataKey="delta" radius={[0, 4, 4, 0]}>
              {chart.map(c => <Cell key={c.name} fill={c.delta >= 0 ? '#4a6152' : '#825249'} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

export type { Summary };
