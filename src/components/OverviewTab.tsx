import React from 'react';
import { TradeRow, AccountInfo } from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  Target, 
  Clock, 
  PieChart, 
  Layers, 
  Flame, 
  ShieldCheck 
} from 'lucide-react';
import { formatCurrency } from '../utils/tradeCalculations';

interface OverviewTabProps {
  trades: TradeRow[];
  activeAccount: AccountInfo;
  onNavigateToHistory: () => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  trades,
  activeAccount,
  onNavigateToHistory
}) => {
  const winCount = trades.filter(t => t.result === 'Win').length;
  const lossCount = trades.filter(t => t.result === 'Loss').length;
  const totalTrades = trades.length || 1;
  const winRate = ((winCount / totalTrades) * 100).toFixed(1);

  // Sessions breakdown
  const tokyoTrades = trades.filter(t => t.session === 'Á').length;
  const londonTrades = trades.filter(t => t.session === 'Âu').length;
  const nyTrades = trades.filter(t => t.session === 'Mỹ').length;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* Top Banner KPI */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 rounded-xl bg-[#111622] border border-slate-800">
          <span className="text-xs text-slate-500 font-medium block">Số dư hiện tại</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-mono font-black text-white">
              ${activeAccount.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className="text-xs text-slate-500 font-mono">Gốc: ${activeAccount.initial_balance.toLocaleString()}</span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#111622] border border-slate-800">
          <span className="text-xs text-slate-500 font-medium block">Lãi/Lỗ ròng (Net PnL)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`text-2xl font-mono font-black ${activeAccount.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {activeAccount.pnl >= 0 ? '+' : '-'}${Math.abs(activeAccount.pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
            <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
              activeAccount.pnl >= 0 ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
            }`}>
              {((activeAccount.pnl / activeAccount.initial_balance) * 100).toFixed(2)}%
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#111622] border border-slate-800">
          <span className="text-xs text-slate-500 font-medium block">Tỷ lệ thắng (Win Rate)</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-mono font-black text-cyan-400">
              {winRate}%
            </span>
            <span className="text-xs font-mono text-slate-400">
              {winCount}W / {lossCount}L
            </span>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-[#111622] border border-slate-800">
          <span className="text-xs text-slate-500 font-medium block">Tổng số lệnh đã khớp</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-2xl font-mono font-black text-slate-200">
              {trades.length}
            </span>
            <button
              type="button"
              onClick={onNavigateToHistory}
              className="text-xs text-cyan-400 hover:underline font-medium"
            >
              Xem chi tiết →
            </button>
          </div>
        </div>
      </div>

      {/* Grid: Equity Curve Preview & Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Equity Curve SVG */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-[#111622] border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-sm font-bold text-white">Đường cong tăng trưởng (Equity Curve)</h4>
              <p className="text-xs text-slate-500">Biểu đồ biến động vốn qua từng lệnh giao dịch</p>
            </div>
            <span className="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/60 px-2.5 py-1 rounded border border-emerald-800/40">
              +11.6% Peak
            </span>
          </div>

          {/* SVG Equity Line */}
          <div className="h-56 w-full relative flex items-center justify-center bg-[#0d1117] rounded-lg p-3 border border-slate-800/80">
            <svg viewBox="0 0 600 200" className="w-full h-full">
              <defs>
                <linearGradient id="equityGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <line x1="0" y1="50" x2="600" y2="50" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="0" y1="100" x2="600" y2="100" stroke="#1e293b" strokeDasharray="3 3" />
              <line x1="0" y1="150" x2="600" y2="150" stroke="#1e293b" strokeDasharray="3 3" />
              
              <path
                d="M 0 160 Q 100 130 180 140 T 320 90 T 450 110 T 600 60 L 600 200 L 0 200 Z"
                fill="url(#equityGrad)"
              />
              <path
                d="M 0 160 Q 100 130 180 140 T 320 90 T 450 110 T 600 60"
                fill="none"
                stroke="#38bdf8"
                strokeWidth="2.5"
              />
              <circle cx="600" cy="60" r="4" fill="#38bdf8" />
            </svg>
          </div>
        </div>

        {/* Sessions & Setup Performance */}
        <div className="space-y-4">
          {/* Phân bổ theo phiên */}
          <div className="p-4 rounded-xl bg-[#111622] border border-slate-800 space-y-3">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Phân bổ theo phiên</h4>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Phiên London (Âu):</span>
                <span className="font-mono text-slate-200 font-semibold">{londonTrades} lệnh ({Math.round((londonTrades/totalTrades)*100)}%)</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-blue-500 h-full" style={{ width: `${(londonTrades/totalTrades)*100}%` }} />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400">Phiên New York (Mỹ):</span>
                <span className="font-mono text-slate-200 font-semibold">{nyTrades} lệnh ({Math.round((nyTrades/totalTrades)*100)}%)</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-cyan-400 h-full" style={{ width: `${(nyTrades/totalTrades)*100}%` }} />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-slate-400">Phiên Á (Tokyo):</span>
                <span className="font-mono text-slate-200 font-semibold">{tokyoTrades} lệnh ({Math.round((tokyoTrades/totalTrades)*100)}%)</span>
              </div>
              <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-amber-400 h-full" style={{ width: `${(tokyoTrades/totalTrades)*100}%` }} />
              </div>
            </div>
          </div>

          {/* Thống kê theo Setup */}
          <div className="p-4 rounded-xl bg-[#111622] border border-slate-800 space-y-2.5">
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Thống kê theo Setup</h4>
            <div className="space-y-2 text-xs">
              <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-200 block">POI sau IDM</span>
                  <span className="text-[11px] text-slate-500">1 lệnh (1W / 0L)</span>
                </div>
                <div className="text-right">
                  <span className="text-emerald-400 font-bold font-mono">100%</span>
                  <span className="text-[10px] text-slate-500 block">+$1,281</span>
                </div>
              </div>

              <div className="p-2 rounded bg-slate-900 border border-slate-800 flex items-center justify-between">
                <div>
                  <span className="font-bold text-slate-200 block">Cực Trị</span>
                  <span className="text-[11px] text-slate-500">3 lệnh (0W / 3L)</span>
                </div>
                <div className="text-right">
                  <span className="text-rose-400 font-bold font-mono">0%</span>
                  <span className="text-[10px] text-slate-500 block">-$934</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
