import { useLanguage } from '../context/LanguageContext';
import React, { useState, useMemo } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  AreaChart,
  Area,
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ReferenceLine, 
  Cell 
} from 'recharts';
import { TradeRow, AccountInfo } from '../types';
import { groupTradesByPosition, determineSession } from '../utils/tradeCalculations';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Target, 
  ShieldAlert, 
  Award, 
  Calendar, 
  Activity, 
  CheckCircle2, 
  AlertTriangle, 
  ArrowUpRight, 
  ArrowDownRight, 
  Layers,
  ChevronRight,
  ShieldCheck,
  Flame,
  Clock,
  PieChart,
  BarChart3,
  Percent,
  Sliders,
  Zap,
  Tag,
  ArrowRight
} from 'lucide-react';

interface OverviewTabProps {
  trades: TradeRow[];
  activeAccount: AccountInfo;
  onNavigateToHistory: () => void;
  hideNoiseRows?: boolean;
}

// Custom Tooltip for Cumulative Equity / R-Multiple
const CustomEquityTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isGain = (data.pnl || 0) >= 0;
    return (
      <div className="bg-[#1e232b] border border-[#30363d] rounded-xl p-3 shadow-2xl font-sans text-xs space-y-1.5 min-w-[180px]">
        <div className="flex items-center justify-between pb-1 border-b border-[#30363d] text-slate-400">
          <span className="font-semibold text-slate-200">{data.tradeLabel || `Trade #${data.tradeIndex}`}</span>
          <span className="font-mono text-[11px]">{data.date}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Balance:</span>
          <span className="font-mono font-bold text-white">${Number(data.balance).toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
        {data.pnl !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Trade P&L:</span>
            <span className={`font-mono font-bold ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isGain ? '+' : ''}${Number(data.pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        )}
        {data.rMultiple !== undefined && (
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Cumulative R:</span>
            <span className={`font-mono font-bold ${data.rMultiple >= 0 ? 'text-teal-300' : 'text-rose-400'}`}>
              {data.rMultiple >= 0 ? '+' : ''}{Number(data.rMultiple).toFixed(2)} R
            </span>
          </div>
        )}
        {data.growth !== undefined && (
          <div className="flex items-center justify-between pt-0.5 border-t border-[#30363d]/60">
            <span className="text-slate-400">Return:</span>
            <span className={`font-mono font-bold ${data.growth >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {data.growth >= 0 ? '+' : ''}{data.growth.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
    );
  }
  return null;
};

// Custom Tooltip for TradeZella Daily PnL Bar Chart
const CustomDailyPnlTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload;
    const isGain = (data.dailyPnl || 0) >= 0;
    return (
      <div className="bg-[#1e232b] border border-[#30363d] rounded-xl p-3 shadow-2xl font-sans text-xs space-y-1.5 min-w-[160px]">
        <div className="flex items-center justify-between pb-1 border-b border-[#30363d] text-slate-300 font-bold">
          <span>{data.dateLabel}</span>
          <span className="font-mono text-[10px] text-slate-400">{data.tradesCount} trade(s)</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-slate-400">Daily P&L:</span>
          <span className={`font-mono font-bold text-sm ${isGain ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isGain ? '+' : ''}${Number(data.dailyPnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>
    );
  }
  return null;
};

export const OverviewTab: React.FC<OverviewTabProps> = ({
  trades = [],
  activeAccount,
  onNavigateToHistory,
  hideNoiseRows = false
}) => {
  const { t, language } = useLanguage();
  // Chart Mode: TradeZella Style (Cumulative PnL, Daily PnL, R-Multiple)
  const [chartMode, setChartMode] = useState<'cumulative' | 'daily' | 'rMultiple'>('cumulative');
  const [timeFilter, setTimeFilter] = useState<'ALL' | '30D' | 'MONTH' | 'WEEK'>('ALL');

  // Initial Capital
  const initialBalance = activeAccount?.initial_balance && activeAccount.initial_balance > 0 
    ? activeAccount.initial_balance 
    : 10000;

  // 1. Process and sort closed trades: Gộp các lệnh cắt từng phần thành 1 vị thế (Position) duy nhất
  const closedTrades = useMemo(() => {
    const rawClosed = [...trades]
      .filter(t => (t.status || 'CLOSED').toUpperCase() === 'CLOSED');

    const groups = groupTradesByPosition(rawClosed);
    const filteredGroups = hideNoiseRows
      ? groups.filter(g => !g.is_noise && !(g.total_volume != null && Number(g.total_volume) <= 0.01 && Number(g.total_volume) > 0))
      : groups;

    return filteredGroups.map(g => {
      const master: any = g.master_trade || {};
      return {
        ...master,
        id: g.position_id,
        ticket: g.ticket,
        position_id: g.position_id,
        account_id: g.account_id,
        symbol: g.symbol,
        type: g.type,
        volume: g.total_volume,
        open_price: g.avg_open_price,
        close_price: g.avg_close_price,
        open_time: g.open_time,
        close_time: g.close_time,
        pnl: g.total_gross_pnl,
        commission: g.total_commission,
        swap: g.total_swap,
        net_pnl: g.net_pnl,
        result: g.result,
        weighted_rr: g.weighted_rr,
        pip_sl: g.pip_sl,
        initial_sl: g.initial_sl,
        is_noise: g.is_noise,
        session: master.session || determineSession(g.open_time),
        setup: master.setup,
        setups: master.setups || (master.setup ? [master.setup] : []),
        status: 'CLOSED',
      } as TradeRow;
    }).sort((a, b) => {
      const timeA = new Date((a.close_time || a.open_time || '').replace(/-/g, '/')).getTime() || 0;
      const timeB = new Date((b.close_time || b.open_time || '').replace(/-/g, '/')).getTime() || 0;
      return timeA - timeB;
    });
  }, [trades, hideNoiseRows]);

  // 2. Comprehensive Statistics (Edgewonk & TradeZella Metrics)
  const stats = useMemo(() => {
    if (closedTrades.length > 0) {
      let grossProfit = 0;
      let grossLoss = 0;
      let wins = 0;
      let losses = 0;
      let be = 0;
      let totalPnl = 0;
      let totalVolume = 0;
      let longTrades = 0;
      let longWins = 0;
      let longPnl = 0;
      let shortTrades = 0;
      let shortWins = 0;
      let shortPnl = 0;
      let totalR = 0;

      // Group by setup
      const setupMap: Record<string, { count: number; wins: number; pnl: number }> = {};
      // Group by session
      const sessionMap: Record<string, { count: number; wins: number; pnl: number }> = {};

      closedTrades.forEach(t => {
        const net = t.net_pnl !== undefined ? t.net_pnl : (t.pnl || 0);
        // Lệnh không có SL thì không quy đổi được R, tính 0 thay vì giả định 100$ = 1R
        const r = t.weighted_rr || 0;
        totalPnl += net;
        totalR += r;
        totalVolume += (t.volume || 0);

        if (net > 0) {
          grossProfit += net;
          wins++;
        } else if (net < 0) {
          grossLoss += Math.abs(net);
          losses++;
        } else {
          be++;
        }

        const isLong = (t.type || 'BUY').toUpperCase() === 'BUY';
        if (isLong) {
          longTrades++;
          longPnl += net;
          if (net > 0) longWins++;
        } else {
          shortTrades++;
          shortPnl += net;
          if (net > 0) shortWins++;
        }

        // Setup breakdown
        const setupName = t.setup || 'Standard Setup';
        if (!setupMap[setupName]) {
          setupMap[setupName] = { count: 0, wins: 0, pnl: 0 };
        }
        setupMap[setupName].count++;
        setupMap[setupName].pnl += net;
        if (net > 0) setupMap[setupName].wins++;

        // Session breakdown
        const sName = t.session === 'Á' || t.session === 'Tokyo' ? 'Asian'
          : t.session === 'Âu' || t.session === 'London' ? 'London' : 'New York';
        if (!sessionMap[sName]) {
          sessionMap[sName] = { count: 0, wins: 0, pnl: 0 };
        }
        sessionMap[sName].count++;
        sessionMap[sName].pnl += net;
        if (net > 0) sessionMap[sName].wins++;
      });

      const count = closedTrades.length;
      const winRate = count > 0 ? (wins / count) * 100 : 0;
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 99 : 0;
      const avgWin = wins > 0 ? grossProfit / wins : 0;
      const avgLoss = losses > 0 ? grossLoss / losses : 0;
      const expectancy = count > 0 ? ((wins / count) * avgWin) - ((losses / count) * avgLoss) : 0;
      const avgRR = avgLoss > 0 ? avgWin / avgLoss : 0;

      return {
        count,
        totalTrades: count,
        wins,
        losses,
        be,
        winRate,
        grossProfit,
        grossLoss,
        profitFactor,
        avgWin,
        avgLoss,
        expectancy,
        avgRR,
        avgRiskReward: avgRR,
        totalVolume,
        totalR,
        netPnl: totalPnl,
        currentBalance: initialBalance + totalPnl,
        longTrades,
        longWins,
        longWinRate: longTrades > 0 ? (longWins / longTrades) * 100 : 0,
        longPnl,
        shortTrades,
        shortWins,
        shortWinRate: shortTrades > 0 ? (shortWins / shortTrades) * 100 : 0,
        shortPnl,
        setupStats: Object.entries(setupMap).map(([name, val]) => ({
          name,
          count: val.count,
          winRate: (val.wins / val.count) * 100,
          pnl: val.pnl
        })),
        sessionStats: Object.entries(sessionMap).map(([name, val]) => ({
          name,
          count: val.count,
          winRate: (val.wins / val.count) * 100,
          pnl: val.pnl
        }))
      };
    }

    // Chưa có lệnh đóng: hiển thị 0, không dùng số liệu mẫu
    return {
      count: 0,
      totalTrades: 0,
      wins: 0,
      losses: 0,
      be: 0,
      winRate: 0,
      grossProfit: 0,
      grossLoss: 0,
      profitFactor: 0,
      avgWin: 0,
      avgLoss: 0,
      expectancy: 0,
      avgRR: 0,
      avgRiskReward: 0,
      totalVolume: 0,
      totalR: 0,
      netPnl: 0,
      currentBalance: initialBalance,
      longTrades: 0,
      longWins: 0,
      longWinRate: 0,
      longPnl: 0,
      shortTrades: 0,
      shortWins: 0,
      shortWinRate: 0,
      shortPnl: 0,
      setupStats: [],
      sessionStats: []
    };
  }, [closedTrades, initialBalance]);

  const currentBalance = stats.currentBalance;
  const netPnl = stats.netPnl;
  const netPnlPercent = initialBalance > 0 ? (netPnl / initialBalance) * 100 : 0;

  // Max Drawdown thật: sụt giảm lớn nhất từ đỉnh vốn (theo chuỗi lệnh đã đóng)
  const maxDrawdown = useMemo(() => {
    let running = initialBalance;
    let peak = initialBalance;
    let maxDd = 0;
    closedTrades.forEach(tr => {
      running += tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
      if (running > peak) peak = running;
      if (peak - running > maxDd) maxDd = peak - running;
    });
    return maxDd;
  }, [closedTrades, initialBalance]);
  const maxDrawdownPercent = initialBalance > 0 ? (maxDrawdown / initialBalance) * 100 : 0;

  // 4. Chart Data: Cumulative Curve & R-Multiple
  const cumulativeChartData = useMemo(() => {
    if (closedTrades.length > 0) {
      let running = initialBalance;
      let cumR = 0;
      const points = [
        { tradeIndex: 0, tradeLabel: 'Start', date: 'Start', balance: initialBalance, pnl: 0, growth: 0, rMultiple: 0 }
      ];

      closedTrades.forEach((tr, idx) => {
        const pnl = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
        const r = tr.weighted_rr || 0;
        running += pnl;
        cumR += r;
        const growth = ((running - initialBalance) / initialBalance) * 100;
        const dateStr = tr.close_time ? tr.close_time.slice(5, 16) : `T${idx + 1}`;
        points.push({
          tradeIndex: idx + 1,
          tradeLabel: `Trade #${idx + 1} (${tr.symbol || 'XAUUSD'})`,
          date: dateStr,
          balance: Number(running.toFixed(2)),
          pnl: Number(pnl.toFixed(2)),
          growth: Number(growth.toFixed(2)),
          rMultiple: Number(cumR.toFixed(2))
        });
      });
      return points;
    }

    return [
      { tradeIndex: 0, tradeLabel: 'Start', date: 'Start', balance: initialBalance, pnl: 0, growth: 0, rMultiple: 0 }
    ];
  }, [closedTrades, initialBalance]);

  // 5. Chart Data: TradeZella Daily PnL Bar Chart
  const dailyBarChartData = useMemo(() => {
    const dailyMap: Record<string, { dateLabel: string; dailyPnl: number; tradesCount: number }> = {};

    if (closedTrades.length > 0) {
      closedTrades.forEach(tr => {
        const dateKey = tr.close_time ? tr.close_time.slice(5, 10) : 'Day 1';
        const pnl = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
        if (!dailyMap[dateKey]) {
          dailyMap[dateKey] = { dateLabel: dateKey, dailyPnl: 0, tradesCount: 0 };
        }
        dailyMap[dateKey].dailyPnl += pnl;
        dailyMap[dateKey].tradesCount++;
      });
      return Object.values(dailyMap);
    }

    return [];
  }, [closedTrades]);



  return (
    <div className="flex flex-col min-h-full py-5 px-4 sm:px-6 lg:px-[6%] xl:px-[8%] space-y-6 max-w-[1700px] mx-auto w-full transition-all font-sans select-none">
      
      {/* 1. TOP HEADER BANNER (Tactile Claymorphic Hub Banner) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-3xl bg-[#ede7df] shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.9)]">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-[#cee9d6]/60 flex items-center justify-center shadow-[4px_6px_12px_rgba(74,97,82,0.15),inset_2px_2px_3px_rgba(255,255,255,0.8)] text-[#4a6152]">
            <Activity className="w-7 h-7 stroke-[2.3]" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#737973]">
                {language === 'vi' ? 'BẢNG ĐIỀU KHIỂN ĐỊNH LƯỢNG' : 'QUANTITATIVE HUB'}
              </span>
              <span className="w-2 h-2 rounded-full bg-[#4a6152] animate-pulse"></span>
              <span className="text-[10px] font-bold text-[#4a6152] font-mono">
                Q4 REAL-TIME HUB
              </span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-[#1d1b17] tracking-tight mt-0.5">
              {language === 'vi' ? 'Tổng Quan Hiệu Suất P&L & Nhật Ký Vốn' : 'Performance Overview & Capital Journal'}
            </h1>
          </div>
        </div>

        {/* Period Selector Pills & Quick Action */}
        <div className="flex items-center flex-wrap gap-2">
          <div className="flex items-center p-1 rounded-full bg-[#e8e2da] shadow-[inset_2px_3px_6px_rgba(90,78,68,0.12),inset_-2px_-2px_4px_rgba(255,255,255,0.8)]">
            {(['ALL', '30D', 'MONTH', 'WEEK'] as const).map((period) => (
              <button
                key={period}
                type="button"
                onClick={() => setTimeFilter(period)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  timeFilter === period
                    ? 'bg-white text-[#4a6152] font-black shadow-[3px_4px_10px_rgba(125,110,95,0.12),inset_1px_1px_2px_rgba(255,255,255,0.9)]'
                    : 'text-[#424843] hover:text-[#1d1b17]'
                }`}
              >
                {period === 'ALL' ? (language === 'vi' ? 'Tất cả' : 'All Time') : period === '30D' ? (language === 'vi' ? '30 ngày' : 'Last 30D') : period === 'MONTH' ? (language === 'vi' ? 'Tháng này' : 'This Month') : (language === 'vi' ? 'Tuần này' : 'This Week')}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onNavigateToHistory}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-white hover:bg-[#f9f3eb] clay-pill text-[#1d1b17] text-xs font-bold transition-all cursor-pointer"
          >
            <span>{language === 'vi' ? 'Sổ Nhật Ký Lệnh' : 'Trade Journal'}</span>
            <ChevronRight className="w-3.5 h-3.5 text-[#737973]" />
          </button>
        </div>
      </div>

      {/* 2. ROW 1: 5 KPI CLAY TILES (Tactile Porcelain Pods) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* KPI 1: Net P&L */}
        <div className="p-5 rounded-3xl bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] flex flex-col justify-between hover:translate-y-[-2px] transition-transform">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-2xl bg-[#cee9d6] text-[#4a6152] flex items-center justify-center shadow-[inset_1px_1px_2px_rgba(255,255,255,0.7),2px_3px_6px_rgba(74,97,82,0.12)]">
              <DollarSign className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
              netPnl >= 0 ? 'bg-[#cee9d6] text-[#092014]' : 'bg-[#ffdad4] text-[#93000a]'
            }`}>
              {netPnlPercent >= 0 ? '+' : ''}{Number(netPnlPercent || 0).toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#737973] uppercase tracking-wider block">
              {language === 'vi' ? 'P&L Ròng Tích Lũy' : 'Cumulative Net P&L'}
            </span>
            <div className={`text-2xl font-black font-mono mt-1 ${netPnl >= 0 ? 'text-[#4a6152]' : 'text-[#825249]'}`}>
              {netPnl >= 0 ? '+' : ''}${Number(netPnl || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#e2dbd0] flex items-center justify-between text-xs text-[#424843] font-mono">
            <span>{language === 'vi' ? 'Vốn:' : 'Capital:'} ${Number(initialBalance || 0).toLocaleString()}</span>
            <span className="text-[#737973]">DD: -{Number(maxDrawdownPercent || 0).toFixed(1)}%</span>
          </div>
        </div>

        {/* KPI 2: Win Rate */}
        <div className="p-5 rounded-3xl bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] flex flex-col justify-between hover:translate-y-[-2px] transition-transform">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-2xl bg-[#cde6f4] text-[#475f6b] flex items-center justify-center shadow-[inset_1px_1px_2px_rgba(255,255,255,0.7),2px_3px_6px_rgba(71,95,107,0.15)]">
              <Target className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#cde6f4] text-[#041e28] text-xs font-bold">
              {stats?.totalTrades ?? stats?.count ?? 0} {language === 'vi' ? 'lệnh' : 'trades'}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#737973] uppercase tracking-wider block">
              {language === 'vi' ? 'Tỷ Lệ Lệnh Thắng' : 'Win Rate'}
            </span>
            <div className="text-2xl font-black font-mono text-[#1d1b17] mt-1">
              {Number(stats?.winRate ?? 0).toFixed(1)}%
            </div>
          </div>
          <div className="mt-3 pt-2">
            <div className="w-full bg-[#e8e2da] rounded-full h-2 overflow-hidden shadow-[inset_1px_1px_2px_rgba(0,0,0,0.1)]">
              <div className="bg-[#475f6b] h-2 rounded-full transition-all" style={{ width: `${Number(stats?.winRate ?? 0)}%` }}></div>
            </div>
            <div className="flex justify-between text-[10px] text-[#737973] font-mono mt-1">
              <span>{stats?.wins ?? 0}W</span>
              <span>{stats?.losses ?? 0}L</span>
              <span>{stats?.be ?? 0}BE</span>
            </div>
          </div>
        </div>

        {/* KPI 3: Profit Factor */}
        <div className="p-5 rounded-3xl bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] flex flex-col justify-between hover:translate-y-[-2px] transition-transform">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-2xl bg-[#ffdad4] text-[#825249] flex items-center justify-center shadow-[inset_1px_1px_2px_rgba(255,255,255,0.7),2px_3px_6px_rgba(130,82,73,0.15)]">
              <Award className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#ffdad4] text-[#33110b] text-xs font-bold">
              {Number(stats?.profitFactor ?? 0) >= 2.0 ? 'A+' : Number(stats?.profitFactor ?? 0) >= 1.5 ? 'A' : 'B'}
            </span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#737973] uppercase tracking-wider block">
              {language === 'vi' ? 'Hệ Số Lãi/Lỗ (PF)' : 'Profit Factor'}
            </span>
            <div className="text-2xl font-black font-mono text-[#1d1b17] mt-1">
              {Number(stats?.profitFactor ?? 0).toFixed(2)}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#e2dbd0] flex items-center justify-between text-xs text-[#424843] font-mono">
            <span>+{Number(stats?.grossProfit ?? 0).toFixed(0)}$</span>
            <span className="text-[#825249]">-{Number(stats?.grossLoss ?? 0).toFixed(0)}$</span>
          </div>
        </div>

        {/* KPI 4: Avg R:R */}
        <div className="p-5 rounded-3xl bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] flex flex-col justify-between hover:translate-y-[-2px] transition-transform">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-2xl bg-[#e8e2da] text-[#1d1b17] flex items-center justify-center shadow-[inset_1px_1px_2px_rgba(255,255,255,0.9),2px_3px_6px_rgba(125,110,95,0.1)]">
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#e8e2da] text-[#424843] text-xs font-bold">
              Target &gt; 1:2
            </span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#737973] uppercase tracking-wider block">
              {language === 'vi' ? 'Tỷ Lệ R:R Trung Bình' : 'Average R:R'}
            </span>
            <div className="text-2xl font-black font-mono text-[#1d1b17] mt-1">
              1:{Number(stats?.avgRiskReward ?? stats?.avgRR ?? 1.5).toFixed(2)}
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#e2dbd0] flex items-center justify-between text-xs text-[#424843] font-mono">
            <span>Win: +{Number(stats?.avgWin ?? 0).toFixed(0)}$</span>
            <span>Loss: -{Number(stats?.avgLoss ?? 0).toFixed(0)}$</span>
          </div>
        </div>

        {/* KPI 5: Cumulative R */}
        <div className="p-5 rounded-3xl bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] flex flex-col justify-between hover:translate-y-[-2px] transition-transform">
          <div className="flex items-center justify-between mb-2">
            <div className="w-9 h-9 rounded-2xl bg-[#cee9d6] text-[#4a6152] flex items-center justify-center shadow-[inset_1px_1px_2px_rgba(255,255,255,0.7),2px_3px_6px_rgba(74,97,82,0.12)]">
              <Flame className="w-5 h-5 stroke-[2.5]" />
            </div>
            <span className="px-2.5 py-0.5 rounded-full bg-[#cee9d6] text-[#092014] text-xs font-bold">
              {Number(stats?.totalR ?? 0) >= 0 ? '+' : ''}{Number(stats?.totalR ?? 0).toFixed(1)}R
            </span>
          </div>
          <div>
            <span className="text-[11px] font-bold text-[#737973] uppercase tracking-wider block">
              {language === 'vi' ? 'Tổng Số R Tích Lũy' : 'Cumulative R-Multiple'}
            </span>
            <div className="text-2xl font-black font-mono text-[#4a6152] mt-1">
              {Number(stats?.totalR ?? 0) >= 0 ? '+' : ''}{Number(stats?.totalR ?? 0).toFixed(2)} R
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-[#e2dbd0] flex items-center justify-between text-xs text-[#424843] font-mono">
            <span>{language === 'vi' ? 'Số dư hiện tại:' : 'Equity:'}</span>
            <span className="font-bold text-[#1d1b17]">${Number(activeAccount?.balance ?? initialBalance ?? 10000).toLocaleString('en-US', { minimumFractionDigits: 0 })}</span>
          </div>
        </div>
      </div>

      {/* 3. ROW 2: TACTILE WAVE CHART (8 COLS) + DONUT & METRIC POD (4 COLS) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* Equity Curve & Trajectory Chart (8 Cols) */}
        <div className="lg:col-span-8 p-6 rounded-3xl bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] flex flex-col justify-between relative">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#737973] block">
                {language === 'vi' ? 'Quỹ Đạo Tăng Trưởng Tài Khoản' : 'Account Equity Trajectory'}
              </span>
              <h2 className="text-lg font-bold text-[#1d1b17] mt-0.5">
                {language === 'vi' ? 'Đường Cong Vốn & Mức Sụt Giảm (Equity & Drawdown)' : 'Equity Curve & Drawdown Analysis'}
              </h2>
            </div>

            {/* Chart Sub-mode Switches */}
            <div className="flex items-center gap-1.5 p-1 rounded-full bg-[#ede7df] shadow-[inset_1px_2px_4px_rgba(90,78,68,0.1)]">
              <button
                type="button"
                onClick={() => setChartMode('cumulative')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  chartMode === 'cumulative'
                    ? 'bg-white text-[#4a6152] font-black shadow-[2px_3px_8px_rgba(125,110,95,0.12)]'
                    : 'text-[#424843] hover:text-[#1d1b17]'
                }`}
              >
                Equity ($)
              </button>
              <button
                type="button"
                onClick={() => setChartMode('rMultiple')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  chartMode === 'rMultiple'
                    ? 'bg-white text-[#4a6152] font-black shadow-[2px_3px_8px_rgba(125,110,95,0.12)]'
                    : 'text-[#424843] hover:text-[#1d1b17]'
                }`}
              >
                R-Multiple
              </button>
              <button
                type="button"
                onClick={() => setChartMode('daily')}
                className={`px-3 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  chartMode === 'daily'
                    ? 'bg-white text-[#4a6152] font-black shadow-[2px_3px_8px_rgba(125,110,95,0.12)]'
                    : 'text-[#424843] hover:text-[#1d1b17]'
                }`}
              >
                Daily PnL
              </button>
            </div>
          </div>

          {/* Chart Canvas */}
          <div className="w-full h-80 pt-2">
            <ResponsiveContainer width="100%" height="100%">
              {chartMode === 'daily' ? (
                <BarChart data={dailyBarChartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2dbd0" vertical={false} opacity={0.6} />
                  <XAxis dataKey="dateLabel" stroke="#737973" fontSize={11} tickLine={false} />
                  <YAxis stroke="#737973" fontSize={11} tickLine={false} tickFormatter={(val) => `$${val}`} />
                  <Tooltip content={<CustomDailyPnlTooltip />} />
                  <ReferenceLine y={0} stroke="#d8d0c5" strokeWidth={1.5} />
                  <Bar dataKey="dailyPnl" radius={[6, 6, 0, 0]}>
                    {dailyBarChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.dailyPnl >= 0 ? '#4a6152' : '#825249'} />
                    ))}
                  </Bar>
                </BarChart>
              ) : (
                <AreaChart data={cumulativeChartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="waveAreaGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#4a6152" stopOpacity={0.22} />
                      <stop offset="70%" stopColor="#4a6152" stopOpacity={0.04} />
                      <stop offset="100%" stopColor="#fff8f0" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2dbd0" vertical={false} opacity={0.6} />
                  <XAxis dataKey="tradeLabel" stroke="#737973" fontSize={11} tickLine={false} />
                  <YAxis 
                    stroke="#737973" 
                    fontSize={11} 
                    tickLine={false} 
                    domain={['auto', 'auto']}
                    tickFormatter={(val) => chartMode === 'rMultiple' ? `${val}R` : `$${val.toLocaleString()}`}
                  />
                  <Tooltip content={<CustomEquityTooltip />} />
                  <ReferenceLine 
                    y={chartMode === 'rMultiple' ? 0 : initialBalance} 
                    stroke="#737973" 
                    strokeDasharray="3 3" 
                  />
                  <Area
                    type="monotone"
                    dataKey={chartMode === 'rMultiple' ? 'rMultiple' : 'balance'}
                    stroke="#4a6152"
                    strokeWidth={2.8}
                    fill="url(#waveAreaGrad)"
                    dot={{ fill: '#4a6152', r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: '#4a6152', stroke: '#ffffff', strokeWidth: 2 }}
                  />
                </AreaChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Win/Loss Donut & Allocation Pod (4 Cols) */}
        <div className="lg:col-span-4 p-6 rounded-3xl bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[10px] font-bold text-[#737973] uppercase tracking-wider">
              {language === 'vi' ? 'Cơ Cấu Hiệu Suất' : 'Performance Breakdown'}
            </span>
            <span className="w-2.5 h-2.5 rounded-full bg-[#4a6152]"></span>
          </div>

          {/* Donut Chart Display */}
          <div className="flex flex-col items-center justify-center p-3">
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full transform -rotate-90 drop-shadow-md" viewBox="0 0 100 100">
                <circle cx="50" cy="50" fill="transparent" r="38" stroke="#e8e2da" strokeWidth="13"></circle>
                {/* Loss segment (Terracotta Clay #825249) */}
                <circle
                  cx="50"
                  cy="50"
                  fill="transparent"
                  r="38"
                  stroke="#825249"
                  strokeWidth="13"
                  strokeDasharray={`${(Number(stats?.losses ?? 0) / (Number(stats?.totalTrades ?? 1) || 1)) * 238.7} 238.7`}
                  strokeDashoffset="0"
                  strokeLinecap="round"
                ></circle>
                {/* Win segment (Deep Sage #4a6152) */}
                <circle
                  cx="50"
                  cy="50"
                  fill="transparent"
                  r="38"
                  stroke="#4a6152"
                  strokeWidth="13"
                  strokeDasharray={`${(Number(stats?.wins ?? 0) / (Number(stats?.totalTrades ?? 1) || 1)) * 238.7} 238.7`}
                  strokeDashoffset={`-${(Number(stats?.losses ?? 0) / (Number(stats?.totalTrades ?? 1) || 1)) * 238.7}`}
                  strokeLinecap="round"
                ></circle>
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-black font-mono text-[#1d1b17]">
                  {Number(stats?.winRate ?? 0).toFixed(1)}%
                </span>
                <span className="text-[9px] font-bold uppercase tracking-wider text-[#737973]">
                  WIN RATE
                </span>
              </div>
            </div>
          </div>

          {/* Legend Badges */}
          <div className="grid grid-cols-2 gap-2 mt-2">
            <div className="p-3 rounded-2xl bg-[#ede7df] clay-well flex flex-col">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#4a6152]">
                <span className="w-2 h-2 rounded-full bg-[#4a6152]"></span>
                <span>{language === 'vi' ? 'Thắng (Wins)' : 'Wins'}</span>
              </div>
              <span className="text-lg font-black font-mono text-[#1d1b17] mt-1">
                {stats?.wins ?? 0} <span className="text-xs text-[#737973] font-normal">({Number(stats?.winRate ?? 0).toFixed(0)}%)</span>
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-[#ede7df] clay-well flex flex-col">
              <div className="flex items-center gap-1.5 text-xs font-bold text-[#825249]">
                <span className="w-2 h-2 rounded-full bg-[#825249]"></span>
                <span>{language === 'vi' ? 'Thua (Losses)' : 'Losses'}</span>
              </div>
              <span className="text-lg font-black font-mono text-[#1d1b17] mt-1">
                {stats?.losses ?? 0} <span className="text-xs text-[#737973] font-normal">({Number(100 - (stats?.winRate ?? 0)).toFixed(0)}%)</span>
              </span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-[#e2dbd0] flex items-center justify-between text-xs text-[#424843]">
            <span>{language === 'vi' ? 'Tỷ lệ hòa vốn (BE):' : 'Breakeven trades:'}</span>
            <span className="font-bold font-mono text-[#1d1b17]">{stats?.be ?? 0} {language === 'vi' ? 'lệnh' : 'trades'}</span>
          </div>
        </div>
      </div>

      {/* 4. ROW 3: RECENT TRADES SLAB (Danh sách các lệnh gần nhất) */}
      <div className="p-6 rounded-3xl bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#737973] block">
              {language === 'vi' ? 'Nhật Ký Thực Thi Gần Nhất' : 'Recent Execution Activity'}
            </span>
            <h3 className="text-base font-bold text-[#1d1b17] mt-0.5">
              {language === 'vi' ? 'Tóm Tắt 5 Lệnh Khớp Mới Nhất' : 'Last 5 Closed Positions'}
            </h3>
          </div>
          <button
            type="button"
            onClick={onNavigateToHistory}
            className="text-xs text-[#4a6152] font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <span>{language === 'vi' ? 'Xem toàn bộ lịch sử' : 'View full history'}</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Minimalist Cards / Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-[#e8e2da] text-[#737973] uppercase text-[10px] font-bold">
                <th className="py-2.5 px-3">Ticket</th>
                <th className="py-2.5 px-3">Instrument</th>
                <th className="py-2.5 px-3">Type</th>
                <th className="py-2.5 px-3">Lots</th>
                <th className="py-2.5 px-3">Entry / Exit</th>
                <th className="py-2.5 px-3">P&L ($)</th>
                <th className="py-2.5 px-3">R:R</th>
                <th className="py-2.5 px-3 text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e8e2da] font-mono">
              {closedTrades.slice(-5).reverse().map((t) => {
                const pnlVal = t.net_pnl !== undefined ? t.net_pnl : (t.pnl || 0);
                const isWin = pnlVal > 0;
                const isLoss = pnlVal < 0;
                return (
                  <tr key={t.id || t.ticket} className="hover:bg-[#f9f3eb] transition-colors">
                    <td className="py-3 px-3 font-bold text-[#1d1b17]">#{t.ticket}</td>
                    <td className="py-3 px-3 font-sans font-bold text-[#1d1b17]">{t.symbol}</td>
                    <td className="py-3 px-3">
                      <span className={`font-bold ${t.type === 'BUY' ? 'text-[#4a6152]' : 'text-[#825249]'}`}>
                        {t.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-[#424843]">{t.volume}</td>
                    <td className="py-3 px-3 text-[#424843]">
                      {t.open_price} → {t.close_price || '-'}
                    </td>
                    <td className={`py-3 px-3 font-bold ${isWin ? 'text-[#4a6152]' : isLoss ? 'text-[#825249]' : 'text-[#737973]'}`}>
                      {pnlVal >= 0 ? '+' : ''}${Number(pnlVal || 0).toFixed(2)}
                    </td>
                    <td className={`py-3 px-3 font-bold ${isWin ? 'text-[#4a6152]' : isLoss ? 'text-[#825249]' : 'text-[#737973]'}`}>
                      {t.actual_rr ? `${t.actual_rr > 0 ? '+' : ''}${Number(t.actual_rr || 0).toFixed(2)}R` : '-'}
                    </td>
                    <td className="py-3 px-3 text-right text-[#737973] text-[11px]">
                      {t.close_time ? t.close_time.slice(5, 16) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

