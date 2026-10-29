import React, { useMemo, useState } from 'react';
import { ResponsiveContainer, ComposedChart, Area, Line, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell, ReferenceLine } from 'recharts';
import { TradeRow, AccountInfo, TradingPlan, PreChecklistItem, PostMistakeItem } from '../../types';
import { getSavedTimezoneOffset } from '../../utils/tradeCalculations';
import { PeriodKind, getPeriodRange, getPreviousRange, PeriodRange } from '../../utils/reportPeriods';
import { buildPositions, Position } from '../../utils/reportPositions';
import { summarize, equityCurve, dailyNet, fmtMoney, fmtR } from '../../utils/reportStats';
import { computePsychology, loadPsySettings, savePsySettings, PsySettings } from '../../utils/psychologyScore';
import { Card, Stat, Delta, Pills, MUTED, pnlClass, scoreClass } from './ui';
import { PsychologySection, PlanSection, PropSection, PerformanceSection, MfeMaeSection, PartialSection, WhatIfSection } from './sections';

interface Props {
  trades: TradeRow[];
  activeAccount: AccountInfo;
  plans?: TradingPlan[];
  hideNoiseRows?: boolean;
  preChecklist?: PreChecklistItem[];
  postMistakes?: PostMistakeItem[];
  onSelectTrade?: (trade: TradeRow) => void;
  timezoneOffset?: number;
  onShowLegacy?: () => void;
}

const NAV: [string, string][] = [
  ['tong-quan', 'Tổng quan'], ['tam-ly', 'Tâm lý'], ['plan', 'Plan'], ['luat-quy', 'Luật quỹ'],
  ['hieu-suat', 'Hiệu suất'], ['mfe-mae', 'MFE/MAE'], ['cat-tung-phan', 'Cắt từng phần'], ['gia-lap', 'Giả lập'],
];

const inRange = (p: Position, r: PeriodRange | null) =>
  !r || ((!r.start || p.closeTime >= r.start) && (!r.end || p.closeTime < r.end));

