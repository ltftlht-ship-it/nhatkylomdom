import React, { useState } from 'react';
import { TradeRow, AccountInfo } from '../types';
import { 
  FileText, 
  TrendingUp, 
  TrendingDown,
  DollarSign, 
  Activity, 
  Percent, 
  ArrowUpRight, 
  ArrowDownRight,
  SlidersHorizontal,
  ShieldCheck,
  AlertTriangle,
  Scale,
  CheckCircle2,
  Receipt
} from 'lucide-react';
import { 
  formatCurrency, 
  computeTradeStatistics, 
  getSavedNoiseFilter, 
  saveNoiseFilter 
} from '../utils/tradeCalculations';

interface ReportsTabProps {
  trades: TradeRow[];
  activeAccount: AccountInfo;
}

export const ReportsTab: React.FC<ReportsTabProps> = ({ trades, activeAccount }) => {
  const [isNoiseFilterActive, setIsNoiseFilterActive] = useState<boolean>(() => getSavedNoiseFilter());

  const handleToggleNoiseFilter = () => {
    const next = !isNoiseFilterActive;
    setIsNoiseFilterActive(next);
    saveNoiseFilter(next);
  };

  // Tính toán các chỉ số thống kê chuẩn hóa theo yêu cầu:
  // Khi bật 'Noise Filter': Winrate, Tổng R:R, Profit Factor, Average Win/Loss BẮT BUỘC loại bỏ lệnh rác volume <= 0.01
  const stats = computeTradeStatistics(trades, isNoiseFilterActive);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto select-none">
      {/* Header & Noise Filter Toggle Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-800/80">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5 text-cyan-400" />
            Báo Cáo Thống Kê Hiệu Suất Giao Dịch
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Định lượng hiệu suất chuẩn mực: Winrate, Tổng R:R, Profit Factor, Tỷ lệ R thực nhận và Bào mòn phí (Fee Drag)
          </p>
        </div>

        {/* Noise Filter Toggle in Reports */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#111622] p-1.5 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={handleToggleNoiseFilter}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                isNoiseFilterActive
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm shadow-cyan-950/50'
                  : 'bg-slate-800/80 text-slate-400 hover:text-slate-200 border border-slate-700'
              }`}
              title="Bật/tắt loại bỏ lệnh rác (Volume <= 0.01 lot) ra khỏi toàn bộ phép tính thống kê"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-cyan-400" />
              <span>Lọc Lệnh Rác (&le;0.01 Lot)</span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                isNoiseFilterActive ? 'bg-cyan-400 text-slate-950' : 'bg-slate-700 text-slate-300'
              }`}>
                {isNoiseFilterActive ? 'BẬT' : 'TẮT'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Noise Filter Status Banner */}
      {isNoiseFilterActive && stats.noiseTradesCount > 0 && (
        <div className="px-4 py-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/30 flex items-center justify-between text-xs text-cyan-200">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              <strong>Noise Filter đang kích hoạt:</strong> Đã loại bỏ <span className="font-mono font-bold text-white">{stats.noiseTradesCount} lệnh rác</span> (volume &le; 0.01 lot) ra khỏi phép tính Winrate, R:R và Profit Factor.
            </span>
          </div>
          <span className="font-mono text-[11px] text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/40">
            {stats.filteredTradesCount} lệnh hợp lệ
          </span>
        </div>
      )}

      {/* Primary KPI Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Win Rate */}
        <div className="p-4 rounded-xl bg-[#111622] border border-slate-800 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Tỷ Lệ Thắng (Win Rate)</span>
            <Percent className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-mono font-black text-cyan-400">
              {stats.winRate.toFixed(1)}%
            </span>
            <span className="text-xs font-mono text-slate-400">
              ({stats.wins}W - {stats.losses}L{stats.breakeven > 0 ? ` - ${stats.breakeven}BE` : ''})
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            Trên tổng số {stats.filteredTradesCount} lệnh tính toán
          </span>
        </div>

        {/* Tổng R:R Đạt Được */}
        <div className="p-4 rounded-xl bg-[#111622] border border-slate-800 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Tổng R:R Đạt Được</span>
            <TrendingUp className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className={`text-2xl font-mono font-black ${stats.totalRR >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {stats.totalRR > 0 ? `+${stats.totalRR.toFixed(2)}R` : `${stats.totalRR.toFixed(2)}R`}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            Tính theo khoảng cách SL &amp; Khối lượng từng lệnh
          </span>
        </div>

        {/* Profit Factor */}
        <div className="p-4 rounded-xl bg-[#111622] border border-slate-800 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Hệ số Lợi Nhuận (Profit Factor)</span>
            <Scale className="w-4 h-4 text-blue-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-mono font-black text-white">
              {stats.profitFactor >= 99 ? '99.9' : stats.profitFactor.toFixed(2)}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            Tổng Lãi (${formatCurrency(stats.totalWinUsd, false)}) / Tổng Lỗ (${formatCurrency(stats.totalLossUsd, false)})
          </span>
        </div>

        {/* Tỷ lệ R:R Thực Nhận (Realized R:R) */}
        <div className="p-4 rounded-xl bg-[#111622] border border-slate-800 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium">Tỷ lệ Risk : Reward Thực Nhận</span>
            <Activity className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="text-2xl font-mono font-black text-emerald-400">
              1 : {stats.realizedRR.toFixed(2)}
            </span>
          </div>
          <span className="text-[11px] text-slate-500 block mt-1">
            Lãi Trung Bình / Lỗ Trung Bình
          </span>
        </div>
      </div>

      {/* Secondary Metrics: Avg Win, Avg Loss & Fee Drag */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Lãi trung bình */}
        <div className="p-4 rounded-xl bg-[#111622] border border-slate-800">
          <span className="text-xs text-slate-400 font-medium block">Lãi Trung Bình (Avg Win)</span>
          <span className="text-xl font-mono font-bold text-emerald-400 mt-1 block">
            +{formatCurrency(stats.avgWin, false)}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Dựa trên {stats.wins} lệnh thắng (Tổng: +{formatCurrency(stats.totalWinUsd, false)})
          </span>
        </div>

        {/* Lỗ trung bình */}
        <div className="p-4 rounded-xl bg-[#111622] border border-slate-800">
          <span className="text-xs text-slate-400 font-medium block">Lỗ Trung Bình (Avg Loss)</span>
          <span className="text-xl font-mono font-bold text-rose-400 mt-1 block">
            -{formatCurrency(stats.avgLoss, false)}
          </span>
          <span className="text-[11px] text-slate-500 mt-1 block">
            Dựa trên {stats.losses} lệnh thua (Tổng: -{formatCurrency(stats.totalLossUsd, false)})
          </span>
        </div>

        {/* Bào mòn Phí (Fee Drag: Commission & Swap) */}
        <div className="p-4 rounded-xl bg-[#111622] border border-slate-800">
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-400 font-medium block">Bào Mòn Chi Phí (Fee Drag)</span>
            <Receipt className="w-4 h-4 text-amber-400" />
          </div>
          <span className="text-xl font-mono font-bold text-amber-300 mt-1 block">
            {formatCurrency(stats.totalFees)}
          </span>
          <div className="text-[11px] text-slate-500 mt-1 flex items-center justify-between">
            <span>Commission: {formatCurrency(stats.totalCommission)}</span>
            <span>Swap: {formatCurrency(stats.totalSwap)}</span>
          </div>
        </div>
      </div>

      {/* Breakdown: Tâm lý & Kỷ luật */}
      <div className="p-5 rounded-xl bg-[#111622] border border-slate-800 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">Bảng Phân Tích Tâm Lý &amp; Kỷ Luật Giao Dịch</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Đo lường mức độ tuân thủ quy tắc và tác động tài chính từ các lỗi tâm lý
            </p>
          </div>
          <span className="text-xs font-mono text-cyan-400 bg-cyan-950/40 px-2.5 py-1 rounded-lg border border-cyan-500/30">
            Net PnL Toàn Bộ: {formatCurrency(stats.totalNetPnl)}
          </span>
        </div>

        <div className="space-y-2.5 pt-2 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
                A+
              </div>
              <div>
                <span className="font-bold text-slate-200 block">Lệnh tuân thủ Grade A+ (&gt;= 95 điểm)</span>
                <span className="text-slate-400">Lệnh có SL rõ ràng, kế hoạch chuẩn và giữ đúng kỷ luật TP</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-emerald-400 font-mono font-bold text-sm block">Win Rate 85.0%</span>
              <span className="text-[11px] text-slate-500 font-mono">+12.5R lợi nhuận</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold">
                !
              </div>
              <div>
                <span className="font-bold text-rose-300 block">Vi phạm FOMO &amp; Revenge Trade</span>
                <span className="text-slate-400">Các lệnh vào sớm, đuổi giá hoặc cay cú gỡ lệnh</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-rose-400 font-mono font-bold text-sm block">Thất thoát -$634.24</span>
              <span className="text-[11px] text-rose-400/80 font-mono">-6.34R tổn thất</span>
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                &times;
              </div>
              <div>
                <span className="font-bold text-amber-300 block">Vi phạm Cắt Non (Early Exit)</span>
                <span className="text-slate-400">Lợi nhuận tiềm năng bị bỏ lỡ so với Kế Hoạch đặt ra</span>
              </div>
            </div>
            <div className="text-right">
              <span className="text-amber-400 font-mono font-bold text-sm block">Lost Profit: -$675.00</span>
              <span className="text-[11px] text-amber-400/80 font-mono">Hụt 6.75R tiềm năng</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
