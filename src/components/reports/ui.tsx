import React from 'react';
import { Position } from '../../utils/reportPositions';
import { fmtMoney, fmtR } from '../../utils/reportStats';

export const WIN = 'text-[#4a6152]';
export const LOSS = 'text-[#825249]';
export const MUTED = 'text-[#737973]';
export const WARN = 'text-amber-600';

export const pnlClass = (v: number | null | undefined) => (v === null || v === undefined ? MUTED : v > 0 ? WIN : v < 0 ? LOSS : MUTED);
export const scoreClass = (s: number | null) =>
  s === null ? MUTED : s >= 80 ? WIN : s >= 60 ? WARN : s >= 40 ? 'text-orange-600' : LOSS;

export const Card: React.FC<{ id?: string; title: string; right?: React.ReactNode; children: React.ReactNode }> = ({ id, title, right, children }) => (
  <section id={id} className="bg-[var(--bg-card)] rounded-3xl p-4 sm:p-5 clay-card border border-[var(--border-main)] scroll-mt-24">
    <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
      <h3 className="font-black text-[var(--text-primary)] text-xs tracking-wider uppercase">{title}</h3>
      {right}
    </div>
    {children}
  </section>
);

export const Stat: React.FC<{ label: string; value: React.ReactNode; cls?: string; sub?: React.ReactNode }> = ({ label, value, cls, sub }) => (
  <div className="rounded-2xl p-3 bg-[var(--bg-subtle)] clay-well min-w-0">
    <div className={`text-[11px] font-bold uppercase tracking-wider ${MUTED} truncate`}>{label}</div>
    <div className={`text-lg font-black font-mono mt-1 truncate ${cls || 'text-[var(--text-primary)]'}`}>{value}</div>
    {sub !== undefined && <div className="text-[10px] font-mono mt-0.5">{sub}</div>}
  </div>
);

export function Delta({ cur, prev, fmt, higherIsBetter = true, neutral = false }: {
  cur: number | null; prev: number | null; fmt: (v: number) => string; higherIsBetter?: boolean; neutral?: boolean;
}) {
  if (cur === null || prev === null) return <span className={MUTED}>—</span>;
  const d = cur - prev;
  if (Math.abs(d) < 1e-9) return <span className={MUTED}>= kỳ trước</span>;
  const good = higherIsBetter ? d > 0 : d < 0;
  return <span className={`font-bold ${neutral ? MUTED : good ? WIN : LOSS}`}>{d > 0 ? '▲' : '▼'} {fmt(Math.abs(d))}</span>;
}

export const NumInput: React.FC<{ label: string; value: number | null; onChange: (v: number | null) => void; step?: number }> = ({ label, value, onChange, step = 1 }) => (
  <label className="flex items-center gap-2 text-[11px] font-bold text-[var(--text-secondary)]">
    {label}
    <input type="number" step={step} value={value ?? ''}
      onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}
      className="w-16 px-2 py-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-primary)] font-mono text-xs focus:outline-none focus:border-[#4a6152]" />
  </label>
);

export const Pills: React.FC<{ options: [string, string][]; value: string; onChange: (v: string) => void }> = ({ options, value, onChange }) => (
  <div className="flex items-center gap-1 p-1 rounded-full bg-[var(--bg-subtle)] clay-well flex-wrap">
    {options.map(([k, label]) => (
      <button key={k} type="button" onClick={() => onChange(k)}
        className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
          value === k ? 'bg-[var(--bg-card)] text-[#1d1b17] clay-pill font-black shadow-sm' : 'text-[var(--text-secondary)] hover:text-[#4a6152]'
        }`}>
        {label}
      </button>
    ))}
  </div>
);

const dt = (d: Date) => d.toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

export function PositionList({ list, onSelect, max = 300 }: { list: Position[]; onSelect?: (p: Position) => void; max?: number }) {
  if (!list.length) return <div className={`text-xs ${MUTED} py-2`}>Không có lệnh nào</div>;
  return (
    <div className="mt-3 max-h-64 overflow-auto rounded-xl border border-[var(--border-main)]">
      <table className="w-full text-xs font-mono whitespace-nowrap">
        <tbody>
          {list.slice(0, max).map(p => (
            <tr key={p.id} onClick={() => onSelect?.(p)}
              className="border-b border-[var(--border-main)] last:border-0 hover:text-[#4a6152] cursor-pointer">
              <td className="px-3 py-1.5">#{p.ticket}{p.isScaled ? ` (${p.legs.length} lần cắt)` : ''}</td>
              <td className="px-3 py-1.5">{dt(p.openTime)}</td>
              <td className="px-3 py-1.5">{p.symbol} {p.isBuy ? 'BUY' : 'SELL'}</td>
              <td className="px-3 py-1.5">{p.volume}L</td>
              <td className="px-3 py-1.5 text-right">{fmtR(p.r)}</td>
              <td className={`px-3 py-1.5 text-right font-bold ${pnlClass(p.net)}`}>{fmtMoney(p.net)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Bảng thống kê theo nhóm (phiên, thứ, cặp tiền, setup...) */
export function GroupTable({ rows, keyLabel }: { rows: { key: string; label: string; count: number; winRate: number; net: number; avgR: number | null; profitFactor: number | null }[]; keyLabel: string }) {
  if (!rows.length) return <div className={`text-xs ${MUTED}`}>Chưa có dữ liệu</div>;
  const maxAbs = Math.max(1, ...rows.map(r => Math.abs(r.net)));
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs font-mono whitespace-nowrap">
        <thead>
          <tr className={`${MUTED} text-[10px] uppercase`}>
            <th className="px-2 py-1 text-left">{keyLabel}</th>
            <th className="px-2 py-1 text-right">Lệnh</th>
            <th className="px-2 py-1 text-right">Win</th>
            <th className="px-2 py-1 text-right">PF</th>
            <th className="px-2 py-1 text-right">R TB</th>
            <th className="px-2 py-1 text-right">PnL</th>
            <th className="px-2 py-1 w-24"></th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.key} className="border-t border-[var(--border-main)]">
              <td className="px-2 py-1.5 font-bold text-[var(--text-primary)]">{r.label}</td>
              <td className="px-2 py-1.5 text-right">{r.count}</td>
              <td className="px-2 py-1.5 text-right">{r.winRate.toFixed(0)}%</td>
              <td className="px-2 py-1.5 text-right">{r.profitFactor === null ? (r.net > 0 ? '∞' : '—') : r.profitFactor.toFixed(2)}</td>
              <td className={`px-2 py-1.5 text-right ${pnlClass(r.avgR)}`}>{fmtR(r.avgR)}</td>
              <td className={`px-2 py-1.5 text-right font-bold ${pnlClass(r.net)}`}>{fmtMoney(r.net)}</td>
              <td className="px-2 py-1.5">
                <div className="h-1.5 rounded-full bg-[var(--bg-subtle)] overflow-hidden">
                  <div className={`h-full ${r.net >= 0 ? 'bg-[#4a6152]' : 'bg-[#825249]'}`} style={{ width: `${(Math.abs(r.net) / maxAbs) * 100}%` }} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