export const ReportsView: React.FC<Props> = ({
  trades, activeAccount, plans = [], hideNoiseRows = false, preChecklist = [], postMistakes = [], onSelectTrade, timezoneOffset, onShowLegacy,
}) => {
  const offset = timezoneOffset !== undefined ? timezoneOffset : getSavedTimezoneOffset();

  const [kind, setKind] = useState<PeriodKind>(() => {
    try { return (localStorage.getItem('bd_report_period') as PeriodKind) || 'MONTH'; } catch { return 'MONTH'; }
  });
  const [step, setStep] = useState(0);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const changeKind = (k: string) => {
    setKind(k as PeriodKind);
    setStep(0);
    try { localStorage.setItem('bd_report_period', k); } catch {}
  };
  const range = useMemo(() => getPeriodRange(kind, step, new Date(), { from, to }), [kind, step, from, to]);
  const prevRange = useMemo(() => getPreviousRange(kind, step, range), [kind, step, range]);

  const [psySettings, setPsySettings] = useState<PsySettings>(() => loadPsySettings());
  const updatePsy = (s: PsySettings) => { setPsySettings(s); savePsySettings(s); };

  // Nhãn lỗi tâm lý: ID → tên Thầy đặt trong cấu hình checklist
  const mistakeLabel = useMemo(() => new Map(postMistakes.map(m => [m.id, m.label])), [postMistakes]);
  const all = useMemo(() => buildPositions(trades, offset, hideNoiseRows).map(p => ({
    ...p, mistakes: p.mistakes.map(id => mistakeLabel.get(id) || id),
  })), [trades, offset, hideNoiseRows, mistakeLabel]);
  const list = useMemo(() => all.filter(p => inRange(p, range)), [all, range]);
  const prevList = useMemo(() => (prevRange ? all.filter(p => inRange(p, prevRange)) : null), [all, prevRange]);

  const initialBalance = useMemo(() => {
    const init = Number(activeAccount?.initial_balance);
    if (init > 0) return init;
    const bal = Number(activeAccount?.balance);
    return bal > 0 ? bal - Number(activeAccount?.pnl || 0) : 0;
  }, [activeAccount]);

  const cur = useMemo(() => summarize(list), [list]);
  const prev = useMemo(() => (prevList ? summarize(prevList) : null), [prevList]);
  const psy = useMemo(() => computePsychology(list, psySettings, plans.length), [list, psySettings, plans.length]);
  const psyPrev = useMemo(() => (prevList ? computePsychology(prevList, psySettings, plans.length) : null), [prevList, psySettings, plans.length]);

  // Đường vốn của kỳ: bắt đầu từ số dư thật tại đầu kỳ
  const startBalance = useMemo(() => {
    if (!range.start) return initialBalance;
    return initialBalance + all.filter(p => p.closeTime < range.start!).reduce((s, p) => s + p.net, 0);
  }, [all, range, initialBalance]);
  const eq = useMemo(() => equityCurve(list, startBalance), [list, startBalance]);
  const days = useMemo(() => dailyNet(list).map(d => ({ label: `${String(d.date.getDate()).padStart(2, '0')}/${String(d.date.getMonth() + 1).padStart(2, '0')}`, net: Number(d.net.toFixed(2)), count: d.count })), [list]);

  const select = (p: Position) => onSelectTrade?.(p.raw);
  const accountId = String(activeAccount?.id || '');

  const kpis: { label: string; cur: number | null; prev: number | null; show: (v: number) => string; cls?: string; fmt: (v: number) => string; neutral?: boolean }[] = [
    { label: 'PnL Net', cur: cur.net, prev: prev?.net ?? null, show: fmtMoney, cls: pnlClass(cur.net), fmt: v => `$${v.toFixed(2)}` },
    { label: 'Số lệnh', cur: cur.count, prev: prev?.count ?? null, show: v => String(v), fmt: v => String(v), neutral: true },
    { label: 'Win Rate', cur: cur.count ? cur.winRate : null, prev: prev?.count ? prev.winRate : null, show: v => `${v.toFixed(1)}%`, fmt: v => `${v.toFixed(1)}%` },
    { label: 'Profit Factor', cur: cur.profitFactor, prev: prev?.profitFactor ?? null, show: v => v.toFixed(2), fmt: v => v.toFixed(2) },
    { label: 'R TB / lệnh', cur: cur.avgR, prev: prev?.avgR ?? null, show: v => fmtR(v), cls: pnlClass(cur.avgR), fmt: v => `${v.toFixed(2)}R` },
    { label: 'Tổng R', cur: cur.rCount ? cur.totalR : null, prev: prev?.rCount ? prev.totalR : null, show: v => fmtR(v), cls: pnlClass(cur.totalR), fmt: v => `${v.toFixed(2)}R` },
    { label: 'Lãi TB / Lỗ TB', cur: cur.payoff, prev: prev?.payoff ?? null, show: v => v.toFixed(2), fmt: v => v.toFixed(2) },
    { label: 'Sụt giảm lớn nhất', cur: list.length ? eq.maxDrawdown : null, prev: null, show: v => `-$${v.toFixed(2)}`, cls: 'text-[#825249]', fmt: v => `$${v.toFixed(2)}` },
    { label: 'Chuỗi thắng / thua', cur: null, prev: null, show: () => '', fmt: () => '' },
    { label: 'Phí + Swap', cur: list.length ? cur.fees : null, prev: prev ? prev.fees : null, show: fmtMoney, cls: pnlClass(cur.fees), fmt: v => `$${v.toFixed(2)}` },
    { label: 'Điểm Tâm Lý', cur: psy.score, prev: psyPrev?.score ?? null, show: v => String(v), cls: scoreClass(psy.score), fmt: v => `${v}` },
  ];

  return (
    <div className="flex flex-col gap-4 py-5 px-3 sm:px-6 max-w-[1500px] mx-auto w-full font-sans">
      {/* KỲ BÁO CÁO + MỤC LỤC */}
      <div className="sticky top-0 z-20 p-3 bg-[var(--bg-card)] rounded-3xl clay-card border border-[var(--border-main)] flex flex-col gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-black text-xs uppercase tracking-wider text-[var(--text-primary)] mr-1">Báo cáo</span>
          <Pills value={kind} onChange={changeKind} options={[['WEEK', 'Tuần'], ['MONTH', 'Tháng'], ['QUARTER', 'Quý'], ['ALL', 'Tất cả'], ['CUSTOM', 'Tùy chọn']]} />
          {(kind === 'WEEK' || kind === 'MONTH' || kind === 'QUARTER') && (
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setStep(s => s - 1)} className="w-7 h-7 rounded-full bg-[var(--bg-subtle)] clay-well font-black hover:text-[#4a6152] cursor-pointer">‹</button>
              <button type="button" onClick={() => setStep(s => Math.min(0, s + 1))} disabled={step >= 0}
                className="w-7 h-7 rounded-full bg-[var(--bg-subtle)] clay-well font-black hover:text-[#4a6152] cursor-pointer disabled:opacity-40 disabled:cursor-default">›</button>
            </div>
          )}
          {kind === 'CUSTOM' && (
            <div className="flex items-center gap-1 text-xs font-mono">
              <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-2 py-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)]" />
              <span>–</span>
              <input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-2 py-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)]" />
            </div>
          )}
          <span className="text-xs font-black font-mono text-[var(--text-primary)]">{range.label}</span>
          {prevRange && <span className={`text-[11px] font-mono ${MUTED}`}>so với {prevRange.label}</span>}
          {onShowLegacy && (
            <button type="button" onClick={onShowLegacy} className={`ml-auto text-[11px] font-bold ${MUTED} hover:text-[#4a6152] cursor-pointer`}>Bản cũ</button>
          )}
        </div>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {NAV.map(([id, label]) => (
            <a key={id} href={`#${id}`} onClick={e => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}
              className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap ${MUTED} hover:text-[#4a6152] bg-[var(--bg-subtle)]`}>{label}</a>
          ))}
        </nav>
      </div>

      {/* TỔNG QUAN KỲ */}
      <Card id="tong-quan" title={`Tổng quan · ${range.label}`}>
        {list.length === 0 ? (
          <div className={`text-sm ${MUTED}`}>Không có lệnh đóng trong kỳ này</div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
              {kpis.map(k => k.label === 'Chuỗi thắng / thua' ? (
                <Stat key={k.label} label={k.label} value={<><span className="text-[#4a6152]">{cur.maxWinStreak}</span> / <span className="text-[#825249]">{cur.maxLossStreak}</span></>} />
              ) : (
                <Stat key={k.label} label={k.label} value={k.cur === null ? '—' : k.show(k.cur)} cls={k.cls}
                  sub={prevRange ? <Delta cur={k.cur} prev={k.prev} fmt={k.fmt} neutral={k.neutral} /> : undefined} />
              ))}
            </div>
            <div className={`text-[11px] font-mono mt-2 ${MUTED}`}>
              {cur.wins} thắng · {cur.losses} thua · {cur.be} hòa · R đo trên {cur.rCount}/{cur.count} lệnh có SL
              {initialBalance <= 0 && ' · Chưa có vốn ban đầu của tài khoản'}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 mt-4">
              <div>
                <div className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${MUTED}`}>Số dư & sụt giảm</div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={eq.points} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={20} />
                      <YAxis yAxisId="b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} width={60} />
                      <YAxis yAxisId="d" orientation="right" tick={{ fontSize: 10 }} width={50} />
                      <Tooltip formatter={(v: any, n: any) => [`$${Number(v).toFixed(2)}`, n === 'balance' ? 'Số dư' : 'Dưới đỉnh']} />
                      <Area yAxisId="d" dataKey="drawdown" stroke="#825249" fill="#825249" fillOpacity={0.15} />
                      <Line yAxisId="b" dataKey="balance" stroke="#4a6152" strokeWidth={2} dot={false} />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div>
                <div className={`text-[11px] font-bold uppercase tracking-wider mb-1 ${MUTED}`}>Lãi / lỗ theo ngày</div>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={days} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-main)" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} minTickGap={10} />
                      <YAxis tick={{ fontSize: 10 }} width={60} />
                      <Tooltip formatter={(v: any) => [fmtMoney(Number(v)), 'PnL']} />
                      <ReferenceLine y={0} stroke="var(--border-main)" />
                      <Bar dataKey="net" radius={[3, 3, 0, 0]}>
                        {days.map(d => <Cell key={d.label} fill={d.net >= 0 ? '#4a6152' : '#825249'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      <PsychologySection psy={psy} psyPrev={psyPrev} all={all} settings={psySettings} onSettings={updatePsy} plansCount={plans.length} onSelect={select} />
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <PlanSection list={list} checklistSize={preChecklist.length} />
        <PropSection all={all} initialBalance={initialBalance} accountId={accountId} />
      </div>
      <PerformanceSection list={list} onSelect={select} />
      <MfeMaeSection list={list} />
      <PartialSection list={list} />
      <WhatIfSection list={list} psy={psy} plansCount={plans.length} />
    </div>
  );
};
