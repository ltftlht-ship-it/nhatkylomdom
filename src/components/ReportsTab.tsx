import React, { useState, useMemo, useEffect, useLayoutEffect, useCallback } from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart,
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  Area,
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  Tooltip, 
  CartesianGrid, 
  ReferenceLine, 
  Legend,
  LabelList
} from 'recharts';
import { 
  Calendar, 
  Scissors, 
  Layers, 
  CheckCircle2, 
  XCircle, 
  MinusCircle, 
  Plus, 
  Trash2, 
  Sliders, 
  Search, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCw,
  HelpCircle,
  Filter,
  Flame,
  Brain,
  AlertTriangle,
  Zap,
  Shield,
  TrendingUp,
  Sparkles
} from 'lucide-react';
import { TradeRow, AccountInfo, TradingPlan, PreChecklistItem } from '../types';
import { useLanguage } from '../context/LanguageContext';
import { determineSession, groupTradesByPosition, isNoiseTrade, getSavedTimezoneOffset, formatDateTimeWithOffset, calculateRisk1R } from '../utils/tradeCalculations';
import { PeriodKind, getPeriodRange, getPreviousRange, filterTradesByRange } from '../utils/reportPeriods';

interface ReportsTabProps {
  trades: TradeRow[];
  activeAccount: AccountInfo;
  plans?: TradingPlan[];
  hideNoiseRows?: boolean;
  preChecklist?: PreChecklistItem[];
  onSelectTrade?: (trade: TradeRow) => void;
  timezoneOffset?: number;
}

// Custom Tooltip for Charts - Hỗ trợ chuẩn xác cả Biểu đồ PnL lẫn Giả lập What-If
const CustomChartTooltip = ({ active, payload, label, pnlTimeframe = 'day', language = 'vi', customRRRatio = 2 }: any) => {
  if (active && payload && payload.length) {
    const item = payload[0]?.payload;
    if (!item) return null;

    const formatMoney = (val: number, isEquity = false) => {
      if (isEquity) {
        return `$${val.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
      }
      const prefix = val > 0 ? '+$' : val < 0 ? '-$' : '$';
      return `${prefix}${Math.abs(val).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    };

    // Trường hợp 1: Tooltip của Biểu đồ Giả Lập What-If (có actual, fixedRR), Giả Lập MFE, hoặc Cắt Từng Phần
    if (item.actual !== undefined && (item.fixedRR !== undefined || item.mfeOptimal !== undefined || item.simulated !== undefined)) {
      return (
        <div className="bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)]/95 backdrop-blur-md border border-[#e8e2da] rounded-xl p-3 shadow-2xl font-sans text-xs space-y-2 min-w-[220px]">
          <div className="pb-1.5 border-b border-[#e8e2da] text-[#424843] font-bold flex items-center justify-between">
            <span className="text-[#1d1b17] font-mono">{label || item.trade}</span>
            {item.pnl !== undefined && (
              <span className={`font-mono text-xs font-bold ${item.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatMoney(item.pnl)}
              </span>
            )}
            {item.actualPnl !== undefined && (
              <span className={`font-mono text-xs font-bold ${item.actualPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatMoney(item.actualPnl)}
              </span>
            )}
          </div>

          <div className="space-y-1.5 pt-0.5 font-mono">
            <div className="flex items-center justify-between gap-4">
              <span className="text-emerald-400 flex items-center gap-1.5">
                
                {language === 'vi' ? 'Thực Tế:' : 'Actual:'}
              </span>
              <span className="font-bold text-[#1d1b17]">
                {formatMoney(item.actual, true)}
              </span>
            </div>

            {item.fixedRR !== undefined && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#1d1b17] flex items-center gap-1.5">
                  
                  {language === 'vi' ? `Giả Lập MFE ${customRRRatio}R:` : `Fixed ${customRRRatio}R via MFE:`}
                </span>
                <span className="font-bold text-[#1d1b17]">
                  {formatMoney(item.fixedRR, true)}
                </span>
              </div>
            )}

            {item.simulated !== undefined && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#1d1b17] flex items-center gap-1.5">
                  
                  {language === 'vi' ? 'Cắt Từng Phần:' : 'Scale-Out:'}
                </span>
                <span className="font-bold text-[#1d1b17]">
                  {formatMoney(item.simulated, true)}
                </span>
              </div>
            )}

            {item.mfeOptimal !== undefined && (
              <div className="flex items-center justify-between gap-4">
                <span className="text-[#1d1b17] flex items-center gap-1.5">
                  
                  {language === 'vi' ? 'Chốt theo MFE:' : 'Optimal MFE:'}
                </span>
                <span className="font-bold text-[#1d1b17]">
                  {formatMoney(item.mfeOptimal, true)}
                </span>
              </div>
            )}

            {item.leftOnTable !== undefined && item.leftOnTable > 0 && (
              <div className="flex items-center justify-between gap-4 text-[10px] pt-1 border-t border-[#e8e2da]/50">
                <span className="text-rose-400">
                  {language === 'vi' ? 'Để tuột mất đỉnh:' : 'Left on Table:'}
                </span>
                <span className="font-bold text-rose-300">
                  -${item.leftOnTable.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // Trường hợp 2: Tooltip thông thường của Biểu đồ PnL & Equity tích lũy
    const tradeCount = item.tradeCount;
    const pnl = typeof item.pnl === 'number' ? item.pnl : 0;
    const cumPnl = typeof item.cumPnl === 'number' ? item.cumPnl : 0;
    const equity = typeof item.equity === 'number' ? item.equity : 0;

    const periodPnlLabel = language === 'vi'
      ? (pnlTimeframe === 'day' ? 'PnL ngày hôm đó' : pnlTimeframe === 'week' ? 'PnL tuần này' : 'PnL tháng này')
      : (pnlTimeframe === 'day' ? 'Daily PnL' : pnlTimeframe === 'week' ? 'Weekly PnL' : 'Monthly PnL');

    const totalPnlLabel = language === 'vi' ? 'PnL tổng' : 'Total PnL';
    const equityLabel = 'Equity';

    return (
      <div className="bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)]/95 backdrop-blur-md border border-[#e8e2da] rounded-xl p-3 shadow-2xl font-sans text-xs space-y-2 min-w-[210px]">
        <div className="pb-1.5 border-b border-[#e8e2da] text-[#424843] font-bold flex items-center justify-between">
          <span className="text-[#1d1b17]">{label || item.name}</span>
          {tradeCount !== undefined && tradeCount > 0 && (
            <span className="text-[10px] text-[#737973] font-mono font-medium">
              {tradeCount} {language === 'vi' ? 'lệnh' : 'trades'}
            </span>
          )}
        </div>

        <div className="space-y-1.5 pt-0.5">
          {/* Dòng 1: PnL của ngày hôm đó */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#737973]">{periodPnlLabel}:</span>
            <span className="font-mono font-medium text-[#1d1b17]">
              {formatMoney(pnl)}
            </span>
          </div>

          {/* Dòng 2: PnL tổng */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#737973]">{totalPnlLabel}:</span>
            <span className="font-mono font-medium text-[#1d1b17]">
              {formatMoney(cumPnl)}
            </span>
          </div>

          {/* Dòng 3: Equity */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-[#737973]">{equityLabel}:</span>
            <span className="font-mono font-medium text-[#1d1b17]">
              {formatMoney(equity, true)}
            </span>
          </div>
        </div>
      </div>
    );
  }
  return null;
};

export const ReportsTab: React.FC<ReportsTabProps> = ({
  trades,
  activeAccount,
  plans = [],
  hideNoiseRows = false,
  preChecklist = [],
  onSelectTrade,
  timezoneOffset,
}) => {
  const { language } = useLanguage();
  const activeOffset = timezoneOffset !== undefined ? timezoneOffset : getSavedTimezoneOffset();

  // Sub-tabs / Modules View Controller - Default is 'ALL'
  const [activeSection, setActiveSection] = useState<'ALL' | 'PERIOD' | 'WHAT_IF' | 'MFE_MAE' | 'PARTIAL_SCALE' | 'PSYCHOLOGY' | 'INSTRUMENTS' | 'DISCIPLINE' | 'CAPITAL'>(() => {
    return (localStorage.getItem('deal_report_section') as any) || 'ALL';
  });

  // Kỳ báo cáo: toàn bộ các mục bên dưới đều tính theo kỳ đang chọn
  const [periodKind, setPeriodKind] = useState<PeriodKind>(() => {
    try { return (localStorage.getItem('bd_report_period') as PeriodKind) || 'ALL'; } catch { return 'ALL'; }
  });
  const [periodStep, setPeriodStep] = useState(0);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const changePeriodKind = (k: PeriodKind) => {
    setPeriodKind(k);
    setPeriodStep(0);
    try { localStorage.setItem('bd_report_period', k); } catch {}
  };
  const periodRange = useMemo(
    () => getPeriodRange(periodKind, periodStep, new Date(), { from: customFrom, to: customTo }),
    [periodKind, periodStep, customFrom, customTo]
  );
  const prevPeriodRange = useMemo(() => getPreviousRange(periodKind, periodStep, periodRange), [periodKind, periodStep, periodRange]);

  useEffect(() => {
    const handleSectionChange = (e: any) => {
      if (e?.detail) {
        setActiveSection(e.detail);
        localStorage.setItem('deal_report_section', e.detail);
      }
    };
    window.addEventListener('deal_report_section_changed', handleSectionChange);
    return () => window.removeEventListener('deal_report_section_changed', handleSectionChange);
  }, []);

  const [viewMode] = useState<'positions' | 'deals'>('positions');
  // Đọc trực tiếp prop để bật/tắt Ẩn lệnh rác cập nhật ngay, đồng bộ với Tab Tổng Quan
  const hideNoise = hideNoiseRows;

  // Interactive switchers for visual cards
  const [pnlTimeframe, setPnlTimeframe] = useState<'day' | 'week' | 'month'>('day');
  const [sessionMetric, setSessionMetric] = useState<'pnl' | 'winrate'>('pnl');

  // Đơn vị đo lường toàn diện (Mục 1: Toggle USD / R-Multiple / % Vốn)
  const [metricUnit, setMetricUnit] = useState<'USD' | 'R' | 'PERCENT'>('USD');

  // Tỷ lệ R mục tiêu tùy chỉnh cho mô-đun Giả lập What-If (mặc định 2.0R)
  const [customWhatIfRR, setCustomWhatIfRR] = useState<number>(2.0);

  // Tỷ lệ R mục tiêu tùy chỉnh cho mô-đun Bóc tách MFE/MAE (mặc định 2.0R: 1R, 2R, 3R...)
  const [customMfeRR, setCustomMfeRR] = useState<number>(2.0);

  // Cấu hình mốc Cắt Lệnh Từng Phần (Partial Scale-Out Take-Profit) kèm Tùy chỉnh Dịch SL (Trailing Stop)
  const [partialScaleTiers, setPartialScaleTiers] = useState<Array<{ id: string; portionFraction: string; portionRatio: number; targetR: number; trailStopR: number }>>([
    { id: '1', portionFraction: '1/3', portionRatio: 1 / 3, targetR: 2.0, trailStopR: 0.0 },
    { id: '2', portionFraction: '1/3', portionRatio: 1 / 3, targetR: 4.0, trailStopR: 2.0 },
    { id: '3', portionFraction: '1/3', portionRatio: 1 / 3, targetR: 6.0, trailStopR: 4.0 },
  ]);
  const [partialRemainingMode, setPartialRemainingMode] = useState<'BE' | 'SL' | 'ACTUAL'>('BE');
  const [partialSearchQuery, setPartialSearchQuery] = useState<string>('');
  const [partialFilterStatus, setPartialFilterStatus] = useState<'ALL' | 'WIN' | 'BE' | 'LOSS' | 'BETTER_THAN_ACTUAL'>('ALL');
  const [partialPage, setPartialPage] = useState<number>(1);
  const [partialPageSize, setPartialPageSize] = useState<number>(10);

  // Cấu hình Mục: Dịch SL Liên Tục Không Có TP Cố Định (Continuous Trailing Stop - Runner Mode)
  const [scaleOutSubMode, setScaleOutSubMode] = useState<'CONTINUOUS_TRAILING' | 'TIERS'>('CONTINUOUS_TRAILING');
  const [continuousStepR, setContinuousStepR] = useState<number>(1.5); // Mặc định 1.5R lợi nhuận SL dịch lên 1.5R (có thể thay đổi được)
  const [continuousTrailType, setContinuousTrailType] = useState<'GAP' | 'DIRECT'>('GAP'); // 'GAP': Đệm 1 nấc (1.5R -> BE 0R) | 'DIRECT': Khóa cùng nấc (1.5R -> 1.5R)
  const [continuousSearchQuery, setContinuousSearchQuery] = useState<string>('');
  const [continuousFilterStatus, setContinuousFilterStatus] = useState<'ALL' | 'WIN' | 'BE' | 'LOSS' | 'BETTER_THAN_ACTUAL' | 'RUNNER'>('ALL');
  const [continuousPage, setContinuousPage] = useState<number>(1);
  const [continuousPageSize, setContinuousPageSize] = useState<number>(10);

  // Giả lập dời SL liên tục cần nến M5 của từng lệnh: báo app tải nến (1 lần mỗi phiên) khi mục này hiển thị
  useEffect(() => {
    if ((activeSection === 'ALL' || activeSection === 'PARTIAL_SCALE') && scaleOutSubMode === 'CONTINUOUS_TRAILING') {
      window.dispatchEvent(new Event('bd_need_trade_candles'));
    }
  }, [activeSection, scaleOutSubMode, activeAccount?.id]);

  // Cấu hình mô-đun Rà soát Tâm lý Hậu "Hụt Ăn" (Post-MFE Greed Decay & Revenge Audit)
  const [psychologyMfeThreshold, setPsychologyMfeThreshold] = useState<number>(2.0); // MFE tối thiểu để coi là lệnh chạy ngon (mặc định 2.0R)
  const [psychologyCaptureRateMax, setPsychologyCaptureRateMax] = useState<number>(20); // Tỷ lệ giữ lãi tối đa để coi là hụt ăn (<= 20%, mất >= 80% đỉnh lãi)
  const [psychologyMinHoldingMinutes, setPsychologyMinHoldingMinutes] = useState<number>(15); // Thời gian gồng tối thiểu (phút) để loại trừ giật râu tin tức
  const [psychologyWindowSize, setPsychologyWindowSize] = useState<number>(3); // Số lệnh kế tiếp để quan sát (1, 3, 5, 10 lệnh)
  const [psychologyPage, setPsychologyPage] = useState<number>(1);
  const [psychologyPageSize, setPsychologyPageSize] = useState<number>(10);

  // Cấu hình mô-đun Rà soát Tâm lý Hậu "Thắng Đậm / Đủ TP" (Post-TP Euphoria & Overconfidence Audit)
  const [euphoriaTpThresholdR, setEuphoriaTpThresholdR] = useState<number>(2.0); // Mức lãi thực nhận tối thiểu để tính là thắng đậm (mặc định >= 2.0R)
  const [euphoriaCaptureRateMin, setEuphoriaCaptureRateMin] = useState<number>(66.7); // Tỷ lệ giữ lãi tối thiểu để tính là ăn trọn / đủ TP (mặc định >= 66.7%)
  const [euphoriaWindowSize, setEuphoriaWindowSize] = useState<number>(3); // Số lệnh kế tiếp để quan sát (1, 3, 5, 10 lệnh)
  const [euphoriaPage, setEuphoriaPage] = useState<number>(1);
  const [euphoriaPageSize, setEuphoriaPageSize] = useState<number>(10);

  // Cấu hình mô-đun Kiểm toán Trả Lại Tiền Sau Chuỗi Thắng (Post-Win Streak Clawback)
  const [streakClawbackMinStreak, setStreakClawbackMinStreak] = useState<number>(3); // Chuỗi thắng tối thiểu (mặc định >= 3 lệnh thắng liên tiếp)
  const [streakClawbackWindowSize, setStreakClawbackWindowSize] = useState<number>(3); // Số lệnh kế tiếp sau chuỗi thắng để quan sát (mặc định 3 lệnh)
  const [streakClawbackPage, setStreakClawbackPage] = useState<number>(1);
  const [streakClawbackPageSize, setStreakClawbackPageSize] = useState<number>(10);

  // Logic số dư ban đầu: Luôn lấy từ balance đầu tiên người dùng nhập vào (initial_balance)
  const initialBalance = useMemo(() => {
    const rawInit = Number(activeAccount?.initial_balance);
    if (!isNaN(rawInit) && rawInit > 0) return rawInit;
    const rawBal = Number(activeAccount?.balance);
    const rawPnl = Number(activeAccount?.pnl || 0);
    if (!isNaN(rawBal) && rawBal > 0) {
      const derived = rawBal - rawPnl;
      if (derived > 0) return derived;
      return rawBal;
    }
    return 100000;
  }, [activeAccount?.initial_balance, activeAccount?.balance, activeAccount?.pnl]);

  // =========================================================================
  // 0. CHUẨN HÓA DỮ LIỆU ĐÃ ĐÓNG (ISOLATION TUYỆT ĐỐI THEO TÀI KHOẢN MT5)
  // =========================================================================
  const allClosedTrades = useMemo(() => {
    if (!trades || trades.length === 0) return [];

    const cleanActiveId = String(activeAccount?.id || '').replace(/^acc-/, '').trim();

    const rawClosed = trades.filter(t => {
      if (t.status && t.status !== 'CLOSED') return false;

      if (cleanActiveId && cleanActiveId !== 'ALL') {
        const tAcc = String(t.account_id ?? (t as any).account ?? (t as any).login ?? (t as any).mt5_account ?? (t as any).user_id ?? '').replace(/^acc-/, '').trim();
        if (tAcc && tAcc !== cleanActiveId) return false;
      }

      return true;
    });

    if (viewMode === 'positions') {
      const groups = groupTradesByPosition(rawClosed);
      const filteredGroups = hideNoise 
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
          risk_1r_usd: g.total_risk_1r || master.risk_1r_usd || (g.initial_sl ? calculateRisk1R(g.avg_open_price, g.initial_sl, g.total_volume, 100, 100, g.symbol) : undefined),
          is_noise: g.is_noise,
          session: master.session || determineSession(g.open_time),
          setup: master.setup,
          setups: master.setups || (master.setup ? [master.setup] : []),
          pre_checklist_ids: master.pre_checklist_ids,
          post_checklist_ids: master.post_checklist_ids,
          timeframe: master.timeframe || 'M15',
          notes: master.notes,
          plan_id: master.plan_id,
          plan_pnl: master.plan_pnl,
          lost_profit: master.lost_profit,
          tp1_r: master.tp1_r,
          tp2_r: master.tp2_r,
          tp3_r: master.tp3_r,
          high: master.high,
          low: master.low,
          mfe_price: master.mfe_price,
          mae_price: master.mae_price,
          mfe_dist: master.mfe_dist,
          mae_dist: master.mae_dist,
          mfe_r: master.mfe_r,
          status: 'CLOSED',
          candles: master.candles || (g.trades && g.trades.find((s: any) => s.candles)?.candles),
        } as TradeRow;
      }).sort((a, b) => {
        const timeA = new Date((a.close_time || a.open_time || '').replace(/-/g, '/')).getTime() || 0;
        const timeB = new Date((b.close_time || b.open_time || '').replace(/-/g, '/')).getTime() || 0;
        return timeA - timeB;
      });
    }

    const map = new Map<string, TradeRow>();
    rawClosed.forEach(t => {
      if (hideNoise && (t.is_noise || (t.volume != null && Number(t.volume) <= 0.01))) {
        return;
      }
      const key = String(t.ticket || t.id || '').trim();
      if (key && !map.has(key)) {
        map.set(key, t);
      } else if (!key) {
        map.set(`t-${Math.random()}`, t);
      }
    });

    return Array.from(map.values()).sort((a, b) => {
      const timeA = new Date((a.close_time || a.open_time || '').replace(/-/g, '/')).getTime() || 0;
      const timeB = new Date((b.close_time || b.open_time || '').replace(/-/g, '/')).getTime() || 0;
      return timeA - timeB;
    });
  }, [trades, activeAccount, viewMode, hideNoise]);

  // Lệnh trong kỳ đang chọn (mọi mục báo cáo bên dưới dùng closedTrades) và kỳ trước để so sánh
  const closedTrades = useMemo(
    () => filterTradesByRange(allClosedTrades, periodRange, activeOffset),
    [allClosedTrades, periodRange, activeOffset]
  );

  // =========================================================================
  // 1. CHỈ SỐ RỦI RO CỐT LÕI & CHUỖI THẮNG / THUA (CORE RISK & STREAKS)
  // =========================================================================
  const coreRiskData = useMemo(() => {
    let grossProfit = 0;
    let grossLoss = 0;
    let totalWins = 0;
    let totalLosses = 0;

    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let maxWinStreak = 0;
    let maxLossStreak = 0;

    let lastStreakType: 'WIN' | 'LOSS' | null = null;
    let activeStreakCount = 0;

    closedTrades.forEach(tr => {
      const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
      if (net > 0) {
        grossProfit += net;
        totalWins++;
        currentWinStreak++;
        currentLossStreak = 0;
        if (currentWinStreak > maxWinStreak) maxWinStreak = currentWinStreak;

        if (lastStreakType === 'WIN') {
          activeStreakCount++;
        } else {
          lastStreakType = 'WIN';
          activeStreakCount = 1;
        }
      } else if (net < 0) {
        grossLoss += Math.abs(net);
        totalLosses++;
        currentLossStreak++;
        currentWinStreak = 0;
        if (currentLossStreak > maxLossStreak) maxLossStreak = currentLossStreak;

        if (lastStreakType === 'LOSS') {
          activeStreakCount++;
        } else {
          lastStreakType = 'LOSS';
          activeStreakCount = 1;
        }
      }
    });

    const netPnl = Number((grossProfit - grossLoss).toFixed(2));
    const totalCount = closedTrades.length;
    const winRate = totalCount > 0 ? Number(((totalWins / totalCount) * 100).toFixed(1)) : 0;
    const lossRate = totalCount > 0 ? Number(((totalLosses / totalCount) * 100).toFixed(1)) : 0;

    const profitFactor = grossLoss > 0 
      ? Number((grossProfit / grossLoss).toFixed(2)) 
      : grossProfit > 0 ? 99.99 : 0;

    const avgWin = totalWins > 0 ? Number((grossProfit / totalWins).toFixed(2)) : 0;
    const avgLoss = totalLosses > 0 ? Number((grossLoss / totalLosses).toFixed(2)) : 0;
    const winLossRatio = avgLoss > 0 ? Number((avgWin / avgLoss).toFixed(2)) : (avgWin > 0 ? avgWin : 0);
    
    const expectancy = totalCount > 0 
      ? Number(((winRate / 100) * avgWin - (lossRate / 100) * avgLoss).toFixed(2)) 
      : 0;

    // Tính toán các chỉ số quy đổi theo R-Multiple
    let totalR = 0;
    let grossProfitR = 0;
    let grossLossR = 0;
    let totalRisk1RSum = 0;
    let countWithRisk = 0;

    closedTrades.forEach(tr => {
      const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
      const risk1R = tr.risk_1r_usd && tr.risk_1r_usd > 0 ? tr.risk_1r_usd : 100;
      totalRisk1RSum += risk1R;
      countWithRisk++;
      const r = tr.weighted_rr !== undefined && !isNaN(tr.weighted_rr) ? tr.weighted_rr : (net / risk1R);
      totalR += r;
      if (r > 0) grossProfitR += r;
      else if (r < 0) grossLossR += Math.abs(r);
    });

    const totalAvgRisk1R = countWithRisk > 0 ? totalRisk1RSum / countWithRisk : 100;
    const avgWinR = totalWins > 0 ? Number((grossProfitR / totalWins).toFixed(2)) : 0;
    const avgLossR = totalLosses > 0 ? Number((grossLossR / totalLosses).toFixed(2)) : 0;
    const expectancyR = totalCount > 0 ? Number((totalR / totalCount).toFixed(2)) : 0;

    // TÍNH SQN (System Quality Number theo Van Tharp):
    // SQN = sqrt(N) * (Mean R / StdDev R)
    let sqn = 0;
    let rStdDev = 0;
    if (totalCount >= 2) {
      const meanR = totalR / totalCount;
      let sumSqDiff = 0;
      closedTrades.forEach(tr => {
        const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
        const risk1R = tr.risk_1r_usd && tr.risk_1r_usd > 0 ? tr.risk_1r_usd : 100;
        const r = tr.weighted_rr !== undefined && !isNaN(tr.weighted_rr) ? tr.weighted_rr : (net / risk1R);
        sumSqDiff += Math.pow(r - meanR, 2);
      });
      rStdDev = Math.sqrt(sumSqDiff / totalCount);
      if (rStdDev > 0) {
        sqn = Number((Math.sqrt(totalCount) * (meanR / rStdDev)).toFixed(2));
      }
    }

    let sqnRating: 'EXCELLENT' | 'GOOD' | 'AVERAGE' | 'POOR' = 'AVERAGE';
    if (sqn >= 3.0) sqnRating = 'EXCELLENT';
    else if (sqn >= 2.0) sqnRating = 'GOOD';
    else if (sqn >= 1.6) sqnRating = 'AVERAGE';
    else sqnRating = 'POOR';

    return {
      grossProfit: Number(grossProfit.toFixed(2)),
      grossLoss: Number(grossLoss.toFixed(2)),
      grossProfitR: Number(grossProfitR.toFixed(2)),
      grossLossR: Number(grossLossR.toFixed(2)),
      totalR: Number(totalR.toFixed(2)),
      totalAvgRisk1R: Number(totalAvgRisk1R.toFixed(2)),
      avgWinR,
      avgLossR,
      expectancyR,
      sqn,
      rStdDev: Number(rStdDev.toFixed(2)),
      sqnRating,
      netPnl,
      totalWins,
      totalLosses,
      totalCount,
      winRate,
      profitFactor,
      maxWinStreak,
      maxLossStreak,
      currentStreakType: lastStreakType || 'WIN',
      currentStreakCount: activeStreakCount,
      avgWin,
      avgLoss,
      winLossRatio,
      expectancy
    };
  }, [closedTrades]);

  // Helper định dạng giá trị theo đơn vị được chọn ($ / R / %)
  const formatMetricValue = useCallback((usdVal: number, rVal?: number, showSign = true) => {
    if (metricUnit === 'R') {
      const r = rVal !== undefined ? rVal : (coreRiskData.totalAvgRisk1R > 0 ? usdVal / coreRiskData.totalAvgRisk1R : usdVal / 100);
      const absR = Math.abs(r);
      const sign = r > 0 ? '+' : r < 0 ? '-' : '';
      return `${showSign ? sign : (r < 0 ? '-' : '')}${absR.toFixed(2)}R`;
    }
    if (metricUnit === 'PERCENT') {
      const pct = initialBalance > 0 ? (usdVal / initialBalance) * 100 : 0;
      const absPct = Math.abs(pct);
      const sign = pct > 0 ? '+' : pct < 0 ? '-' : '';
      return `${showSign ? sign : (pct < 0 ? '-' : '')}${absPct.toFixed(2)}%`;
    }
    // Mặc định USD
    const abs = Math.abs(usdVal);
    const sign = usdVal > 0 ? '+' : usdVal < 0 ? '-' : '';
    return `${showSign ? sign : (usdVal < 0 ? '-' : '')}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, [metricUnit, initialBalance, coreRiskData.totalAvgRisk1R]);

  // Số dư tài khoản thực tế còn lại hiện tại = Vốn ban đầu nhập vào + Lãi/lỗ ròng
  const currentBalance = useMemo(() => {
    return Number((initialBalance + coreRiskData.netPnl).toFixed(2));
  }, [initialBalance, coreRiskData.netPnl]);

  // =========================================================================
  // 2. TÍNH TOÁN MAX DRAWDOWN TỪ EQUITY THỰC TẾ
  // =========================================================================
  const maxDrawdownData = useMemo(() => {
    let runningEq = initialBalance;
    let peak = initialBalance;
    let maxDdUsd = 0;
    let maxDdPct = 0;

    closedTrades.forEach(tr => {
      const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
      runningEq += net;
      if (runningEq > peak) {
        peak = runningEq;
      }
      const dd = peak - runningEq;
      if (dd > maxDdUsd) {
        maxDdUsd = dd;
        maxDdPct = peak > 0 ? (dd / peak) * 100 : 0;
      }
    });

    const avgRisk1R = closedTrades.reduce((acc, t) => acc + (t.risk_1r_usd || 100), 0) / (closedTrades.length || 1);
    const maxDdR = avgRisk1R > 0 ? Number((maxDdUsd / avgRisk1R).toFixed(2)) : 0;

    return {
      maxDdUsd: Number(maxDdUsd.toFixed(2)),
      maxDdPct: Number(maxDdPct.toFixed(2)),
      maxDdR
    };
  }, [closedTrades, initialBalance]);

  // =========================================================================
  // 3. THỜI GIAN VÀ PHIÊN GIAO DỊCH (SESSIONS & DAY OF WEEK)
  // =========================================================================
  const timeAndSessionData = useMemo(() => {
    const daysMap: Record<number, { count: number; wins: number; pnl: number; grossProfit: number; grossLoss: number }> = {
      1: { count: 0, wins: 0, pnl: 0, grossProfit: 0, grossLoss: 0 },
      2: { count: 0, wins: 0, pnl: 0, grossProfit: 0, grossLoss: 0 },
      3: { count: 0, wins: 0, pnl: 0, grossProfit: 0, grossLoss: 0 },
      4: { count: 0, wins: 0, pnl: 0, grossProfit: 0, grossLoss: 0 },
      5: { count: 0, wins: 0, pnl: 0, grossProfit: 0, grossLoss: 0 },
      6: { count: 0, wins: 0, pnl: 0, grossProfit: 0, grossLoss: 0 },
      0: { count: 0, wins: 0, pnl: 0, grossProfit: 0, grossLoss: 0 },
    };

    const sessionsMap: Record<string, { count: number; wins: number; losses: number; pnl: number }> = {
      'Âu': { count: 0, wins: 0, losses: 0, pnl: 0 },
      'Mỹ': { count: 0, wins: 0, losses: 0, pnl: 0 },
      'Á': { count: 0, wins: 0, losses: 0, pnl: 0 },
    };

    const monthsMap: Record<number, { count: number; wins: number; pnl: number }> = {};
    for (let m = 0; m < 12; m++) {
      monthsMap[m] = { count: 0, wins: 0, pnl: 0 };
    }

    closedTrades.forEach(tr => {
      const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
      const raw = tr.open_time;
      let openDate: Date | null = null;
      if (raw) {
        const cleanRaw = raw.includes('T') ? raw : raw.replace(/[\.\-]/g, '/');
        const baseDate = new Date(cleanRaw);
        if (!isNaN(baseDate.getTime())) {
          openDate = new Date(baseDate.getTime() + activeOffset * 3600 * 1000);
        }
      }

      if (openDate && !isNaN(openDate.getTime())) {
        const day = openDate.getDay();
        if (daysMap[day] !== undefined) {
          daysMap[day].count++;
          daysMap[day].pnl += net;
          if (net > 0) {
            daysMap[day].wins++;
            daysMap[day].grossProfit += net;
          } else {
            daysMap[day].grossLoss += Math.abs(net);
          }
        }

        const month = openDate.getMonth();
        if (monthsMap[month]) {
          monthsMap[month].count++;
          monthsMap[month].pnl += net;
          if (net > 0) monthsMap[month].wins++;
        }
      }

      const sess = determineSession(tr.open_time || '', activeOffset);
      const sKey = sess === 'Á' || sess === 'Âu' || sess === 'Mỹ' ? sess : 'Âu';
      sessionsMap[sKey].count++;
      sessionsMap[sKey].pnl += net;
      if (net > 0) {
        sessionsMap[sKey].wins++;
      } else if (net < 0) {
        sessionsMap[sKey].losses++;
      }
    });

    const dayLabels: Record<number, { en: string; vi: string }> = {
      1: { en: 'Mon', vi: 'Thứ 2' },
      2: { en: 'Tue', vi: 'Thứ 3' },
      3: { en: 'Wed', vi: 'Thứ 4' },
      4: { en: 'Thu', vi: 'Thứ 5' },
      5: { en: 'Fri', vi: 'Thứ 6' },
      6: { en: 'Sat', vi: 'Thứ 7' },
      0: { en: 'Sun', vi: 'Chủ nhật' }
    };

    const dayOfWeekData = [1, 2, 3, 4, 5, 6, 0].map(d => {
      const item = daysMap[d];
      const winRate = item.count > 0 ? Number(((item.wins / item.count) * 100).toFixed(1)) : 0;
      const pnlDisplay = item.count > 0 
        ? (item.pnl >= 0 
            ? `+$${item.pnl.toLocaleString('en-US', { maximumFractionDigits: 0 })}` 
            : `-$${Math.abs(item.pnl).toLocaleString('en-US', { maximumFractionDigits: 0 })}`)
        : '-';
      return {
        dayKey: d,
        name: language === 'vi' ? dayLabels[d].vi : dayLabels[d].en,
        pnl: Number(item.pnl.toFixed(2)),
        pnlDisplay,
        count: item.count,
        winRate: winRate,
        isPositive: item.pnl >= 0
      };
    });

    // Mốc trục Y cho phân tích theo ngày trong tuần: mỗi mốc đúng 2500 ($2,500)
    const dowStep = 2500;
    const dowPnls = dayOfWeekData.map(d => d.pnl);
    const minDowPnl = Math.min(0, ...dowPnls);
    const maxDowPnl = Math.max(0, ...dowPnls);

    // Tính mốc chẵn theo bước 2500:
    // minDowVal: làm tròn xuống bội số của 2500 (nếu có pnl âm)
    const minDowVal = minDowPnl < 0 ? Math.floor(minDowPnl / dowStep) * dowStep : 0;
    // maxDowVal: tối thiểu đạt 10,000 để các mốc 2k5, 5k, 7k5, 10k luôn hiển thị đầy đủ, hoặc cao hơn theo bước 2500
    const maxDowVal = Math.max(10000, Math.ceil(maxDowPnl / dowStep) * dowStep);

    const dowTicks: number[] = [];
    for (let v = minDowVal; v <= maxDowVal; v += dowStep) {
      dowTicks.push(v);
    }

    const activeDays = dayOfWeekData.filter(d => d.count > 0);
    let bestDay = activeDays.length > 0 ? activeDays[0] : dayOfWeekData[0];
    let worstDay = activeDays.length > 0 ? activeDays[0] : dayOfWeekData[0];
    activeDays.forEach(d => {
      if (d.pnl > bestDay.pnl) bestDay = d;
      if (d.pnl < worstDay.pnl) worstDay = d;
    });

    const totalSessionTrades = closedTrades.length || 1;

    // Danh sách 3 phiên chuẩn: London, New York, Tokyo
    // Logic: 
    // - Lãi: Màu xanh (#10b981), thanh chiếm theo % lệnh thắng (winRate)
    // - Lỗ: Màu đỏ (#f43f5e), thanh chiếm theo % lệnh thua (lossRate, ví dụ 10 lệnh thua 9 thì chia làm 10 phần hiển thị hết 9 phần = 90%)
    const rawSessions = [
      {
        id: 'London',
        name: 'London',
        count: sessionsMap['Âu'].count,
        wins: sessionsMap['Âu'].wins,
        losses: sessionsMap['Âu'].losses,
        pnl: Number(sessionsMap['Âu'].pnl.toFixed(2)),
        winRate: sessionsMap['Âu'].count > 0 ? Number(((sessionsMap['Âu'].wins / sessionsMap['Âu'].count) * 100).toFixed(1)) : 0,
        lossRate: sessionsMap['Âu'].count > 0 ? Number(((sessionsMap['Âu'].losses / sessionsMap['Âu'].count) * 100).toFixed(1)) : 0,
      },
      {
        id: 'New York',
        name: 'New York',
        count: sessionsMap['Mỹ'].count,
        wins: sessionsMap['Mỹ'].wins,
        losses: sessionsMap['Mỹ'].losses,
        pnl: Number(sessionsMap['Mỹ'].pnl.toFixed(2)),
        winRate: sessionsMap['Mỹ'].count > 0 ? Number(((sessionsMap['Mỹ'].wins / sessionsMap['Mỹ'].count) * 100).toFixed(1)) : 0,
        lossRate: sessionsMap['Mỹ'].count > 0 ? Number(((sessionsMap['Mỹ'].losses / sessionsMap['Mỹ'].count) * 100).toFixed(1)) : 0,
      },
      {
        id: 'Tokyo',
        name: 'Tokyo',
        count: sessionsMap['Á'].count,
        wins: sessionsMap['Á'].wins,
        losses: sessionsMap['Á'].losses,
        pnl: Number(sessionsMap['Á'].pnl.toFixed(2)),
        winRate: sessionsMap['Á'].count > 0 ? Number(((sessionsMap['Á'].wins / sessionsMap['Á'].count) * 100).toFixed(1)) : 0,
        lossRate: sessionsMap['Á'].count > 0 ? Number(((sessionsMap['Á'].losses / sessionsMap['Á'].count) * 100).toFixed(1)) : 0,
      }
    ];

    const sessionList = rawSessions.map(s => {
      const isProfit = s.pnl >= 0;
      const barWidth = s.count > 0 ? (isProfit ? s.winRate : s.lossRate) : 0;
      const barColorClass = isProfit 
        ? 'bg-[#10b981] shadow-[0_0_8px_rgba(16,185,129,0.35)]' 
        : 'bg-[#f43f5e] shadow-[0_0_8px_rgba(244,63,94,0.35)]';
      return {
        ...s,
        isProfit,
        barWidth,
        barColorClass,
        tradePct: Number(((s.count / totalSessionTrades) * 100).toFixed(1)),
      };
    });

    let worstSession = sessionList[0];
    sessionList.forEach(s => {
      if (s.pnl < worstSession.pnl) worstSession = s;
    });

    const monthNamesEn = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const monthNamesVi = ['T1', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'T8', 'T9', 'T10', 'T11', 'T12'];
    const monthlyGrid = [];
    for (let m = 0; m < 12; m++) {
      const item = monthsMap[m];
      const count = item.count;
      const pnl = Number(item.pnl.toFixed(2));
      const winRate = count > 0 ? Number(((item.wins / count) * 100).toFixed(1)) : 0;
      monthlyGrid.push({
        monthIdx: m,
        name: language === 'vi' ? monthNamesVi[m] : monthNamesEn[m],
        pnl,
        count,
        winRate,
        status: count === 0 ? 'EMPTY' : (pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BE')
      });
    }

    return {
      dayOfWeekData,
      bestDay,
      worstDay,
      hasActiveDays: activeDays.length > 0,
      sessionList,
      worstSession,
      monthlyGrid,
      dowTicks,
      dowDomain: [minDowVal, maxDowVal] as [number, number]
    };
  }, [closedTrades, language, activeOffset]);

  // =========================================================================
  // 4. THỜI GIAN GIỮ LỆNH TRUNG BÌNH & PHÂN BỔ DURATION (TỪ DỮ LIỆU MT5)
  // =========================================================================
  const holdingTimeData = useMemo(() => {
    let totalMinutes = 0;
    let validCount = 0;

    const buckets = [
      { label: '< 15m', min: 0, max: 15, count: 0, wins: 0, pnl: 0 },
      { label: '15m-1h', min: 15, max: 60, count: 0, wins: 0, pnl: 0 },
      { label: '1h-4h', min: 60, max: 240, count: 0, wins: 0, pnl: 0 },
      { label: '4h-12h', min: 240, max: 720, count: 0, wins: 0, pnl: 0 },
      { label: '12h-1d', min: 720, max: 1440, count: 0, wins: 0, pnl: 0 },
      { label: '1d+', min: 1440, max: Infinity, count: 0, wins: 0, pnl: 0 },
    ];

    closedTrades.forEach(tr => {
      if (tr.open_time && tr.close_time) {
        const tOpen = new Date(tr.open_time.replace(/-/g, '/')).getTime();
        const tClose = new Date(tr.close_time.replace(/-/g, '/')).getTime();
        if (!isNaN(tOpen) && !isNaN(tClose) && tClose >= tOpen) {
          const diffMinutes = Math.max(0, (tClose - tOpen) / 60000);
          totalMinutes += diffMinutes;
          validCount++;

          const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
          const isWin = net > 0 || tr.result === 'Win';

          for (const b of buckets) {
            if (diffMinutes >= b.min && diffMinutes < b.max) {
              b.count++;
              b.pnl += net;
              if (isWin) b.wins++;
              break;
            }
          }
        }
      }
    });

    const avgMinutes = validCount > 0 ? Math.round(totalMinutes / validCount) : 0;
    const hours = Math.floor(avgMinutes / 60);
    const mins = avgMinutes % 60;
    const formattedAvg = validCount > 0 ? `${hours}h ${mins}m` : '0h 0m';

    const bucketData = buckets.map(b => {
      const winRate = b.count > 0 ? Math.round((b.wins / b.count) * 100) : 0;
      const pct = validCount > 0 ? Math.round((b.count / validCount) * 100) : 0;
      return {
        label: b.label,
        count: b.count,
        wins: b.wins,
        winRate,
        winRateDisplay: b.count > 0 ? `${winRate}%` : '-',
        pct,
        pnl: Number(b.pnl.toFixed(2))
      };
    });

    return {
      formattedAvg,
      bucketData,
      validCount
    };
  }, [closedTrades]);

  // =========================================================================
  // 4.1. BẢNG NHIỆT MA TRẬN 24 GIỜ TRONG TUẦN (INTRADAY HOURLY HEATMAP 0H - 23H)
  // =========================================================================
  const intradayHourlyMatrix = useMemo(() => {
    const dayKeys = [1, 2, 3, 4, 5, 6, 0]; // Thứ 2 đến Chủ nhật
    const dayLabels: Record<number, { vi: string; en: string; short: string }> = {
      1: { vi: 'Thứ 2', en: 'Monday', short: 'T2' },
      2: { vi: 'Thứ 3', en: 'Tuesday', short: 'T3' },
      3: { vi: 'Thứ 4', en: 'Wednesday', short: 'T4' },
      4: { vi: 'Thứ 5', en: 'Thursday', short: 'T5' },
      5: { vi: 'Thứ 6', en: 'Friday', short: 'T6' },
      6: { vi: 'Thứ 7', en: 'Saturday', short: 'T7' },
      0: { vi: 'Chủ nhật', en: 'Sunday', short: 'CN' }
    };

    // grid[dayKey][hour]
    const grid: Record<number, Record<number, { count: number; wins: number; pnl: number; r: number }>> = {};
    const hourTotals: Record<number, { count: number; wins: number; pnl: number; r: number }> = {};
    const dayTotals: Record<number, { count: number; wins: number; pnl: number; r: number }> = {};

    for (let h = 0; h < 24; h++) {
      hourTotals[h] = { count: 0, wins: 0, pnl: 0, r: 0 };
    }

    dayKeys.forEach(d => {
      grid[d] = {};
      dayTotals[d] = { count: 0, wins: 0, pnl: 0, r: 0 };
      for (let h = 0; h < 24; h++) {
        grid[d][h] = { count: 0, wins: 0, pnl: 0, r: 0 };
      }
    });

    closedTrades.forEach(tr => {
      // Luôn lấy giờ vào lệnh (open_time) làm gốc chuẩn, áp dụng độ lệch múi giờ người dùng đã chỉnh
      const raw = tr.open_time;
      if (!raw) return;
      const cleanRaw = raw.includes('T') ? raw : raw.replace(/[\.\-]/g, '/');
      const baseDate = new Date(cleanRaw);
      if (isNaN(baseDate.getTime())) return;

      // Dời thời gian theo offset giờ Việt Nam đã thiết lập
      const dt = new Date(baseDate.getTime() + activeOffset * 3600 * 1000);

      const d = dt.getDay();
      const h = dt.getHours();
      const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
      const risk1R = tr.risk_1r_usd && tr.risk_1r_usd > 0 ? tr.risk_1r_usd : 100;
      const r = tr.weighted_rr !== undefined && !isNaN(tr.weighted_rr) ? tr.weighted_rr : (net / risk1R);

      if (grid[d] && grid[d][h]) {
        grid[d][h].count++;
        grid[d][h].pnl += net;
        grid[d][h].r += r;
        if (net > 0) grid[d][h].wins++;
      }

      if (hourTotals[h]) {
        hourTotals[h].count++;
        hourTotals[h].pnl += net;
        hourTotals[h].r += r;
        if (net > 0) hourTotals[h].wins++;
      }

      if (dayTotals[d]) {
        dayTotals[d].count++;
        dayTotals[d].pnl += net;
        dayTotals[d].r += r;
        if (net > 0) dayTotals[d].wins++;
      }
    });

    let bestHour = -1;
    let worstHour = -1;
    let bestHourPnl = -Infinity;
    let worstHourPnl = Infinity;
    let maxAbsPnl = 1;

    for (let h = 0; h < 24; h++) {
      if (hourTotals[h].count > 0) {
        if (hourTotals[h].pnl > bestHourPnl) {
          bestHourPnl = hourTotals[h].pnl;
          bestHour = h;
        }
        if (hourTotals[h].pnl < worstHourPnl) {
          worstHourPnl = hourTotals[h].pnl;
          worstHour = h;
        }
      }
      dayKeys.forEach(d => {
        const absVal = Math.abs(grid[d][h].pnl);
        if (absVal > maxAbsPnl) maxAbsPnl = absVal;
      });
    }

    return {
      grid,
      dayKeys,
      dayLabels,
      hourTotals,
      dayTotals,
      maxAbsPnl,
      bestHour: bestHour >= 0 ? bestHour : null,
      worstHour: worstHour >= 0 && worstHourPnl < 0 ? worstHour : null,
      bestHourPnl: bestHourPnl !== -Infinity ? bestHourPnl : 0,
      worstHourPnl: worstHourPnl !== Infinity ? worstHourPnl : 0
    };
  }, [closedTrades, activeOffset]);

  // =========================================================================
  // 5. CHECKLIST TRUNG BÌNH & TỶ LỆ TUÂN THỦ TIÊU CHÍ
  // =========================================================================
  const checklistData = useMemo(() => {
    const totalTrades = closedTrades.length;

    const defaultCriteria = [
      { id: 'dir', label: language === 'vi' ? 'Đúng hướng lớn' : 'HTF Alignment' },
      { id: 'bos', label: language === 'vi' ? 'Có BOS' : 'BOS Confirmed' },
      { id: 'poi', label: language === 'vi' ? 'Có OB/FVG/POI' : 'OB/FVG/POI Present' },
      { id: 'risk', label: language === 'vi' ? 'Risk đúng quy định' : 'Fixed Risk 1-2%' },
      { id: 'sl', label: language === 'vi' ? 'SL hợp lý' : 'Valid Invalidation SL' },
      { id: 'tp', label: language === 'vi' ? 'TP hợp lý' : 'Structural Target TP' }
    ];

    const activeList = preChecklist && preChecklist.length > 0 
      ? preChecklist.slice(0, 6).map(c => ({ id: c.id, label: c.label }))
      : defaultCriteria;

    const countMap: Record<string, number> = {};
    activeList.forEach(c => { countMap[c.id] = 0; });

    let totalCheckedCount = 0;

    closedTrades.forEach(tr => {
      const ids = Array.isArray(tr.pre_checklist_ids) 
        ? tr.pre_checklist_ids 
        : typeof tr.pre_checklist_ids === 'string' 
          ? [tr.pre_checklist_ids] 
          : [];

      activeList.forEach((c, idx) => {
        const isChecked = ids.includes(c.id) || (ids.length > idx);
        if (isChecked) {
          countMap[c.id] = (countMap[c.id] || 0) + 1;
          totalCheckedCount++;
        }
      });
    });

    const items = activeList.map(c => {
      const count = countMap[c.id] || 0;
      const pct = totalTrades > 0 ? Math.round((count / totalTrades) * 100) : 0;
      return {
        id: c.id,
        label: c.label,
        count,
        pct
      };
    });

    const maxPossible = totalTrades * (activeList.length || 1);
    const avgScorePercent = maxPossible > 0 ? Math.round((totalCheckedCount / maxPossible) * 100) : 0;
    const avgPoints = ((avgScorePercent / 100) * 5).toFixed(1);

    return {
      avgScorePercent,
      avgPoints,
      items
    };
  }, [closedTrades, preChecklist, language]);

  // =========================================================================
  // 6. LỆNH THẮNG LỚN NHẤT & LỆNH THUA LỚN NHẤT (OUTLIER TRADES)
  // =========================================================================
  const { bestTrade, worstTrade } = useMemo(() => {
    if (closedTrades.length === 0) return { bestTrade: null, worstTrade: null };
    let best: TradeRow | null = null;
    let worst: TradeRow | null = null;

    closedTrades.forEach(tr => {
      const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
      if (net > 0) {
        if (!best || net > (best.net_pnl !== undefined ? best.net_pnl : (best.pnl || 0))) {
          best = tr;
        }
      }
      if (net < 0) {
        if (!worst || net < (worst.net_pnl !== undefined ? worst.net_pnl : (worst.pnl || 0))) {
          worst = tr;
        }
      }
    });

    return { bestTrade: best, worstTrade: worst };
  }, [closedTrades]);

  // =========================================================================
  // 7. BIỂU ĐỒ PNL & ĐƯỜNG CONG TÍCH LŨY (COMPOSED CHART DATA)
  // =========================================================================
  const pnlChartData = useMemo(() => {
    if (!closedTrades || closedTrades.length === 0) return [];

    const round2 = (n: number) => Number(n.toFixed(2));

    if (pnlTimeframe === 'day') {
      // Nhóm theo từng ngày giao dịch (YYYY-MM-DD)
      const dayMap = new Map<string, { dateStr: string; pnl: number; count: number }>();

      closedTrades.forEach(tr => {
        const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
        const rawTime = tr.close_time || tr.open_time;
        let d = new Date();
        if (rawTime) {
          const cleanRaw = rawTime.includes('T') ? rawTime : rawTime.replace(/[\.\-]/g, '/');
          const baseDate = new Date(cleanRaw);
          if (!isNaN(baseDate.getTime())) {
            d = new Date(baseDate.getTime() + activeOffset * 3600 * 1000);
          }
        }
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const key = `${yyyy}-${mm}-${dd}`;
        const display = `${dd}/${mm}`;

        if (!dayMap.has(key)) {
          dayMap.set(key, { dateStr: display, pnl: 0, count: 0 });
        }
        const item = dayMap.get(key)!;
        item.pnl += net;
        item.count += 1;
      });

      const sortedDays = Array.from(dayMap.entries())
        .sort(([k1], [k2]) => k1.localeCompare(k2));

      // Nếu chỉ có 1 ngày duy nhất có lệnh, hiển thị chi tiết từng lệnh theo giờ
      if (sortedDays.length <= 1 && closedTrades.length > 1) {
        let cum = 0;
        let runningEq = initialBalance;
        const details = closedTrades.map((tr, idx) => {
          const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
          cum += net;
          runningEq += net;
          const time = tr.close_time || tr.open_time || '';
          let timeStr = `#${idx + 1}`;
          if (time) {
            const cleanRaw = time.includes('T') ? time : time.replace(/[\.\-]/g, '/');
            const baseDate = new Date(cleanRaw);
            if (!isNaN(baseDate.getTime())) {
              const shifted = new Date(baseDate.getTime() + activeOffset * 3600 * 1000);
              const hh = String(shifted.getHours()).padStart(2, '0');
              const mi = String(shifted.getMinutes()).padStart(2, '0');
              timeStr = `${hh}:${mi}`;
            }
          }
          return {
            index: idx + 1,
            name: `${timeStr}`,
            trade: `T#${idx + 1}`,
            pnl: round2(net),
            equity: round2(runningEq),
            equityArea: round2(runningEq),
            cumPnl: round2(cum),
            tradeCount: 1,
            isWin: net >= 0,
            isStart: false
          };
        });
        return details;
      }

      let cum = 0;
      let runningEq = initialBalance;
      const days = sortedDays.map(([key, item], idx) => {
        cum += item.pnl;
        runningEq += item.pnl;
        return {
          index: idx + 1,
          name: item.dateStr,
          trade: `D#${idx + 1}`,
          pnl: round2(item.pnl),
          equity: round2(runningEq),
          equityArea: round2(runningEq),
          cumPnl: round2(cum),
          tradeCount: item.count,
          isWin: item.pnl >= 0,
          isStart: false
        };
      });
      return days;
    }

    if (pnlTimeframe === 'week') {
      // Nhóm theo từng tuần (Thứ Hai -> Chủ Nhật)
      const weekMap = new Map<string, { weekLabel: string; pnl: number; count: number; sortKey: string }>();

      closedTrades.forEach(tr => {
        const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
        const rawTime = tr.close_time || tr.open_time;
        let d = new Date();
        if (rawTime) {
          const cleanRaw = rawTime.includes('T') ? rawTime : rawTime.replace(/[\.\-]/g, '/');
          const baseDate = new Date(cleanRaw);
          if (!isNaN(baseDate.getTime())) {
            d = new Date(baseDate.getTime() + activeOffset * 3600 * 1000);
          }
        }

        // Tìm Thứ 2 đầu tuần
        const day = d.getDay();
        const diffToMon = d.getDate() - day + (day === 0 ? -6 : 1);
        const mon = new Date(d);
        mon.setDate(diffToMon);

        const yyyy = mon.getFullYear();
        const mm = String(mon.getMonth() + 1).padStart(2, '0');
        const dd = String(mon.getDate()).padStart(2, '0');
        const sortKey = `${yyyy}-${mm}-${dd}`;
        const weekLabel = `W (${dd}/${mm})`;

        if (!weekMap.has(sortKey)) {
          weekMap.set(sortKey, { weekLabel, pnl: 0, count: 0, sortKey });
        }
        const item = weekMap.get(sortKey)!;
        item.pnl += net;
        item.count += 1;
      });

      const sortedWeeks = Array.from(weekMap.values())
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

      let cum = 0;
      let runningEq = initialBalance;
      const weeks = sortedWeeks.map((item, idx) => {
        cum += item.pnl;
        runningEq += item.pnl;
        return {
          index: idx + 1,
          name: item.weekLabel,
          trade: `W#${idx + 1}`,
          pnl: round2(item.pnl),
          equity: round2(runningEq),
          equityArea: round2(runningEq),
          cumPnl: round2(cum),
          tradeCount: item.count,
          isWin: item.pnl >= 0,
          isStart: false
        };
      });
      return weeks;
    }

    if (pnlTimeframe === 'month') {
      // Nhóm theo từng tháng YYYY-MM
      const monthMap = new Map<string, { monthLabel: string; pnl: number; count: number; sortKey: string }>();

      closedTrades.forEach(tr => {
        const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
        const rawTime = tr.close_time || tr.open_time;
        let d = new Date();
        if (rawTime) {
          const cleanRaw = rawTime.includes('T') ? rawTime : rawTime.replace(/[\.\-]/g, '/');
          const baseDate = new Date(cleanRaw);
          if (!isNaN(baseDate.getTime())) {
            d = new Date(baseDate.getTime() + activeOffset * 3600 * 1000);
          }
        }
        const yyyy = d.getFullYear();
        const mIdx = d.getMonth() + 1;
        const sortKey = `${yyyy}-${String(mIdx).padStart(2, '0')}`;
        const monthLabel = `T${mIdx}/${String(yyyy).slice(2)}`;

        if (!monthMap.has(sortKey)) {
          monthMap.set(sortKey, { monthLabel, pnl: 0, count: 0, sortKey });
        }
        const item = monthMap.get(sortKey)!;
        item.pnl += net;
        item.count += 1;
      });

      const sortedMonths = Array.from(monthMap.values())
        .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

      let cum = 0;
      let runningEq = initialBalance;
      const months = sortedMonths.map((item, idx) => {
        cum += item.pnl;
        runningEq += item.pnl;
        return {
          index: idx + 1,
          name: item.monthLabel,
          trade: `M#${idx + 1}`,
          pnl: round2(item.pnl),
          equity: round2(runningEq),
          equityArea: round2(runningEq),
          cumPnl: round2(cum),
          tradeCount: item.count,
          isWin: item.pnl >= 0,
          isStart: false
        };
      });
      return months;
    }

    return [];
  }, [closedTrades, pnlTimeframe, initialBalance, activeOffset]);

  // Logic trục Y: Điểm mốc trung tâm tương ứng mức 0 cũ là Vốn ban đầu (initialBalance, ví dụ 100k)
  // Cứ mỗi 2k ($2,000) là một mốc tick đối xứng, đảm bảo số liệu chính xác theo từng tài khoản
  const { chartTicks, chartDomain, pnlDomain } = useMemo(() => {
    const step = 2000;
    const allEquities = pnlChartData
      .map(d => d.equity)
      .filter((v): v is number => typeof v === 'number' && !isNaN(v));
    const minEq = allEquities.length > 0 ? Math.min(...allEquities, initialBalance) : initialBalance;
    const maxEq = allEquities.length > 0 ? Math.max(...allEquities, initialBalance) : initialBalance;

    const diffDown = Math.max(0, initialBalance - minEq);
    const diffUp = Math.max(0, maxEq - initialBalance);
    const maxDiff = Math.max(diffDown, diffUp, step);

    const steps = Math.ceil(maxDiff / step);
    const halfSpan = steps * step;

    const minVal = initialBalance - halfSpan;
    const maxVal = initialBalance + halfSpan;

    const ticks: number[] = [];
    for (let v = minVal; v <= maxVal; v += step) {
      ticks.push(v);
    }

    return {
      chartTicks: ticks,
      chartDomain: [minVal, maxVal] as [number, number],
      pnlDomain: [-halfSpan, halfSpan] as [number, number]
    };
  }, [pnlChartData, initialBalance]);

  // Hook đồng bộ mở rộng đường line & area bắt đầu từ mốc 100k sát trục Y đến cuối bảng biểu đồ
  useLayoutEffect(() => {
    const extendPaths = () => {
      const container = document.getElementById('pnl-chart-wrapper');
      if (!container) return;

      const refLine = container.querySelector('.recharts-reference-line-line') as SVGLineElement | null;
      const lineCurve = container.querySelector('.recharts-line-curve') as SVGPathElement | null;
      const areaCurve = container.querySelector('.recharts-area-area') as SVGPathElement | null;

      if (!refLine || !lineCurve) return;

      const x1 = parseFloat(refLine.getAttribute('x1') || '0');
      const y1 = parseFloat(refLine.getAttribute('y1') || '0');
      const x2 = parseFloat(refLine.getAttribute('x2') || '0');

      if (!x1 || !x2 || isNaN(x1) || isNaN(x2) || x2 <= x1) return;

      const curLineD = lineCurve.getAttribute('d');
      if (!curLineD) return;

      if (lineCurve.getAttribute('data-extended-line') === curLineD) {
        return;
      }

      // Tách điểm đầu tiên và đường đi tiếp theo của Line
      const origMatch = curLineD.match(/^M\s*([\d.-]+)[,\s]+([\d.-]+)(.*)$/i);
      if (!origMatch) return;
      const startX = parseFloat(origMatch[1]);
      const startY = parseFloat(origMatch[2]);
      const restPath = origMatch[3];

      const lastCoordMatch = curLineD.trim().match(/[\s,]([\d.-]+)$/);
      const yLast = lastCoordMatch ? parseFloat(lastCoordMatch[1]) : y1;

      // Đường Line khởi đầu từ sát mép mốc 100k (x1, y1) chạy mượt tới điểm đầu tiên rồi vươn tới cuối biểu đồ (x2)
      const extLineD = `M ${x1},${y1} L ${startX},${startY}${restPath} L ${x2},${yLast}`;
      lineCurve.setAttribute('d', extLineD);
      lineCurve.setAttribute('data-extended-line', extLineD);

      if (areaCurve) {
        const curAreaD = areaCurve.getAttribute('d');
        const matchBase = (curAreaD || '').match(/L\s*[\d.]+[\s,]+([\d.]+)[^L]*Z$/i);
        const yBase = matchBase ? parseFloat(matchBase[1]) : y1 + 100;

        const extAreaD = `M ${x1},${yBase} L ${x1},${y1} L ${startX},${startY}${restPath} L ${x2},${yLast} L ${x2},${yBase} Z`;
        areaCurve.setAttribute('d', extAreaD);
        areaCurve.setAttribute('data-extended-area', extAreaD);
      }
    };

    extendPaths();
    const t1 = setTimeout(extendPaths, 50);
    const t2 = setTimeout(extendPaths, 150);

    const container = document.getElementById('pnl-chart-wrapper');
    let observer: MutationObserver | null = null;
    if (container) {
      observer = new MutationObserver((mutations) => {
        let shouldUpdate = false;
        for (const m of mutations) {
          if (m.type === 'childList') {
            shouldUpdate = true;
            break;
          }
          if (m.type === 'attributes' && m.attributeName === 'd') {
            const target = m.target as Element;
            if (target.classList.contains('recharts-line-curve')) {
              const currentD = target.getAttribute('d');
              if (currentD && currentD !== target.getAttribute('data-extended-line')) {
                shouldUpdate = true;
                break;
              }
            }
          }
        }
        if (shouldUpdate) {
          extendPaths();
        }
      });
      observer.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['d'] });
    }

    window.addEventListener('resize', extendPaths);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      if (observer) observer.disconnect();
      window.removeEventListener('resize', extendPaths);
    };
  }, [pnlChartData, pnlTimeframe, initialBalance]);

  // =========================================================================
  // 8. HIỆU SUẤT THEO SETUP (LẤY TOÀN BỘ LỆNH TỪ LỊCH SỬ - LỆNH CHƯA GÁN VÀO 'KHÁC')
  // =========================================================================
  const setupPerformanceData = useMemo(() => {
    const setupMap: Record<string, { count: number; wins: number; pnl: number; grossProfit: number; grossLoss: number }> = {};

    closedTrades.forEach(tr => {
      const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);

      // Trích xuất danh sách setup đã gán thực tế từ lệnh trong bảng lịch sử
      const assignedSetups: string[] = [];
      if (Array.isArray(tr.setups) && tr.setups.length > 0) {
        tr.setups.forEach(s => {
          const clean = String(s || '').trim();
          if (clean && !assignedSetups.includes(clean)) assignedSetups.push(clean);
        });
      } else if (tr.setup) {
        const clean = String(tr.setup).trim();
        if (clean) assignedSetups.push(clean);
      }

      // Nếu lệnh chưa được gán setup, gom vào "Khác" (hoặc "Other") để không bỏ sót bất kỳ lệnh nào trong lịch sử
      const targetSetups = assignedSetups.length > 0 
        ? assignedSetups 
        : [language === 'vi' ? 'Khác' : 'Other'];

      targetSetups.forEach(setupName => {
        if (!setupMap[setupName]) {
          setupMap[setupName] = { count: 0, wins: 0, pnl: 0, grossProfit: 0, grossLoss: 0 };
        }
        setupMap[setupName].count++;
        setupMap[setupName].pnl += net;
        if (net > 0) {
          setupMap[setupName].wins++;
          setupMap[setupName].grossProfit += net;
        } else {
          setupMap[setupName].grossLoss += Math.abs(net);
        }
      });
    });

    const list = Object.keys(setupMap).map(name => {
      const item = setupMap[name];
      const winRate = item.count > 0 ? Number(((item.wins / item.count) * 100).toFixed(1)) : 0;
      const avgWin = item.wins > 0 ? item.grossProfit / item.wins : 0;
      const avgLoss = (item.count - item.wins) > 0 ? item.grossLoss / (item.count - item.wins) : 0;
      const avgR = avgLoss > 0 ? Number((avgWin / avgLoss).toFixed(2)) : (avgWin > 0 ? 2.0 : 0);

      return {
        setup: name,
        count: item.count,
        winRate,
        avgR: avgR > 0 ? `+${avgR}R` : `${avgR}R`,
        avgRNum: avgR,
        pnl: Number(item.pnl.toFixed(2))
      };
    });

    // Mặc định sắp xếp theo PnL cao nhất xuống thấp nhất
    list.sort((a, b) => b.pnl - a.pnl);

    return list;
  }, [closedTrades, language]);

  // =========================================================================
  // 9. CÁC MÔ-ĐUN PHÂN TÍCH CHUYÊN SÂU
  // =========================================================================
  const confluenceData = useMemo(() => {
    const gradeMap: Record<string, { count: number; wins: number; pnl: number }> = {
      'A+': { count: 0, wins: 0, pnl: 0 },
      'A': { count: 0, wins: 0, pnl: 0 },
      'B': { count: 0, wins: 0, pnl: 0 },
      'C': { count: 0, wins: 0, pnl: 0 },
    };

    closedTrades.forEach(tr => {
      const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
      const preIds = Array.isArray(tr.pre_checklist_ids) 
        ? tr.pre_checklist_ids 
        : typeof tr.pre_checklist_ids === 'string' 
          ? [tr.pre_checklist_ids] 
          : [];
      const confluenceCount = preIds.length;

      let grade = 'C';
      if (confluenceCount >= 5) grade = 'A+';
      else if (confluenceCount >= 3) grade = 'A';
      else if (confluenceCount === 2) grade = 'B';
      else grade = 'C';

      gradeMap[grade].count++;
      gradeMap[grade].pnl += net;
      if (net > 0) gradeMap[grade].wins++;
    });

    return [
      {
        grade: 'A+',
        title: language === 'vi' ? 'Hạng A+ (5+ Hợp lưu trở lên)' : 'Grade A+ (5+ Confluences)',
        desc: language === 'vi' ? 'HTF + POI Chuẩn + Quét Thanh Khoản + LTF Xác Nhận' : 'Highest technical confluence confirmation',
        count: gradeMap['A+'].count,
        winRate: gradeMap['A+'].count > 0 ? Number(((gradeMap['A+'].wins / gradeMap['A+'].count) * 100).toFixed(1)) : 0,
        pnl: Number(gradeMap['A+'].pnl.toFixed(2)),
        badgeColor: 'text-[#1d1b17] bg-amber-400/10 border-[#d8d0c5]',
        avgRR: '1:2.8+'
      },
      {
        grade: 'A',
        title: language === 'vi' ? 'Hạng A (3 - 4 Hợp lưu chuẩn)' : 'Grade A (3 - 4 Confluences)',
        desc: language === 'vi' ? 'Kèo kỹ thuật chuẩn chỉ, cấu trúc rõ ràng' : 'Textbook Technical Setup with Good Structure',
        count: gradeMap['A'].count,
        winRate: gradeMap['A'].count > 0 ? Number(((gradeMap['A'].wins / gradeMap['A'].count) * 100).toFixed(1)) : 0,
        pnl: Number(gradeMap['A'].pnl.toFixed(2)),
        badgeColor: 'text-[#1d1b17] bg-teal-400/10 border-[#d8d0c5]',
        avgRR: '1:2.0'
      },
      {
        grade: 'B',
        title: language === 'vi' ? 'Hạng B (2 Hợp lưu vừa phải)' : 'Grade B (2 Confluences)',
        desc: language === 'vi' ? 'Xác nhận mức trung bình, dễ bị nhiễu sóng' : 'Moderate Confirmation, prone to noise',
        count: gradeMap['B'].count,
        winRate: gradeMap['B'].count > 0 ? Number(((gradeMap['B'].wins / gradeMap['B'].count) * 100).toFixed(1)) : 0,
        pnl: Number(gradeMap['B'].pnl.toFixed(2)),
        badgeColor: 'text-blue-400 bg-blue-400/10 border-blue-500/30',
        avgRR: '1:1.5'
      },
      {
        grade: 'C',
        title: language === 'vi' ? 'Hạng C (0 - 1 Hợp lưu / Bột phát)' : 'Grade C (0 - 1 Confluence)',
        desc: language === 'vi' ? 'Vào lệnh vội vàng, thiếu xác nhận checklist' : 'Impulsive / Under-confirmed trades',
        count: gradeMap['C'].count,
        winRate: gradeMap['C'].count > 0 ? Number(((gradeMap['C'].wins / gradeMap['C'].count) * 100).toFixed(1)) : 0,
        pnl: Number(gradeMap['C'].pnl.toFixed(2)),
        badgeColor: 'text-rose-400 bg-rose-400/10 border-rose-500/30',
        avgRR: '1:0.8'
      }
    ];
  }, [closedTrades, language]);

  const timeframeData = useMemo(() => {
    const tfMap: Record<string, { count: number; wins: number; pnl: number; grossProfit: number; grossLoss: number }> = {};
    const standardTfs = ['D1', 'H4', 'H1', 'M15', 'M5', 'M1'];
    standardTfs.forEach(tf => {
      tfMap[tf] = { count: 0, wins: 0, pnl: 0, grossProfit: 0, grossLoss: 0 };
    });

    closedTrades.forEach(tr => {
      const tf = (tr.timeframe || 'M15').toUpperCase();
      if (!tfMap[tf]) {
        tfMap[tf] = { count: 0, wins: 0, pnl: 0, grossProfit: 0, grossLoss: 0 };
      }
      const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
      tfMap[tf].count++;
      tfMap[tf].pnl += net;
      if (net > 0) {
        tfMap[tf].wins++;
        tfMap[tf].grossProfit += net;
      } else {
        tfMap[tf].grossLoss += Math.abs(net);
      }
    });

    return Object.keys(tfMap)
      .filter(tf => tfMap[tf].count > 0 || standardTfs.includes(tf))
      .map(tf => {
        const item = tfMap[tf];
        const count = item.count;
        const winRate = count > 0 ? (item.wins / count) * 100 : 0;
        const avgWin = item.wins > 0 ? item.grossProfit / item.wins : 0;
        const avgLoss = (count - item.wins) > 0 ? item.grossLoss / (count - item.wins) : 0;
        const avgRR = avgLoss > 0 ? `1:${(avgWin / avgLoss).toFixed(2)}` : (avgWin > 0 ? '1:∞' : '1:0');
        return {
          tf,
          count,
          winRate,
          pnl: Number(item.pnl.toFixed(2)),
          avgRR
        };
      });
  }, [closedTrades]);

  const instrumentData = useMemo(() => {
    const symbolMap: Record<string, { count: number; wins: number; pnl: number; grossProfit: number; grossLoss: number }> = {};
    let buyCount = 0, buyWins = 0, buyPnl = 0, buyVol = 0;
    let sellCount = 0, sellWins = 0, sellPnl = 0, sellVol = 0;

    closedTrades.forEach(tr => {
      const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
      const sym = (tr.symbol || 'OTHER').toUpperCase().replace('/', '');
      const vol = tr.volume || 0;

      if (!symbolMap[sym]) {
        symbolMap[sym] = { count: 0, wins: 0, pnl: 0, grossProfit: 0, grossLoss: 0 };
      }
      symbolMap[sym].count++;
      symbolMap[sym].pnl += net;
      if (net > 0) {
        symbolMap[sym].wins++;
        symbolMap[sym].grossProfit += net;
      } else {
        symbolMap[sym].grossLoss += Math.abs(net);
      }

      const type = (tr.type || 'BUY').toUpperCase();
      if (type === 'BUY') {
        buyCount++;
        buyVol += vol;
        buyPnl += net;
        if (net > 0) buyWins++;
      } else {
        sellCount++;
        sellVol += vol;
        sellPnl += net;
        if (net > 0) sellWins++;
      }
    });

    const symbols = Object.keys(symbolMap).map(sym => {
      const item = symbolMap[sym];
      const winRate = item.count > 0 ? Number(((item.wins / item.count) * 100).toFixed(1)) : 0;
      const avgWin = item.wins > 0 ? item.grossProfit / item.wins : 0;
      const avgLoss = (item.count - item.wins) > 0 ? item.grossLoss / (item.count - item.wins) : 0;
      const rr = avgLoss > 0 ? `1:${(avgWin / avgLoss).toFixed(2)}` : (avgWin > 0 ? '1:∞' : '1:0');
      return {
        symbol: sym,
        count: item.count,
        winRate,
        pnl: Number(item.pnl.toFixed(2)),
        avgRR: rr
      };
    }).sort((a, b) => b.pnl - a.pnl);

    const totalDir = buyCount + sellCount || 1;
    const buyPct = Math.round((buyCount / totalDir) * 100);
    const sellPct = 100 - buyPct;

    let biasVerdict = language === 'vi' ? 'Cân bằng giữa Mua & Bán' : 'Balanced Execution';
    if (totalDir >= 4) {
      const buyWR = buyCount > 0 ? (buyWins / buyCount) * 100 : 0;
      const sellWR = sellCount > 0 ? (sellWins / sellCount) * 100 : 0;
      if (buyWR - sellWR >= 20) {
        biasVerdict = language === 'vi' ? 'Thiên kiến MUA (Long Bias) — Đánh Buy hiệu quả hơn Sell' : 'Strong Long Bias';
      } else if (sellWR - buyWR >= 20) {
        biasVerdict = language === 'vi' ? 'Thiên kiến BÁN (Short Bias) — Đánh Sell hiệu quả hơn Buy' : 'Strong Short Bias';
      }
    }

    return {
      symbols,
      longShort: {
        buy: { count: buyCount, winRate: buyCount > 0 ? Math.round((buyWins / buyCount) * 100) : 0, pnl: Number(buyPnl.toFixed(2)), volume: Number(buyVol.toFixed(2)), ratioPct: buyPct },
        sell: { count: sellCount, winRate: sellCount > 0 ? Math.round((sellWins / sellCount) * 100) : 0, pnl: Number(sellPnl.toFixed(2)), volume: Number(sellVol.toFixed(2)), ratioPct: sellPct },
        biasVerdict
      }
    };
  }, [closedTrades, language]);

  const disciplineData = useMemo(() => {
    let movingSlLoss = 0;
    let fomoLoss = 0;
    let revengeLoss = 0;
    let overlotLoss = 0;
    let earlyExitLostProfit = 0;

    closedTrades.forEach(tr => {
      const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
      const postIds = Array.isArray(tr.post_checklist_ids) 
        ? tr.post_checklist_ids 
        : typeof tr.post_checklist_ids === 'string' 
          ? [tr.post_checklist_ids] 
          : [];
      
      if (postIds.length > 0 && net < 0) {
        const lossAmount = Math.abs(net);
        const matchedCats: string[] = [];
        postIds.forEach(id => {
          const idLower = String(id).toLowerCase();
          if ((idLower.includes('sl') || idLower.includes('move')) && !matchedCats.includes('sl')) matchedCats.push('sl');
          if ((idLower.includes('fomo') || idLower.includes('sớm') || idLower.includes('chasing')) && !matchedCats.includes('fomo')) matchedCats.push('fomo');
          if ((idLower.includes('revenge') || idLower.includes('trả thù') || idLower.includes('cay cú')) && !matchedCats.includes('revenge')) matchedCats.push('revenge');
          if ((idLower.includes('overlot') || idLower.includes('khối lượng')) && !matchedCats.includes('overlot')) matchedCats.push('overlot');
        });

        const split = matchedCats.length || 1;
        const portion = lossAmount / split;
        if (matchedCats.includes('sl')) movingSlLoss += portion;
        if (matchedCats.includes('fomo')) fomoLoss += portion;
        if (matchedCats.includes('revenge')) revengeLoss += portion;
        if (matchedCats.includes('overlot')) overlotLoss += portion;
      }

      postIds.forEach(id => {
        const idLower = String(id).toLowerCase();
        if (idLower.includes('cut_early') || idLower.includes('cắt non') || idLower.includes('early')) {
          const lost = tr.lost_profit && tr.lost_profit > 0 ? tr.lost_profit : Math.max(0, (tr.plan_pnl || 0) - net);
          if (lost > 0) earlyExitLostProfit += lost;
        }
      });
    });

    const totalNegativeMistakes = Number((movingSlLoss + fomoLoss + revengeLoss + overlotLoss).toFixed(2));
    const actualPnl = closedTrades.reduce((s, t) => s + (t.net_pnl !== undefined ? t.net_pnl : (t.pnl || 0)), 0);
    const potentialPnl = Number((actualPnl + totalNegativeMistakes + earlyExitLostProfit).toFixed(2));

    return {
      movingSlLoss: Number(movingSlLoss.toFixed(2)),
      fomoLoss: Number(fomoLoss.toFixed(2)),
      revengeLoss: Number(revengeLoss.toFixed(2)),
      overlotLoss: Number(overlotLoss.toFixed(2)),
      totalNegativeMistakes,
      earlyExitLostProfit: Number(earlyExitLostProfit.toFixed(2)),
      potentialPnl
    };
  }, [closedTrades]);

  const whatIfData = useMemo(() => {
    let runningActual = initialBalance;
    let runningFixed = initialBalance;

    const targetRR = customWhatIfRR > 0 ? customWhatIfRR : 2.0;

    const whatIfCurves: Array<{ trade: string; pnl: number; actual: number; fixedRR: number }> = [
      { trade: 'T#0', pnl: 0, actual: initialBalance, fixedRR: initialBalance }
    ];

    // Tính mức thua lỗ trung bình thực tế của các lệnh lỗ để làm mốc quy chiếu 1R thực tế nếu lệnh không có SL
    const lossTrades = closedTrades.filter(t => (t.net_pnl !== undefined ? t.net_pnl : (t.pnl || 0)) < -1);
    const avgLossAmount = lossTrades.length > 0 
      ? Math.abs(lossTrades.reduce((sum, t) => sum + (t.net_pnl !== undefined ? t.net_pnl : (t.pnl || 0)), 0) / lossTrades.length)
      : 100;

    closedTrades.forEach((tr, idx) => {
      const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
      runningActual += net;

      // Tính mức Risk 1R ($) chuẩn xác - ĐỒNG BỘ 100% VỚI BẢNG LỊCH SỬ LỆNH:
      // 1. Khoảng cách giá SL = |open_price - initial_sl|
      // 2. Risk 1R ($) = Price Risk * volume * 100 (Vàng) hoặc 100,000 (Forex)
      // 3. Ưu tiên tr.risk_1r_usd đã tính từ bảng Lịch Sử
      let risk1R = tr.risk_1r_usd && tr.risk_1r_usd > 0 ? tr.risk_1r_usd : 0;
      if (!risk1R && tr.initial_sl && tr.initial_sl > 0 && tr.open_price && tr.volume) {
        risk1R = calculateRisk1R(tr.open_price, tr.initial_sl, tr.volume, 100, 100, tr.symbol);
      }
      if (!risk1R || risk1R <= 0) {
        // Nếu lệnh không SL: nếu là lệnh lỗ, lấy chính số tiền lỗ thực tế của lệnh làm 1R
        risk1R = net < 0 ? Math.abs(net) : avgLossAmount;
      }

      // Xác định MFE thực tế của lệnh (tính bằng số R):
      // - Lấy trực tiếp mfe_r từ bảng lịch sử nếu có
      // - Hoặc tính từ khoảng cách đỉnh giá MFE so với khoảng cách SL: mfeDist / priceRisk
      // - Hoặc nếu lệnh thực tế đã ăn được số R (weighted_rr) cao hơn mfe_r thì lấy tối thiểu bằng số R thực tế
      let mfeR = tr.mfe_r !== undefined && tr.mfe_r !== null && !isNaN(Number(tr.mfe_r)) ? Number(tr.mfe_r) : 0;
      if (!mfeR && tr.mfe_price && tr.open_price) {
        const pRisk = tr.initial_sl ? Math.abs(tr.open_price - tr.initial_sl) : 0;
        const mfeDist = tr.mfe_dist !== undefined && tr.mfe_dist !== null ? Number(tr.mfe_dist) : Math.abs(tr.mfe_price - tr.open_price);
        if (pRisk > 0) mfeR = Number((mfeDist / pRisk).toFixed(2));
      }

      // Đỉnh MFE thực tế của lệnh tối thiểu phải đạt bằng số R thực tế mà lệnh đã chốt (weighted_rr)
      const actualR = tr.weighted_rr !== undefined && !isNaN(Number(tr.weighted_rr)) 
        ? Number(tr.weighted_rr) 
        : (risk1R > 0 ? Number((net / risk1R).toFixed(2)) : 0);
      const effectiveMaxR = Math.max(mfeR, actualR);

      // =====================================================================
      // ĐƯỜNG GIẢ LẬP THEO MFE TUÂN THEO MỐC R CỐ ĐỊNH (CHUẨN 100% DỮ LIỆU THẬT):
      // - Nếu MFE của lệnh đạt đủ targetRR (effectiveMaxR >= targetRR hoặc lãi thực tế >= targetRR * risk1R):
      //   + Lệnh chạm đúng TP kỳ vọng -> Ăn trọn mức cố định: +targetRR * risk1R
      // - Nếu MFE KHÔNG ĐỦ targetRR (effectiveMaxR < targetRR):
      //   + Lấy đúng kết quả thực tế của lệnh (net) từ Bảng Lịch Sử!
      // =====================================================================
      const reachedTargetByMfe = effectiveMaxR >= targetRR || (net > 0 && risk1R > 0 && net >= targetRR * risk1R);

      if (reachedTargetByMfe) {
        runningFixed += risk1R * targetRR;
      } else {
        // MFE không đủ targetRR -> Lấy đúng kết quả thực tế của lệnh (lỗ, BE, hoặc lãi nhỏ thực nhận)
        runningFixed += net;
      }

      whatIfCurves.push({
        trade: `T#${idx + 1}`,
        pnl: Number(net.toFixed(2)),
        actual: Number(runningActual.toFixed(2)),
        fixedRR: Number(runningFixed.toFixed(2))
      });
    });

    return { 
      whatIfCurves,
      targetRR,
      finalActual: Number(runningActual.toFixed(2)),
      finalFixed: Number(runningFixed.toFixed(2))
    };
  }, [closedTrades, initialBalance, customWhatIfRR]);

  // =========================================================================
  // BÓC TÁCH MFE (LÃI TỐI ĐA TRONG LỆNH) & MAE (LỖ TỐI ĐA TRONG LỆNH)
  // VÀ GIẢ LẬP ĐƯỜNG CONG TỐI ƯU KHI CHỐT THEO MFE SO VỚI THỰC TẾ
  // =========================================================================
  const mfeMaeData = useMemo(() => {
    let runningActual = initialBalance;
    let runningMfeOptimal = initialBalance;
    let runningFixed = initialBalance;
    let totalLeftOnTable = 0; // Lợi nhuận để tuột mất (MFE - Net)
    let totalAdverseDrag = 0; // Áp lực drawdown phải chịu đựng (MAE)
    let validMfeCount = 0;

    const targetRR = customMfeRR > 0 ? customMfeRR : 2.0;

    const lossTrades = closedTrades.filter(t => (t.net_pnl !== undefined ? t.net_pnl : (t.pnl || 0)) < -1);
    const avgLossAmount = lossTrades.length > 0 
      ? Math.abs(lossTrades.reduce((sum, t) => sum + (t.net_pnl !== undefined ? t.net_pnl : (t.pnl || 0)), 0) / lossTrades.length)
      : 100;

    const curveData: Array<{
      trade: string;
      actual: number;
      mfeOptimal: number;
      fixedRR: number;
      actualPnl: number;
      mfeUsd: number;
      maeUsd: number;
      leftOnTable: number;
    }> = [
      { trade: 'T#0', actual: initialBalance, mfeOptimal: initialBalance, fixedRR: initialBalance, actualPnl: 0, mfeUsd: 0, maeUsd: 0, leftOnTable: 0 }
    ];

    const tradeDetails = closedTrades.map((tr, idx) => {
      const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
      runningActual += net;

      let risk1R = tr.risk_1r_usd && tr.risk_1r_usd > 0 ? tr.risk_1r_usd : 0;
      if (!risk1R && tr.initial_sl && tr.initial_sl > 0 && tr.open_price && tr.volume) {
        risk1R = calculateRisk1R(tr.open_price, tr.initial_sl, tr.volume, 100, avgLossAmount, tr.symbol);
      }
      if (!risk1R || risk1R <= 0) {
        risk1R = net < 0 ? Math.abs(net) : avgLossAmount;
      }

      // =====================================================================
      // TÍNH MFE & MAE THEO DỮ LIỆU THẬT 100% (NGHIÊM CẤM TỰ Ý NHÂN ẢO)
      // 1. Nếu có mfe_r / mae_r từ EA: quy đổi qua 1R (mfe_r * risk1R)
      // 2. Nếu có mfe_price / mae_price từ giá High / Low của EA:
      //    Vàng: mfe_price * volume * 100 | Forex: mfe_price * volume * 100,000
      // 3. Nếu chưa có dữ liệu High/Low/MFE từ EA MT5:
      //    Lấy MFE tối thiểu chính bằng Net PnL (lãi thực tế chốt), KHÔNG TỰ BỊA ĐỈNH SỐNG!
      // =====================================================================
      const isGold = (tr.symbol || '').toUpperCase().includes('XAU') || (tr.symbol || '').toUpperCase().includes('GOLD');
      const multiplier = isGold ? 100 : 100000;
      const vol = tr.volume || 1;

      // Xác định khoảng cách giá chênh lệch MFE & MAE:
      // Nếu có mfe_dist: dùng trực tiếp
      // Nếu có mfe_price từ EA: tính Math.abs(tr.mfe_price - tr.open_price)
      let mfeDist = tr.mfe_dist !== undefined && tr.mfe_dist !== null ? Number(tr.mfe_dist) : 0;
      let maeDist = tr.mae_dist !== undefined && tr.mae_dist !== null ? Number(tr.mae_dist) : 0;
      let hasRealMfe = false;
      let hasRealMae = false;

      if (!mfeDist && tr.mfe_price !== undefined && tr.mfe_price !== null && Number(tr.mfe_price) > 0 && tr.open_price) {
        const rawMfe = Number(tr.mfe_price);
        if (Math.abs(rawMfe - tr.open_price) < tr.open_price * 0.5) {
          mfeDist = Math.abs(rawMfe - tr.open_price);
        } else {
          mfeDist = rawMfe;
        }
      }
      if (mfeDist > 0) hasRealMfe = true;

      if (!maeDist && tr.mae_price !== undefined && tr.mae_price !== null && Number(tr.mae_price) > 0 && tr.open_price) {
        const rawMae = Number(tr.mae_price);
        if (Math.abs(rawMae - tr.open_price) < tr.open_price * 0.5) {
          maeDist = Math.abs(rawMae - tr.open_price);
        } else {
          maeDist = rawMae;
        }
      }
      if (maeDist > 0) hasRealMae = true;

      // Tính MFE ($) và MAE ($):
      // Tiền MFE ($) = khoảng cách giá (giá đỉnh - giá vào) * Volume (lot) * Hợp đồng chuẩn (Vàng 100, Forex 100,000)
      let mfeUsd = 0;
      if (hasRealMfe) {
        mfeUsd = Number((mfeDist * vol * multiplier).toFixed(2));
      } else if (net > 0) {
        // Mốc tối thiểu chắc chắn thật: Đỉnh sóng tối thiểu phải bằng mức lãi đã chốt
        mfeUsd = net;
      }

      let maeUsd = 0;
      if (hasRealMae) {
        maeUsd = Number((maeDist * vol * multiplier).toFixed(2));
      } else if (net < 0) {
        // Mốc tối thiểu chắc chắn thật: Drawdown tối thiểu phải bằng mức lỗ đã chốt
        maeUsd = Math.abs(net);
      }

      // Tính MFE R và MAE R chuẩn:
      const pRisk = (tr.initial_sl && tr.open_price) ? Math.abs(tr.open_price - tr.initial_sl) : 0;
      let mfeR = tr.mfe_r !== undefined && tr.mfe_r !== null && !isNaN(Number(tr.mfe_r)) ? Number(tr.mfe_r) : 0;
      if (!mfeR && pRisk > 0 && mfeDist > 0) {
        mfeR = Number((mfeDist / pRisk).toFixed(2));
      } else if (!mfeR && risk1R > 0 && mfeUsd > 0) {
        mfeR = Number((mfeUsd / risk1R).toFixed(2));
      }

      let maeR = tr.mae_r !== undefined && tr.mae_r !== null && !isNaN(Number(tr.mae_r)) ? Number(tr.mae_r) : 0;
      if (!maeR && pRisk > 0 && maeDist > 0) {
        maeR = Number((maeDist / pRisk).toFixed(2));
      } else if (!maeR && risk1R > 0 && maeUsd > 0) {
        maeR = Number((maeUsd / risk1R).toFixed(2));
      }

      // Đỉnh MFE thực tế của lệnh tối thiểu phải đạt bằng số R thực tế mà lệnh đã chốt (weighted_rr)
      const actualR = tr.weighted_rr !== undefined && !isNaN(Number(tr.weighted_rr)) 
        ? Number(tr.weighted_rr) 
        : (risk1R > 0 ? Number((net / risk1R).toFixed(2)) : 0);
      const effectiveMaxR = Math.max(mfeR, actualR);

      // ĐỈNH MFE THẬT ($): LUÔN LẤY 1R BAN ĐẦU NHÂN LÊN THEO ĐỈNH R ĐẠT ĐƯỢC
      if (effectiveMaxR > 0 && risk1R > 0) {
        mfeUsd = Math.max(mfeUsd, Number((effectiveMaxR * risk1R).toFixed(2)));
      }
      if (net > 0 && net > mfeUsd) {
        mfeUsd = net;
      }

      // =====================================================================
      // ĐƯỜNG 3: CỐ ĐỊNH TARGET XR (1R, 2R, 3R...) DỰA TRÊN ĐỈNH MFE:
      // - Nếu MFE của lệnh đạt đủ targetRR (effectiveMaxR >= targetRR hoặc lãi thực tế >= targetRR * risk1R):
      //   -> Lệnh đạt target: Chốt +targetRR * risk1R
      // - Nếu MFE KHÔNG ĐỦ targetRR (effectiveMaxR < targetRR):
      //   -> Giữ nguyên kết quả thực tế của lệnh (lỗ, BE, hoặc lãi nhỏ thực nhận)
      // =====================================================================
      const reachedTargetByMfe = effectiveMaxR >= targetRR || (net > 0 && risk1R > 0 && net >= (targetRR * risk1R));
      if (reachedTargetByMfe) {
        runningFixed += risk1R * targetRR;
      } else {
        runningFixed += net;
      }

      // Lợi nhuận để tuột thực tế (MFE chốt đỉnh - Net thực nhận)
      const leftOnTable = Math.max(0, mfeUsd - net);
      totalLeftOnTable += leftOnTable;
      totalAdverseDrag += maeUsd;
      if (hasRealMfe) validMfeCount++;

      // Kịch bản chốt theo đỉnh sóng MFE thật (Nếu có ghi nhận MFE > net):
      const optimalTradeProfit = mfeUsd > 0 ? mfeUsd : net;
      runningMfeOptimal += optimalTradeProfit;

      curveData.push({
        trade: `T#${idx + 1}`,
        actual: Number(runningActual.toFixed(2)),
        mfeOptimal: Number(runningMfeOptimal.toFixed(2)),
        fixedRR: Number(runningFixed.toFixed(2)),
        actualPnl: Number(net.toFixed(2)),
        mfeUsd: Number(mfeUsd.toFixed(2)),
        maeUsd: Number(maeUsd.toFixed(2)),
        leftOnTable: Number(leftOnTable.toFixed(2))
      });

      return {
        ticket: tr.ticket || `#${idx + 1}`,
        symbol: tr.symbol,
        type: tr.type || 'BUY',
        volume: vol,
        openPrice: tr.open_price || 0,
        closePrice: tr.close_price || 0,
        initialSl: tr.initial_sl || 0,
        openTime: tr.open_time || '',
        net,
        risk1R,
        hasRealMfe,
        hasRealMae,
        mfePrice: tr.mfe_price !== undefined && tr.mfe_price !== null ? Number(tr.mfe_price) : null,
        maePrice: tr.mae_price !== undefined && tr.mae_price !== null ? Number(tr.mae_price) : null,
        mfeDist: Number(mfeDist.toFixed(2)),
        maeDist: Number(maeDist.toFixed(2)),
        mfeUsd: Number(mfeUsd.toFixed(2)),
        maeUsd: Number(maeUsd.toFixed(2)),
        leftOnTable: Number(leftOnTable.toFixed(2)),
        mfeR,
        maeR
      };
    });

    const avgLeftOnTable = closedTrades.length > 0 ? totalLeftOnTable / closedTrades.length : 0;
    const avgMae = closedTrades.length > 0 ? totalAdverseDrag / closedTrades.length : 0;

    // THỐNG KÊ ĐÈ NÉN LỆNH THẮNG (MAE on Winning Trades - Edge Tightening Analysis):
    // Phân tích xem các lệnh THẮNG đã từng bị kéo ngược âm tối đa bao nhiêu R (MAE)
    const winningTrades = tradeDetails.filter(t => t.net > 0);
    const winCount = winningTrades.length;
    let sumMaeWinR = 0;
    let maxMaeWinR = 0;
    let maeWinUnder025R = 0;
    let maeWinUnder050R = 0;
    let maeWinUnder075R = 0;

    winningTrades.forEach(wt => {
      const mR = wt.maeR || 0;
      sumMaeWinR += mR;
      if (mR > maxMaeWinR) maxMaeWinR = mR;
      if (mR <= 0.25) maeWinUnder025R++;
      if (mR <= 0.50) maeWinUnder050R++;
      if (mR <= 0.75) maeWinUnder075R++;
    });

    const avgMaeWinR = winCount > 0 ? Number((sumMaeWinR / winCount).toFixed(2)) : 0;
    const pctUnder050R = winCount > 0 ? Number(((maeWinUnder050R / winCount) * 100).toFixed(1)) : 0;

    return {
      curveData,
      tradeDetails,
      targetRR,
      totalLeftOnTable: Number(totalLeftOnTable.toFixed(2)),
      avgLeftOnTable: Number(avgLeftOnTable.toFixed(2)),
      totalAdverseDrag: Number(totalAdverseDrag.toFixed(2)),
      avgMae: Number(avgMae.toFixed(2)),
      finalActual: Number(runningActual.toFixed(2)),
      finalMfeOptimal: Number(runningMfeOptimal.toFixed(2)),
      finalFixed: Number(runningFixed.toFixed(2)),
      potentialGain: Number((runningMfeOptimal - runningActual).toFixed(2)),
      maeWinStats: {
        winCount,
        avgMaeWinR,
        maxMaeWinR: Number(maxMaeWinR.toFixed(2)),
        pctUnder050R,
        maeWinUnder025R,
        maeWinUnder050R,
        maeWinUnder075R
      }
    };
  }, [closedTrades, initialBalance, customMfeRR]);

  const capitalAndFeesData = useMemo(() => {
    let totalComm = 0;
    let totalSwap = 0;
    let grossProfit = 0;
    const posMap: Record<string, { count: number; pnl: number }> = {};

    closedTrades.forEach(tr => {
      totalComm += Math.abs(tr.commission || 0);
      totalSwap += Math.abs(tr.swap || 0);
      const gross = tr.pnl || 0;
      if (gross > 0) grossProfit += gross;

      const posId = tr.position_id || tr.ticket;
      if (!posMap[posId]) posMap[posId] = { count: 0, pnl: 0 };
      posMap[posId].count++;
      posMap[posId].pnl += (tr.net_pnl !== undefined ? tr.net_pnl : gross);
    });

    const positions = Object.values(posMap);
    const single = positions.filter(p => p.count === 1);
    const clusters = positions.filter(p => p.count > 1);

    const singlePnl = Number(single.reduce((s, p) => s + p.pnl, 0).toFixed(2));
    const clusterPnl = Number(clusters.reduce((s, p) => s + p.pnl, 0).toFixed(2));
    const totalFeeDrag = Number((totalComm + totalSwap).toFixed(2));
    const feeDragPercent = grossProfit > 0 ? Number(((totalFeeDrag / grossProfit) * 100).toFixed(1)) : 0;

    return {
      singleCount: single.length,
      singlePnl,
      clusterCount: clusters.length,
      clusterPnl,
      totalComm: Number(totalComm.toFixed(2)),
      totalSwap: Number(totalSwap.toFixed(2)),
      totalFeeDrag,
      feeDragPercent
    };
  }, [closedTrades]);

  // =========================================================================
  // MÔ-ĐUN GIẢ LẬP CẮT LỆNH TỪNG PHẦN (PARTIAL SCALE-OUT TAKE-PROFIT SIMULATION)
  // 100% DỰA TRÊN DỮ LIỆU ĐỈNH GIÁ THẬT (MFE) TỪ MT5 & SUPABASE
  // =========================================================================

  // Helper tính tỷ lệ từ phân số (1/3, 1/2) hoặc % (30%, 50%)
  const parsePortionRatio = useCallback((input: string): number => {
    const clean = String(input || '').trim().replace('%', '');
    if (clean.includes('/')) {
      const parts = clean.split('/');
      const n = parseFloat(parts[0]);
      const d = parseFloat(parts[1]);
      if (!isNaN(n) && !isNaN(d) && d > 0) return n / d;
    }
    const val = parseFloat(clean);
    if (!isNaN(val)) {
      if (val > 1) return val / 100;
      return val;
    }
    return 0;
  }, []);

  // Danh sách các cấu hình mẫu phổ biến (Presets) kèm Mức Dịch SL tự động
  const PARTIAL_SCALE_PRESETS = useMemo(() => [
    {
      id: 'p1',
      label: '1/3 @ 2R | 1/3 @ 4R | 1/3 @ 6R',
      desc: language === 'vi' ? '3 phần: 1/3 ở 2R (Dịch BE 0R), 1/3 ở 4R (Dịch 2R), 1/3 ở 6R' : '3 tiers: 1/3 @ 2R (BE 0R), 1/3 @ 4R (Trail 2R), 1/3 @ 6R',
      tiers: [
        { id: '1', portionFraction: '1/3', portionRatio: 1 / 3, targetR: 2.0, trailStopR: 0.0 },
        { id: '2', portionFraction: '1/3', portionRatio: 1 / 3, targetR: 4.0, trailStopR: 2.0 },
        { id: '3', portionFraction: '1/3', portionRatio: 1 / 3, targetR: 6.0, trailStopR: 4.0 },
      ]
    },
    {
      id: 'p2',
      label: '1/2 @ 1.5R | 1/2 @ 2.0R',
      desc: language === 'vi' ? '2 phần: 1/2 ở 1.5R (Dịch BE 0R), 1/2 ở 2.0R' : '2 tiers: 1/2 @ 1.5R (BE 0R), 1/2 @ 2.0R',
      tiers: [
        { id: '1', portionFraction: '1/2', portionRatio: 0.5, targetR: 1.5, trailStopR: 0.0 },
        { id: '2', portionFraction: '1/2', portionRatio: 0.5, targetR: 2.0, trailStopR: 1.0 },
      ]
    },
    {
      id: 'p3',
      label: '1/2 @ 2.0R | 1/2 @ 3.0R',
      desc: language === 'vi' ? '2 phần: 1/2 ở 2.0R (Dịch BE 0R), 1/2 ở 3.0R' : '2 tiers: 1/2 @ 2.0R (BE 0R), 1/2 @ 3.0R',
      tiers: [
        { id: '1', portionFraction: '1/2', portionRatio: 0.5, targetR: 2.0, trailStopR: 0.0 },
        { id: '2', portionFraction: '1/2', portionRatio: 0.5, targetR: 3.0, trailStopR: 1.5 },
      ]
    },
    {
      id: 'p4',
      label: '50% @ 1.5R | 30% @ 2.5R | 20% @ 4.0R',
      desc: language === 'vi' ? 'Bảo toàn vốn sớm + Gồng lời Runner' : 'Early capital protection + Runner',
      tiers: [
        { id: '1', portionFraction: '50%', portionRatio: 0.5, targetR: 1.5, trailStopR: 0.0 },
        { id: '2', portionFraction: '30%', portionRatio: 0.3, targetR: 2.5, trailStopR: 1.0 },
        { id: '3', portionFraction: '20%', portionRatio: 0.2, targetR: 4.0, trailStopR: 2.0 },
      ]
    },
    {
      id: 'p5',
      label: '1/4 @ 1.5R | 1/4 @ 2.5R | 1/4 @ 3.5R | 1/4 @ 5.0R',
      desc: language === 'vi' ? '4 phần: 1.5R (BE 0R), 2.5R (1R), 3.5R (2R), 5.0R' : '4 equal quarters',
      tiers: [
        { id: '1', portionFraction: '1/4', portionRatio: 0.25, targetR: 1.5, trailStopR: 0.0 },
        { id: '2', portionFraction: '1/4', portionRatio: 0.25, targetR: 2.5, trailStopR: 1.0 },
        { id: '3', portionFraction: '1/4', portionRatio: 0.25, targetR: 3.5, trailStopR: 2.0 },
        { id: '4', portionFraction: '1/4', portionRatio: 0.25, targetR: 5.0, trailStopR: 3.5 },
      ]
    }
  ], [language]);

  // Tính toán Mô phỏng Cắt Lệnh Từng Phần dựa trên dữ liệu thật 100% kèm Tùy chỉnh Dịch SL
  const partialScaleData = useMemo(() => {
    let runningActual = initialBalance;
    let runningSim = initialBalance;
    let winCount = 0;
    let lossCount = 0;
    let beCount = 0;
    let betterCount = 0;

    const lossTrades = closedTrades.filter(t => (t.net_pnl !== undefined ? t.net_pnl : (t.pnl || 0)) < -1);
    const avgLossAmount = lossTrades.length > 0 
      ? Math.abs(lossTrades.reduce((sum, t) => sum + (t.net_pnl !== undefined ? t.net_pnl : (t.pnl || 0)), 0) / lossTrades.length)
      : 100;

    // Sắp xếp các mốc theo targetR tăng dần
    const sortedTiers = [...partialScaleTiers].sort((a, b) => a.targetR - b.targetR);
    const rawTotalRatio = sortedTiers.reduce((s, t) => s + (t.portionRatio || 0), 0);
    // Chuẩn hóa tỷ lệ nếu tổng khác 1 để đảm bảo 100% khối lượng
    const normalizedTiers = sortedTiers.map(t => ({
      ...t,
      trailStopR: t.trailStopR !== undefined && !isNaN(Number(t.trailStopR)) ? Number(t.trailStopR) : 0,
      normalizedRatio: rawTotalRatio > 0 ? (t.portionRatio / rawTotalRatio) : (1 / sortedTiers.length)
    }));

    const tierHitCounts: Record<string, number> = {};
    sortedTiers.forEach(t => { tierHitCounts[t.id] = 0; });

    const curveData: Array<{ trade: string; actual: number; simulated: number; pnl: number; simPnl: number }> = [
      { trade: 'T#0', actual: initialBalance, simulated: initialBalance, pnl: 0, simPnl: 0 }
    ];

    const tradeBreakdown = closedTrades.map((tr, idx) => {
      const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
      runningActual += net;

      let risk1R = tr.risk_1r_usd && tr.risk_1r_usd > 0 ? tr.risk_1r_usd : 0;
      if (!risk1R && tr.initial_sl && tr.initial_sl > 0 && tr.open_price && tr.volume) {
        risk1R = calculateRisk1R(tr.open_price, tr.initial_sl, tr.volume, 100, 100, tr.symbol);
      }
      if (!risk1R || risk1R <= 0) {
        risk1R = net < 0 ? Math.abs(net) : avgLossAmount;
      }

      // 1. Trích xuất MFE thật 100% từ MT5 / Supabase
      const isGold = (tr.symbol || '').toUpperCase().includes('XAU') || (tr.symbol || '').toUpperCase().includes('GOLD');
      const multiplier = isGold ? 100 : 100000;
      const vol = tr.volume || 1;
      const isBuy = tr.type === 'BUY';

      let mfeDist = tr.mfe_dist !== undefined && tr.mfe_dist !== null ? Number(tr.mfe_dist) : 0;
      if (!mfeDist && tr.mfe_price !== undefined && tr.mfe_price !== null && Number(tr.mfe_price) > 0 && tr.open_price) {
        const rawMfe = Number(tr.mfe_price);
        if (Math.abs(rawMfe - tr.open_price) < tr.open_price * 0.5) {
          mfeDist = Math.abs(rawMfe - tr.open_price);
        } else {
          mfeDist = rawMfe;
        }
      }

      // Trích xuất từ đỉnh High / Low của nến nếu chưa có mfeDist
      if (!mfeDist && tr.open_price) {
        if (isBuy && tr.high && Number(tr.high) > tr.open_price) {
          mfeDist = Number(tr.high) - tr.open_price;
        } else if (!isBuy && tr.low && Number(tr.low) < tr.open_price) {
          mfeDist = tr.open_price - Number(tr.low);
        }
      }

      let mfeUsd = 0;
      if (mfeDist > 0) {
        mfeUsd = Number((mfeDist * vol * multiplier).toFixed(2));
      } else if (net > 0) {
        mfeUsd = net; // Đỉnh sóng tối thiểu phải bằng mức lãi đã chốt
      }

      const pRisk = (tr.initial_sl && tr.open_price) ? Math.abs(tr.open_price - tr.initial_sl) : 0;
      let mfeR = tr.mfe_r !== undefined && tr.mfe_r !== null && !isNaN(Number(tr.mfe_r)) ? Number(tr.mfe_r) : 0;
      if (!mfeR && pRisk > 0 && mfeDist > 0) {
        mfeR = Number((mfeDist / pRisk).toFixed(2));
      } else if (!mfeR && risk1R > 0 && mfeUsd > 0) {
        mfeR = Number((mfeUsd / risk1R).toFixed(2));
      }

      const actualR = tr.weighted_rr !== undefined && !isNaN(Number(tr.weighted_rr)) 
        ? Number(tr.weighted_rr) 
        : (risk1R > 0 ? Number((net / risk1R).toFixed(2)) : 0);
      const effectiveMaxR = Math.max(mfeR, actualR);

      // ĐỈNH MFE THẬT ($): LUÔN LẤY 1R BAN ĐẦU NHÂN LÊN THEO ĐỈNH R ĐẠT ĐƯỢC (effectiveMaxR * risk1R)
      // MFE là đỉnh cao nhất sóng của lệnh, không bị cắt nhỏ theo 1/3 hay 1/2 của setting!
      if (effectiveMaxR > 0 && risk1R > 0) {
        mfeUsd = Math.max(mfeUsd, Number((effectiveMaxR * risk1R).toFixed(2)));
      }
      if (net > 0 && net > mfeUsd) {
        mfeUsd = net;
      }

      // ĐỐI CHIẾU MFE THẬT: Tìm mốc TP cao nhất mà lệnh đã đạt tới
      let highestHitIdx = -1;
      normalizedTiers.forEach((tier, tIdx) => {
        const isHit = effectiveMaxR >= tier.targetR || (net > 0 && risk1R > 0 && net >= tier.targetR * risk1R);
        if (isHit) {
          highestHitIdx = Math.max(highestHitIdx, tIdx);
        }
      });

      // Mức SL dịch chuyển bảo vệ (Trailing Stop) được kích hoạt bởi mốc TP cao nhất đã chạm:
      // - Nếu chưa chạm mốc nào (highestHitIdx === -1): mức bảo vệ chưa kích hoạt
      // - Nếu chạm ít nhất mốc highestHitIdx: lấy trailStopR của mốc đó (ví dụ đạt TP1 dịch lên 0R; đạt TP2 dịch lên 2R...)
      const activeTrailedSlR = highestHitIdx >= 0 
        ? (normalizedTiers[highestHitIdx].trailStopR !== undefined ? normalizedTiers[highestHitIdx].trailStopR : 0)
        : null;

      let tradeSimPnl = 0;
      const tierResults = normalizedTiers.map((tier, tIdx) => {
        const isHit = tIdx <= highestHitIdx;
        if (isHit) {
          tierHitCounts[tier.id] = (tierHitCounts[tier.id] || 0) + 1;
        }

        let tierPnl = 0;
        let status: 'HIT' | 'BE' | 'TRAILED' | 'SL' | 'ACTUAL' = 'SL';

        if (isHit) {
          // Mốc này đã chạm TP thành công -> Ăn trọn mốc TP
          tierPnl = tier.normalizedRatio * tier.targetR * risk1R;
          status = 'HIT';
        } else {
          // Mốc này KHÔNG đạt TP (MFE không tới)
          if (highestHitIdx >= 0 && activeTrailedSlR !== null) {
            // Đã đạt ít nhất 1 mốc trước đó -> Phần này thoát ở mức SL dịch chuyển bảo vệ!
            if (activeTrailedSlR > 0) {
              // Dịch SL khóa lãi dương (ví dụ đạt TP2 dịch SL lên +2R!)
              tierPnl = tier.normalizedRatio * activeTrailedSlR * risk1R;
              status = 'TRAILED';
            } else if (activeTrailedSlR === 0) {
              // Dịch SL về Hòa vốn BE $0
              tierPnl = 0;
              status = 'BE';
            } else {
              // activeTrailedSlR < 0
              tierPnl = tier.normalizedRatio * activeTrailedSlR * risk1R;
              status = 'SL';
            }
          } else {
            // Không đạt nổi cả TP1 (trượt hoàn toàn)
            if (partialRemainingMode === 'SL') {
              tierPnl = -tier.normalizedRatio * 1.0 * risk1R;
              status = 'SL';
            } else {
              tierPnl = tier.normalizedRatio * net;
              status = net < 0 ? 'SL' : 'ACTUAL';
            }
          }
        }

        tradeSimPnl += tierPnl;

        return {
          id: tier.id,
          targetR: tier.targetR,
          trailStopR: tier.trailStopR ?? 0,
          portionFraction: tier.portionFraction,
          portionRatio: tier.normalizedRatio,
          isHit,
          status,
          tierPnl: Number(tierPnl.toFixed(2)),
          activeTrailedSlR,
          effectiveMaxR: Number(effectiveMaxR.toFixed(2))
        };
      });

      runningSim += tradeSimPnl;

      if (tradeSimPnl > 1) winCount++;
      else if (tradeSimPnl < -1) lossCount++;
      else beCount++;

      const delta = tradeSimPnl - net;
      if (delta > 1) betterCount++;

      curveData.push({
        trade: `T#${idx + 1}`,
        actual: Number(runningActual.toFixed(2)),
        simulated: Number(runningSim.toFixed(2)),
        pnl: Number(net.toFixed(2)),
        simPnl: Number(tradeSimPnl.toFixed(2))
      });

      return {
        idx: idx + 1,
        ticket: tr.ticket || tr.position_id || `T#${idx + 1}`,
        symbol: tr.symbol || 'N/A',
        type: tr.type || (tr.action === 0 ? 'BUY' : 'SELL'),
        volume: tr.volume || 0,
        openPrice: tr.open_price || 0,
        initialSl: tr.initial_sl || 0,
        closePrice: tr.close_price || 0,
        net: Number(net.toFixed(2)),
        risk1R: Number(risk1R.toFixed(2)),
        mfeR: Number(mfeR.toFixed(2)),
        mfeUsd: Number(mfeUsd.toFixed(2)),
        effectiveMaxR: Number(effectiveMaxR.toFixed(2)),
        simPnl: Number(tradeSimPnl.toFixed(2)),
        delta: Number(delta.toFixed(2)),
        hitTp1: highestHitIdx >= 0,
        tierResults,
        openTime: tr.open_time || '',
        closeTime: tr.close_time || '',
        durationSec: (tr.open_time && tr.close_time) 
          ? Math.max(0, Math.floor((new Date(tr.close_time).getTime() - new Date(tr.open_time).getTime()) / 1000))
          : 0
      };
    });

    const totalTrades = closedTrades.length;
    const finalActual = Number(runningActual.toFixed(2));
    const finalSimulated = Number(runningSim.toFixed(2));
    const deltaTotal = Number((finalSimulated - finalActual).toFixed(2));
    const winRate = totalTrades > 0 ? Number(((winCount / totalTrades) * 100).toFixed(1)) : 0;
    const avgSimPnl = totalTrades > 0 ? Number(((finalSimulated - initialBalance) / totalTrades).toFixed(2)) : 0;
    const avgActualPnl = totalTrades > 0 ? Number(((finalActual - initialBalance) / totalTrades).toFixed(2)) : 0;

    return {
      totalTrades,
      finalActual,
      finalSimulated,
      deltaTotal,
      winCount,
      lossCount,
      beCount,
      betterCount,
      winRate,
      avgSimPnl,
      avgActualPnl,
      curveData,
      tradeBreakdown,
      tierHitCounts,
      sortedTiers,
      rawTotalRatioPercent: Number((rawTotalRatio * 100).toFixed(1))
    };
  }, [closedTrades, partialScaleTiers, partialRemainingMode, initialBalance, calculateRisk1R]);

  // Bộ lọc danh sách lệnh
  const filteredPartialTrades = useMemo(() => {
    let list = partialScaleData.tradeBreakdown;

    if (partialSearchQuery.trim()) {
      const q = partialSearchQuery.trim().toLowerCase();
      list = list.filter(t => 
        String(t.ticket).toLowerCase().includes(q) || 
        String(t.symbol).toLowerCase().includes(q)
      );
    }

    if (partialFilterStatus === 'WIN') {
      list = list.filter(t => t.simPnl > 1);
    } else if (partialFilterStatus === 'LOSS') {
      list = list.filter(t => t.simPnl < -1);
    } else if (partialFilterStatus === 'BE') {
      list = list.filter(t => Math.abs(t.simPnl) <= 1);
    } else if (partialFilterStatus === 'BETTER_THAN_ACTUAL') {
      list = list.filter(t => t.delta > 1);
    }

    return list;
  }, [partialScaleData.tradeBreakdown, partialSearchQuery, partialFilterStatus]);

  // Phân trang danh sách lệnh (Đồng bộ kiểu dáng như HistoryTable)
  const effectivePartialPageSize = partialPageSize === 0 ? (filteredPartialTrades.length || 1) : partialPageSize;
  const totalPartialPages = Math.max(1, Math.ceil(filteredPartialTrades.length / effectivePartialPageSize));
  const safePartialPage = Math.min(partialPage, totalPartialPages);

  useEffect(() => {
    setPartialPage(1);
  }, [partialSearchQuery, partialFilterStatus, partialPageSize]);

  const paginatedPartialTrades = useMemo(() => {
    if (partialPageSize === 0) return filteredPartialTrades;
    const start = (safePartialPage - 1) * effectivePartialPageSize;
    return filteredPartialTrades.slice(start, start + effectivePartialPageSize);
  }, [filteredPartialTrades, safePartialPage, effectivePartialPageSize, partialPageSize]);

  const partialPaginationNumbers = useMemo(() => {
    const pages: number[] = [];
    if (totalPartialPages <= 5) {
      for (let i = 1; i <= totalPartialPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePartialPage > 3) pages.push(-1);
      const start = Math.max(2, safePartialPage - 1);
      const end = Math.min(totalPartialPages - 1, safePartialPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (safePartialPage < totalPartialPages - 2) pages.push(-1);
      if (!pages.includes(totalPartialPages)) pages.push(totalPartialPages);
    }
    return pages;
  }, [totalPartialPages, safePartialPage]);

  // =========================================================================
  // MÔ-ĐUN GIẢ LẬP DỊCH SL LIÊN TỤC KHÔNG CÓ TP CỐ ĐỊNH (CONTINUOUS TRAILING SL - RUNNER MODE)
  // MẶC ĐỊNH: LỢI NHUẬN ĐẠT MỖI 1.5R THÌ SL DỊCH LÊN 1.5R (CÓ THỂ THAY ĐỔI ĐƯỢC)
  // =========================================================================
  const continuousTrailingData = useMemo(() => {
    let runningActual = initialBalance;
    let runningSim = initialBalance;
    let winCount = 0;
    let lossCount = 0;
    let beCount = 0;
    let betterCount = 0;
    let runnerCount = 0;
    let maxRunnerR = 0;

    // LỌC CHUẨN XÁC THEO YÊU CẦU CỦA THẦY: CHỈ KIỂM TOÁN CÁC LỆNH ĐÃ CÓ NẾN M5 THẬT, BỎ QUA LỆNH CHƯA CÓ NẾN
    const targetTrades = closedTrades.filter(tr => {
      if (!tr.candles) return false;
      if (Array.isArray(tr.candles)) return tr.candles.length > 0;
      if (typeof tr.candles === 'string') {
        try {
          const parsed = JSON.parse(tr.candles);
          return Array.isArray(parsed) && parsed.length > 0;
        } catch {
          return false;
        }
      }
      return false;
    });

    const skippedTradesCount = closedTrades.length - targetTrades.length;

    const lossTrades = targetTrades.filter(t => (t.net_pnl !== undefined ? t.net_pnl : (t.pnl || 0)) < -1);
    const avgLossAmount = lossTrades.length > 0 
      ? Math.abs(lossTrades.reduce((sum, t) => sum + (t.net_pnl !== undefined ? t.net_pnl : (t.pnl || 0)), 0) / lossTrades.length)
      : 100;

    const curveData: Array<{ trade: string; actual: number; simulated: number; pnl: number; simPnl: number }> = [
      { trade: 'T#0', actual: initialBalance, simulated: initialBalance, pnl: 0, simPnl: 0 }
    ];

    const stepR = Math.max(0.1, continuousStepR || 1.5);

    const tradeBreakdown = targetTrades.map((tr, idx) => {
      const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
      runningActual += net;

      let risk1R = tr.risk_1r_usd && tr.risk_1r_usd > 0 ? tr.risk_1r_usd : 0;
      if (!risk1R && tr.initial_sl && tr.initial_sl > 0 && tr.open_price && tr.volume) {
        risk1R = calculateRisk1R(tr.open_price, tr.initial_sl, tr.volume, 100, 100, tr.symbol);
      }
      if (!risk1R || risk1R <= 0) {
        risk1R = net < 0 ? Math.abs(net) : avgLossAmount;
      }

      const isGold = (tr.symbol || '').toUpperCase().includes('XAU') || (tr.symbol || '').toUpperCase().includes('GOLD');
      const multiplier = isGold ? 100 : 100000;
      const vol = tr.volume || 1;
      const isBuy = tr.type === 'BUY';

      let mfeDist = tr.mfe_dist !== undefined && tr.mfe_dist !== null ? Number(tr.mfe_dist) : 0;
      if (!mfeDist && tr.mfe_price !== undefined && tr.mfe_price !== null && Number(tr.mfe_price) > 0 && tr.open_price) {
        const rawMfe = Number(tr.mfe_price);
        if (Math.abs(rawMfe - tr.open_price) < tr.open_price * 0.5) {
          mfeDist = Math.abs(rawMfe - tr.open_price);
        } else {
          mfeDist = rawMfe;
        }
      }

      if (!mfeDist && tr.open_price) {
        if (isBuy && tr.high && Number(tr.high) > tr.open_price) {
          mfeDist = Number(tr.high) - tr.open_price;
        } else if (!isBuy && tr.low && Number(tr.low) < tr.open_price) {
          mfeDist = tr.open_price - Number(tr.low);
        }
      }

      let mfeUsd = 0;
      if (mfeDist > 0) {
        mfeUsd = Number((mfeDist * vol * multiplier).toFixed(2));
      } else if (net > 0) {
        mfeUsd = net;
      }

      const pRisk = (tr.initial_sl && tr.open_price) ? Math.abs(tr.open_price - tr.initial_sl) : 0;
      let mfeR = tr.mfe_r !== undefined && tr.mfe_r !== null && !isNaN(Number(tr.mfe_r)) ? Number(tr.mfe_r) : 0;
      if (!mfeR && pRisk > 0 && mfeDist > 0) {
        mfeR = Number((mfeDist / pRisk).toFixed(2));
      } else if (!mfeR && risk1R > 0 && mfeUsd > 0) {
        mfeR = Number((mfeUsd / risk1R).toFixed(2));
      }

      const actualR = tr.weighted_rr !== undefined && !isNaN(Number(tr.weighted_rr)) 
        ? Number(tr.weighted_rr) 
        : (risk1R > 0 ? Number((net / risk1R).toFixed(2)) : 0);
      const effectiveMaxR = Math.max(mfeR, actualR);

      // QUY TẮC DỊCH SL LIÊN TỤC KHÔNG CÓ TP CỐ ĐỊNH (TIME-SERIES CANDLE SIMULATION):
      let simR = actualR;
      let simPnl = net;
      let stepCount = 0;
      let lockedSlR = -1;
      let stoppedByTrail = false;

      // NẾU LỆNH CÓ MẢNG NẾN CANDLES: Duyệt từng nến theo thời gian thật để bắt chính xác các cú quét râu nến
      let candleList: Array<{ open?: number; high?: number; low?: number; close?: number }> = [];
      if (tr.candles) {
        if (Array.isArray(tr.candles)) {
          candleList = tr.candles;
        } else if (typeof tr.candles === 'string') {
          try { candleList = JSON.parse(tr.candles); } catch(e) {}
        }
      }

      if (candleList && candleList.length > 0 && pRisk > 0) {
        let currentSlR = -1; // Mặc định SL ban đầu là -1R
        let currentPeakR = 0;
        let currentSteps = 0;

        for (let i = 0; i < candleList.length; i++) {
          const c = candleList[i];
          if (!c) continue;

          const isGreen = (Number(c.close || 0)) >= (Number(c.open || 0));
          // Ở cây nến đầu tiên (vào lệnh), chặn biên bởi open_price để không lấy phần râu nến trước khi khớp lệnh
          const candleHigh = i === 0 
            ? Math.max(Number(c.high ?? tr.open_price), tr.open_price) 
            : Number(c.high ?? c.close ?? tr.open_price);
          const candleLow = i === 0 
            ? Math.min(Number(c.low ?? tr.open_price), tr.open_price) 
            : Number(c.low ?? c.open ?? tr.open_price);

          const candleHighR = isBuy 
            ? ((candleHigh - tr.open_price) / pRisk)
            : ((tr.open_price - candleLow) / pRisk);
          const candleAdverseR = isBuy 
            ? ((candleLow - tr.open_price) / pRisk)
            : ((tr.open_price - candleHigh) / pRisk);

          // Thứ tự hành động giá vi mô trong nến (Intra-bar Price Action Sequence):
          // Lệnh BUY nến xanh hoặc SELL nến đỏ: Râu bất lợi test trước -> kiểm tra SL trước, sau đó thân nến thuận chiều kéo đỉnh -> nâng SL
          // Lệnh BUY nến đỏ hoặc SELL nến xanh: Râu thuận chiều rướn trước -> nâng SL, sau đó râu bất lợi giật ngược -> kiểm tra quét SL
          const checkAdverseFirst = isBuy ? isGreen : !isGreen;

          if (checkAdverseFirst) {
            // 1. Kiểm tra râu bất lợi có cắn mức SL đã dời từ các nến trước không
            if (currentSlR >= 0 && candleAdverseR <= currentSlR) {
              stoppedByTrail = true;
              stepCount = currentSteps;
              lockedSlR = currentSlR;
              simR = currentSlR;
              simPnl = Number((currentSlR * risk1R).toFixed(2));
              break;
            }
            // 2. Cập nhật đỉnh có lợi và nâng SL lên nấc mới
            if (candleHighR > currentPeakR) {
              currentPeakR = candleHighR;
              if (currentPeakR >= (currentSteps + 1) * stepR) {
                currentSteps = Math.floor(currentPeakR / stepR);
                if (continuousTrailType === 'GAP') {
                  currentSlR = Number(((currentSteps - 1) * stepR).toFixed(2));
                } else {
                  currentSlR = Number((currentSteps * stepR).toFixed(2));
                }
              }
            }
          } else {
            // 1. Rướn đỉnh thuận chiều trước -> cập nhật đỉnh và nâng SL
            if (candleHighR > currentPeakR) {
              currentPeakR = candleHighR;
              if (currentPeakR >= (currentSteps + 1) * stepR) {
                currentSteps = Math.floor(currentPeakR / stepR);
                if (continuousTrailType === 'GAP') {
                  currentSlR = Number(((currentSteps - 1) * stepR).toFixed(2));
                } else {
                  currentSlR = Number((currentSteps * stepR).toFixed(2));
                }
              }
            }
            // 2. Kiểm tra râu giật ngược có quét trúng mức SL vừa nâng hoặc SL cũ không
            if (currentSlR >= 0 && candleAdverseR <= currentSlR) {
              stoppedByTrail = true;
              stepCount = currentSteps;
              lockedSlR = currentSlR;
              simR = currentSlR;
              simPnl = Number((currentSlR * risk1R).toFixed(2));
              break;
            }
          }
        }

        // Nếu hết danh sách nến mà chưa bị quét SL: lấy mức SL đã khóa cao nhất
        if (!stoppedByTrail) {
          if (currentSteps > 0 && currentSlR >= 0) {
            stepCount = currentSteps;
            lockedSlR = currentSlR;
            simR = currentSlR;
            simPnl = Number((currentSlR * risk1R).toFixed(2));
          } else {
            simR = actualR;
            simPnl = net;
          }
        }
      } else {
        // Fallback: Khi lệnh chưa có mảng nến (tính theo xấp xỉ MFE)
        if (effectiveMaxR >= stepR) {
          stepCount = Math.floor(effectiveMaxR / stepR);
          if (continuousTrailType === 'GAP') {
            lockedSlR = Number(((stepCount - 1) * stepR).toFixed(2));
          } else {
            lockedSlR = Number((stepCount * stepR).toFixed(2));
          }
          simR = lockedSlR;
          simPnl = Number((lockedSlR * risk1R).toFixed(2));
        } else {
          simR = actualR;
          simPnl = net;
        }
      }

      runningSim += simPnl;
      curveData.push({
        trade: `T#${idx + 1}`,
        actual: Number(runningActual.toFixed(2)),
        simulated: Number(runningSim.toFixed(2)),
        pnl: net,
        simPnl
      });

      if (simPnl > 5) winCount++;
      else if (simPnl < -5) lossCount++;
      else beCount++;

      if (simPnl > net + 5) betterCount++;
      if (simR >= 3.0) runnerCount++;
      if (simR > maxRunnerR) maxRunnerR = simR;

      return {
        tradeId: tr.id,
        ticket: tr.ticket || `#${idx + 1}`,
        symbol: tr.symbol || 'XAUUSD',
        type: tr.type || 'BUY',
        volume: vol,
        net,
        actualR,
        risk1R,
        effectiveMaxR,
        stepCount,
        lockedSlR,
        simR,
        simPnl,
        candlesCount: candleList.length,
        stoppedByTrail,
        delta: Number((simPnl - net).toFixed(2)),
        isBetter: simPnl > net + 5,
        status: simPnl > 5 ? 'WIN' : (simPnl < -5 ? 'LOSS' : 'BE'),
        openTime: tr.open_time || '',
        closeTime: tr.close_time || ''
      };
    });

    const totalTrades = targetTrades.length;
    const finalActual = Number(runningActual.toFixed(2));
    const finalSimulated = Number(runningSim.toFixed(2));
    const deltaTotal = Number((finalSimulated - finalActual).toFixed(2));
    const winRate = totalTrades > 0 ? Number(((winCount / totalTrades) * 100).toFixed(1)) : 0;
    const avgSimPnl = totalTrades > 0 ? Number(((finalSimulated - initialBalance) / totalTrades).toFixed(2)) : 0;
    const avgActualPnl = totalTrades > 0 ? Number(((finalActual - initialBalance) / totalTrades).toFixed(2)) : 0;

    return {
      totalTrades,
      skippedTradesCount,
      hasCandleData: totalTrades > 0,
      finalActual,
      finalSimulated,
      deltaTotal,
      winCount,
      lossCount,
      beCount,
      betterCount,
      runnerCount,
      maxRunnerR,
      winRate,
      avgSimPnl,
      avgActualPnl,
      curveData,
      tradeBreakdown,
      stepR
    };
  }, [closedTrades, continuousStepR, continuousTrailType, initialBalance, calculateRisk1R]);

  // Bộ lọc danh sách lệnh Dịch SL liên tục
  const filteredContinuousTrades = useMemo(() => {
    let list = continuousTrailingData.tradeBreakdown;

    if (continuousSearchQuery.trim()) {
      const q = continuousSearchQuery.trim().toLowerCase();
      list = list.filter(t => 
        String(t.ticket).toLowerCase().includes(q) || 
        String(t.symbol).toLowerCase().includes(q)
      );
    }

    if (continuousFilterStatus === 'WIN') {
      list = list.filter(t => t.simPnl > 1);
    } else if (continuousFilterStatus === 'LOSS') {
      list = list.filter(t => t.simPnl < -1);
    } else if (continuousFilterStatus === 'BE') {
      list = list.filter(t => Math.abs(t.simPnl) <= 1);
    } else if (continuousFilterStatus === 'BETTER_THAN_ACTUAL') {
      list = list.filter(t => t.delta > 1);
    } else if (continuousFilterStatus === 'RUNNER') {
      list = list.filter(t => t.simR >= 3.0);
    }

    return list;
  }, [continuousTrailingData.tradeBreakdown, continuousSearchQuery, continuousFilterStatus]);

  // Phân trang danh sách lệnh Dịch SL liên tục
  const effectiveContinuousPageSize = continuousPageSize === 0 ? (filteredContinuousTrades.length || 1) : continuousPageSize;
  const totalContinuousPages = Math.max(1, Math.ceil(filteredContinuousTrades.length / effectiveContinuousPageSize));
  const safeContinuousPage = Math.min(continuousPage, totalContinuousPages);

  useEffect(() => {
    setContinuousPage(1);
  }, [continuousSearchQuery, continuousFilterStatus, continuousPageSize]);

  const paginatedContinuousTrades = useMemo(() => {
    if (continuousPageSize === 0) return filteredContinuousTrades;
    const start = (safeContinuousPage - 1) * effectiveContinuousPageSize;
    return filteredContinuousTrades.slice(start, start + effectiveContinuousPageSize);
  }, [filteredContinuousTrades, safeContinuousPage, effectiveContinuousPageSize, continuousPageSize]);

  const continuousPaginationNumbers = useMemo(() => {
    const pages: number[] = [];
    if (totalContinuousPages <= 5) {
      for (let i = 1; i <= totalContinuousPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeContinuousPage > 3) pages.push(-1);
      const start = Math.max(2, safeContinuousPage - 1);
      const end = Math.min(totalContinuousPages - 1, safeContinuousPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (safeContinuousPage < totalContinuousPages - 2) pages.push(-1);
      if (!pages.includes(totalContinuousPages)) pages.push(totalContinuousPages);
    }
    return pages;
  }, [totalContinuousPages, safeContinuousPage]);

  // =========================================================================
  // 5.4.3 RÀ SOÁT TÂM LÝ: HẬU QUẢ HỤT ĂN ĐỈNH DẪN ĐẾN TRẢ THÙ THỊ TRƯỜNG
  // (Post-MFE Greed Hangover & Revenge Trading Audit)
  // =========================================================================
  const postGreedPsychologyData = useMemo(() => {
    const list = partialScaleData.tradeBreakdown || [];
    const totalTrades = list.length;
    if (totalTrades === 0) {
      return {
        triggeredEvents: [],
        totalTriggered: 0,
        baselineLossRate: 0,
        postLossRate: 0,
        lossRateDelta: 0,
        totalRevengePnlUsd: 0,
        totalRevengePnlR: 0,
        maxLossStreakAfter: 0,
        tiltSeverity: 'NORMAL' as 'NORMAL' | 'ELEVATED' | 'CRITICAL'
      };
    }

    // Baseline: Tỷ lệ thua bình thường của toàn bộ tài khoản
    const normalLossCount = list.filter(t => t.net < -1).length;
    const baselineLossRate = Number(((normalLossCount / totalTrades) * 100).toFixed(1));

    interface TriggeredEvent {
      triggerTrade: typeof list[0];
      triggerIndex: number;
      effectiveMaxR: number;
      actualR: number;
      missedR: number;
      missedUsd: number;
      captureRatePercent: number;
      durationSec: number;
      holdingMinutes: number;
      followUps: Array<typeof list[0] & { orderInWindow: number; isLoss: boolean; isWin: boolean; isBe: boolean }>;
      followUpLossCount: number;
      followUpWinCount: number;
      followUpBeCount: number;
      followUpTotalPnlUsd: number;
      followUpTotalPnlR: number;
      postEventLossRate: number;
      lossStreak: number;
    }

    const events: TriggeredEvent[] = [];
    let aggregateFollowUpTrades = 0;
    let aggregateFollowUpLosses = 0;
    let totalRevengePnlUsd = 0;
    let totalRevengePnlR = 0;
    let globalMaxStreak = 0;

    for (let i = 0; i < totalTrades; i++) {
      const tr = list[i];
      const effMaxR = tr.effectiveMaxR || 0;
      const actualR = tr.risk1R > 0 ? Number((tr.net / tr.risk1R).toFixed(2)) : 0;
      const missedR = Number((effMaxR - actualR).toFixed(2));

      // 1. TỶ LỆ GIỮ LÃI (Capture Rate %): Thực nhận / Đỉnh MFE
      // Nếu thực nhận âm (SL) hoặc 0 (BE), tỷ lệ giữ lãi = 0%
      const captureRatePercent = (effMaxR > 0 && actualR > 0)
        ? Number(((actualR / effMaxR) * 100).toFixed(1))
        : 0;

      // 2. THỜI GIAN GỒNG LỆNH (Holding Duration):
      const durationSec = tr.durationSec || 0;
      const holdingMinutes = Number((durationSec / 60).toFixed(1));

      // ĐIỀU KIỆN KÍCH HOẠT HỤT ĂN BỐC HƠI (DECAY EFFICIENCY TRAP - KẾT HỢP 1 VÀ 3):
      // - Tiêu chí 1: Đỉnh MFE cao (mặc định >= 2.5R)
      // - Tiêu chí 2: Tỷ lệ giữ lãi rất thấp (mặc định <= 20%, để bốc hơi >= 80% đỉnh lãi)
      // - Tiêu chí 3: Thời gian gồng lệnh đủ lâu (mặc định >= 15 phút, loại trừ giật râu tin tức chớp nhoáng)
      const isGreedTrap = effMaxR >= psychologyMfeThreshold && 
                          captureRatePercent <= psychologyCaptureRateMax &&
                          (psychologyMinHoldingMinutes === 0 || holdingMinutes >= psychologyMinHoldingMinutes);

      if (isGreedTrap) {
        // Cửa sổ K lệnh tiếp theo ngay sau lệnh hụt ăn này
        const followUpsRaw = list.slice(i + 1, i + 1 + psychologyWindowSize);
        let fLoss = 0;
        let fWin = 0;
        let fBe = 0;
        let fPnlUsd = 0;
        let fPnlR = 0;
        let curStreak = 0;
        let maxLocalStreak = 0;

        const followUps = followUpsRaw.map((ft, fIdx) => {
          const isL = ft.net < -1;
          const isW = ft.net > 1;
          const isB = !isL && !isW;

          if (isL) {
            fLoss++;
            curStreak++;
            maxLocalStreak = Math.max(maxLocalStreak, curStreak);
          } else {
            curStreak = 0;
            if (isW) fWin++;
            else fBe++;
          }

          fPnlUsd += ft.net;
          const ftR = ft.risk1R > 0 ? ft.net / ft.risk1R : 0;
          fPnlR += ftR;

          return {
            ...ft,
            orderInWindow: fIdx + 1,
            isLoss: isL,
            isWin: isW,
            isBe: isB
          };
        });

        aggregateFollowUpTrades += followUps.length;
        aggregateFollowUpLosses += fLoss;
        totalRevengePnlUsd += fPnlUsd;
        totalRevengePnlR += fPnlR;
        globalMaxStreak = Math.max(globalMaxStreak, maxLocalStreak);

        const missedUsd = Number(((effMaxR * tr.risk1R) - tr.net).toFixed(2));
        const postLossRate = followUps.length > 0 ? Number(((fLoss / followUps.length) * 100).toFixed(1)) : 0;

        events.push({
          triggerTrade: tr,
          triggerIndex: i + 1,
          effectiveMaxR: effMaxR,
          actualR,
          missedR,
          missedUsd: Math.max(0, missedUsd),
          captureRatePercent,
          durationSec,
          holdingMinutes,
          followUps,
          followUpLossCount: fLoss,
          followUpWinCount: fWin,
          followUpBeCount: fBe,
          followUpTotalPnlUsd: Number(fPnlUsd.toFixed(2)),
          followUpTotalPnlR: Number(fPnlR.toFixed(2)),
          postEventLossRate: postLossRate,
          lossStreak: maxLocalStreak
        });
      }
    }

    const postLossRate = aggregateFollowUpTrades > 0 
      ? Number(((aggregateFollowUpLosses / aggregateFollowUpTrades) * 100).toFixed(1)) 
      : 0;

    const lossRateDelta = Number((postLossRate - baselineLossRate).toFixed(1));

    let tiltSeverity: 'NORMAL' | 'ELEVATED' | 'CRITICAL' = 'NORMAL';
    if (lossRateDelta >= 20 || postLossRate >= 70) tiltSeverity = 'CRITICAL';
    else if (lossRateDelta >= 10 || postLossRate >= 55) tiltSeverity = 'ELEVATED';

    return {
      triggeredEvents: events,
      totalTriggered: events.length,
      baselineLossRate,
      postLossRate,
      lossRateDelta,
      totalRevengePnlUsd: Number(totalRevengePnlUsd.toFixed(2)),
      totalRevengePnlR: Number(totalRevengePnlR.toFixed(2)),
      maxLossStreakAfter: globalMaxStreak,
      tiltSeverity
    };
  }, [partialScaleData.tradeBreakdown, psychologyMfeThreshold, psychologyCaptureRateMax, psychologyMinHoldingMinutes, psychologyWindowSize]);

  // Phân trang danh sách sự kiện hụt ăn
  const effectivePsychologyPageSize = psychologyPageSize === 0 ? (postGreedPsychologyData.triggeredEvents.length || 1) : psychologyPageSize;
  const totalPsychologyPages = Math.max(1, Math.ceil(postGreedPsychologyData.triggeredEvents.length / effectivePsychologyPageSize));
  const safePsychologyPage = Math.min(psychologyPage, totalPsychologyPages);

  useEffect(() => {
    setPsychologyPage(1);
  }, [psychologyMfeThreshold, psychologyCaptureRateMax, psychologyMinHoldingMinutes, psychologyWindowSize, psychologyPageSize]);

  const paginatedPsychologyEvents = useMemo(() => {
    if (psychologyPageSize === 0) return postGreedPsychologyData.triggeredEvents;
    const start = (safePsychologyPage - 1) * effectivePsychologyPageSize;
    return postGreedPsychologyData.triggeredEvents.slice(start, start + effectivePsychologyPageSize);
  }, [postGreedPsychologyData.triggeredEvents, safePsychologyPage, effectivePsychologyPageSize, psychologyPageSize]);

  const psychologyPaginationNumbers = useMemo(() => {
    const pages: number[] = [];
    if (totalPsychologyPages <= 5) {
      for (let i = 1; i <= totalPsychologyPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePsychologyPage > 3) pages.push(-1);
      const start = Math.max(2, safePsychologyPage - 1);
      const end = Math.min(totalPsychologyPages - 1, safePsychologyPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (safePsychologyPage < totalPsychologyPages - 2) pages.push(-1);
      if (!pages.includes(totalPsychologyPages)) pages.push(totalPsychologyPages);
    }
    return pages;
  }, [totalPsychologyPages, safePsychologyPage]);

  // =========================================================================
  // 5.4.4 RÀ SOÁT TÂM LÝ: HẬU QUẢ THẮNG ĐẬM / ĐỦ TP DẪN ĐẾN TỰ PHỤ & PHÁ QUY TẮC
  // (Post-TP Euphoria & Overconfidence Trading Audit)
  // =========================================================================
  const postEuphoriaPsychologyData = useMemo(() => {
    const list = partialScaleData.tradeBreakdown || [];
    const totalTrades = list.length;
    if (totalTrades === 0) {
      return {
        triggeredEvents: [],
        totalTriggered: 0,
        baselineLossRate: 0,
        postLossRate: 0,
        lossRateDelta: 0,
        totalPostPnlUsd: 0,
        totalPostPnlR: 0,
        maxLossStreakAfter: 0,
        euphoriaSeverity: 'NORMAL' as 'NORMAL' | 'ELEVATED' | 'CRITICAL'
      };
    }

    const normalLossCount = list.filter(t => t.net < -1).length;
    const baselineLossRate = Number(((normalLossCount / totalTrades) * 100).toFixed(1));

    interface EuphoriaEvent {
      triggerTrade: typeof list[0];
      triggerIndex: number;
      actualR: number;
      actualUsd: number;
      effectiveMaxR: number;
      captureRatePercent: number;
      durationSec: number;
      holdingMinutes: number;
      followUps: Array<typeof list[0] & { orderInWindow: number; isLoss: boolean; isWin: boolean; isBe: boolean }>;
      followUpLossCount: number;
      followUpWinCount: number;
      followUpBeCount: number;
      followUpTotalPnlUsd: number;
      followUpTotalPnlR: number;
      postEventLossRate: number;
      lossStreak: number;
    }

    const events: EuphoriaEvent[] = [];
    let aggregateFollowUpTrades = 0;
    let aggregateFollowUpLosses = 0;
    let totalPostPnlUsd = 0;
    let totalPostPnlR = 0;
    let globalMaxStreak = 0;

    for (let i = 0; i < totalTrades; i++) {
      const tr = list[i];
      const effMaxR = tr.effectiveMaxR || 0;
      const actualR = tr.risk1R > 0 ? Number((tr.net / tr.risk1R).toFixed(2)) : 0;
      const durationSec = tr.durationSec || 0;
      const holdingMinutes = Number((durationSec / 60).toFixed(1));

      // 1. TỶ LỆ GIỮ LÃI (Capture Rate %): Thực nhận / Đỉnh MFE
      const captureRatePercent = (effMaxR > 0 && actualR > 0)
        ? Number(((actualR / effMaxR) * 100).toFixed(1))
        : 0;

      // ĐIỀU KIỆN KÍCH HOẠT THẮNG ĐẬM / ĂN ĐỦ TP (EUPHORIA TRIGGER):
      // 1. Lệnh thực nhận đạt từ ngưỡng kỳ vọng trở lên (mặc định actualR >= 2.0R)
      // 2. Tỷ lệ giữ lãi cao (mặc định >= 66.7%), chứng minh là ăn trọn / ăn đúng TP chứ không phải bị rơi rớt hụt ăn!
      const isBigWin = actualR >= euphoriaTpThresholdR && captureRatePercent >= euphoriaCaptureRateMin;

      if (isBigWin) {
        const followUpsRaw = list.slice(i + 1, i + 1 + euphoriaWindowSize);
        let fLoss = 0;
        let fWin = 0;
        let fBe = 0;
        let fPnlUsd = 0;
        let fPnlR = 0;
        let curStreak = 0;
        let maxLocalStreak = 0;

        const followUps = followUpsRaw.map((ft, fIdx) => {
          const isL = ft.net < -1;
          const isW = ft.net > 1;
          const isB = !isL && !isW;

          if (isL) {
            fLoss++;
            curStreak++;
            maxLocalStreak = Math.max(maxLocalStreak, curStreak);
          } else {
            curStreak = 0;
            if (isW) fWin++;
            else fBe++;
          }

          fPnlUsd += ft.net;
          const ftR = ft.risk1R > 0 ? ft.net / ft.risk1R : 0;
          fPnlR += ftR;

          return {
            ...ft,
            orderInWindow: fIdx + 1,
            isLoss: isL,
            isWin: isW,
            isBe: isB
          };
        });

        aggregateFollowUpTrades += followUps.length;
        aggregateFollowUpLosses += fLoss;
        totalPostPnlUsd += fPnlUsd;
        totalPostPnlR += fPnlR;
        globalMaxStreak = Math.max(globalMaxStreak, maxLocalStreak);

        const postLossRate = followUps.length > 0 ? Number(((fLoss / followUps.length) * 100).toFixed(1)) : 0;

        events.push({
          triggerTrade: tr,
          triggerIndex: i + 1,
          actualR,
          actualUsd: tr.net,
          effectiveMaxR: effMaxR,
          captureRatePercent,
          durationSec,
          holdingMinutes,
          followUps,
          followUpLossCount: fLoss,
          followUpWinCount: fWin,
          followUpBeCount: fBe,
          followUpTotalPnlUsd: Number(fPnlUsd.toFixed(2)),
          followUpTotalPnlR: Number(fPnlR.toFixed(2)),
          postEventLossRate: postLossRate,
          lossStreak: maxLocalStreak
        });
      }
    }

    const postLossRate = aggregateFollowUpTrades > 0 
      ? Number(((aggregateFollowUpLosses / aggregateFollowUpTrades) * 100).toFixed(1)) 
      : 0;

    const lossRateDelta = Number((postLossRate - baselineLossRate).toFixed(1));

    let euphoriaSeverity: 'NORMAL' | 'ELEVATED' | 'CRITICAL' = 'NORMAL';
    if (lossRateDelta >= 20 || postLossRate >= 70) euphoriaSeverity = 'CRITICAL';
    else if (lossRateDelta >= 10 || postLossRate >= 55) euphoriaSeverity = 'ELEVATED';

    return {
      triggeredEvents: events,
      totalTriggered: events.length,
      baselineLossRate,
      postLossRate,
      lossRateDelta,
      totalPostPnlUsd: Number(totalPostPnlUsd.toFixed(2)),
      totalPostPnlR: Number(totalPostPnlR.toFixed(2)),
      maxLossStreakAfter: globalMaxStreak,
      euphoriaSeverity
    };
  }, [partialScaleData.tradeBreakdown, euphoriaTpThresholdR, euphoriaCaptureRateMin, euphoriaWindowSize]);

  // Phân trang danh sách sự kiện thắng đậm
  const effectiveEuphoriaPageSize = euphoriaPageSize === 0 ? (postEuphoriaPsychologyData.triggeredEvents.length || 1) : euphoriaPageSize;
  const totalEuphoriaPages = Math.max(1, Math.ceil(postEuphoriaPsychologyData.triggeredEvents.length / effectiveEuphoriaPageSize));
  const safeEuphoriaPage = Math.min(euphoriaPage, totalEuphoriaPages);

  useEffect(() => {
    setEuphoriaPage(1);
  }, [euphoriaTpThresholdR, euphoriaCaptureRateMin, euphoriaWindowSize, euphoriaPageSize]);

  const paginatedEuphoriaEvents = useMemo(() => {
    if (euphoriaPageSize === 0) return postEuphoriaPsychologyData.triggeredEvents;
    const start = (safeEuphoriaPage - 1) * effectiveEuphoriaPageSize;
    return postEuphoriaPsychologyData.triggeredEvents.slice(start, start + effectiveEuphoriaPageSize);
  }, [postEuphoriaPsychologyData.triggeredEvents, safeEuphoriaPage, effectiveEuphoriaPageSize, euphoriaPageSize]);

  const euphoriaPaginationNumbers = useMemo(() => {
    const pages: number[] = [];
    if (totalEuphoriaPages <= 5) {
      for (let i = 1; i <= totalEuphoriaPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeEuphoriaPage > 3) pages.push(-1);
      const start = Math.max(2, safeEuphoriaPage - 1);
      const end = Math.min(totalEuphoriaPages - 1, safeEuphoriaPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (safeEuphoriaPage < totalEuphoriaPages - 2) pages.push(-1);
      if (!pages.includes(totalEuphoriaPages)) pages.push(totalEuphoriaPages);
    }
    return pages;
  }, [totalEuphoriaPages, safeEuphoriaPage]);

  // =========================================================================
  // 5.4.5 RÀ SOÁT TÂM LÝ: TRẢ LẠI TIỀN SAU CHUỖI THẮNG (POST-WIN STREAK CLAWBACK AUDIT)
  // =========================================================================
  const postStreakClawbackData = useMemo(() => {
    const list = partialScaleData.tradeBreakdown;
    const totalTrades = list.length;
    if (totalTrades < 5) {
      return {
        triggeredEvents: [],
        totalTriggered: 0,
        baselineLossRate: 0,
        postLossRate: 0,
        lossRateDelta: 0,
        totalGainedInStreaksUsd: 0,
        totalClawedBackUsd: 0,
        clawbackPercent: 0,
        maxLossStreakAfter: 0,
        clawbackSeverity: 'NORMAL' as const
      };
    }

    const normalLossCount = list.filter(t => t.net < -1).length;
    const baselineLossRate = Number(((normalLossCount / totalTrades) * 100).toFixed(1));

    interface StreakClawbackEvent {
      streakStartIndex: number;
      streakEndIndex: number;
      streakLength: number;
      streakTotalUsd: number;
      streakTotalR: number;
      streakTrades: typeof list;
      followUps: Array<typeof list[0] & { orderInWindow: number; isLoss: boolean; isWin: boolean; isBe: boolean }>;
      followUpLossCount: number;
      followUpWinCount: number;
      followUpBeCount: number;
      followUpTotalPnlUsd: number;
      followUpTotalPnlR: number;
      clawbackPercent: number; // Lượng tiền bị trả lại so với lãi chuỗi thắng (%)
      postEventLossRate: number;
      lossStreak: number;
    }

    const events: StreakClawbackEvent[] = [];
    let aggregateFollowUpTrades = 0;
    let aggregateFollowUpLosses = 0;
    let totalGainedInStreaksUsd = 0;
    let totalClawedBackUsd = 0;
    let globalMaxStreak = 0;

    // Duyệt tìm các chuỗi thắng liên tiếp đạt độ dài >= streakClawbackMinStreak
    let i = 0;
    while (i < totalTrades) {
      if (list[i].net > 1) {
        const start = i;
        let streakPnlUsd = 0;
        let streakPnlR = 0;
        const sTrades: typeof list = [];

        while (i < totalTrades && list[i].net > 1) {
          sTrades.push(list[i]);
          streakPnlUsd += list[i].net;
          const rVal = list[i].risk1R > 0 ? list[i].net / list[i].risk1R : 0;
          streakPnlR += rVal;
          i++;
        }

        const streakLen = sTrades.length;
        if (streakLen >= streakClawbackMinStreak) {
          const end = i - 1;
          const followUpsRaw = list.slice(i, i + streakClawbackWindowSize);
          let fLoss = 0;
          let fWin = 0;
          let fBe = 0;
          let fPnlUsd = 0;
          let fPnlR = 0;
          let curStreak = 0;
          let maxLocalStreak = 0;

          const followUps = followUpsRaw.map((ft, fIdx) => {
            const isL = ft.net < -1;
            const isW = ft.net > 1;
            const isB = !isL && !isW;

            if (isL) {
              fLoss++;
              curStreak++;
              maxLocalStreak = Math.max(maxLocalStreak, curStreak);
            } else {
              curStreak = 0;
              if (isW) fWin++;
              else fBe++;
            }

            fPnlUsd += ft.net;
            const ftR = ft.risk1R > 0 ? ft.net / ft.risk1R : 0;
            fPnlR += ftR;

            return {
              ...ft,
              orderInWindow: fIdx + 1,
              isLoss: isL,
              isWin: isW,
              isBe: isB
            };
          });

          aggregateFollowUpTrades += followUps.length;
          aggregateFollowUpLosses += fLoss;
          totalGainedInStreaksUsd += streakPnlUsd;

          const clawedAmount = fPnlUsd < 0 ? Math.abs(fPnlUsd) : 0;
          totalClawedBackUsd += clawedAmount;
          globalMaxStreak = Math.max(globalMaxStreak, maxLocalStreak);

          const postLossRate = followUps.length > 0 ? Number(((fLoss / followUps.length) * 100).toFixed(1)) : 0;
          const singleClawPct = streakPnlUsd > 0 ? Number(((clawedAmount / streakPnlUsd) * 100).toFixed(1)) : 0;

          events.push({
            streakStartIndex: start + 1,
            streakEndIndex: end + 1,
            streakLength: streakLen,
            streakTotalUsd: Number(streakPnlUsd.toFixed(2)),
            streakTotalR: Number(streakPnlR.toFixed(2)),
            streakTrades: sTrades,
            followUps,
            followUpLossCount: fLoss,
            followUpWinCount: fWin,
            followUpBeCount: fBe,
            followUpTotalPnlUsd: Number(fPnlUsd.toFixed(2)),
            followUpTotalPnlR: Number(fPnlR.toFixed(2)),
            clawbackPercent: singleClawPct,
            postEventLossRate: postLossRate,
            lossStreak: maxLocalStreak
          });
        }
      } else {
        i++;
      }
    }

    const postLossRate = aggregateFollowUpTrades > 0
      ? Number(((aggregateFollowUpLosses / aggregateFollowUpTrades) * 100).toFixed(1))
      : 0;

    const lossRateDelta = Number((postLossRate - baselineLossRate).toFixed(1));
    const globalClawbackPct = totalGainedInStreaksUsd > 0
      ? Number(((totalClawedBackUsd / totalGainedInStreaksUsd) * 100).toFixed(1))
      : 0;

    let clawbackSeverity: 'NORMAL' | 'ELEVATED' | 'CRITICAL' = 'NORMAL';
    if (globalClawbackPct >= 50 || postLossRate >= 70) clawbackSeverity = 'CRITICAL';
    else if (globalClawbackPct >= 30 || postLossRate >= 55) clawbackSeverity = 'ELEVATED';

    return {
      triggeredEvents: events,
      totalTriggered: events.length,
      baselineLossRate,
      postLossRate,
      lossRateDelta,
      totalGainedInStreaksUsd: Number(totalGainedInStreaksUsd.toFixed(2)),
      totalClawedBackUsd: Number(totalClawedBackUsd.toFixed(2)),
      clawbackPercent: globalClawbackPct,
      maxLossStreakAfter: globalMaxStreak,
      clawbackSeverity
    };
  }, [partialScaleData.tradeBreakdown, streakClawbackMinStreak, streakClawbackWindowSize]);

  // Phân trang danh sách sự kiện trả lại tiền sau chuỗi thắng
  const effectiveStreakClawbackPageSize = streakClawbackPageSize === 0 ? (postStreakClawbackData.triggeredEvents.length || 1) : streakClawbackPageSize;
  const totalStreakClawbackPages = Math.max(1, Math.ceil(postStreakClawbackData.triggeredEvents.length / effectiveStreakClawbackPageSize));
  const safeStreakClawbackPage = Math.min(streakClawbackPage, totalStreakClawbackPages);

  useEffect(() => {
    setStreakClawbackPage(1);
  }, [streakClawbackMinStreak, streakClawbackWindowSize, streakClawbackPageSize]);

  const paginatedStreakClawbackEvents = useMemo(() => {
    if (streakClawbackPageSize === 0) return postStreakClawbackData.triggeredEvents;
    const start = (safeStreakClawbackPage - 1) * effectiveStreakClawbackPageSize;
    return postStreakClawbackData.triggeredEvents.slice(start, start + effectiveStreakClawbackPageSize);
  }, [postStreakClawbackData.triggeredEvents, safeStreakClawbackPage, effectiveStreakClawbackPageSize, streakClawbackPageSize]);

  const streakClawbackPaginationNumbers = useMemo(() => {
    const pages: number[] = [];
    if (totalStreakClawbackPages <= 5) {
      for (let i = 1; i <= totalStreakClawbackPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeStreakClawbackPage > 3) pages.push(-1);
      const start = Math.max(2, safeStreakClawbackPage - 1);
      const end = Math.min(totalStreakClawbackPages - 1, safeStreakClawbackPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (safeStreakClawbackPage < totalStreakClawbackPages - 2) pages.push(-1);
      if (!pages.includes(totalStreakClawbackPages)) pages.push(totalStreakClawbackPages);
    }
    return pages;
  }, [totalStreakClawbackPages, safeStreakClawbackPage]);

  // =========================================================================
  // 5.4.6 ĐỊNH LƯỢNG TÂM LÝ & HIỆU SUẤT GIAO DỊCH (QUANTIFIED PERFORMANCE PSYCHOLOGY)
  // Quy đổi 5 trụ cột tâm lý thành chuẩn số học 100% dữ liệu thật từ closedTrades
  // =========================================================================
  const psychologyQuantitativeData = useMemo(() => {
    const list = partialScaleData.tradeBreakdown || [];
    const totalTrades = list.length;

    // 1. CHỈ SỐ THUẾ TỰ MÃN (Overconfidence Clawback %):
    // Lượng tiền và tỷ lệ nộp lại thị trường ngay sau các chuỗi thắng
    const clawbackPct = postStreakClawbackData.clawbackPercent;
    const clawedBackUsd = postStreakClawbackData.totalClawedBackUsd;
    const gainedInStreaksUsd = postStreakClawbackData.totalGainedInStreaksUsd;
    const streakCount = postStreakClawbackData.totalTriggered;

    // 2. CHỈ SỐ TÂM LÝ SỢ HÃI & DO DỰ (Fear & Regret / Left On The Table):
    // Số tiền và số R trung bình để tuột mất ở các lệnh thắng (chốt non do sợ mất lãi)
    const totalLeftOnTable = mfeMaeData.totalLeftOnTable;
    const avgLeftOnTable = mfeMaeData.avgLeftOnTable;
    let sumLeftOnTableR = 0;
    let winTradeCount = 0;
    let prematureExitCount = 0;

    list.forEach(t => {
      if (t.net > 1) {
        winTradeCount++;
        const missedR = Math.max(0, (t.effectiveMaxR || 0) - (t.risk1R > 0 ? (t.net / t.risk1R) : 0));
        sumLeftOnTableR += missedR;
        // Nếu đỉnh MFE >= 1.5R nhưng chỉ chốt được <= 50% đỉnh đó
        if (t.effectiveMaxR >= 1.5 && (t.risk1R > 0 ? (t.net / t.risk1R) : 0) <= t.effectiveMaxR * 0.5) {
          prematureExitCount++;
        }
      }
    });

    const avgLeftOnTableR = winTradeCount > 0 ? Number((sumLeftOnTableR / winTradeCount).toFixed(2)) : 0;
    const prematureExitRate = winTradeCount > 0 ? Number(((prematureExitCount / winTradeCount) * 100).toFixed(1)) : 0;

    // 3. ĐỘ LỆCH CAY CÚ SAU HỤT ĂN (Post-Greed Tilt Delta):
    // So sánh tỷ lệ thua sau các cú hụt ăn đỉnh vs baseline tài khoản
    const greedEventCount = postGreedPsychologyData.totalTriggered;
    const greedTiltDelta = postGreedPsychologyData.lossRateDelta;
    const greedPostLossRate = postGreedPsychologyData.postLossRate;
    const greedBaselineLossRate = postGreedPsychologyData.baselineLossRate;
    const greedRevengePnlUsd = postGreedPsychologyData.totalRevengePnlUsd;

    // 4. MỆT MỎI NHẬN THỨC THEO THỨ TỰ LỆNH TRONG NGÀY (Intraday Cognitive Fatigue):
    // Nhóm lệnh theo ngày và số thứ tự lệnh trong cùng một ngày:
    // Nhóm 1: Lệnh 1 (Tươi mới nhất)
    // Nhóm 2: Lệnh 2 (Vẫn còn tập trung)
    // Nhóm 3: Lệnh 3 trở đi (Bắt đầu mệt mỏi nhận thức / overtrading)
    const dayGroups: Record<string, typeof list> = {};
    list.forEach(t => {
      const raw = t.openTime;
      let dayKey = 'unknown';
      if (raw) {
        const cleanRaw = raw.includes('T') ? raw : raw.replace(/[\.\-]/g, '/');
        const bDate = new Date(cleanRaw);
        if (!isNaN(bDate.getTime())) {
          const shifted = new Date(bDate.getTime() + activeOffset * 3600 * 1000);
          const y = shifted.getFullYear();
          const m = String(shifted.getMonth() + 1).padStart(2, '0');
          const d = String(shifted.getDate()).padStart(2, '0');
          dayKey = `${y}-${m}-${d}`;
        }
      }
      if (!dayGroups[dayKey]) dayGroups[dayKey] = [];
      dayGroups[dayKey].push(t);
    });

    const orderBuckets: {
      order1: { count: number; wins: number; losses: number; pnlUsd: number; pnlR: number };
      order2: { count: number; wins: number; losses: number; pnlUsd: number; pnlR: number };
      order3Plus: { count: number; wins: number; losses: number; pnlUsd: number; pnlR: number };
    } = {
      order1: { count: 0, wins: 0, losses: 0, pnlUsd: 0, pnlR: 0 },
      order2: { count: 0, wins: 0, losses: 0, pnlUsd: 0, pnlR: 0 },
      order3Plus: { count: 0, wins: 0, losses: 0, pnlUsd: 0, pnlR: 0 }
    };

    Object.values(dayGroups).forEach(dayTrades => {
      dayTrades.forEach((t, orderIdx) => {
        const net = t.net;
        const rVal = t.risk1R > 0 ? (net / t.risk1R) : 0;
        const isW = net > 1;
        const isL = net < -1;

        let bucket = orderBuckets.order3Plus;
        if (orderIdx === 0) bucket = orderBuckets.order1;
        else if (orderIdx === 1) bucket = orderBuckets.order2;

        bucket.count++;
        if (isW) bucket.wins++;
        if (isL) bucket.losses++;
        bucket.pnlUsd += net;
        bucket.pnlR += rVal;
      });
    });

    const fatigueRows = [
      {
        bucketKey: 'order1',
        title: language === 'vi' ? 'Lệnh #1 Trong Ngày (Đầu Phiên)' : 'Trade #1 of Day (Peak Alertness)',
        subtitle: language === 'vi' ? 'Tâm thế tỉnh táo, thể lực và kỷ luật cao nhất' : 'High energy, disciplined execution',
        count: orderBuckets.order1.count,
        winRate: orderBuckets.order1.count > 0 ? Number(((orderBuckets.order1.wins / orderBuckets.order1.count) * 100).toFixed(1)) : 0,
        lossRate: orderBuckets.order1.count > 0 ? Number(((orderBuckets.order1.losses / orderBuckets.order1.count) * 100).toFixed(1)) : 0,
        pnlUsd: Number(orderBuckets.order1.pnlUsd.toFixed(2)),
        pnlR: Number(orderBuckets.order1.pnlR.toFixed(2)),
        avgPnlUsd: orderBuckets.order1.count > 0 ? Number((orderBuckets.order1.pnlUsd / orderBuckets.order1.count).toFixed(2)) : 0,
        avgPnlR: orderBuckets.order1.count > 0 ? Number((orderBuckets.order1.pnlR / orderBuckets.order1.count).toFixed(2)) : 0,
        badgeStatus: 'OPTIMAL'
      },
      {
        bucketKey: 'order2',
        title: language === 'vi' ? 'Lệnh #2 Trong Ngày (Giữa Phiên)' : 'Trade #2 of Day (Mid-Session)',
        subtitle: language === 'vi' ? 'Duy trì kế hoạch, bắt đầu chịu ảnh hưởng từ kết quả lệnh 1' : 'Moderate focus, anchored to trade #1',
        count: orderBuckets.order2.count,
        winRate: orderBuckets.order2.count > 0 ? Number(((orderBuckets.order2.wins / orderBuckets.order2.count) * 100).toFixed(1)) : 0,
        lossRate: orderBuckets.order2.count > 0 ? Number(((orderBuckets.order2.losses / orderBuckets.order2.count) * 100).toFixed(1)) : 0,
        pnlUsd: Number(orderBuckets.order2.pnlUsd.toFixed(2)),
        pnlR: Number(orderBuckets.order2.pnlR.toFixed(2)),
        avgPnlUsd: orderBuckets.order2.count > 0 ? Number((orderBuckets.order2.pnlUsd / orderBuckets.order2.count).toFixed(2)) : 0,
        avgPnlR: orderBuckets.order2.count > 0 ? Number((orderBuckets.order2.pnlR / orderBuckets.order2.count).toFixed(2)) : 0,
        badgeStatus: 'STANDARD'
      },
      {
        bucketKey: 'order3Plus',
        title: language === 'vi' ? 'Lệnh #3+ Trong Ngày (Vùng Mệt Mỏi)' : 'Trade #3+ of Day (Fatigue Zone)',
        subtitle: language === 'vi' ? 'Tiêu hao nhận thức, dễ overtrade / vào lệnh ép buộc' : 'Cognitive fatigue, overtrading risk',
        count: orderBuckets.order3Plus.count,
        winRate: orderBuckets.order3Plus.count > 0 ? Number(((orderBuckets.order3Plus.wins / orderBuckets.order3Plus.count) * 100).toFixed(1)) : 0,
        lossRate: orderBuckets.order3Plus.count > 0 ? Number(((orderBuckets.order3Plus.losses / orderBuckets.order3Plus.count) * 100).toFixed(1)) : 0,
        pnlUsd: Number(orderBuckets.order3Plus.pnlUsd.toFixed(2)),
        pnlR: Number(orderBuckets.order3Plus.pnlR.toFixed(2)),
        avgPnlUsd: orderBuckets.order3Plus.count > 0 ? Number((orderBuckets.order3Plus.pnlUsd / orderBuckets.order3Plus.count).toFixed(2)) : 0,
        avgPnlR: orderBuckets.order3Plus.count > 0 ? Number((orderBuckets.order3Plus.pnlR / orderBuckets.order3Plus.count).toFixed(2)) : 0,
        badgeStatus: 'FATIGUE_RISK'
      }
    ];

    // Chênh lệch Winrate giữa Lệnh #1 và Lệnh #3+
    const fatigueWinRateDrop = Number((fatigueRows[0].winRate - fatigueRows[2].winRate).toFixed(1));

    // 5. TỶ SỐ KIÊN NHẪN (Patience & Confluence Ratio):
    // So sánh hiệu suất giữa Lệnh có chọn lọc kỹ (Hạng A/A+ >= 3 checklist) vs Lệnh bột phát (Hạng C <= 1 checklist)
    let patientCount = 0;
    let patientWins = 0;
    let patientPnlUsd = 0;
    let patientPnlR = 0;

    let impulseCount = 0;
    let impulseWins = 0;
    let impulsePnlUsd = 0;
    let impulsePnlR = 0;

    closedTrades.forEach(tr => {
      const net = tr.net_pnl !== undefined ? tr.net_pnl : (tr.pnl || 0);
      let risk1R = tr.risk_1r_usd && tr.risk_1r_usd > 0 ? tr.risk_1r_usd : 0;
      if (!risk1R && tr.initial_sl && tr.initial_sl > 0 && tr.open_price && tr.volume) {
        risk1R = calculateRisk1R(tr.open_price, tr.initial_sl, tr.volume, 100, 100, tr.symbol);
      }
      const rVal = risk1R > 0 ? (net / risk1R) : 0;

      const preIds = Array.isArray(tr.pre_checklist_ids)
        ? tr.pre_checklist_ids
        : typeof tr.pre_checklist_ids === 'string'
          ? [tr.pre_checklist_ids]
          : [];
      const cCount = preIds.length;

      if (cCount >= 3) {
        patientCount++;
        patientPnlUsd += net;
        patientPnlR += rVal;
        if (net > 0) patientWins++;
      } else if (cCount <= 1) {
        impulseCount++;
        impulsePnlUsd += net;
        impulsePnlR += rVal;
        if (net > 0) impulseWins++;
      }
    });

    const patientWinRate = patientCount > 0 ? Number(((patientWins / patientCount) * 100).toFixed(1)) : 0;
    const impulseWinRate = impulseCount > 0 ? Number(((impulseWins / impulseCount) * 100).toFixed(1)) : 0;
    const patienceEdgeWinRate = Number((patientWinRate - impulseWinRate).toFixed(1));

    // TỔNG ĐIỂM SỨC BỀN TÂM LÝ (Psychological Resilience Score 0 - 100):
    let psychScore = 100;
    if (clawbackPct > 15) {
      psychScore -= Math.min(25, Math.round(((clawbackPct - 15) / 50) * 25));
    }
    if (greedTiltDelta > 5) {
      psychScore -= Math.min(25, Math.round((greedTiltDelta / 40) * 25));
    }
    if (fatigueWinRateDrop > 10 && orderBuckets.order3Plus.count >= 3) {
      psychScore -= Math.min(25, Math.round((fatigueWinRateDrop / 40) * 25));
    }
    if (impulsePnlUsd < 0 && impulseCount > 0) {
      psychScore -= Math.min(25, Math.round((Math.abs(impulsePnlUsd) / (Math.abs(patientPnlUsd) + 1000)) * 25));
    }
    psychScore = Math.max(10, Math.min(100, psychScore));

    return {
      psychScore,
      clawback: {
        clawbackPct,
        clawedBackUsd,
        gainedInStreaksUsd,
        streakCount
      },
      fearLeftOnTable: {
        totalLeftOnTable,
        avgLeftOnTable,
        avgLeftOnTableR,
        prematureExitRate,
        prematureExitCount,
        winTradeCount
      },
      greedTilt: {
        greedEventCount,
        greedTiltDelta,
        greedPostLossRate,
        greedBaselineLossRate,
        greedRevengePnlUsd
      },
      fatigue: {
        fatigueRows,
        fatigueWinRateDrop,
        totalIntradayOrders: totalTrades
      },
      patienceEdge: {
        patientCount,
        patientWinRate,
        patientPnlUsd: Number(patientPnlUsd.toFixed(2)),
        patientPnlR: Number(patientPnlR.toFixed(2)),
        impulseCount,
        impulseWinRate,
        impulsePnlUsd: Number(impulsePnlUsd.toFixed(2)),
        impulsePnlR: Number(impulsePnlR.toFixed(2)),
        patienceEdgeWinRate
      }
    };
  }, [
    partialScaleData.tradeBreakdown,
    postStreakClawbackData,
    mfeMaeData,
    postGreedPsychologyData,
    closedTrades,
    activeOffset,
    language
  ]);

  return (
    <div className="flex flex-col min-h-full py-5 px-4 sm:px-6 lg:px-[6%] xl:px-[8%] space-y-6 w-full max-w-none transition-all font-sans select-none">
      
      {/* 1. TOP HEADER & SUB-TAB NAVIGATION (Tactile Claymorphic Header) */}
      <div className="p-5 bg-[var(--bg-card)] rounded-3xl clay-card border border-[var(--border-main)] flex items-center justify-between gap-4 flex-wrap relative">
        <div className="flex items-center gap-3.5 flex-wrap relative z-10">
          <div className="flex items-center gap-2.5 px-4 py-2 rounded-2xl bg-[var(--bg-subtle)] clay-well">
            <span className="font-black text-[var(--text-primary)] text-xs tracking-wider uppercase font-sans">
              {language === 'vi' ? 'BÁO CÁO HIỆU SUẤT & KIỂM TOÁN TÂM LÝ' : 'PERFORMANCE & DISCIPLINE AUDIT'}
            </span>
          </div>

          <span className="text-xs text-[var(--text-secondary)] font-medium">
            ({closedTrades.length} {language === 'vi' ? 'lệnh đã đóng' : 'closed trades'})
          </span>
        </div>

        {/* Controls: Unit Toggle ($ / R / %) & Sub-tab Switcher */}
        <div className="flex items-center gap-3 flex-wrap relative z-10">
          {/* Unit Toggle Switcher ($ / R / %) */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-[var(--bg-subtle)] clay-well">
            <span className="text-[10px] text-[var(--text-muted)] font-bold px-2 hidden sm:inline uppercase">
              {language === 'vi' ? 'Đơn vị:' : 'Unit:'}
            </span>
            <button
              type="button"
              onClick={() => setMetricUnit('USD')}
              className={`px-3 py-1 rounded-full text-xs font-bold font-mono transition-all cursor-pointer ${
                metricUnit === 'USD'
                  ? 'bg-[var(--bg-card)] text-[#1d1b17] clay-pill font-black shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              $ USD
            </button>
            <button
              type="button"
              onClick={() => setMetricUnit('R')}
              className={`px-3 py-1 rounded-full text-xs font-bold font-mono transition-all cursor-pointer ${
                metricUnit === 'R'
                  ? 'bg-[var(--bg-card)] text-[#1d1b17] clay-pill font-black shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              R-Multiple
            </button>
            <button
              type="button"
              onClick={() => setMetricUnit('PERCENT')}
              className={`px-3 py-1 rounded-full text-xs font-bold font-mono transition-all cursor-pointer ${
                metricUnit === 'PERCENT'
                  ? 'bg-[var(--bg-card)] text-[#1d1b17] clay-pill font-black shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              % {language === 'vi' ? 'Vốn' : 'Equity'}
            </button>
          </div>

          {/* View Switcher Sub-tabs */}
          <div className="flex items-center gap-1 p-1 rounded-full bg-[var(--bg-subtle)] clay-well overflow-x-auto max-w-full">
            {[
              { id: 'ALL', label: language === 'vi' ? 'Tất cả' : 'All Modules' },
              { id: 'WHAT_IF', label: language === 'vi' ? 'Giả lập What-If' : 'What-If Sim' },
              { id: 'MFE_MAE', label: language === 'vi' ? 'Hiệu Suất MFE & MAE' : 'MFE & MAE Excursion' },
              { id: 'PARTIAL_SCALE', label: language === 'vi' ? 'Cắt Lệnh Từng Phần' : 'Scale-Out TP' },
              { id: 'PSYCHOLOGY', label: language === 'vi' ? 'Tâm Lý & Hiệu Suất' : 'Psychology & Performance' },
              { id: 'INSTRUMENTS', label: language === 'vi' ? 'Ma trận Tài sản' : 'Instruments & Bias' },
              { id: 'DISCIPLINE', label: language === 'vi' ? 'Chi phí Kỷ luật' : 'Discipline Cost' },
              { id: 'CAPITAL', label: language === 'vi' ? 'Quản lý Vốn' : 'Capital & Fees' },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveSection(tab.id as any)}
                className={`px-3.5 py-1 rounded-full text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                  activeSection === tab.id
                    ? 'bg-[var(--bg-card)] text-[var(--text-primary)] clay-pill font-black'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* KỲ BÁO CÁO: Tất cả / Tuần / Tháng / Quý / Tùy chọn */}
      <div className="p-3 bg-[var(--bg-card)] rounded-3xl clay-card border border-[var(--border-main)] flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 p-1 rounded-full bg-[var(--bg-subtle)] clay-well">
          {([['ALL', 'Tất cả'], ['WEEK', 'Tuần'], ['MONTH', 'Tháng'], ['QUARTER', 'Quý'], ['CUSTOM', 'Tùy chọn']] as [PeriodKind, string][]).map(([k, label]) => (
            <button key={k} type="button" onClick={() => changePeriodKind(k)}
              className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                periodKind === k ? 'bg-[var(--bg-card)] text-[#1d1b17] clay-pill font-black shadow-sm' : 'text-[var(--text-secondary)] hover:text-[#4a6152]'
              }`}>
              {label}
            </button>
          ))}
        </div>
        {(periodKind === 'WEEK' || periodKind === 'MONTH' || periodKind === 'QUARTER') && (
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setPeriodStep(s => s - 1)}
              className="w-7 h-7 rounded-full bg-[var(--bg-subtle)] clay-well text-sm font-black hover:text-[#4a6152] cursor-pointer">‹</button>
            <button type="button" onClick={() => setPeriodStep(s => Math.min(0, s + 1))} disabled={periodStep >= 0}
              className="w-7 h-7 rounded-full bg-[var(--bg-subtle)] clay-well text-sm font-black hover:text-[#4a6152] cursor-pointer disabled:opacity-40 disabled:cursor-default">›</button>
          </div>
        )}
        {periodKind === 'CUSTOM' && (
          <div className="flex items-center gap-2 text-xs font-mono">
            <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
              className="px-2 py-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-primary)]" />
            <span>–</span>
            <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
              className="px-2 py-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-primary)]" />
          </div>
        )}
        <span className="text-xs font-black font-mono text-[var(--text-primary)]">{periodRange.label}</span>
      </div>


      {/* 2. TOP 6 KPI METRIC CARDS (Tactile Clay Pods) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {/* Card 1: Tổng PnL (Net) */}
        <div className="bg-[var(--bg-card)] rounded-3xl p-4 flex flex-col justify-between clay-card hover:translate-y-[-2px] transition-transform">
          <span className="text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-wider">{language === 'vi' ? 'Tổng PnL (Net)' : 'Net Realized PnL'}</span>
          <div className="mt-2">
            <span className={`text-xl font-black font-mono ${coreRiskData.netPnl >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
              {formatMetricValue(coreRiskData.netPnl, coreRiskData.totalR)}
            </span>
            <p className="text-[10px] text-[var(--text-secondary)] font-mono mt-1 truncate">
              {metricUnit === 'USD' 
                ? (language === 'vi' ? `+${coreRiskData.grossProfit.toFixed(0)} | -${coreRiskData.grossLoss.toFixed(0)}` : `W +$${coreRiskData.grossProfit.toFixed(0)} | L -$${coreRiskData.grossLoss.toFixed(0)}`)
                : metricUnit === 'R'
                  ? (language === 'vi' ? `+${coreRiskData.grossProfitR.toFixed(1)}R | -${coreRiskData.grossLossR.toFixed(1)}R` : `W +${coreRiskData.grossProfitR.toFixed(1)}R | L -${coreRiskData.grossLossR.toFixed(1)}R`)
                  : (language === 'vi' ? `+${((coreRiskData.grossProfit / initialBalance) * 100).toFixed(1)}% | -${((coreRiskData.grossLoss / initialBalance) * 100).toFixed(1)}%` : `W +${((coreRiskData.grossProfit / initialBalance) * 100).toFixed(1)}% | L -${((coreRiskData.grossLoss / initialBalance) * 100).toFixed(1)}%`)
              }
            </p>
          </div>
        </div>

        {/* Card 2: Profit Factor */}
        <div className="bg-[var(--bg-card)] rounded-3xl p-4 flex flex-col justify-between clay-card hover:translate-y-[-2px] transition-transform">
          <span className="text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-wider">Profit Factor</span>
          <div className="mt-2">
            <span className={`text-xl font-black font-mono ${coreRiskData.profitFactor >= 1.5 ? 'text-[#4a6152] dark:text-emerald-400' : coreRiskData.profitFactor >= 1.0 ? 'text-[#1d1b17]' : 'text-rose-500'}`}>
              {coreRiskData.totalCount > 0 ? coreRiskData.profitFactor : '-'}
            </span>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1 font-semibold">
              {coreRiskData.profitFactor >= 1.5 
                ? (language === 'vi' ? 'Chuẩn Quỹ A+' : 'Robust Edge') 
                : (language === 'vi' ? 'Cần cải thiện' : 'Needs Optimization')}
            </p>
          </div>
        </div>

        {/* Card 3: Win Rate */}
        <div className="bg-[var(--bg-card)] rounded-3xl p-4 flex flex-col justify-between clay-card hover:translate-y-[-2px] transition-transform">
          <span className="text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-wider">Win Rate</span>
          <div className="mt-2">
            <span className="text-xl font-black font-mono text-[#4a6152] dark:text-emerald-400">
              {coreRiskData.winRate}%
            </span>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1 font-mono">
              {coreRiskData.totalWins} {language === 'vi' ? 'Thắng' : 'W'} / {coreRiskData.totalLosses} {language === 'vi' ? 'Thua' : 'L'}
            </p>
          </div>
        </div>

        {/* Card 4: Max Drawdown */}
        <div className="bg-[var(--bg-card)] rounded-3xl p-4 flex flex-col justify-between clay-card hover:translate-y-[-2px] transition-transform">
          <span className="text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-wider">Max Drawdown</span>
          <div className="mt-2">
            <span className="text-xl font-black font-mono text-rose-500 dark:text-rose-400">
              {metricUnit === 'R'
                ? `-${maxDrawdownData.maxDdR}R`
                : metricUnit === 'USD'
                  ? `-$${maxDrawdownData.maxDdUsd.toLocaleString('en-US', { minimumFractionDigits: 0 })}`
                  : `${maxDrawdownData.maxDdPct}%`
              }
            </span>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1 truncate">
              {metricUnit === 'R'
                ? `${maxDrawdownData.maxDdPct}% (peak DD)`
                : `-${maxDrawdownData.maxDdUsd.toLocaleString('en-US', { minimumFractionDigits: 0 })} ${language === 'vi' ? 'sụt giảm lớn nhất' : 'peak DD'}`
              }
            </p>
          </div>
        </div>

        {/* Card 5: Kỷ lục chuỗi thắng/thua */}
        <div className="bg-[var(--bg-card)] rounded-3xl p-4 flex flex-col justify-between clay-card hover:translate-y-[-2px] transition-transform">
          <span className="text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-wider">{language === 'vi' ? 'Kỷ lục chuỗi (W:L)' : 'Streaks (W:L)'}</span>
          <div className="mt-2">
            <span className="text-xl font-black font-mono text-[var(--text-primary)]">
              {coreRiskData.maxWinStreak} : {coreRiskData.maxLossStreak}
            </span>
            <p className="text-[10px] text-[var(--text-secondary)] mt-1 truncate">
              {language === 'vi' ? `Chuỗi thua max: ${coreRiskData.maxLossStreak} lệnh` : `Max loss streak: ${coreRiskData.maxLossStreak}`}
            </p>
          </div>
        </div>

        {/* Card 6: Lợi nhuận TB/lệnh */}
        <div className="bg-[var(--bg-card)] rounded-3xl p-4 flex flex-col justify-between clay-card hover:translate-y-[-2px] transition-transform relative">
          <div className="flex items-center gap-1.5 text-[var(--text-muted)] text-[11px] font-bold uppercase tracking-wider">
            <span>{language === 'vi' ? 'Lợi nhuận TB/lệnh' : 'Avg PnL / Trade'}</span>
            
            {/* Dấu chấm hỏi nhỏ hiển thị giải thích công thức tính khi hover */}
            <div className="relative group inline-block cursor-help">
              <span className="w-3.5 h-3.5 rounded-full bg-[var(--bg-subtle)] hover:bg-[var(--border-main)] text-[var(--text-secondary)] flex items-center justify-center text-[10px] font-bold border border-[var(--border-main)] shadow-xs transition-colors">
                ?
              </span>
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover:block z-50 w-72 p-3 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-2xl shadow-2xl text-[11px] font-normal text-[var(--text-secondary)] pointer-events-none leading-relaxed">
                <div className="font-bold text-[#4a6152] dark:text-emerald-400 pb-1.5 mb-1.5 border-b border-[var(--border-main)] flex items-center justify-between">
                  <span>{language === 'vi' ? 'Cách tính Lãi / Lỗ TB' : 'Avg PnL Calculation'}</span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">Dữ liệu MT5</span>
                </div>
                <ul className="space-y-1 text-[var(--text-secondary)]">
                  <li>• <strong className="text-[var(--text-primary)]">{language === 'vi' ? 'Lợi nhuận TB (Expectancy):' : 'Avg Expectancy:'}</strong> {language === 'vi' ? 'Tổng Net PnL ÷ Tổng số lệnh đóng (sau trừ phí commission & swap).' : 'Total Net PnL ÷ Total closed trades.'}</li>
                  <li>• <strong className="text-emerald-500 dark:text-emerald-400">{language === 'vi' ? 'Lãi TB (Avg Win):' : 'Avg Win:'}</strong> {language === 'vi' ? 'Tổng lãi các lệnh thắng ÷ Số lệnh thắng.' : 'Total profit from wins ÷ Win count.'}</li>
                  <li>• <strong className="text-rose-500 dark:text-rose-400">{language === 'vi' ? 'Lỗ TB (Avg Loss):' : 'Avg Loss:'}</strong> {language === 'vi' ? 'Tổng lỗ các lệnh thua ÷ Số lệnh thua.' : 'Total loss from losses ÷ Loss count.'}</li>
                  <li>• <strong className="text-[#475f6b]">{language === 'vi' ? 'Tỷ lệ Lãi:Lỗ (Payoff):' : 'Payoff Ratio:'}</strong> {language === 'vi' ? 'Lãi TB ÷ Lỗ TB' : 'Avg Win ÷ Avg Loss'} = <span className="font-mono text-[var(--text-primary)] font-bold">{coreRiskData.winLossRatio}:1</span></li>
                </ul>
                <div className="mt-2 pt-1 border-t border-[var(--border-main)] text-[10px] text-[var(--text-muted)] italic">
                  {language === 'vi' ? '100% tính trực tiếp từ số liệu thực tế các lệnh đóng MT5.' : 'Computed 100% directly from real MT5 deals.'}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-2">
            <span className={`text-xl font-black font-mono ${coreRiskData.expectancy >= 0 ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
              {formatMetricValue(coreRiskData.expectancy, coreRiskData.expectancyR)}
            </span>
            <p className="text-[10px] text-[#737973] mt-1 truncate">
              {metricUnit === 'R'
                ? `+${coreRiskData.avgWinR}R / -${coreRiskData.avgLossR}R`
                : metricUnit === 'PERCENT'
                  ? `+${((coreRiskData.avgWin / initialBalance) * 100).toFixed(2)}% / -${((coreRiskData.avgLoss / initialBalance) * 100).toFixed(2)}%`
                  : (language === 'vi' ? `Lãi +$${coreRiskData.avgWin} | Lỗ -$${coreRiskData.avgLoss}` : `+$${coreRiskData.avgWin} / -$${coreRiskData.avgLoss}`)
              }
            </p>
          </div>
        </div>
      </div>

      {/* 3. VẤN ĐỀ CẦN CHÚ Ý (ATTENTION STRIP BANNER) */}
      <div className="bg-[var(--bg-card)] border border-[var(--border-main)] rounded-3xl p-5 clay-card flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="space-y-1 min-w-[260px]">
          <h4 className="text-xs font-black text-[#1d1b17] uppercase tracking-wide">
            {language === 'vi' ? 'Vấn đề cần chú ý' : 'Critical Risk Signals'}
          </h4>
          <p className="text-[11px] text-[var(--text-secondary)] font-medium">
            {language === 'vi' 
              ? 'Một số chỉ số đang ở mức rủi ro. Hãy xem xét lại kế hoạch giao dịch và kỷ luật của bạn.' 
              : 'Empirical risk thresholds detected. Audit your trading plan and discipline execution.'}
          </p>
        </div>

        {/* Attention Badges */}
        <div className="flex items-center gap-2.5 overflow-x-auto w-full lg:w-auto pb-1 lg:pb-0">
          <div className="bg-[var(--bg-subtle)] px-3.5 py-2.5 rounded-2xl clay-well shrink-0 space-y-0.5 min-w-[130px]">
            <div className="text-[11px] font-bold text-[var(--text-primary)]">
              Profit Factor <span className={`font-mono ${coreRiskData.profitFactor >= 1.5 ? 'text-[#4a6152] dark:text-emerald-400' : 'text-rose-500'}`}>{coreRiskData.profitFactor}</span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">
              {coreRiskData.profitFactor < 1.0 ? (language === 'vi' ? '< 1 là không tốt' : '< 1 is negative edge') : (language === 'vi' ? 'Cần tối ưu' : 'Good stability')}
            </p>
          </div>

          <div className="bg-[var(--bg-subtle)] px-3.5 py-2.5 rounded-2xl clay-well shrink-0 space-y-0.5 min-w-[130px]">
            <div className="text-[11px] font-bold text-[var(--text-primary)]">
              {language === 'vi' ? 'Chuỗi thua' : 'Loss streak'} <span className="font-mono text-rose-500">{coreRiskData.maxLossStreak} {language === 'vi' ? 'lệnh' : 'trades'}</span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">
              {language === 'vi' ? 'Cần dừng lại và đánh giá' : 'Halt & reassess'}
            </p>
          </div>

          <div className="bg-[var(--bg-subtle)] px-3.5 py-2.5 rounded-2xl clay-well shrink-0 space-y-0.5 min-w-[130px]">
            <div className="text-[11px] font-bold text-[var(--text-primary)]">
              {timeAndSessionData.worstDay.name}: <span className="font-mono text-rose-500">{timeAndSessionData.worstDay.pnl < 0 ? '-' : ''}${Math.abs(timeAndSessionData.worstDay.pnl).toFixed(0)}</span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">
              {language === 'vi' ? 'Ngày thua lớn nhất tuần' : 'Weakest weekday'}
            </p>
          </div>

          <div className="bg-[var(--bg-subtle)] px-3.5 py-2.5 rounded-2xl clay-well shrink-0 space-y-0.5 min-w-[130px]">
            <div className="text-[11px] font-bold text-[var(--text-primary)]">
              Win Rate <span className="font-mono text-[#4a6152] dark:text-emerald-400">{coreRiskData.winRate}%</span>
            </div>
            <p className="text-[10px] text-[var(--text-muted)]">
              {coreRiskData.winRate < 50 ? (language === 'vi' ? 'Dưới ngưỡng 50%' : 'Below 50% benchmark') : (language === 'vi' ? 'Tỷ lệ thắng ổn định' : 'Healthy win rate')}
            </p>
          </div>

          {/* SQN Badge (System Quality Number) */}
          <div className="bg-[#ede7df] px-3 py-2 rounded-lg border border-[#e8e2da] shrink-0 space-y-0.5 min-w-[140px]">
            <div className="text-[11px] font-bold text-[#1d1b17]">
              SQN (Van Tharp){' '}
              <span className={`font-mono ${coreRiskData.sqn >= 2.0 ? 'text-[#1d1b17] font-bold' : coreRiskData.sqn >= 1.6 ? 'text-[#1d1b17]' : 'text-rose-400'}`}>
                {coreRiskData.totalCount >= 2 ? coreRiskData.sqn : '-'}
              </span>
            </div>
            <p className="text-[10px] text-[#737973]">
              {coreRiskData.totalCount < 2
                ? (language === 'vi' ? 'Cần tối thiểu 2 lệnh' : 'Need ≥2 trades')
                : coreRiskData.sqnRating === 'EXCELLENT' 
                ? (language === 'vi' ? 'Xuất sắc (Chuẩn quỹ)' : 'Excellent Edge') 
                : coreRiskData.sqnRating === 'GOOD'
                ? (language === 'vi' ? 'Tốt & Ổn định' : 'Good Quality')
                : coreRiskData.sqnRating === 'AVERAGE'
                ? (language === 'vi' ? 'Mức trung bình' : 'Average Edge')
                : (language === 'vi' ? 'Cần siết kỷ luật' : 'Underperforming')}
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 4. KHU VỰC BIỂU ĐỒ TRỰC QUAN VỚI HIỆU ỨNG NỀN GLOW MỜ ẢO */}
      {/* ========================================================================= */}
      {activeSection === 'ALL' && (
        <div className="space-y-3.5">
          
          {/* HÀNG 1: BIỂU ĐỒ PNL (7 CỘT) + HIỆU SUẤT THEO PHIÊN (5 CỘT) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            
            {/* Card 1: Biểu đồ PnL (Combo Bar + Area Glow + Line Equity từ Vốn Ban Đầu) */}
            <div className="lg:col-span-7 bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] p-5 shadow-lg flex flex-col justify-between space-y-3 min-h-[400px] relative overflow-hidden">
              {/* Soft atmospheric background glow */}
              

              <div className="flex items-center justify-between pb-2 border-b border-[#e8e2da] relative z-10">
                <span className="font-bold text-[#1d1b17] text-xs tracking-wide uppercase">
                  {language === 'vi' ? 'Biểu đồ PnL & Số Dư' : 'PnL & Equity Trajectory'}
                </span>
                <div className="flex items-center gap-1 bg-[#ede7df] p-0.5 rounded-lg border border-[#e8e2da]">
                  {[
                    { id: 'day', label: 'Day' },
                    { id: 'week', label: 'Week' },
                    { id: 'month', label: 'Month' }
                  ].map(tab => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setPnlTimeframe(tab.id as any)}
                      className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                        pnlTimeframe === tab.id ? 'bg-[#e8e2da] text-[#1d1b17] shadow-xs' : 'text-[#737973] hover:text-[#1d1b17]'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              <div id="pnl-chart-wrapper" className="h-72 w-full pt-1 relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={pnlChartData} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                    <defs>
                      {/* Gradient glow cho vùng phủ số dư tài khoản (Equity Area Glow theo Tertiary #8AA3B0) */}
                      <linearGradient id="equityAreaGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#8AA3B0" stopOpacity={0.25} />
                        <stop offset="60%" stopColor="#8AA3B0" stopOpacity={0.06} />
                        <stop offset="100%" stopColor="#EDE7DF" stopOpacity={0.0} />
                      </linearGradient>
                      {/* Vertical gradients for profit/loss bars (Primary #7D9685 vs Secondary #C48B81) */}
                      <linearGradient id="barWinGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#7D9685" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#677F6E" stopOpacity={0.75} />
                      </linearGradient>
                      <linearGradient id="barLossGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#C48B81" stopOpacity={0.95} />
                        <stop offset="100%" stopColor="#B0756B" stopOpacity={0.75} />
                      </linearGradient>
                    </defs>

                    <CartesianGrid strokeDasharray="3 3" stroke="#D8D0C5" strokeOpacity={0.6} vertical={false} />
                    <XAxis 
                      dataKey="name" 
                      stroke="#7E867F" 
                      tick={{ fontSize: 10 }} 
                      padding={{ left: 0, right: 0 }} 
                    />
                    
                    {/* Trục Y duy nhất bên trái: Vốn ban đầu tại vị trí mốc 0, cứ cách 2k là một mốc */}
                    <YAxis 
                      yAxisId="equity" 
                      stroke="#7E867F" 
                      ticks={chartTicks} 
                      domain={chartDomain} 
                      tick={{ fontSize: 10 }} 
                      tickFormatter={v => `$${v >= 1000 ? (v / 1000).toFixed(0) + 'k' : v}`} 
                    />

                    {/* Trục Y ẩn dành cho cột PnL, đồng bộ căn giữa theo mốc vốn ban đầu */}
                    <YAxis 
                      yAxisId="pnl" 
                      hide 
                      domain={pnlDomain} 
                    />

                    {/* Vạch kẻ hover dạng nét đứt (Dashed cursor) theo yêu cầu */}
                    <Tooltip 
                      content={<CustomChartTooltip pnlTimeframe={pnlTimeframe} language={language} />} 
                      cursor={{ stroke: '#8AA3B0', strokeWidth: 1, strokeDasharray: '4 4' }} 
                    />
                    <ReferenceLine yAxisId="equity" y={initialBalance} stroke="#7E867F" strokeWidth={1} strokeDasharray="3 3" />

                    {/* Vùng bóng sáng mờ cho đường số dư tài khoản bắt đầu từ gốc */}
                    <Area 
                      yAxisId="equity"
                      type="monotone" 
                      dataKey="equity" 
                      baseValue={chartDomain[0]}
                      stroke="none" 
                      fill="url(#equityAreaGlow)" 
                      isAnimationActive={false}
                    />

                    {/* Cột PnL từng kỳ (xanh thắng #7D9685, đất nung thua #C48B81) */}
                    <Bar yAxisId="pnl" dataKey="pnl" name="PnL" radius={[3, 3, 0, 0]} isAnimationActive={false}>
                      {pnlChartData.map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.isWin ? 'url(#barWinGrad)' : 'url(#barLossGrad)'} />
                      ))}
                    </Bar>

                    {/* Đường số dư tài khoản (Equity) theo màu Slate Blue #8AA3B0 */}
                    <Line 
                      yAxisId="equity"
                      type="monotone" 
                      dataKey="equity" 
                      name={language === 'vi' ? 'Số dư (Equity)' : 'Account Equity'} 
                      stroke="#8AA3B0" 
                      strokeWidth={2.5} 
                      dot={false} 
                      
                      isAnimationActive={false}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Card 2: Hiệu suất theo phiên (Porcelain Card với màu Primary & Secondary Stitch) */}
            <div className="lg:col-span-5 bg-[var(--bg-card)] rounded-3xl border border-[var(--border-main)] p-5 clay-card flex flex-col justify-between min-h-[400px] relative overflow-hidden">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-main)] relative z-10">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-[#7E867F]" />
                  <span className="font-black text-[var(--text-primary)] text-xs tracking-wide uppercase">
                    {language === 'vi' ? 'Hiệu suất theo phiên' : 'Session Performance'}
                  </span>
                </div>
              </div>

              {/* Danh sách các phiên: Tên phiên, Lãi/lỗ, Số lệnh & Tỷ lệ % */}
              <div className="my-auto py-3 space-y-6 relative z-10">
                {timeAndSessionData.sessionList.map(s => (
                  <div key={s.id} className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-3">
                        <span className="font-bold text-[var(--text-primary)] text-xs w-20">{s.name}</span>
                        <span className={`font-mono font-bold text-xs ${s.pnl >= 0 ? 'text-[#7D9685]' : 'text-[#C48B81]'}`}>
                          {s.pnl >= 0 ? '+' : ''}${s.pnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                      <div className="text-right font-mono text-xs font-semibold text-[var(--text-secondary)]">
                        Win {s.wins}/{s.count} winrate {s.winRate % 1 === 0 ? s.winRate.toFixed(0) : s.winRate.toFixed(1)}%
                      </div>
                    </div>

                    <div className="w-full h-2.5 bg-[var(--bg-subtle)] rounded-full overflow-hidden clay-well p-0.5">
                      <div 
                        className="h-full rounded-full transition-all duration-500"
                        style={{ 
                          width: `${s.barWidth}%`,
                          backgroundColor: s.pnl >= 0 ? '#7D9685' : '#C48B81'
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>

          {/* HÀNG 2: HIỆU SUẤT THEO SETUP | THỜI GIAN GIỮ LỆNH TB | CHECKLIST TRUNG BÌNH */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
            
            {/* Setup Table */}
            <div className="lg:col-span-6 bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] p-4 shadow-lg flex flex-col justify-between space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-[#e8e2da]">
                <span className="font-bold text-[#1d1b17] text-xs tracking-wide uppercase">
                  {language === 'vi' ? 'Hiệu suất theo setup' : 'Setup Performance'}
                </span>
              </div>

              <div className="overflow-x-auto my-auto max-h-56">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#e8e2da] text-[#737973] text-[10px] uppercase">
                      <th className="py-1.5 px-2"># Setup</th>
                      <th className="py-1.5 px-2 text-center">{language === 'vi' ? 'Số lệnh' : 'Trades'}</th>
                      <th className="py-1.5 px-2 text-center">Win Rate</th>
                      <th className="py-1.5 px-2 text-center">Avg R</th>
                      <th className="py-1.5 px-2 text-right">PnL</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#30363d]/40">
                    {setupPerformanceData.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-[#737973] text-xs">
                          {language === 'vi' ? 'Chưa có dữ liệu setup' : 'No setup data'}
                        </td>
                      </tr>
                    ) : (
                      setupPerformanceData.map((s, idx) => (
                        <tr key={s.setup} className="hover:bg-[#ede7df]/50 transition-colors">
                          <td className="py-2 px-2 font-medium text-[#1d1b17] flex items-center gap-1.5">
                            <span className="font-mono text-[10px] text-[#737973]">{idx + 1}.</span>
                            <span>{s.setup}</span>
                          </td>
                          <td className="py-2 px-2 text-center text-[#737973] font-mono">{s.count}</td>
                          <td className="py-2 px-2 text-center font-mono font-bold text-[#1d1b17]">{s.winRate}%</td>
                          <td className="py-2 px-2 text-center font-mono text-[#424843]">{s.avgR}</td>
                          <td className={`py-2 px-2 text-right font-mono font-bold ${s.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {s.pnl >= 0 ? '+' : ''}${s.pnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>


            </div>

            {/* Duration Distribution với hiệu ứng cột Gradient chuyển màu mờ ảo */}
            <div className="lg:col-span-3 bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] p-4 shadow-lg flex flex-col justify-between space-y-3 relative overflow-hidden">
              {/* Atmospheric cyan glow behind duration bars */}
              

              <div className="pb-2 border-b border-[#e8e2da] relative z-10">
                <span className="font-bold text-[#1d1b17] text-xs tracking-wide uppercase">
                  {language === 'vi' ? 'Thời gian giữ lệnh trung bình' : 'Avg Holding Duration'}
                </span>
              </div>

              <div className="my-auto space-y-3 relative z-10">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold font-mono text-[#1d1b17]">
                    {holdingTimeData.formattedAvg}
                  </span>
                  <span className="text-[10px] text-[#737973]">
                    {language === 'vi' ? 'trung bình / lệnh' : 'average per trade'}
                  </span>
                </div>

                <div className="h-32 w-full pt-1">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={holdingTimeData.bucketData} margin={{ top: 18, right: 10, left: -25, bottom: 0 }}>
                      <defs>
                        {/* Smooth gradient from light cyan to dark slate */}
                        <linearGradient id="durationBarGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#4a6152" stopOpacity={0.95} />
                          <stop offset="50%" stopColor="#3d5144" stopOpacity={0.7} />
                          <stop offset="100%" stopColor="#2d3e34" stopOpacity={0.3} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2dbd0" strokeOpacity={0.6} vertical={false} />
                      <XAxis dataKey="label" stroke="#737973" tick={{ fontSize: 10 }} />
                      <YAxis stroke="#737973" tick={{ fontSize: 9 }} unit="%" />
                      {/* Khi di chuột vào cột: hiện vạch bóng màu xám nhạt dịu mắt thay vì màu trắng gắt */}
                      <Tooltip 
                        cursor={{ fill: 'rgba(51, 65, 85, 0.35)' }}
                        content={({ active, payload }: any) => {
                          if (active && payload && payload.length) {
                            const item = payload[0]?.payload;
                            if (!item) return null;
                            return (
                              <div className="bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)]/95 backdrop-blur-md border border-[#e8e2da] rounded-xl p-2.5 shadow-2xl font-sans text-xs space-y-1 min-w-[150px]">
                                <div className="pb-1 border-b border-[#e8e2da] text-[#1d1b17] font-bold flex items-center justify-between">
                                  <span>{item.label}</span>
                                  <span className="text-[10px] text-[#737973] font-mono">
                                    {item.count} {language === 'vi' ? 'lệnh' : 'trades'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-3 pt-0.5">
                                  <span className="text-[#737973]">Win Rate:</span>
                                  <span className="font-mono font-bold text-[#1d1b17]">
                                    {item.winRateDisplay} {item.count > 0 ? `(${item.wins}/${item.count})` : ''}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-[#737973]">Tỷ lệ:</span>
                                  <span className="font-mono font-medium text-[#1d1b17]">
                                    {item.pct}%
                                  </span>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        }}
                      />
                      <Bar 
                        dataKey="pct" 
                        name="Tỷ lệ (%)" 
                        fill="url(#durationBarGrad)" 
                        radius={[4, 4, 0, 0]} 
                        
                      >
                        {/* Hiển thị Win Rate trực tiếp trên đầu mỗi cột thời gian giữ lệnh */}
                        <LabelList 
                          dataKey="winRateDisplay" 
                          position="top" 
                          fill="#94a3b8" 
                          fontSize={9} 
                          fontFamily="monospace"
                          fontWeight={600}
                          offset={4}
                        />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>


            </div>

            {/* Checklist trung bình với hiệu ứng phát sáng tròn */}
            <div className="lg:col-span-3 bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] p-4 shadow-lg flex flex-col justify-between space-y-3 relative overflow-hidden">
              {/* Soft teal ambient background glow */}
              

              <div className="pb-2 border-b border-[#e8e2da] relative z-10">
                <span className="font-bold text-[#1d1b17] text-xs tracking-wide uppercase">
                  {language === 'vi' ? 'Checklist trung bình' : 'Checklist Adherence'}
                </span>
              </div>

              <div className="my-auto space-y-3 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                    <svg 
                      className="w-full h-full transform -rotate-90" 
                      viewBox="0 0 36 36"
                      
                    >
                      <path
                        className="text-[#252b35]"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className="text-[#1d1b17] transition-all duration-500"
                        strokeDasharray={`${checklistData.avgScorePercent}, 100`}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <span className="absolute font-mono text-xs font-bold text-[#1d1b17]">
                      {checklistData.avgScorePercent}%
                    </span>
                  </div>

                  <div>
                    <div className="text-sm font-bold text-[#1d1b17]">
                      {checklistData.avgPoints} / 5.0 {language === 'vi' ? 'điểm' : 'pts'}
                    </div>
                    <p className="text-[10px] text-[#737973]">
                      {language === 'vi' ? 'Điểm kỷ luật xác nhận' : 'Pre-trade confirmation score'}
                    </p>
                  </div>
                </div>

                <div className="space-y-1.5">
                  {checklistData.items.map(item => (
                    <div key={item.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-[11px] text-[#424843] truncate max-w-[130px]">{item.label}</span>
                      <div className="flex items-center gap-2 flex-1 max-w-[100px]">
                        <div className="w-full bg-[#ede7df] h-1.5 rounded-full overflow-hidden border border-[#e8e2da]/40">
                          <div 
                            className="bg-gradient-to-r from-teal-400 to-emerald-400 h-full rounded-full transition-all shadow-[0_0_6px_rgba(20,184,166,0.4)]"
                            style={{ width: `${item.pct}%` }} 
                          />
                        </div>
                        <span className="font-mono text-[10px] text-[#737973] shrink-0 w-7 text-right">
                          {item.pct}%
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="text-[10px] text-[#737973] text-center pt-2 border-t border-[#e8e2da]/60 relative z-10">
                {language === 'vi' ? 'Đo lường mức độ tuân thủ tiêu chí checklist' : 'Empirical checklist rule completion'}
              </div>
            </div>
          </div>

          {/* HÀNG 3: CẶP THẺ LỆNH NGOẠI LAI (LỆNH THẮNG LỚN NHẤT & LỆNH THUA LỚN NHẤT) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Thẻ 1: Lệnh thắng lớn nhất (Largest Win Trade) */}
            <div className="bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] p-4 shadow-lg flex flex-col justify-between space-y-3 relative overflow-hidden">
              

              <div className="pb-2 border-b border-[#e8e2da] flex items-center justify-between relative z-10">
                <span className="font-bold text-[#1d1b17] text-xs tracking-wide uppercase font-sans">
                  {language === 'vi' ? 'Lệnh thắng lớn nhất' : 'Largest Win Trade'}
                </span>
                
              </div>

              {bestTrade ? (
                <div className="my-auto space-y-3 relative z-10">
                  <div>
                    <span className="text-2xl font-bold font-mono text-emerald-400 drop-shadow-[0_0_8px_rgba(52,211,153,0.35)]">
                      +${(bestTrade.net_pnl !== undefined ? bestTrade.net_pnl : (bestTrade.pnl || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div>
                      <span className="text-[10px] text-[#737973] block">{language === 'vi' ? 'Mã & Lot' : 'Symbol & Vol'}</span>
                      <span className="font-bold font-mono text-[#1d1b17] text-xs truncate block">
                        {bestTrade.symbol || 'XAUUSD'} • {bestTrade.volume || 0} lot
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#737973] block">{language === 'vi' ? 'Giờ vào lệnh' : 'Entry Time'}</span>
                      <span className="font-mono text-xs text-[#424843] truncate block" title={bestTrade.open_time}>
                        {bestTrade.open_time ? formatDateTimeWithOffset(bestTrade.open_time, getSavedTimezoneOffset(), 'YYYY-MM-DD HH:mm') : '-'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#737973] block">Setup</span>
                      <span className="text-[#424843] font-medium text-xs truncate block">
                        {bestTrade.setup || (language === 'vi' ? 'Khác' : 'Other')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#737973] block">{language === 'vi' ? 'Phiên' : 'Session'}</span>
                      <span className="text-[#424843] font-medium text-xs truncate block">
                        {bestTrade.session || determineSession(bestTrade.open_time || '', getSavedTimezoneOffset())}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="my-auto text-center py-6 text-[#737973] text-xs relative z-10">
                  {language === 'vi' ? 'Chưa có lệnh thắng nào' : 'No win trades recorded'}
                </div>
              )}

              <div className="pt-2 border-t border-[#e8e2da]/60 flex items-center justify-between relative z-10">
                <span className="text-[10px] text-[#737973] font-mono">{bestTrade ? `#${bestTrade.ticket || bestTrade.id}` : ''}</span>
              </div>
            </div>

            {/* Thẻ 2: Lệnh thua lớn nhất (Largest Loss Trade) */}
            <div className="bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] p-4 shadow-lg flex flex-col justify-between space-y-3 relative overflow-hidden">
              

              <div className="pb-2 border-b border-[#e8e2da] flex items-center justify-between relative z-10">
                <span className="font-bold text-[#1d1b17] text-xs tracking-wide uppercase font-sans">
                  {language === 'vi' ? 'Lệnh thua lớn nhất' : 'Largest Loss Trade'}
                </span>
                
              </div>

              {worstTrade ? (
                <div className="my-auto space-y-3 relative z-10">
                  <div>
                    <span className="text-2xl font-bold font-mono text-rose-400 drop-shadow-[0_0_8px_rgba(244,63,94,0.35)]">
                      -${Math.abs(worstTrade.net_pnl !== undefined ? worstTrade.net_pnl : (worstTrade.pnl || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div>
                      <span className="text-[10px] text-[#737973] block">{language === 'vi' ? 'Mã & Lot' : 'Symbol & Vol'}</span>
                      <span className="font-bold font-mono text-[#1d1b17] text-xs truncate block">
                        {worstTrade.symbol || 'XAUUSD'} • {worstTrade.volume || 0} lot
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#737973] block">{language === 'vi' ? 'Giờ vào lệnh' : 'Entry Time'}</span>
                      <span className="font-mono text-xs text-[#424843] truncate block" title={worstTrade.open_time}>
                        {worstTrade.open_time ? formatDateTimeWithOffset(worstTrade.open_time, getSavedTimezoneOffset(), 'YYYY-MM-DD HH:mm') : '-'}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#737973] block">Setup</span>
                      <span className="text-[#424843] font-medium text-xs truncate block">
                        {worstTrade.setup || (language === 'vi' ? 'Khác' : 'Other')}
                      </span>
                    </div>

                    <div>
                      <span className="text-[10px] text-[#737973] block">{language === 'vi' ? 'Phiên' : 'Session'}</span>
                      <span className="text-[#424843] font-medium text-xs truncate block">
                        {worstTrade.session || determineSession(worstTrade.open_time || '', getSavedTimezoneOffset())}
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="my-auto text-center py-6 text-[#737973] text-xs relative z-10">
                  {language === 'vi' ? 'Không có lệnh thua nào' : 'No loss trades recorded'}
                </div>
              )}

              <div className="pt-2 border-t border-[#e8e2da]/60 flex items-center justify-between relative z-10">
                <span className="text-[10px] text-[#737973] font-mono">{worstTrade ? `#${worstTrade.ticket || worstTrade.id}` : ''}</span>
              </div>
            </div>
          </div>

          {/* HÀNG 4: MA TRẬN NHIỆT 24 GIỜ TRONG TUẦN (INTRADAY HOURLY HEATMAP: 00H - 23H) */}
          <div className="bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] p-4 shadow-lg space-y-3.5 relative">
            {/* Ambient glow */}
            

            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-[#e8e2da] relative z-10">
              <div className="flex items-center gap-2">
                
                <span className="font-bold text-[#1d1b17] text-xs tracking-wide uppercase font-sans">
                  {language === 'vi' ? 'Ma trận nhiệt 24 Giờ trong tuần (Intraday Hourly Heatmap)' : 'Intraday 24-Hour Performance Heatmap'}
                </span>
                <span className="text-[10px] text-[#737973] font-mono">
                  (00:00 - 23:59)
                </span>
              </div>

              {/* Best & Worst Hour Badges */}
              <div className="flex items-center gap-2 text-[11px] font-mono flex-wrap">
                {intradayHourlyMatrix.bestHour !== null && (
                  <span className="px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[#1d1b17] border border-[var(--border-main)] flex items-center gap-1 shadow-xs">
                    <span className="font-bold text-[#1d1b17]">{language === 'vi' ? 'Giờ Vàng:' : 'Peak Hour:'}</span>
                    <strong className="text-[#1d1b17] font-bold">{String(intradayHourlyMatrix.bestHour).padStart(2, '0')}:00</strong>
                    <span className="text-emerald-600 font-bold">({formatMetricValue(intradayHourlyMatrix.bestHourPnl)})</span>
                  </span>
                )}
                {intradayHourlyMatrix.worstHour !== null && (
                  <span className="px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[#1d1b17] border border-[var(--border-main)] flex items-center gap-1 shadow-xs">
                    <span className="font-bold text-[#1d1b17]">{language === 'vi' ? 'Tử Huyệt:' : 'Worst Hour:'}</span>
                    <strong className="text-[#1d1b17] font-bold">{String(intradayHourlyMatrix.worstHour).padStart(2, '0')}:00</strong>
                    <span className="text-rose-600 font-bold">({formatMetricValue(intradayHourlyMatrix.worstHourPnl)})</span>
                  </span>
                )}
              </div>
            </div>

            {/* Grid container with horizontal scroll for responsiveness */}
            <div className="overflow-x-auto pb-2 pt-1 relative z-10">
              <div className="min-w-[860px]">
                {/* Hour Columns Header */}
                <div className="grid grid-cols-[65px_repeat(24,1fr)_115px] gap-1 text-[9px] font-mono text-[#737973] pb-1.5 font-bold">
                  <div className="text-left pl-1">{language === 'vi' ? 'Thứ' : 'Day'}</div>
                  {Array.from({ length: 24 }).map((_, h) => (
                    <div key={h} className="text-center truncate text-[#424843]">
                      {String(h).padStart(2, '0')}h
                    </div>
                  ))}
                  <div className="text-center truncate">{language === 'vi' ? 'Tổng Ngày' : 'Total'}</div>
                </div>

                {/* 7 Day Rows */}
                <div className="space-y-1">
                  {intradayHourlyMatrix.dayKeys.map((d) => {
                    const dayLabel = language === 'vi' ? intradayHourlyMatrix.dayLabels[d].short : intradayHourlyMatrix.dayLabels[d].en.slice(0, 3);
                    const fullDayName = language === 'vi' ? intradayHourlyMatrix.dayLabels[d].vi : intradayHourlyMatrix.dayLabels[d].en;
                    const dayTotal = intradayHourlyMatrix.dayTotals[d];
                    // T2, T3, T4: Pop-up rơi xuống dưới (top-full mt-2)
                    // T5, T6, T7, CN: Pop-up trồi lên trên (bottom-full mb-2)
                    const isTopRow = d === 1 || d === 2 || d === 3;
                    const popupVerticalAlign = isTopRow ? 'top-full mt-2' : 'bottom-full mb-2';

                    return (
                      <div key={d} className="grid grid-cols-[65px_repeat(24,1fr)_115px] gap-1 items-center relative hover:z-50">
                        {/* Day Label */}
                        <div className="text-xs font-mono font-bold text-[#424843] text-left pl-1 truncate">
                          {dayLabel}
                        </div>

                        {/* 24 Hour Cells */}
                        {Array.from({ length: 24 }).map((_, h) => {
                          const cell = intradayHourlyMatrix.grid[d][h];
                          const hasTrades = cell.count > 0;
                          const isProfit = cell.pnl > 0;
                          const isLoss = cell.pnl < 0;
                          const winRate = hasTrades ? Math.round((cell.wins / cell.count) * 100) : 0;
                          
                          // Color styling
                          let bgClass = 'bg-[#ede7df]/70 border-[#e8e2da]/40 text-slate-600';
                          if (hasTrades) {
                            if (isProfit) {
                              const ratio = Math.min(1, Math.abs(cell.pnl) / (intradayHourlyMatrix.maxAbsPnl || 1));
                              bgClass = ratio > 0.4 
                                ? 'bg-emerald-100 border-emerald-300 text-[#4a6152] font-bold' 
                                : 'bg-emerald-50 border-emerald-200 text-[#4a6152]';
                            } else if (isLoss) {
                              const ratio = Math.min(1, Math.abs(cell.pnl) / (intradayHourlyMatrix.maxAbsPnl || 1));
                              bgClass = ratio > 0.4 
                                ? 'bg-rose-100 border-rose-300 text-[#825249] font-bold' 
                                : 'bg-rose-50 border-rose-200 text-[#825249]';
                            } else {
                              bgClass = 'bg-[#ede7df] border-[#d8d0c5] text-[var(--text-muted)]';
                            }
                          }

                          // Tọa độ căn chỉnh pop-up ngang tránh tràn mép trái/phải
                          const popupHorizontalAlign = h <= 2 
                            ? 'left-0' 
                            : h >= 21 
                              ? 'right-0' 
                              : 'left-1/2 -translate-x-1/2';

                          return (
                            <div
                              key={h}
                              className={`h-7 rounded border flex items-center justify-center text-[10px] font-mono font-semibold transition-transform hover:scale-110 cursor-pointer relative group ${bgClass} hover:z-50`}
                            >
                              {hasTrades ? cell.count : '·'}

                              {/* Hover Tooltip: T2, T3, T4 hiện xuống dưới và nổi lên trên các dòng sau; T5, T6, CN hiện trồi lên trên */}
                              {hasTrades && (
                                <div className={`absolute ${popupHorizontalAlign} ${popupVerticalAlign} hidden group-hover:block z-50 w-52 p-2.5 bg-[#ede7df] border border-[#38414e] rounded-xl shadow-[0_12px_32px_rgba(0,0,0,0.95)] text-[11px] font-normal text-[#1d1b17] pointer-events-none leading-tight backdrop-blur-md`}>
                                  <div className="pb-1 border-b border-[#e8e2da] flex items-center justify-between font-bold">
                                    <span className="text-[#1d1b17]">{fullDayName}</span>
                                    <span className="text-[#1d1b17] font-mono">{String(h).padStart(2, '0')}:00 - {String(h).padStart(2, '0')}:59</span>
                                  </div>
                                  <div className="pt-1.5 space-y-1">
                                    <div className="flex justify-between">
                                      <span className="text-[#737973]">{language === 'vi' ? 'Số lệnh:' : 'Trades:'}</span>
                                      <span className="font-mono font-bold text-[#1d1b17]">{cell.count} ({cell.wins}W - {cell.count - cell.wins}L)</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-[#737973]">Win Rate:</span>
                                      <span className="font-mono font-bold text-[#1d1b17]">{winRate}%</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span className="text-[#737973]">PnL:</span>
                                      <span className={`font-mono font-bold ${cell.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                                        {formatMetricValue(cell.pnl, cell.r)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Day Total Column: Canh giữa chuẩn */}
                        <div className={`text-center font-mono text-xs font-bold truncate ${dayTotal.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {dayTotal.count > 0 ? formatMetricValue(dayTotal.pnl, dayTotal.r) : '-'}
                        </div>
                      </div>
                    );
                  })}

                  {/* Bottom Summary Row */}
                  <div className="grid grid-cols-[65px_repeat(24,1fr)_115px] gap-1 items-center pt-1.5 border-t border-[#e8e2da]/40">
                    <div className="text-[10px] font-mono text-[#737973] font-bold pl-1">{language === 'vi' ? 'Tổng' : 'Total'}</div>
                    {Array.from({ length: 24 }).map((_, h) => {
                      const hTot = intradayHourlyMatrix.hourTotals[h];
                      return (
                        <div
                          key={h}
                          className={`text-center font-mono text-[9px] font-bold truncate ${
                            hTot.count === 0 ? 'text-slate-600' : hTot.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                          }`}
                          title={`${String(h).padStart(2, '0')}:00 - ${hTot.count} lệnh (${hTot.wins}W) - ${formatMetricValue(hTot.pnl, hTot.r)}`}
                        >
                          {hTot.count > 0 ? (hTot.pnl >= 0 ? `+` : `-`) : '·'}
                        </div>
                      );
                    })}
                    {/* Hàng tổng dưới cùng: Canh giữa */}
                    <div className="text-center font-mono text-xs font-bold text-[#1d1b17] truncate">
                      {formatMetricValue(coreRiskData.netPnl, coreRiskData.totalR)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* HÀNG 5: BÁO CÁO 12 THÁNG TRONG NĂM (THU NHỎ LẠI & BỎ HẾT CHÚ THÍCH Ở DƯỚI) */}
          <div className="bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] shadow-lg p-3 space-y-2 relative overflow-hidden">
            {/* Ambient backdrop glow */}
            

            <div className="pb-1.5 border-b border-[#e8e2da] flex items-center justify-between relative z-10">
              <div className="flex items-center gap-1.5">
                
                <span className="font-bold text-[#1d1b17] text-[11px] tracking-wider uppercase font-sans">
                  {language === 'vi' ? 'Báo Cáo 12 Tháng Trong Năm (Monthly PnL Heatmap)' : '12-Month Performance Heatmap'}
                </span>
              </div>
              <span className="text-[10px] text-[#737973] font-mono">
                {new Date().getFullYear()}
              </span>
            </div>

            <div className="grid grid-cols-4 sm:grid-cols-6 xl:grid-cols-12 gap-1.5 my-auto relative z-10">
              {timeAndSessionData.monthlyGrid.map(m => (
                <div 
                  key={m.monthIdx}
                  className={`p-1.5 rounded-lg border text-center transition-all ${
                    m.status === 'WIN' 
                      ? 'bg-emerald-50 border-emerald-200' 
                      : m.status === 'LOSS'
                        ? 'bg-rose-50 border-rose-200'
                        : 'bg-[#ede7df] border-[#d8d0c5] opacity-60'
                  }`}
                >
                  <span className="text-[9px] text-[#737973] uppercase font-semibold font-mono block">{m.name}</span>
                  <div className={`font-mono text-[11px] font-bold mt-0.5 truncate ${
                    m.pnl > 0 ? 'text-[#4a6152]' : m.pnl < 0 ? 'text-[#825249]' : 'text-[#737973]'
                  }`}>
                    {m.count > 0 ? (m.pnl >= 0 ? `+$${m.pnl.toLocaleString('en-US', { maximumFractionDigits: 0 })}` : `-$${Math.abs(m.pnl).toLocaleString('en-US', { maximumFractionDigits: 0 })}`) : '$0'}
                  </div>
                  <span className="text-[8px] text-[#737973] block font-mono">
                    {m.count > 0 ? `${m.count} lệnh (${m.winRate}%)` : '-'}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. CÁC PHÂN HỆ CHUYÊN SÂU ĐƯỢC BẢO TOÀN TRỌN VẸN VÀO TAB TẤT CẢ */}
      {/* ========================================================================= */}

      {/* 5.1 PHÂN HẠNG HỢP LƯU & ĐA KHUNG THỜI GIAN */}
      {(activeSection === 'ALL') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Confluence Grading Tiers */}
          <div className="lg:col-span-7 bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] p-4 shadow-lg space-y-3">
            <div className="pb-2 border-b border-[#e8e2da] flex items-center justify-between">
              <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase">
                {language === 'vi' ? 'Phân Hạng Theo Lớp Hợp Lưu (Confluence Grading A+, A, B, C)' : 'Confluence Quality Tiers'}
              </span>
              <span className="text-[11px] text-[#737973]">
                {language === 'vi' ? 'Dựa trên số tiêu chí checklist đã tích' : 'Pre-trade criteria count'}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {confluenceData.map(g => (
                <div key={g.grade} className="p-3 bg-[#ede7df] rounded-xl border border-[#e8e2da] space-y-1">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border font-mono ${g.badgeColor}`}>
                      {g.grade}
                    </span>
                    <span className={`font-mono font-bold text-xs ${g.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {g.pnl >= 0 ? '+' : ''}${g.pnl.toFixed(0)}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-[#1d1b17]">{g.title}</div>
                  <p className="text-[10px] text-[#737973] line-clamp-1">{g.desc}</p>
                  <div className="flex items-center justify-between text-[11px] text-[#424843] pt-1 border-t border-[#e8e2da]/50 font-mono">
                    <span>{g.count} {language === 'vi' ? 'lệnh' : 'trades'} • WR {g.winRate}%</span>
                    <span>RR {g.avgRR}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Timeframe Table */}
          <div className="lg:col-span-5 bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] p-4 shadow-lg space-y-3 flex flex-col justify-between">
            <div className="pb-2 border-b border-[#e8e2da] flex items-center justify-between">
              <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase">
                {language === 'vi' ? 'Hiệu Suất Đa Khung Thời Gian (Timeframes)' : 'Timeframe Breakdown'}
              </span>
            </div>

            <div className="overflow-x-auto my-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e8e2da] text-[#737973] text-[10px] uppercase">
                    <th className="py-1.5 px-2">TF</th>
                    <th className="py-1.5 px-2 text-center">{language === 'vi' ? 'Số lệnh' : 'Count'}</th>
                    <th className="py-1.5 px-2 text-center">Win Rate</th>
                    <th className="py-1.5 px-2 text-right">PnL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363d]/40">
                  {timeframeData.map(item => (
                    <tr key={item.tf} className="hover:bg-[#ede7df]/50">
                      <td className="py-1.5 px-2 font-bold font-mono text-[#1d1b17]">{item.tf}</td>
                      <td className="py-1.5 px-2 text-center text-[#424843] font-mono">{item.count}</td>
                      <td className="py-1.5 px-2 text-center font-mono font-bold text-[#1d1b17]">{item.winRate.toFixed(1)}%</td>
                      <td className={`py-1.5 px-2 text-right font-mono font-bold ${item.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {item.pnl >= 0 ? '+' : ''}${item.pnl.toFixed(2)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="text-[10px] text-[#737973] text-center pt-2 border-t border-[#e8e2da]/60">
              {language === 'vi' ? 'Phân bổ theo khung thời gian phân tích' : 'Timeframe efficiency breakdown'}
            </div>
          </div>
        </div>
      )}

      {/* 5.2 MA TRẬN CẶP TIỀN & ĐỐI ĐẦU BUY VS SELL */}
      {(activeSection === 'ALL' || activeSection === 'INSTRUMENTS') && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
          {/* Instruments Matrix */}
          <div className="lg:col-span-8 bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] p-4 shadow-lg space-y-3">
            <div className="pb-2 border-b border-[#e8e2da] flex items-center justify-between">
              <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase">
                {language === 'vi' ? 'Ma Trận Cặp Tiền & Tài Sản (Instrument Matrix)' : 'Instrument Performance Matrix'}
              </span>
              <span className="text-xs text-[#737973] font-mono">{instrumentData.symbols.length} {language === 'vi' ? 'mã' : 'symbols'}</span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#e8e2da] text-[#737973] text-[10px] uppercase">
                    <th className="py-2 px-2">{language === 'vi' ? 'Mã' : 'Symbol'}</th>
                    <th className="py-2 px-2 text-center">{language === 'vi' ? 'Số Lệnh' : 'Trades'}</th>
                    <th className="py-2 px-2 text-center">Win Rate</th>
                    <th className="py-2 px-2 text-center">R : R</th>
                    <th className="py-2 px-2 text-right">Net PnL</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#30363d]/40">
                  {instrumentData.symbols.map((item, idx) => (
                    <tr key={item.symbol} className="hover:bg-[#ede7df]/50 transition-colors">
                      <td className="py-2 px-2 font-bold font-mono text-[#1d1b17] flex items-center gap-1.5">
                        <span>{item.symbol}</span>
                        {idx === 0 && item.pnl > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-400/10 text-[#1d1b17] border border-amber-400/20 font-semibold">{language === 'vi' ? 'Gánh team' : 'Top Asset'}</span>}
                        {idx === instrumentData.symbols.length - 1 && item.pnl < 0 && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-rose-400/10 text-rose-300 border border-rose-400/20 font-semibold">{language === 'vi' ? 'Cần né' : 'Avoid'}</span>
                        )}
                      </td>
                      <td className="py-2 px-2 text-center text-[#424843] font-mono">{item.count}</td>
                      <td className="py-2 px-2 text-center font-mono font-bold text-[#1d1b17]">{item.winRate}%</td>
                      <td className="py-2 px-2 text-center font-mono text-[#424843]">{item.avgRR}</td>
                      <td className={`py-2 px-2 text-right font-mono font-bold ${item.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {item.pnl >= 0 ? '+' : ''}${item.pnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Long vs Short Head to Head */}
          <div className="lg:col-span-4 bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] p-4 shadow-lg space-y-3 flex flex-col justify-between">
            <div className="pb-2 border-b border-[#e8e2da]">
              <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase">
                {language === 'vi' ? 'Đối Đầu BUY vs SELL' : 'Long vs Short Bias'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 my-auto">
              <div className="p-3 rounded-xl bg-[#ede7df] border border-[#d8d0c5] space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase">BUY (LONG)</span>
                <div className={`text-base font-bold font-mono ${instrumentData.longShort.buy.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {instrumentData.longShort.buy.pnl >= 0 ? '+' : ''}${instrumentData.longShort.buy.pnl.toFixed(0)}
                </div>
                <div className="text-[11px] text-[#424843]">
                  WR: <span className="font-bold text-[#1d1b17]">{instrumentData.longShort.buy.winRate}%</span>
                </div>
                <div className="text-[10px] text-[#737973]">
                  {instrumentData.longShort.buy.count} {language === 'vi' ? 'lệnh' : 'trades'} • {instrumentData.longShort.buy.volume} lots
                </div>
              </div>

              <div className="p-3 rounded-xl bg-[#ede7df] border border-[#d8d0c5] space-y-1">
                <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase">SELL (SHORT)</span>
                <div className={`text-base font-bold font-mono ${instrumentData.longShort.sell.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {instrumentData.longShort.sell.pnl >= 0 ? '+' : ''}${instrumentData.longShort.sell.pnl.toFixed(0)}
                </div>
                <div className="text-[11px] text-[#424843]">
                  WR: <span className="font-bold text-[#1d1b17]">{instrumentData.longShort.sell.winRate}%</span>
                </div>
                <div className="text-[10px] text-[#737973]">
                  {instrumentData.longShort.sell.count} {language === 'vi' ? 'lệnh' : 'trades'} • {instrumentData.longShort.sell.volume} lots
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-[#737973]">
                <span>BUY: {instrumentData.longShort.buy.ratioPct}%</span>
                <span>SELL: {instrumentData.longShort.sell.ratioPct}%</span>
              </div>
              <div className="w-full bg-[#ede7df] h-2 rounded-full overflow-hidden flex border border-[#e8e2da]/40">
                <div className="bg-emerald-500 h-full" style={{ width: `${instrumentData.longShort.buy.ratioPct}%` }} />
                <div className="bg-rose-500 h-full" style={{ width: `${instrumentData.longShort.sell.ratioPct}%` }} />
              </div>
              <p className="text-[10px] text-[#737973] pt-1 text-center font-medium">
                {instrumentData.longShort.biasVerdict}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 5.3 THƯỚC ĐO KỶ LUẬT & MA TRẬN TỔN THẤT CẢM XÚC */}
      {(activeSection === 'ALL' || activeSection === 'DISCIPLINE') && (
        <div className="bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] shadow-lg p-4 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-[#e8e2da] flex-wrap gap-2">
            <div>
              <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase">
                {language === 'vi' ? 'Thước Đo Kỷ Luật & Chi Phí Lỗi Cảm Xúc (Discipline Gap)' : 'Discipline Gap & Mistake Cost'}
              </span>
              <p className="text-[10px] text-[#737973] mt-0.5">
                {language === 'vi' ? 'Quy đổi các vi phạm kỷ luật thành số tiền mặt thực tế đã mất' : 'Converting disciplinary infractions into empirical cash loss'}
              </p>
            </div>
            <span className="text-[11px] px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-300 border border-rose-500/20 font-mono font-bold">
              {language === 'vi' ? 'Tổng tổn thất:' : 'Total Drain:'} -${disciplineData.totalNegativeMistakes.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="p-3 bg-[#ede7df] rounded-xl border border-rose-500/20 space-y-1">
              <span className="text-[11px] text-[#737973]">{language === 'vi' ? 'Dời / Xóa SL' : 'Moved / Deleted SL'}</span>
              <p className="text-base font-bold font-mono text-rose-400">-${disciplineData.movingSlLoss.toFixed(2)}</p>
              <p className="text-[10px] text-[#737973]">{language === 'vi' ? 'Gồng lỗ ngoài kế hoạch' : 'Unplanned drawdown'}</p>
            </div>
            <div className="p-3 bg-[#ede7df] rounded-xl border border-rose-500/20 space-y-1">
              <span className="text-[11px] text-[#737973]">{language === 'vi' ? 'FOMO / Vào Sớm' : 'FOMO / Early Entry'}</span>
              <p className="text-base font-bold font-mono text-rose-400">-${disciplineData.fomoLoss.toFixed(2)}</p>
              <p className="text-[10px] text-[#737973]">{language === 'vi' ? 'Thiếu nến xác nhận' : 'Missing confirmations'}</p>
            </div>
            <div className="p-3 bg-[#ede7df] rounded-xl border border-rose-500/20 space-y-1">
              <span className="text-[11px] text-[#737973]">{language === 'vi' ? 'Trả Thù Thị Trường' : 'Revenge Trading'}</span>
              <p className="text-base font-bold font-mono text-rose-400">-${disciplineData.revengeLoss.toFixed(2)}</p>
              <p className="text-[10px] text-[#737973]">{language === 'vi' ? 'Vội vàng sau khi SL' : 'Rushed entry after loss'}</p>
            </div>
            <div className="p-3 bg-[#ede7df] rounded-xl border border-rose-500/20 space-y-1">
              <span className="text-[11px] text-[#737973]">{language === 'vi' ? 'Quá Khối Lượng (Overlot)' : 'Overleveraged'}</span>
              <p className="text-base font-bold font-mono text-rose-400">-${disciplineData.overlotLoss.toFixed(2)}</p>
              <p className="text-[10px] text-[#737973]">{language === 'vi' ? 'Vượt quá rủi ro 1-2%' : 'Violating 1-2% risk'}</p>
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-[#ede7df] border border-[#e8e2da] text-xs text-[#424843] flex items-center justify-between flex-wrap gap-2">
            <span>
              {language === 'vi' ? 'Lợi nhuận tiềm năng nếu kỷ luật 100% (không dính các lỗi trên):' : 'Potential PnL with 100% discipline adherence:'}
            </span>
            <span className={`font-mono font-bold text-sm ${disciplineData.potentialPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {disciplineData.potentialPnl >= 0 ? '+' : ''}${disciplineData.potentialPnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        </div>
      )}

      {/* 5.4 GIẢ LẬP WHAT-IF 3 ĐƯỜNG CONG VỐN VỚI HIỆU ỨNG HÀO QUANG */}
      {(activeSection === 'ALL' || activeSection === 'WHAT_IF') && (
        <div className="bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] shadow-lg p-4 space-y-3 relative overflow-hidden">
          {/* Subtle green/cyan backdrop glow */}
          

          <div className="flex items-center justify-between pb-2 border-b border-[#e8e2da] relative z-10 flex-wrap gap-2.5">
            <div className="flex items-center gap-3 flex-wrap">
              <div>
                <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase font-sans">
                  {language === 'vi' ? `Giả Lập Đường Cong Vốn What-If (Thực Tế vs Giả Lập MFE Cố Định ${customWhatIfRR}R)` : `What-If Equity Trajectory (Actual vs Fixed ${customWhatIfRR}R via MFE)`}
                </span>
                <p className="text-[10px] text-[#737973] mt-0.5">
                  {language === 'vi' ? `Lệnh đạt MFE ≥ ${customWhatIfRR}R chốt +${customWhatIfRR}R, không đủ giữ kết quả thực tế` : `MFE ≥ ${customWhatIfRR}R locks +${customWhatIfRR}R, else actual net PnL`}
                </p>
              </div>

              {/* Nút chỉnh sửa mục tiêu R ở góc trái */}
              <div className="flex items-center gap-1.5 bg-[#ede7df] px-2 py-1 rounded-lg border border-[#38414e] shadow-xs">
                <span className="text-[11px] text-[#1d1b17] font-mono font-bold whitespace-nowrap">
                  {language === 'vi' ? 'Mục tiêu:' : 'Target:'}
                </span>
                <div className="flex items-center gap-1">
                  {[1.0, 1.5, 2.0, 2.5, 3.0].map((rVal) => (
                    <button
                      key={rVal}
                      type="button"
                      onClick={() => setCustomWhatIfRR(rVal)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        customWhatIfRR === rVal 
                          ? 'bg-white text-[#1d1b17] font-bold border border-[#d8d0c5] shadow-xs' 
                          : 'text-[#737973] hover:text-[#4a6152] hover:bg-[#e8e2da]'
                      }`}
                    >
                      {rVal}R
                    </button>
                  ))}
                  {/* Ô nhập tùy ý */}
                  <div className="flex items-center ml-1 pl-1 border-l border-[#e8e2da]">
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="10"
                      value={customWhatIfRR}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) setCustomWhatIfRR(val);
                      }}
                      className="w-12 px-1 py-0.5 text-[10px] font-mono font-bold bg-white border border-[#d8d0c5] rounded text-[#1d1b17] text-center focus:outline-hidden focus:border-[#4a6152]"
                      title="Nhập số R tùy chỉnh"
                    />
                    <span className="text-[10px] font-mono text-[#737973] ml-0.5">R</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 text-xs font-mono">
              <span className="text-[#737973]">
                {language === 'vi' ? 'Vốn ban đầu:' : 'Initial:'} <strong className="text-[#1d1b17]">${initialBalance.toLocaleString()}</strong>
              </span>
              <span className="text-emerald-400">
                {language === 'vi' ? 'Hiện tại:' : 'Current:'} <strong>${whatIfData.finalActual.toLocaleString()}</strong>
              </span>
              <span className="text-[#1d1b17]">
                {language === 'vi' ? `Giả lập (${customWhatIfRR}R):` : `Simulated (${customWhatIfRR}R):`} <strong>${whatIfData.finalFixed.toLocaleString()}</strong>
              </span>
            </div>
          </div>

          <div className="h-64 w-full pt-1 relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={whatIfData.whatIfCurves} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2dbd0" strokeOpacity={0.6} vertical={false} />
                <XAxis dataKey="trade" stroke="#737973" tick={{ fontSize: 10 }} />
                <YAxis 
                  stroke="#737973" 
                  tick={{ fontSize: 10 }} 
                  domain={['auto', 'auto']}
                  tickFormatter={(val: number) => `$${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomChartTooltip customRRRatio={customWhatIfRR} language={language} />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                <Line 
                  type="monotone" 
                  dataKey="actual" 
                  name={language === 'vi' ? 'Thực Tế' : 'Actual'} 
                  stroke="#4a6152" 
                  strokeWidth={2.5} 
                  dot={false} 
                  
                />
                <Line 
                  type="monotone" 
                  dataKey="fixedRR" 
                  name={language === 'vi' ? `Giả Lập MFE Cố Định ${customWhatIfRR}R` : `Fixed ${customWhatIfRR}R via MFE`} 
                  stroke="#825249" 
                  strokeWidth={2} 
                  strokeDasharray="4 4" 
                  dot={false} 
                  
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 5.4.1 BÓC TÁCH MFE & MAE - BIỂU ĐỒ CHỐT THEO MFE SO VỚI LỆNH THỰC TẾ */}
      {(activeSection === 'ALL' || activeSection === 'MFE_MAE') && (
        <div className="bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] shadow-lg p-4 space-y-4 relative overflow-hidden">
          {/* Subtle amber & emerald radial aura */}
          

          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-[#e8e2da] relative z-10 flex-wrap gap-2.5">
            <div>
              <div className="flex items-center gap-2">
                
                <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase font-sans">
                  {language === 'vi' ? 'Bóc Tách MFE & MAE (Biên Độ Lợi Nhuận & Áp Lực Drawdown)' : 'MFE & MAE Excursion Analysis'}
                </span>
              </div>
              <p className="text-[10px] text-[#737973] mt-0.5">
                {language === 'vi' 
                  ? 'So sánh đường cong vốn thực tế vs Giả lập chốt theo đỉnh MFE (lợi nhuận để tuột trên bàn cân)' 
                  : 'Comparing actual equity trajectory vs MFE peak trailing capture'}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap text-xs font-mono">
              {/* Bộ chọn mục tiêu R cho MFE: 1R, 2R, 3R */}
              <div className="flex items-center gap-1.5 bg-[#ede7df] px-2.5 py-1 rounded-lg border border-[#e8e2da] shadow-xs">
                <span className="text-[11px] text-[#1d1b17] font-mono font-bold whitespace-nowrap">
                  {language === 'vi' ? 'Mốc R MFE:' : 'Target R:'}
                </span>
                <div className="flex items-center gap-1">
                  {[1.0, 1.5, 2.0, 2.5, 3.0].map((rVal) => (
                    <button
                      key={rVal}
                      type="button"
                      onClick={() => setCustomMfeRR(rVal)}
                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold transition-all cursor-pointer ${
                        customMfeRR === rVal 
                          ? 'bg-white text-[#1d1b17] font-bold border border-[#d8d0c5] shadow-xs' 
                          : 'text-[#737973] hover:text-[#4a6152] hover:bg-[#e8e2da]'
                      }`}
                    >
                      {rVal}R
                    </button>
                  ))}
                  {/* Ô nhập tùy chỉnh mốc R */}
                  <div className="flex items-center ml-1 pl-1 border-l border-[#e8e2da]">
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      max="10"
                      value={customMfeRR}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val > 0) setCustomMfeRR(val);
                      }}
                      className="w-12 px-1 py-0.5 text-[10px] font-mono font-bold bg-white border border-[#d8d0c5] rounded text-[#1d1b17] text-center focus:outline-hidden focus:border-[#4a6152]"
                      title={language === 'vi' ? 'Nhập số R tùy chỉnh' : 'Custom R multiple'}
                    />
                  </div>
                </div>
              </div>

              <span className="px-2.5 py-1 rounded bg-[#ede7df] border border-[#d8d0c5] text-[#1d1b17]">
                {language === 'vi' ? 'Tiềm năng tối ưu MFE:' : 'Optimal MFE Potential:'} <strong className="text-[#1d1b17]">+${mfeMaeData.potentialGain.toLocaleString()}</strong>
              </span>
              <span className="px-2.5 py-1 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300">
                {language === 'vi' ? 'Để tuột mất đỉnh:' : 'Left on Table:'} <strong className="text-[#1d1b17]">-${mfeMaeData.totalLeftOnTable.toLocaleString()}</strong>
              </span>
            </div>
          </div>

          {/* Dòng trạng thái nguồn dữ liệu 100% THẬT */}
          <div className="p-2.5 rounded-lg bg-[#ede7df] border border-[#e8e2da] text-[11px] text-[#424843] flex items-center justify-between flex-wrap gap-2 relative z-10">
            <span className="flex items-center gap-1.5">
              
              <span>
                {language === 'vi'
                  ? 'Nguồn MFE/MAE: Dữ liệu thật từ giá High / Low của EA MT5 ghi nhận trong suốt vòng đời lệnh.'
                  : 'Source: 100% Real tick/candle High-Low excursion recorded during trade lifespan.'}
              </span>
            </span>
            <span className="text-[#737973] font-mono text-[10px]">
              {language === 'vi' ? 'Tuyệt đối không sử dụng số liệu ảo' : 'Zero artificial estimations'}
            </span>
          </div>

          {/* 4 Metric Cards: MFE Peak Capture, Drawdown Drag (MAE), Left on Table, MAE on Wins */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
            <div className="p-3 bg-[#ede7df] rounded-xl border border-[#d8d0c5] space-y-1">
              <span className="text-[10px] font-bold text-[#1d1b17] uppercase tracking-wider">
                {language === 'vi' ? 'MFE (Lãi cực đại từng đạt)' : 'MFE (Peak Favorable)'}
              </span>
              <div className="text-lg font-bold font-mono text-[#1d1b17]">
                ${mfeMaeData.finalMfeOptimal.toLocaleString()}
              </div>
              <p className="text-[10px] text-[#737973]">
                {language === 'vi' ? 'Vốn đạt được nếu chốt tối ưu theo MFE' : 'Equity if captured at optimal MFE peak'}
              </p>
            </div>

            <div className="p-3 bg-[#ede7df] rounded-xl border border-[#d8d0c5] space-y-1">
              <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wider">
                {language === 'vi' ? 'Lợi nhuận để tuột (Left on table)' : 'Left on Table Drain'}
              </span>
              <div className="text-lg font-bold font-mono text-rose-400">
                -${mfeMaeData.totalLeftOnTable.toLocaleString()}
              </div>
              <p className="text-[10px] text-[#737973]">
                {language === 'vi' ? `TB để tuột ~$${mfeMaeData.avgLeftOnTable.toFixed(0)} / mỗi lệnh` : `Avg ~$${mfeMaeData.avgLeftOnTable.toFixed(0)} dropped per trade`}
              </p>
            </div>

            <div className="p-3 bg-[#ede7df] rounded-xl border border-[#d8d0c5] space-y-1">
              <span className="text-[10px] font-bold text-[#1d1b17] uppercase tracking-wider">
                {language === 'vi' ? `Cố Định ${customMfeRR}R theo MFE` : `Fixed ${customMfeRR}R via MFE`}
              </span>
              <div className="text-lg font-bold font-mono text-[#1d1b17]">
                ${mfeMaeData.finalFixed.toLocaleString()}
              </div>
              <p className="text-[10px] text-[#737973]">
                {language === 'vi' ? `Lệnh đạt MFE ≥ ${customMfeRR}R chốt +${customMfeRR}R, còn lại giữ kết quả thật` : `MFE ≥ ${customMfeRR}R locked at +${customMfeRR}R, else actual`}
              </p>
            </div>

            {/* Card 4: Tỷ số đè nén lệnh thắng (MAE on Winning Trades - Edge Tightening) */}
            <div className="p-3 bg-[#ede7df] rounded-xl border border-[#d8d0c5] space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-[#1d1b17] uppercase tracking-wider">
                  {language === 'vi' ? 'Đè Nén Lệnh Thắng (MAE)' : 'MAE On Wins'}
                </span>
                <span className="text-[9px] font-mono text-[#4a6152] bg-[#e8e2da] px-1.5 py-0.2 rounded border border-[#d8d0c5] font-bold">
                  {mfeMaeData.maeWinStats.pctUnder050R}% ≤ 0.5R
                </span>
              </div>
              <div className="text-lg font-bold font-mono text-[#1d1b17]">
                {mfeMaeData.maeWinStats.avgMaeWinR}R <span className="text-xs text-[#737973] font-normal">TB</span>
              </div>
              <p className="text-[10px] text-[#737973]">
                {language === 'vi' 
                  ? (mfeMaeData.maeWinStats.pctUnder050R >= 75
                      ? 'Entry cực bén! Có thể xem xét bóp gọn SL.'
                      : 'Độ rung lắc của các lệnh thắng trước khi chốt lời.')
                  : 'Drawdown drag endured by winning trades before TP.'}
              </p>
            </div>
          </div>

          {/* Biểu đồ So Sánh 3 Đường: Thực Tế vs Đỉnh MFE vs Cố Định XR theo MFE */}
          <div className="h-64 w-full pt-1 relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={mfeMaeData.curveData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2dbd0" strokeOpacity={0.6} vertical={false} />
                <XAxis dataKey="trade" stroke="#737973" tick={{ fontSize: 10 }} />
                <YAxis 
                  stroke="#737973" 
                  tick={{ fontSize: 10 }} 
                  domain={['auto', 'auto']}
                  tickFormatter={(val: number) => `$${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomChartTooltip customRRRatio={customMfeRR} language={language} />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                <Line 
                  type="monotone" 
                  dataKey="actual" 
                  name={language === 'vi' ? 'Thực Tế Đóng Lệnh' : 'Actual Realized'} 
                  stroke="#4a6152" 
                  strokeWidth={2.5} 
                  dot={false} 
                  
                />
                <Line 
                  type="monotone" 
                  dataKey="mfeOptimal" 
                  name={language === 'vi' ? 'Giả Lập Chốt Theo MFE (Đỉnh Sóng)' : 'MFE Peak Optimal Capture'} 
                  stroke="#825249" 
                  strokeWidth={2.5} 
                  strokeDasharray="3 3" 
                  dot={false} 
                  
                />
                <Line 
                  type="monotone" 
                  dataKey="fixedRR" 
                  name={language === 'vi' ? `Chốt Cố Định ${customMfeRR}R (Đủ MFE)` : `Fixed ${customMfeRR}R (MFE Reached)`} 
                  stroke="#825249" 
                  strokeWidth={2} 
                  strokeDasharray="4 4" 
                  dot={false} 
                  
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* BẢNG BÓC TÁCH MFE & MAE CHI TIẾT TỪNG LỆNH (THEO DỮ LIỆU THẬT TỪ SUPABASE & MT5) */}
          <div className="pt-2 border-t border-[#e8e2da]/70 relative z-10 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                
                <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase font-sans">
                  {language === 'vi' ? 'Bảng Bóc Tách MFE & MAE Từng Lệnh' : 'Trade-by-Trade MFE & MAE Breakdown'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-[#ede7df] border border-[#d8d0c5] text-[#1d1b17]">
                  {mfeMaeData.tradeDetails.length} {language === 'vi' ? 'lệnh' : 'trades'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-[10px] font-mono text-[#737973]">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-xs bg-emerald-200 border border-emerald-400" />
                  <span>{language === 'vi' ? 'MFE thật từ EA' : 'Real EA MFE'}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-xs bg-[#d8d0c5] border border-[#737973]" />
                  <span>{language === 'vi' ? 'Mốc PnL đóng' : 'Closed Baseline'}</span>
                </span>
              </div>
            </div>

            {/* Bảng dạng cuộn chuẩn Tab History */}
            <div className="overflow-x-auto rounded-2xl border border-[var(--border-main)] bg-white shadow-xs max-h-80 overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs font-sans">
                <thead className="sticky top-0 bg-white border-b border-[var(--border-main)] text-[var(--text-muted)] text-[11px] uppercase font-medium tracking-wider z-20">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-12 font-medium">#</th>
                    <th className="py-2.5 px-2 text-left font-medium">{language === 'vi' ? 'Vé / Lệnh' : 'Ticket'}</th>
                    <th className="py-2.5 px-2 text-left font-medium">{language === 'vi' ? 'Cặp / Loại' : 'Symbol / Type'}</th>
                    <th className="py-2.5 px-2 text-right font-medium">{language === 'vi' ? 'Vào / SL' : 'Entry / SL'}</th>
                    <th className="py-2.5 px-2 text-right font-medium">{language === 'vi' ? 'Giá Đóng' : 'Close Price'}</th>
                    <th className="py-2.5 px-2 text-right font-medium">{language === 'vi' ? 'PnL Thực Nhận' : 'Realized PnL'}</th>
                    <th className="py-2.5 px-2 text-right font-medium">{language === 'vi' ? 'MFE Đỉnh ($ / R)' : 'MFE Peak ($ / R)'}</th>
                    <th className="py-2.5 px-2 text-right font-medium">{language === 'vi' ? 'MAE Đáy ($ / R)' : 'MAE Low ($ / R)'}</th>
                    <th className="py-2.5 px-3 text-right font-medium">{language === 'vi' ? 'Để Tuột Mất' : 'Left on Table'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] text-[var(--text-primary)] text-xs bg-white">
                  {mfeMaeData.tradeDetails.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-[var(--text-muted)] font-sans text-xs">
                        {language === 'vi' ? 'Không có dữ liệu lệnh đã đóng' : 'No closed trades recorded'}
                      </td>
                    </tr>
                  ) : (
                    mfeMaeData.tradeDetails.map((tr, idx) => {
                      const isWin = tr.net > 0;
                      const isLoss = tr.net < 0;
                      const isBuy = tr.type === 'BUY';

                      return (
                        <tr 
                          key={tr.ticket || idx} 
                          className="h-[44px] hover:bg-[var(--table-row-hover)] text-[var(--text-primary)] transition-colors"
                        >
                          {/* Index */}
                          <td className="py-2 px-3 text-center text-[var(--text-muted)] font-mono text-[11px]">
                            {idx + 1}
                          </td>

                          {/* Ticket */}
                          <td className="py-2 px-2 text-left font-mono font-medium text-xs text-[var(--text-primary)] truncate max-w-[90px]">
                            #{tr.ticket}
                          </td>

                          {/* Symbol & Type */}
                          <td className="py-2 px-2 text-left">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[var(--text-primary)] text-xs">{tr.symbol}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                isBuy 
                                  ? 'bg-[#4a6152]/10 text-[var(--color-win)] border-[#4a6152]/30' 
                                  : 'bg-[#825249]/10 text-[var(--color-loss)] border-[#825249]/30'
                              }`}>
                                {tr.type}
                              </span>
                              <span className="text-[10px] text-[var(--text-muted)] font-mono">{tr.volume}L</span>
                            </div>
                          </td>

                          {/* Entry / SL */}
                          <td className="py-2 px-2 text-right font-mono text-xs text-[var(--text-primary)]">
                            <div>{tr.openPrice > 0 ? tr.openPrice : '-'}</div>
                            <div className="text-[var(--text-muted)] text-[10px]">SL: {tr.initialSl > 0 ? tr.initialSl : 'None'}</div>
                          </td>

                          {/* Close Price */}
                          <td className="py-2 px-2 text-right font-mono text-xs text-[var(--text-primary)]">
                            {tr.closePrice > 0 ? tr.closePrice : '-'}
                          </td>

                          {/* Realized PnL */}
                          <td className="py-2 px-2 text-right font-mono font-medium text-xs">
                            <span className={isWin ? 'text-[#4a6152]' : isLoss ? 'text-[#825249]' : 'text-[var(--text-muted)]'}>
                              {tr.net >= 0 ? '+' : ''}${tr.net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <div className="text-[10px] text-[var(--text-muted)] font-normal">
                              {tr.risk1R > 0 ? `${(tr.net / tr.risk1R).toFixed(2)}R` : '-'}
                            </div>
                          </td>

                          {/* MFE ($ / R) & Giá đỉnh */}
                          <td className="py-2 px-2 text-right font-mono text-xs">
                            <div className="font-medium text-[var(--text-primary)]">
                              +${tr.mfeUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)]">
                              {tr.mfeR > 0 ? `+${tr.mfeR}R` : '-'}
                              {tr.mfeDist > 0 && (
                                <span className="text-[var(--text-muted)] ml-1">({tr.mfeDist} giá)</span>
                              )}
                            </div>
                          </td>

                          {/* MAE ($ / R) & Giá đáy */}
                          <td className="py-2 px-2 text-right font-mono text-xs">
                            <div className="font-medium text-[var(--text-primary)]">
                              -${tr.maeUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                            <div className="text-[10px] text-[var(--text-muted)]">
                              {tr.maeR > 0 ? `-${tr.maeR}R` : '-'}
                              {tr.maeDist > 0 && (
                                <span className="text-[var(--text-muted)] ml-1">({tr.maeDist} giá)</span>
                              )}
                            </div>
                          </td>

                          {/* Left on Table */}
                          <td className="py-2 px-3 text-right font-mono text-xs">
                            {tr.leftOnTable > 0.05 ? (
                              <span className="text-[#825249] bg-[#825249]/10 px-1.5 py-0.5 rounded border border-[#825249]/30 text-[10px] font-semibold">
                                -${tr.leftOnTable.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </span>
                            ) : (
                              <span className="text-[var(--text-muted)] text-[10px]">
                                {language === 'vi' ? 'Đỉnh Chốt' : 'Peak Exit'}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5.4.2 BẢNG THỐNG KÊ GIẢ LẬP CẮT LỆNH TỪNG PHẦN (SCALE-OUT TAKE-PROFIT) */}
      {(activeSection === 'ALL' || activeSection === 'PARTIAL_SCALE') && (
        <div className="bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] shadow-lg p-4 space-y-4 relative overflow-hidden">
          {/* Subtle violet/cyan backdrop glow */}
          

          {/* SUB-TABS: CHỌN MÔ-ĐUN DỊCH SL LIÊN TỤC VS CẮT TỪNG PHẦN THEO MỐC */}
          <div className="flex items-center gap-1.5 p-1 bg-[#ede7df] rounded-lg border border-[#e8e2da] w-fit relative z-10 flex-wrap">
            <button
              type="button"
              onClick={() => setScaleOutSubMode('CONTINUOUS_TRAILING')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-all cursor-pointer ${
                scaleOutSubMode === 'CONTINUOUS_TRAILING'
                  ? 'bg-white text-[#1d1b17] border border-[#d8d0c5] shadow-xs'
                  : 'text-[#737973] hover:text-[#4a6152] hover:bg-[#e8e2da]'
              }`}
            >
              <span>{language === 'vi' ? 'Dịch SL Liên Tục (Không TP Cố Định)' : 'Continuous Trailing SL (No Fixed TP)'}</span>
            </button>

            <button
              type="button"
              onClick={() => setScaleOutSubMode('TIERS')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-bold transition-all cursor-pointer ${
                scaleOutSubMode === 'TIERS'
                  ? 'bg-white text-[#1d1b17] border border-[#d8d0c5] shadow-xs'
                  : 'text-[#737973] hover:text-[#4a6152] hover:bg-[#e8e2da]'
              }`}
            >
              <span>{language === 'vi' ? 'Cắt Từng Phần Theo Mốc (Tiers)' : 'Scale-Out Tiers'}</span>
            </button>
          </div>

          {scaleOutSubMode === 'CONTINUOUS_TRAILING' ? (
            /* =========================================================================
               MÔ-ĐUN 1: DỊCH SL LIÊN TỤC KHÔNG CÓ TP CỐ ĐỊNH (RUNNER MODE)
               ========================================================================= */
            <div className="space-y-4 relative z-10">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[var(--border-main)] relative z-10 flex-wrap gap-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-[var(--text-primary)] text-xs tracking-wider uppercase font-sans">
                      {language === 'vi' 
                        ? 'Dịch SL Liên Tục Không TP Cố Định (Continuous Trailing Stop)' 
                        : 'Continuous Trailing SL Simulation'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border-main)]">
                      Step: {continuousTrailingData.stepR}R
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-main)]">
                      {continuousTrailingData.totalTrades} lệnh nến M5 thật
                    </span>
                    {continuousTrailingData.skippedTradesCount > 0 && (
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-main)]/60" title="Chỉ lấy lệnh đã có nến M5 từ MT5 để tính toán chuẩn xác">
                        (Bỏ qua {continuousTrailingData.skippedTradesCount} lệnh cũ chưa nạp nến)
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-0.5">
                    {language === 'vi' 
                      ? `Chiến lược thả rông TP: Kiểm toán 100% bằng từng cây nến M5 từ MT5. Cứ mỗi khi rướn thêm ${continuousTrailingData.stepR}R, SL nâng ${continuousTrailingData.stepR}R; râu nến giật ngược quét trúng SL là chốt ngay lập tức.` 
                      : `100% Real M5 Candle Simulation: Ratchets SL per ${continuousTrailingData.stepR}R excursion. Pullback wick triggers immediate exit.`}
                  </p>
                </div>

                <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
                  <span className="px-2.5 py-1 rounded bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-secondary)]">
                    {language === 'vi' ? 'Vốn ban đầu:' : 'Initial:'} <strong className="text-[var(--text-primary)]">${initialBalance.toLocaleString()}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-secondary)]">
                    {language === 'vi' ? 'Vốn giả lập:' : 'Simulated:'} <strong className="text-[var(--text-primary)]">${continuousTrailingData.finalSimulated.toLocaleString()}</strong>
                  </span>
                  <span className="px-2.5 py-1 rounded bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-secondary)]">
                    {language === 'vi' ? 'Chênh lệch vs Thực tế:' : 'Diff vs Actual:'}{' '}
                    <strong className={`font-bold ${continuousTrailingData.deltaTotal >= 0 ? 'text-[#4a6152]' : 'text-[#825249]'}`}>
                      {continuousTrailingData.deltaTotal >= 0 ? '+' : ''}${continuousTrailingData.deltaTotal.toLocaleString()}
                    </strong>
                  </span>
                </div>
              </div>

              {/* THANH ĐIỀU CHỈNH THÔNG SỐ: BƯỚC R DỊCH SL + KIỂU KHÓA SL */}
              <div className="p-3.5 bg-[var(--bg-card)] rounded-xl border border-[var(--border-main)] space-y-3">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  {/* Ô chỉnh Bước R (mặc định 1.5R, có thể thay đổi được) */}
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      {language === 'vi' ? 'Bước Lợi Nhuận Dịch SL (Step R):' : 'Trailing Step (R):'}
                    </span>

                    <div className="flex items-center gap-1 bg-[var(--bg-subtle)] p-0.5 rounded-lg border border-[var(--border-main)]">
                      <button
                        type="button"
                        onClick={() => setContinuousStepR(prev => Math.max(0.5, Number((prev - 0.5).toFixed(1))))}
                        className="w-6 h-6 rounded flex items-center justify-center bg-white hover:bg-[var(--bg-subtle)] text-[var(--text-primary)] font-bold cursor-pointer text-xs transition-colors shadow-xs"
                      >
                        -
                      </button>
                      <input
                        type="number"
                        step="0.1"
                        min="0.5"
                        max="10"
                        value={continuousStepR}
                        onChange={(e) => {
                          const v = parseFloat(e.target.value);
                          if (!isNaN(v) && v > 0) setContinuousStepR(v);
                        }}
                        className="w-14 px-1 py-0.5 text-xs font-mono font-bold bg-transparent text-[var(--text-primary)] text-center focus:outline-hidden"
                      />
                      <span className="text-xs font-mono text-[var(--text-muted)] mr-1">R</span>
                      <button
                        type="button"
                        onClick={() => setContinuousStepR(prev => Number((prev + 0.5).toFixed(1)))}
                        className="w-6 h-6 rounded flex items-center justify-center bg-white hover:bg-[var(--bg-subtle)] text-[var(--text-primary)] font-bold cursor-pointer text-xs transition-colors shadow-xs"
                      >
                        +
                      </button>
                    </div>

                    {/* Quick presets */}
                    <div className="flex items-center gap-1 flex-wrap">
                      {[1.0, 1.5, 2.0, 2.5, 3.0].map(val => (
                        <button
                          key={val}
                          type="button"
                          onClick={() => setContinuousStepR(val)}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono font-semibold transition-all cursor-pointer border ${
                            continuousStepR === val
                              ? 'bg-white text-[var(--text-primary)] font-bold border-[var(--border-main)] shadow-xs'
                              : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border-main)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {val === 1.5 ? '1.5R (Mặc định)' : `${val}R`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Kiểu Khóa SL */}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[11px] text-[var(--text-muted)]">
                      {language === 'vi' ? 'Kiểu khóa SL:' : 'Locking mode:'}
                    </span>
                    <div className="flex items-center bg-[var(--bg-subtle)] p-0.5 rounded-lg border border-[var(--border-main)] text-xs">
                      <button
                        type="button"
                        onClick={() => setContinuousTrailType('GAP')}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                          continuousTrailType === 'GAP'
                            ? 'bg-white text-[var(--text-primary)] font-bold shadow-xs'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                        title={language === 'vi' ? 'Đệm 1 nấc: Chạm 1.5R dịch lên BE (0R), chạm 3.0R dịch lên 1.5R...' : 'Trailing buffer: Reaching 1.5R moves SL to 0R BE, 3.0R to 1.5R'}
                      >
                        {language === 'vi' ? 'Đệm 1 nấc (Khuyên dùng)' : 'Buffer Step'}
                      </button>

                      <button
                        type="button"
                        onClick={() => setContinuousTrailType('DIRECT')}
                        className={`px-2.5 py-1 rounded text-[11px] font-semibold transition-all cursor-pointer ${
                          continuousTrailType === 'DIRECT'
                            ? 'bg-white text-[var(--text-primary)] font-bold shadow-xs'
                            : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                        }`}
                        title={language === 'vi' ? 'Khóa cùng nấc: Chạm 1.5R khóa 1.5R, chạm 3.0R khóa 3.0R...' : 'Direct step lock: Reaching 1.5R locks 1.5R'}
                      >
                        {language === 'vi' ? 'Khóa Cùng Nấc' : 'Direct Step'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Hướng dẫn cơ chế dịch SL */}
                <div className="p-2.5 rounded-xl bg-[var(--bg-subtle)]/60 border border-[var(--border-main)] text-[11px] text-[var(--text-secondary)] space-y-1">
                  <div className="flex items-center gap-1.5 text-[var(--text-secondary)] font-medium">
                    <span className="text-[var(--text-primary)] font-bold">Quy luật dịch SL:</span>
                    {continuousTrailType === 'GAP' ? (
                      <span>
                        Chạm <strong className="text-[var(--text-primary)]">+{continuousStepR}R</strong> $\rightarrow$ Dời SL về <strong className="text-[var(--text-primary)]">0.0R (BE Hòa Vốn)</strong> • 
                        Chạm <strong className="text-[var(--text-primary)]">+{(continuousStepR * 2).toFixed(1)}R</strong> $\rightarrow$ Dời SL lên <strong className="text-[var(--text-primary)]">+{continuousStepR}R</strong> • 
                        Chạm <strong className="text-[var(--text-primary)]">+{(continuousStepR * 3).toFixed(1)}R</strong> $\rightarrow$ Dời SL lên <strong className="text-[var(--text-primary)]">+{(continuousStepR * 2).toFixed(1)}R</strong>...
                      </span>
                    ) : (
                      <span>
                        Chạm <strong className="text-[var(--text-primary)]">+{continuousStepR}R</strong> $\rightarrow$ Khóa SL tại <strong className="text-[var(--text-primary)]">+{continuousStepR}R</strong> • 
                        Chạm <strong className="text-[var(--text-primary)]">+{(continuousStepR * 2).toFixed(1)}R</strong> $\rightarrow$ Khóa SL tại <strong className="text-[var(--text-primary)]">+{(continuousStepR * 2).toFixed(1)}R</strong>...
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 4 THẺ KPI TỔNG KẾT HIỆU QUẢ DỊCH SL LIÊN TỤC */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
                {/* Card 1: Vốn Giả Lập */}
                <div className="p-3 bg-[#ede7df] rounded-xl border border-[#d8d0c5] space-y-1">
                  <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wider">
                    {language === 'vi' ? 'Vốn Cuối (Dịch SL Liên Tục)' : 'Continuous Trailing Equity'}
                  </span>
                  <div className="text-lg font-bold font-mono text-[#1d1b17]">
                    ${continuousTrailingData.finalSimulated.toLocaleString()}
                  </div>
                  <p className={`text-[10px] font-semibold ${continuousTrailingData.deltaTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {continuousTrailingData.deltaTotal >= 0 ? '+' : ''}${continuousTrailingData.deltaTotal.toLocaleString()} {language === 'vi' ? 'so với thực tế' : 'vs actual'}
                  </p>
                </div>

                {/* Card 2: Winrate & Trạng thái */}
                <div className="p-3 bg-[#ede7df] rounded-xl border border-[#d8d0c5] space-y-1">
                  <span className="text-[10px] font-bold text-[#1d1b17] uppercase tracking-wider">
                    {language === 'vi' ? 'Tỷ Lệ Lệnh Có Lãi (Winrate)' : 'Simulated Winrate'}
                  </span>
                  <div className="text-lg font-bold font-mono text-[#1d1b17]">
                    {continuousTrailingData.winRate}%
                  </div>
                  <p className="text-[10px] text-[#737973]">
                    {continuousTrailingData.winCount} {language === 'vi' ? 'thắng' : 'wins'} • {continuousTrailingData.beCount} BE • {continuousTrailingData.lossCount} {language === 'vi' ? 'thua' : 'losses'}
                  </p>
                </div>

                {/* Card 3: Lệnh Gồng Sóng Lớn (Runners) */}
                <div className="p-3 bg-[#ede7df] rounded-xl border border-[#d8d0c5] space-y-1">
                  <span className="text-[10px] font-bold text-[#1d1b17] uppercase tracking-wider">
                    {language === 'vi' ? 'Lệnh Gồng Sóng Lớn (≥ 3R)' : 'Big Runners (≥ 3R)'}
                  </span>
                  <div className="text-lg font-bold font-mono text-[#1d1b17]">
                    {continuousTrailingData.runnerCount} {language === 'vi' ? 'lệnh' : 'trades'}
                  </div>
                  <p className="text-[10px] text-[#737973]">
                    {language === 'vi' ? 'Lệnh ăn R cao nhất:' : 'Max captured R:'} <strong className="text-emerald-400">+{continuousTrailingData.maxRunnerR.toFixed(1)}R</strong>
                  </p>
                </div>

                {/* Card 4: Cải Thiện & PnL Trung Bình */}
                <div className="p-3 bg-[#ede7df] rounded-xl border border-[#d8d0c5] space-y-1">
                  <span className="text-[10px] font-bold text-[#1d1b17] uppercase tracking-wider">
                    {language === 'vi' ? 'Cải Thiện So Với Thực Tế' : 'Improved vs Actual'}
                  </span>
                  <div className="text-lg font-bold font-mono text-[#1d1b17]">
                    {continuousTrailingData.betterCount} {language === 'vi' ? 'lệnh ăn dày hơn' : 'trades improved'}
                  </div>
                  <p className={`text-[10px] font-semibold ${continuousTrailingData.avgSimPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    PnL TB: {continuousTrailingData.avgSimPnl >= 0 ? '+' : ''}${continuousTrailingData.avgSimPnl.toLocaleString()}/lệnh
                  </p>
                </div>
              </div>

              {/* BIỂU ĐỒ SO SÁNH ĐƯỜNG CONG VỐN */}
              <div className="h-64 w-full pt-1 relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={continuousTrailingData.curveData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2dbd0" strokeOpacity={0.6} vertical={false} />
                    <XAxis dataKey="trade" stroke="#737973" tick={{ fontSize: 10 }} />
                    <YAxis 
                      stroke="#737973" 
                      tick={{ fontSize: 10 }} 
                      domain={['auto', 'auto']}
                      tickFormatter={(val: number) => `$${(val / 1000).toFixed(0)}k`}
                    />
                    <Tooltip content={<CustomChartTooltip language={language} />} />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                    <Line 
                      type="monotone" 
                      dataKey="actual" 
                      name={language === 'vi' ? 'Thực Tế' : 'Actual'} 
                      stroke="#737973" 
                      strokeWidth={2} 
                      dot={false} 
                      strokeDasharray="4 2"
                    />
                    <Line 
                      type="monotone" 
                      dataKey="simulated" 
                      name={language === 'vi' ? `Dịch SL Mỗi ${continuousTrailingData.stepR}R (Không TP)` : `Continuous Trailing ${continuousTrailingData.stepR}R`} 
                      stroke="#4a6152" 
                      strokeWidth={2.5} 
                      dot={false} 
                      
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* BẢNG THỐNG KÊ CHI TIẾT TỪNG LỆNH DỊCH SL */}
              <div className="pt-2 border-t border-[#e8e2da]/70 relative z-10 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    
                    <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase font-sans">
                      {language === 'vi' ? 'Bảng Thống Kê Chi Tiết Từng Lệnh' : 'Trade-by-Trade Trailing SL Breakdown'}
                    </span>
                    <span className="text-[11px] font-mono text-[#737973]">
                      ({filteredContinuousTrades.length} {language === 'vi' ? 'lệnh' : 'trades'})
                    </span>
                  </div>

                  {/* Bộ lọc & Tìm kiếm */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Search */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      <input
                        type="text"
                        value={continuousSearchQuery}
                        onChange={(e) => {
                          setContinuousSearchQuery(e.target.value);
                          setContinuousPage(1);
                        }}
                        placeholder={language === 'vi' ? 'Tìm Symbol, Ticket...' : 'Search Symbol, Ticket...'}
                        className="pl-8 pr-3 py-1.5 text-xs font-mono bg-[var(--bg-subtle)] border border-[var(--border-main)] rounded-full text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-hidden focus:border-[#1d1b17] w-40 sm:w-48"
                      />
                    </div>

                    {/* Filter status */}
                    <div className="flex items-center gap-0.5 bg-[var(--bg-subtle)] p-0.5 rounded-full border border-[var(--border-main)] text-[11px] font-sans">
                      {[
                        { id: 'ALL', label: language === 'vi' ? 'Tất cả' : 'All' },
                        { id: 'WIN', label: language === 'vi' ? 'Lãi' : 'Win' },
                        { id: 'BE', label: 'BE' },
                        { id: 'LOSS', label: language === 'vi' ? 'Lỗ' : 'Loss' },
                        { id: 'BETTER_THAN_ACTUAL', label: language === 'vi' ? 'Ăn đậm hơn' : 'Improved' },
                        { id: 'RUNNER', label: language === 'vi' ? 'Runner ≥ 3R' : 'Runner' },
                      ].map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            setContinuousFilterStatus(f.id as any);
                            setContinuousPage(1);
                          }}
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                            continuousFilterStatus === f.id
                              ? 'clay-pill bg-white text-[var(--text-primary)] font-bold shadow-xs'
                              : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                          }`}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Table: CHUẨN TRẮNG SÁNG NHƯ TAB HISTORY */}
                <div className="overflow-x-auto border border-[var(--border-main)] rounded-2xl bg-white shadow-xs">
                  <table className="w-full text-left text-xs font-sans border-collapse">
                    <thead className="sticky top-0 bg-white text-[var(--text-muted)] uppercase text-[11px] font-medium tracking-wider border-b border-[var(--border-main)] z-10">
                      <tr>
                        <th className="py-3 px-3">Lệnh / Cặp</th>
                        <th className="py-3 px-2 text-center">Loại / Lot</th>
                        <th className="py-3 px-2 text-right">Đỉnh MFE Thật</th>
                        <th className="py-3 px-2 text-center">Nấc Đã Vượt</th>
                        <th className="py-3 px-2 text-right">Mức SL Khóa</th>
                        <th className="py-3 px-2 text-right">PnL Dịch SL</th>
                        <th className="py-3 px-2 text-right">PnL Thực Tế</th>
                        <th className="py-3 px-3 text-right">Chênh Lệch</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)] text-xs bg-white">
                      {paginatedContinuousTrades.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-12 text-center text-[var(--text-muted)] font-sans text-xs">
                            {language === 'vi' ? 'Không có lệnh nào phù hợp bộ lọc' : 'No trades match filter'}
                          </td>
                        </tr>
                      ) : (
                        paginatedContinuousTrades.map((tr) => {
                          const isBetter = tr.delta > 5;
                          const isWorse = tr.delta < -5;
                          const isActualWin = tr.net > 5;
                          const isActualLoss = tr.net < -5;
                          const isSimWin = tr.simPnl > 5;
                          const isSimLoss = tr.simPnl < -5;

                          return (
                            <tr key={tr.tradeId} className="h-[44px] hover:bg-[var(--table-row-hover)] text-[var(--text-primary)] transition-colors">
                              {/* Ticket & Symbol */}
                              <td className="py-2.5 px-3 font-mono">
                                <div className="font-bold text-[var(--text-primary)] text-xs">#{tr.ticket}</div>
                                <div className="text-[11px] text-[var(--text-muted)] font-normal">{tr.symbol}</div>
                              </td>

                              {/* Loại & Volume */}
                              <td className="py-2.5 px-2 text-center font-mono">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${
                                  tr.type === 'BUY'
                                    ? 'bg-[#4a6152]/10 text-[var(--color-win)] border-[#4a6152]/30'
                                    : 'bg-[#825249]/10 text-[var(--color-loss)] border-[#825249]/30'
                                }`}>
                                  {tr.type}
                                </span>
                                <div className="text-[10px] text-[var(--text-muted)] mt-0.5">{tr.volume}L</div>
                              </td>

                              {/* Đỉnh MFE Thật */}
                              <td className="py-2.5 px-2 text-right font-mono font-medium text-xs text-[var(--color-win)]">
                                <div>+{tr.effectiveMaxR.toFixed(2)}R</div>
                                {tr.candlesCount > 0 && (
                                  <div className="text-[10px] text-[var(--text-muted)] font-normal">
                                    {tr.candlesCount} nến M5
                                  </div>
                                )}
                              </td>

                              {/* Nấc Đã Vượt */}
                              <td className="py-2.5 px-2 text-center font-mono">
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-[var(--bg-subtle)] text-[var(--text-primary)] border border-[var(--border-main)]">
                                  {tr.stepCount} nấc
                                </span>
                                {tr.candlesCount > 0 && (
                                  <div className="text-[10px] mt-0.5 font-sans">
                                    {tr.stoppedByTrail ? (
                                      <span className="text-[var(--text-primary)] font-medium" title="Râu nến M5 giật ngược cắn trúng mức SL đã dời">
                                        Quét râu SL
                                      </span>
                                    ) : (
                                      <span className="text-[var(--text-muted)]">
                                        Gồng hết nến
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>

                              {/* Mức SL Khóa */}
                              <td className="py-2.5 px-2 text-right font-mono text-xs">
                                <span className={tr.lockedSlR > 0 ? 'text-[var(--color-win)] font-medium' : tr.lockedSlR === 0 ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-muted)]'}>
                                  {tr.lockedSlR >= 0 ? `+${tr.lockedSlR.toFixed(2)}R` : 'Gốc (-1R)'}
                                </span>
                              </td>

                              {/* PnL Dịch SL */}
                              <td className="py-2.5 px-2 text-right font-mono text-xs">
                                <span className={isSimWin ? 'text-[var(--color-win)] font-medium' : isSimLoss ? 'text-[var(--color-loss)] font-medium' : 'text-[var(--text-muted)]'}>
                                  {tr.simPnl >= 0 ? '+' : ''}${tr.simPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <div className="text-[10px] text-[var(--text-muted)] font-normal">
                                  {tr.simR >= 0 ? `+${tr.simR.toFixed(2)}R` : `${tr.simR.toFixed(2)}R`}
                                </div>
                              </td>

                              {/* PnL Thực Tế */}
                              <td className="py-2.5 px-2 text-right font-mono text-xs">
                                <span className={isActualWin ? 'text-[var(--color-win)] font-medium' : isActualLoss ? 'text-[var(--color-loss)] font-medium' : 'text-[var(--text-muted)]'}>
                                  {tr.net >= 0 ? '+' : ''}${tr.net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                                <div className="text-[10px] text-[var(--text-muted)] font-normal">
                                  {tr.risk1R > 0 ? `${(tr.net / tr.risk1R).toFixed(2)}R` : '-'}
                                </div>
                              </td>

                              {/* Chênh Lệch */}
                              <td className="py-2.5 px-3 text-right font-mono font-medium text-xs">
                                <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                                  isBetter
                                    ? 'bg-[#4a6152]/10 text-[var(--color-win)] border-[#4a6152]/30 font-semibold'
                                    : isWorse
                                    ? 'bg-[#825249]/10 text-[var(--color-loss)] border-[#825249]/30 font-semibold'
                                    : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-main)]'
                                }`}>
                                  {tr.delta >= 0 ? '+' : ''}${tr.delta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Phân trang Dịch SL */}
                <div className="px-4 py-2 bg-[var(--bg-card)] border-t border-[var(--border-main)] flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-[#1d1b17] font-mono">
                      Showing {filteredContinuousTrades.length === 0 ? 0 : (safeContinuousPage - 1) * effectiveContinuousPageSize + 1}-{Math.min(safeContinuousPage * effectiveContinuousPageSize, filteredContinuousTrades.length)} of {filteredContinuousTrades.length} orders
                    </span>

                    <div className="hidden sm:flex items-center gap-1 text-xs ml-2">
                      <span className="text-[#1d1b17] font-medium text-[11px]">Page size:</span>
                      {[5, 10, 20, 50].map((sz) => (
                        <button
                          key={sz}
                          type="button"
                          onClick={() => {
                            setContinuousPageSize(sz);
                            setContinuousPage(1);
                          }}
                          className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                            continuousPageSize === sz
                              ? 'bg-[#e8e2da] text-[#1d1b17] font-bold border border-[#d8d0c5]'
                              : 'text-[var(--text-muted)] hover:text-[#1d1b17] hover:bg-[#e8e2da]'
                          }`}
                        >
                          {sz}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setContinuousPageSize(0);
                          setContinuousPage(1);
                        }}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                          continuousPageSize === 0
                            ? 'bg-[#e8e2da] text-[#1d1b17] font-bold border border-[#d8d0c5]'
                            : 'text-[var(--text-muted)] hover:text-[#1d1b17] hover:bg-[#e8e2da]'
                        }`}
                      >
                        {language === 'vi' ? 'Tất cả' : 'All'}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 font-mono text-[11px]">
                    <button
                      type="button"
                      disabled={safeContinuousPage <= 1}
                      onClick={() => setContinuousPage(p => Math.max(1, p - 1))}
                      className="w-5 h-5 rounded flex items-center justify-center bg-[#ede7df] hover:bg-[#e8e2da] text-[#737973] hover:text-[#1d1b17] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors text-[10px] border border-[#d8d0c5]"
                    >
                      &lt;
                    </button>

                    {continuousPaginationNumbers.map((pNum, idx) => {
                      if (pNum === -1) {
                        return <span key={`c-ellipsis-${idx}`} className="w-3 text-center text-[#737973] text-[10px]">...</span>;
                      }
                      const isCur = pNum === safeContinuousPage;
                      return (
                        <button
                          key={pNum}
                          type="button"
                          onClick={() => setContinuousPage(pNum)}
                          className={`w-5 h-5 rounded flex items-center justify-center font-medium text-[10px] transition-colors cursor-pointer ${
                            isCur
                              ? 'bg-[#e8e2da] text-[#1d1b17] font-bold border border-[#d8d0c5]'
                              : 'hover:bg-[#e8e2da] text-[#737973] hover:text-[#1d1b17]'
                          }`}
                        >
                          {pNum}
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      disabled={safeContinuousPage >= totalContinuousPages}
                      onClick={() => setContinuousPage(p => Math.min(totalContinuousPages, p + 1))}
                      className="w-5 h-5 rounded flex items-center justify-center bg-[#ede7df] hover:bg-[#e8e2da] text-[#737973] hover:text-[#1d1b17] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors text-[10px] border border-[#d8d0c5]"
                    >
                      &gt;
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* =========================================================================
               MÔ-ĐUN 2: CẮT TỪNG PHẦN THEO MỐC CỐ ĐỊNH (TIERS SCALE-OUT)
               ========================================================================= */
            <div className="space-y-4 relative z-10">
              {/* Header */}
              <div className="flex items-center justify-between pb-3 border-b border-[#e8e2da] relative z-10 flex-wrap gap-2.5">
                <div>
                  <div className="flex items-center gap-2">
                    
                    <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase font-sans flex items-center gap-1.5">
                      <Scissors className="w-3.5 h-3.5 text-[#1d1b17]" />
                      {language === 'vi' 
                        ? 'Thống Kê Giả Lập Cắt Lệnh Từng Phần (Scale-Out Take-Profit)' 
                        : 'Scale-Out Take-Profit Simulation Breakdown'}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#737973] mt-0.5">
                    {language === 'vi' 
                      ? '🎯 ĐỐI CHIẾU MFE THẬT 100%: Từng mốc TP chỉ được chốt lời khi Đỉnh MFE thật của lệnh ≥ Mốc R đó (Ví dụ: MFE ≥ 2R mới ăn 2R, MFE ≥ 4R mới ăn 4R). Nếu MFE trượt, phần đó dời BE hoặc cắn SL.' 
                      : '🎯 100% Real MFE Verification: Each tier is ONLY captured if trade peak MFE ≥ target R. Otherwise, remaining portion follows BE/SL discipline.'}
                  </p>
                </div>

            <div className="flex items-center gap-2 text-xs font-mono flex-wrap">
              <span className="px-2.5 py-1 rounded bg-[#ede7df] border border-[#e8e2da] text-[#424843]">
                {language === 'vi' ? 'Vốn ban đầu:' : 'Initial:'} <strong className="text-[#1d1b17]">${initialBalance.toLocaleString()}</strong>
              </span>
              <span className="px-2.5 py-1 rounded bg-[#ede7df] border border-[#d8d0c5] text-[#1d1b17]">
                {language === 'vi' ? 'Vốn giả lập:' : 'Simulated:'} <strong className="text-[#1d1b17]">${partialScaleData.finalSimulated.toLocaleString()}</strong>
              </span>
              <span className={`px-2.5 py-1 rounded border ${
                partialScaleData.deltaTotal >= 0 
                  ? 'bg-[#e8e2da] border-[#d8d0c5] text-[#4a6152]' 
                  : 'bg-[#e8e2da] border-[#d8d0c5] text-[#825249]'
              }`}>
                {language === 'vi' ? 'Chênh lệch vs Thực tế:' : 'Diff vs Actual:'}{' '}
                <strong className="font-bold">
                  {partialScaleData.deltaTotal >= 0 ? '+' : ''}${partialScaleData.deltaTotal.toLocaleString()}
                </strong>
              </span>
            </div>
          </div>

          {/* THANH ĐIỀU KHIỂN CHIẾN LƯỢC: PRESET + TÙY CHỈNH TỪNG MỐC + CHẾ ĐỘ PHẦN CÒN LẠI */}
          <div className="space-y-3 relative z-10">
            {/* Hàng chọn Preset nhanh */}
            <div className="flex items-center gap-2 flex-wrap text-xs">
              <span className="text-[#737973] font-mono font-bold text-[11px] flex items-center gap-1">
                {language === 'vi' ? 'Chiến lược mẫu:' : 'Presets:'}
              </span>
              <div className="flex items-center gap-1.5 flex-wrap">
                {PARTIAL_SCALE_PRESETS.map((preset) => {
                  const isMatch = preset.tiers.length === partialScaleTiers.length &&
                    preset.tiers.every((t, i) => t.targetR === partialScaleTiers[i]?.targetR && t.portionFraction === partialScaleTiers[i]?.portionFraction);
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => {
                        setPartialScaleTiers(preset.tiers.map((t, idx) => ({ ...t, id: String(idx + 1) })));
                        setPartialPage(1);
                      }}
                      className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all cursor-pointer border ${
                        isMatch
                          ? 'bg-white text-[#1d1b17] border-[#d8d0c5] shadow-xs'
                          : 'bg-[#ede7df] text-[#424843] border-[#e8e2da] hover:border-[#d8d0c5] hover:text-[#4a6152]'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Bảng Tùy chỉnh chi tiết từng mốc (Tiers Editor) */}
            <div className="p-3 bg-[#ede7df] rounded-xl border border-[#e8e2da] space-y-2.5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-[#1d1b17]">
                  {language === 'vi' ? 'Tùy Chỉnh Các Mốc Chốt Lời (Tiers):' : 'Customize Take-Profit Tiers:'}
                </span>
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded border ${
                    Math.abs(partialScaleData.rawTotalRatioPercent - 100) < 0.5
                      ? 'bg-[#e8e2da] text-[#4a6152] border-[#d8d0c5]'
                      : 'bg-[#ede7df] text-[#1d1b17] border-[#d8d0c5]'
                  }`}>
                    {language === 'vi' ? 'Tổng Khối Lượng:' : 'Total Volume:'} {partialScaleData.rawTotalRatioPercent}%
                    {Math.abs(partialScaleData.rawTotalRatioPercent - 100) >= 0.5 && (
                      <span className="ml-1 text-[10px] text-[#1d1b17] font-normal">
                        ({language === 'vi' ? 'tự động quy đổi đủ 100%' : 'auto normalized to 100%'})
                      </span>
                    )}
                  </span>
                  {partialScaleTiers.length < 5 && (
                    <button
                      type="button"
                      onClick={() => {
                        const nextId = String(Date.now());
                        const lastTarget = partialScaleTiers[partialScaleTiers.length - 1]?.targetR || 2.0;
                        setPartialScaleTiers([
                          ...partialScaleTiers,
                          { 
                            id: nextId, 
                            portionFraction: '1/3', 
                            portionRatio: 1 / 3, 
                            targetR: lastTarget + 2.0,
                            trailStopR: lastTarget
                          }
                        ]);
                      }}
                      className="flex items-center gap-1 px-2.5 py-0.5 rounded text-[11px] font-semibold bg-[#21262d] text-[#1d1b17] hover:text-[#1d1b17] border border-[#e8e2da] hover:border-sky-500 cursor-pointer transition-all"
                    >
                      <Plus className="w-3 h-3" />
                      {language === 'vi' ? 'Thêm Mốc' : 'Add Tier'}
                    </button>
                  )}
                </div>
              </div>

              {/* Danh sách các thẻ mốc TP */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
                {partialScaleTiers.map((tier, idx) => (
                  <div key={tier.id} className="p-2.5 rounded-lg bg-white border border-[#d8d0c5] space-y-1.5 relative group">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-[#1d1b17] font-mono">
                        {language === 'vi' ? `Mốc TP${idx + 1}` : `TP${idx + 1}`}
                      </span>
                      {partialScaleTiers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => {
                            setPartialScaleTiers(partialScaleTiers.filter(t => t.id !== tier.id));
                          }}
                          className="text-[#737973] hover:text-rose-400 p-0.5 rounded cursor-pointer transition-colors"
                          title={language === 'vi' ? 'Xóa mốc này' : 'Remove tier'}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <label className="text-[10px] text-[#737973] block mb-0.5">
                          {language === 'vi' ? 'Tỷ lệ chốt' : 'Portion'}
                        </label>
                        <input
                          type="text"
                          value={tier.portionFraction}
                          onChange={(e) => {
                            const frac = e.target.value;
                            const ratio = parsePortionRatio(frac);
                            setPartialScaleTiers(partialScaleTiers.map(t => 
                              t.id === tier.id ? { ...t, portionFraction: frac, portionRatio: ratio } : t
                            ));
                          }}
                          className="w-full px-2 py-1 text-xs font-mono font-bold bg-[#ede7df] border border-[#d8d0c5] rounded text-[#1d1b17] text-center focus:outline-hidden focus:border-[#4a6152]"
                          placeholder="1/3, 50%..."
                        />
                      </div>

                      <div>
                        <label className="text-[10px] text-[#737973] block mb-0.5">
                          {language === 'vi' ? 'Mục tiêu R' : 'Target R'}
                        </label>
                        <div className="flex items-center">
                          <input
                            type="number"
                            step="0.5"
                            min="0.5"
                            max="20"
                            value={tier.targetR}
                            onChange={(e) => {
                              const r = parseFloat(e.target.value);
                              if (!isNaN(r) && r > 0) {
                                setPartialScaleTiers(partialScaleTiers.map(t => 
                                  t.id === tier.id ? { ...t, targetR: r } : t
                                ));
                              }
                            }}
                            className="w-full px-2 py-1 text-xs font-mono font-bold bg-[#ede7df] border border-[#d8d0c5] rounded text-[#1d1b17] text-center focus:outline-hidden focus:border-[#4a6152]"
                          />
                          <span className="text-xs font-mono text-[#737973] ml-1">R</span>
                        </div>
                      </div>
                    </div>

                    {/* Dòng tùy chỉnh Dịch SL khi mốc này đạt */}
                    <div className="pt-1.5 border-t border-[#e8e2da]/60 flex items-center justify-between">
                      <label className="text-[10px] text-[#1d1b17] font-medium flex items-center gap-1" title={language === 'vi' ? 'Khi mốc này đạt TP, dời SL bảo vệ các phần còn lại lên mốc này' : 'When reached, trail SL of remaining tiers to:'}>
                        <span>🛡️ {language === 'vi' ? 'Dịch SL lên:' : 'Trail SL to:'}</span>
                      </label>
                      <div className="flex items-center w-20">
                        <input
                          type="number"
                          step="0.5"
                          min="-1"
                          max="20"
                          value={tier.trailStopR ?? 0}
                          onChange={(e) => {
                            const trVal = parseFloat(e.target.value);
                            if (!isNaN(trVal)) {
                              setPartialScaleTiers(partialScaleTiers.map(t => 
                                t.id === tier.id ? { ...t, trailStopR: trVal } : t
                              ));
                            }
                          }}
                          className="w-full px-1.5 py-0.5 text-xs font-mono font-bold bg-[#ede7df] border border-[#d8d0c5] rounded text-[#1d1b17] text-center focus:outline-hidden focus:border-[#4a6152]"
                        />
                        <span className="text-xs font-mono text-[#737973] ml-1">R</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Hàng chọn Chế độ xử lý phần còn lại sau khi TP1 đạt */}
              <div className="pt-2 border-t border-[#e8e2da]/60 flex items-center justify-between flex-wrap gap-2 text-xs">
                <span className="text-[#737973] flex items-center gap-1.5">
                  <HelpCircle className="w-3.5 h-3.5 text-[#1d1b17]" />
                  {language === 'vi' 
                    ? 'Xử lý phần còn lại (nếu chưa chạm các TP sau):' 
                    : 'Remaining volume handling (if next TPs not reached):'}
                </span>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {[
                    { id: 'BE', label: language === 'vi' ? '🛡️ Dời SL về Hòa Vốn (BE $0) [Khuyên dùng]' : '🛡️ Move SL to BE ($0)' },
                    { id: 'SL', label: language === 'vi' ? '⛔ Giữ SL gốc (-1R)' : '⛔ Keep Initial SL (-1R)' },
                    { id: 'ACTUAL', label: language === 'vi' ? '📊 Theo kết quả thực tế' : '📊 Use Actual Exit' }
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setPartialRemainingMode(opt.id as any)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all cursor-pointer border ${
                        partialRemainingMode === opt.id
                          ? 'bg-[#e8e2da] text-[#1d1b17] border-[#d8d0c5] font-bold shadow-xs'
                          : 'bg-white text-[var(--text-muted)] border-[#d8d0c5] hover:text-[#1d1b17] hover:bg-[#e8e2da]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* 4 THẺ KPI TỔNG KẾT HIỆU QUẢ CẮT LỆNH TỪNG PHẦN */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 relative z-10">
            {/* Card 1: Vốn Giả Lập */}
            <div className="p-3 bg-[#ede7df] rounded-xl border border-[#d8d0c5] space-y-1">
              <span className="text-[10px] font-bold text-[#1d1b17] uppercase tracking-wider">
                {language === 'vi' ? 'Vốn Cuối (Cắt Từng Phần)' : 'Scale-Out Equity'}
              </span>
              <div className="text-lg font-bold font-mono text-[#1d1b17]">
                ${partialScaleData.finalSimulated.toLocaleString()}
              </div>
              <p className={`text-[10px] font-semibold ${partialScaleData.deltaTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {partialScaleData.deltaTotal >= 0 ? '+' : ''}${partialScaleData.deltaTotal.toLocaleString()} {language === 'vi' ? 'so với thực tế' : 'vs actual'}
              </p>
            </div>

            {/* Card 2: Winrate */}
            <div className="p-3 bg-[#ede7df] rounded-xl border border-[#d8d0c5] space-y-1">
              <span className="text-[10px] font-bold text-[var(--text-primary)] uppercase tracking-wider">
                {language === 'vi' ? 'Tỷ Lệ Lệnh Có Lãi (Winrate)' : 'Simulated Winrate'}
              </span>
              <div className="text-lg font-bold font-mono text-emerald-400">
                {partialScaleData.winRate}%
              </div>
              <p className="text-[10px] text-[#737973]">
                {partialScaleData.winCount} {language === 'vi' ? 'thắng' : 'wins'} • {partialScaleData.beCount} BE • {partialScaleData.lossCount} {language === 'vi' ? 'thua' : 'losses'}
              </p>
            </div>

            {/* Card 3: Tỷ Lệ Chạm Từng Mốc TP */}
            <div className="p-3 bg-[#ede7df] rounded-xl border border-[#d8d0c5] space-y-1">
              <span className="text-[10px] font-bold text-[#1d1b17] uppercase tracking-wider">
                {language === 'vi' ? 'Tỷ Lệ Đạt Từng Mốc TP' : 'Tier Hit Rates'}
              </span>
              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                {partialScaleData.sortedTiers.map((t, idx) => {
                  const hits = partialScaleData.tierHitCounts[t.id] || 0;
                  const pct = partialScaleData.totalTrades > 0 ? ((hits / partialScaleData.totalTrades) * 100).toFixed(0) : '0';
                  return (
                    <span key={t.id} className="text-[11px] font-mono bg-white px-2 py-0.5 rounded border border-[#d8d0c5] text-[#1d1b17]">
                      TP{idx + 1}({t.targetR}R): <strong>{pct}%</strong>
                    </span>
                  );
                })}
              </div>
              <p className="text-[10px] text-[#737973]">
                {language === 'vi' ? 'Dựa trên đỉnh MFE thật của lệnh' : 'Based on real trade peak MFE'}
              </p>
            </div>

            {/* Card 4: Lợi Nhuận TB / Lệnh */}
            <div className="p-3 bg-[#ede7df] rounded-xl border border-[#d8d0c5] space-y-1">
              <span className="text-[10px] font-bold text-[#1d1b17] uppercase tracking-wider">
                {language === 'vi' ? 'PnL Trung Bình / Lệnh' : 'Avg PnL / Trade'}
              </span>
              <div className={`text-lg font-bold font-mono ${partialScaleData.avgSimPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {partialScaleData.avgSimPnl >= 0 ? '+' : ''}${partialScaleData.avgSimPnl.toLocaleString()}
              </div>
              <p className="text-[10px] text-[#737973]">
                {language === 'vi' ? `${partialScaleData.betterCount} lệnh ăn nhiều hơn thực tế` : `${partialScaleData.betterCount} trades improved`}
              </p>
            </div>
          </div>

          {/* BIỂU ĐỒ SO SÁNH ĐƯỜNG CONG VỐN: THỰC TẾ VS CẮT TỪNG PHẦN */}
          <div className="h-64 w-full pt-1 relative z-10">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={partialScaleData.curveData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2dbd0" strokeOpacity={0.6} vertical={false} />
                <XAxis dataKey="trade" stroke="#737973" tick={{ fontSize: 10 }} />
                <YAxis 
                  stroke="#737973" 
                  tick={{ fontSize: 10 }} 
                  domain={['auto', 'auto']}
                  tickFormatter={(val: number) => `$${(val / 1000).toFixed(0)}k`}
                />
                <Tooltip content={<CustomChartTooltip language={language} />} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '6px' }} />
                <Line 
                  type="monotone" 
                  dataKey="actual" 
                  name={language === 'vi' ? 'Thực Tế' : 'Actual'} 
                  stroke="#4a6152" 
                  strokeWidth={2.5} 
                  dot={false} 
                  
                />
                <Line 
                  type="monotone" 
                  dataKey="simulated" 
                  name={language === 'vi' ? 'Cắt Lệnh Từng Phần' : 'Scale-Out Take Profit'} 
                  stroke="#825249" 
                  strokeWidth={2.5} 
                  strokeDasharray="4 2" 
                  dot={false} 
                  
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* BẢNG THỐNG KÊ CHI TIẾT TỪNG LỆNH CẮT THEO MỐC */}
          <div className="pt-2 border-t border-[#e8e2da]/70 relative z-10 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                
                <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase font-sans">
                  {language === 'vi' ? 'Bảng Thống Kê Chi Tiết Từng Lệnh' : 'Trade-by-Trade Scale-Out Breakdown'}
                </span>
                <span className="text-[11px] font-mono text-[#737973]">
                  ({filteredPartialTrades.length} {language === 'vi' ? 'lệnh' : 'trades'})
                </span>
              </div>

              {/* Bộ lọc & Tìm kiếm */}
              <div className="flex items-center gap-2 flex-wrap">
                {/* Search */}
                <div className="relative">
                  <Search className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#737973]" />
                  <input
                    type="text"
                    value={partialSearchQuery}
                    onChange={(e) => {
                      setPartialSearchQuery(e.target.value);
                      setPartialPage(1);
                    }}
                    placeholder={language === 'vi' ? 'Tìm Symbol, Ticket...' : 'Search Symbol, Ticket...'}
                    className="pl-7 pr-2.5 py-1 text-[11px] font-mono bg-white border border-[#d8d0c5] rounded-lg text-[#1d1b17] placeholder:text-[#737973] focus:outline-hidden focus:border-[#4a6152] w-36 sm:w-44"
                  />
                </div>

                {/* Status Filter */}
                <select
                  value={partialFilterStatus}
                  onChange={(e) => {
                    setPartialFilterStatus(e.target.value as any);
                    setPartialPage(1);
                  }}
                  className="px-2.5 py-1.5 text-xs font-sans bg-[var(--bg-subtle)] border border-[var(--border-main)] rounded-full text-[var(--text-primary)] focus:outline-hidden focus:border-[#1d1b17] cursor-pointer"
                >
                  <option value="ALL">{language === 'vi' ? 'Tất cả trạng thái' : 'All Outcomes'}</option>
                  <option value="WIN">{language === 'vi' ? 'Lệnh có lãi (> 0$)' : 'Winning Trades'}</option>
                  <option value="BE">{language === 'vi' ? 'Hòa vốn (~ 0$)' : 'Break-Even Trades'}</option>
                  <option value="LOSS">{language === 'vi' ? 'Lệnh thua (< 0$)' : 'Losing Trades'}</option>
                  <option value="BETTER_THAN_ACTUAL">{language === 'vi' ? 'Ăn nhiều hơn Thực Tế' : 'Better than Actual'}</option>
                </select>
              </div>
            </div>

            {/* Bảng dữ liệu chuẩn Tab History */}
            <div className="overflow-x-auto rounded-2xl border border-[var(--border-main)] bg-white shadow-xs max-h-[460px] overflow-y-auto">
              <table className="w-full text-xs text-left border-collapse font-sans">
                <thead className="sticky top-0 bg-white text-[var(--text-muted)] font-medium text-[11px] uppercase tracking-wider z-20 border-b border-[var(--border-main)]">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10">#</th>
                    <th className="py-2.5 px-2 text-left w-24">Ticket</th>
                    <th className="py-2.5 px-2 text-left w-28">Symbol</th>
                    <th className="py-2.5 px-2 text-right w-24">Entry / SL</th>
                    <th className="py-2.5 px-2 text-right w-20">Risk 1R</th>
                    <th className="py-2.5 px-2 text-left min-w-[300px]">{language === 'vi' ? 'Đối Chiếu MFE & Dịch SL' : 'MFE Verification & Trailing SL'}</th>
                    <th className="py-2.5 px-2 text-right w-24">{language === 'vi' ? 'Đỉnh MFE Thật' : 'Peak MFE'}</th>
                    <th className="py-2.5 px-2 text-right w-24">PnL Cắt Từng Phần</th>
                    <th className="py-2.5 px-2 text-right w-24">PnL Thực Tế</th>
                    <th className="py-2.5 px-3 text-right w-24">Chênh Lệch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border-subtle)] text-xs bg-white text-[var(--text-primary)]">
                  {paginatedPartialTrades.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="py-12 text-center text-[var(--text-muted)] font-sans text-xs">
                        {language === 'vi' ? 'Không có dữ liệu lệnh phù hợp với bộ lọc' : 'No trades match filter'}
                      </td>
                    </tr>
                  ) : (
                    paginatedPartialTrades.map((tr) => {
                      const isSimWin = tr.simPnl > 1;
                      const isSimLoss = tr.simPnl < -1;
                      const isActualWin = tr.net > 1;
                      const isActualLoss = tr.net < -1;
                      const isBetter = tr.delta > 1;
                      const isWorse = tr.delta < -1;

                      return (
                        <tr 
                          key={tr.ticket || tr.idx} 
                          className="h-[44px] hover:bg-[var(--table-row-hover)] text-[var(--text-primary)] transition-colors"
                        >
                          <td className="py-2 px-3 text-center text-[var(--text-muted)] font-mono text-[11px]">
                            {tr.idx}
                          </td>

                          <td className="py-2 px-2 text-left font-mono font-medium text-xs text-[var(--text-primary)] truncate max-w-[90px]">
                            #{tr.ticket}
                          </td>

                          <td className="py-2 px-2 text-left">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[var(--text-primary)] text-xs">{tr.symbol}</span>
                              <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold border ${
                                tr.type === 'BUY' 
                                  ? 'bg-[#4a6152]/10 text-[var(--color-win)] border-[#4a6152]/30' 
                                  : 'bg-[#825249]/10 text-[var(--color-loss)] border-[#825249]/30'
                              }`}>
                                {tr.type}
                              </span>
                              <span className="text-[10px] text-[var(--text-muted)] font-mono">{tr.volume}L</span>
                            </div>
                          </td>

                          <td className="py-2 px-2 text-right font-mono text-xs text-[var(--text-primary)]">
                            <div>{tr.openPrice > 0 ? tr.openPrice : '-'}</div>
                            <div className="text-[var(--text-muted)] text-[10px]">SL: {tr.initialSl > 0 ? tr.initialSl : 'None'}</div>
                          </td>

                          <td className="py-2 px-2 text-right font-mono text-xs text-[var(--text-primary)]">
                            ${tr.risk1R.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </td>

                          {/* Diễn biến từng mốc TP */}
                          <td className="py-2 px-2 text-left">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {tr.tierResults.map((t, tIdx) => {
                                const isHit = t.status === 'HIT';
                                const isTrailed = t.status === 'TRAILED';
                                const isBE = t.status === 'BE';
                                const isSL = t.status === 'SL';
                                return (
                                  <span
                                    key={t.id || tIdx}
                                    className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 border ${
                                      isHit
                                        ? 'bg-[#4a6152]/10 text-[var(--color-win)] border-[#4a6152]/30 font-semibold'
                                        : isTrailed
                                        ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-main)]'
                                        : isBE
                                        ? 'bg-[var(--bg-subtle)] text-[var(--text-primary)] border-[var(--border-main)]'
                                        : isSL
                                        ? 'bg-[#825249]/10 text-[var(--color-loss)] border-[#825249]/30 font-semibold'
                                        : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border-main)]'
                                    }`}
                                  >
                                    <span className="font-semibold text-[var(--text-muted)]">TP{tIdx + 1}({t.targetR}R):</span>
                                    {isHit ? (
                                      <span className="text-[#4a6152] font-semibold flex items-center gap-0.5">
                                        ĐẠT (+${t.tierPnl.toFixed(0)})
                                      </span>
                                    ) : isTrailed ? (
                                      <span className="text-[var(--text-primary)] font-medium">
                                        Khóa +{t.trailStopR}R (+${t.tierPnl.toFixed(0)})
                                      </span>
                                    ) : isBE ? (
                                      <span className="text-[var(--text-primary)] font-medium">
                                        BE $0
                                      </span>
                                    ) : isSL ? (
                                      <span className="text-[#825249] font-medium">
                                        SL ${t.tierPnl.toFixed(0)}
                                      </span>
                                    ) : (
                                      <span>${t.tierPnl.toFixed(0)}</span>
                                    )}
                                  </span>
                                );
                              })}
                            </div>
                          </td>

                          {/* Đỉnh MFE Thật */}
                          <td className="py-2 px-2 text-right font-mono text-xs">
                            <span className={tr.mfeUsd > 0 || tr.effectiveMaxR > 0 ? 'text-[#4a6152] font-medium' : 'text-[var(--text-muted)]'}>
                              {tr.mfeUsd > 0 ? `+$${tr.mfeUsd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : (tr.effectiveMaxR > 0 ? `+$${(tr.effectiveMaxR * tr.risk1R).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '$0.00')}
                            </span>
                            <div className="text-[10px] text-[var(--text-muted)] font-normal">
                              {tr.effectiveMaxR > 0 ? `+${tr.effectiveMaxR.toFixed(2)}R` : '0R'}
                            </div>
                          </td>

                          {/* PnL Cắt Từng Phần */}
                          <td className="py-2 px-2 text-right font-mono text-xs font-medium">
                            <span className={isSimWin ? 'text-[#4a6152]' : isSimLoss ? 'text-[#825249]' : 'text-[var(--text-muted)]'}>
                              {tr.simPnl >= 0 ? '+' : ''}${tr.simPnl.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <div className="text-[10px] text-[var(--text-muted)] font-normal">
                              {tr.risk1R > 0 ? `${(tr.simPnl / tr.risk1R).toFixed(2)}R` : '-'}
                            </div>
                          </td>

                          {/* PnL Thực Tế */}
                          <td className="py-2 px-2 text-right font-mono text-xs font-medium">
                            <span className={isActualWin ? 'text-[#4a6152]' : isActualLoss ? 'text-[#825249]' : 'text-[var(--text-muted)]'}>
                              {tr.net >= 0 ? '+' : ''}${tr.net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <div className="text-[10px] text-[var(--text-muted)] font-normal">
                              {tr.risk1R > 0 ? `${(tr.net / tr.risk1R).toFixed(2)}R` : '-'}
                            </div>
                          </td>

                          {/* Chênh Lệch */}
                          <td className="py-2 px-3 text-right font-mono text-xs font-medium">
                            <span className={`px-1.5 py-0.5 rounded text-[10px] border ${
                              isBetter
                                ? 'bg-[#4a6152]/10 text-[var(--color-win)] border-[#4a6152]/30 font-semibold'
                                : isWorse
                                ? 'bg-[#825249]/10 text-[var(--color-loss)] border-[#825249]/30 font-semibold'
                                : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-main)]'
                            }`}>
                              {tr.delta >= 0 ? '+' : ''}${tr.delta.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Phân trang (Pagination footer phong cách HistoryTable) */}
            <div className="px-4 py-2 bg-[var(--bg-card)] border-t border-[var(--border-main)] flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-[#1d1b17] font-mono">
                  Showing {filteredPartialTrades.length === 0 ? 0 : (safePartialPage - 1) * effectivePartialPageSize + 1}-{Math.min(safePartialPage * effectivePartialPageSize, filteredPartialTrades.length)} of {filteredPartialTrades.length} orders
                </span>

                {/* Rows per page pills */}
                <div className="hidden sm:flex items-center gap-1 text-xs ml-2">
                  <span className="text-[#1d1b17] font-medium text-[11px]">Page size:</span>
                  {[5, 10, 20, 50].map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => {
                        setPartialPageSize(sz);
                        setPartialPage(1);
                      }}
                      className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                        partialPageSize === sz
                          ? 'bg-[#e8e2da] text-[#1d1b17] font-bold border border-[#d8d0c5]'
                          : 'text-[var(--text-muted)] hover:text-[#1d1b17] hover:bg-[#e8e2da]'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => {
                      setPartialPageSize(0);
                      setPartialPage(1);
                    }}
                    className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                      partialPageSize === 0
                        ? 'bg-[#e8e2da] text-[#1d1b17] font-bold border border-[#d8d0c5]'
                        : 'text-[var(--text-muted)] hover:text-[#1d1b17] hover:bg-[#e8e2da]'
                    }`}
                  >
                    {language === 'vi' ? 'Tất cả' : 'All'}
                  </button>
                </div>
              </div>

              {/* Pagination buttons */}
              <div className="flex items-center gap-1 font-mono text-[11px]">
                <button
                  type="button"
                  disabled={safePartialPage <= 1}
                  onClick={() => setPartialPage(p => Math.max(1, p - 1))}
                  className="w-5 h-5 rounded flex items-center justify-center bg-[#ede7df] hover:bg-[#e8e2da] text-[#737973] hover:text-[#1d1b17] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors text-[10px] border border-[#d8d0c5]"
                  title="Previous page"
                >
                  &lt;
                </button>

                {partialPaginationNumbers.map((pNum, idx) => {
                  if (pNum === -1) {
                    return (
                      <span key={`ellipsis-${idx}`} className="w-3 text-center text-[#737973] text-[10px]">
                        ...
                      </span>
                    );
                  }
                  const isCur = pNum === safePartialPage;
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setPartialPage(pNum)}
                      className={`w-5 h-5 rounded flex items-center justify-center font-medium text-[10px] transition-colors cursor-pointer ${
                        isCur
                          ? 'bg-[#e8e2da] text-[#1d1b17] font-bold border border-[#d8d0c5]'
                          : 'hover:bg-[#e8e2da] text-[#737973] hover:text-[#1d1b17]'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={safePartialPage >= totalPartialPages}
                  onClick={() => setPartialPage(p => Math.min(totalPartialPages, p + 1))}
                  className="w-5 h-5 rounded flex items-center justify-center bg-[#ede7df] hover:bg-[#e8e2da] text-[#737973] hover:text-[#1d1b17] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors text-[10px] border border-[#d8d0c5]"
                  title="Next page"
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )}

      {/* 5.4.6 BẢNG ĐO LƯỜNG TÂM LÝ & HIỆU SUẤT ĐỊNH LƯỢNG (QUANTIFIED TRADING PSYCHOLOGY SCORECARD) */}
      {(activeSection === 'ALL' || activeSection === 'PSYCHOLOGY') && (
        <div className="bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] p-4 shadow-lg space-y-4">
          {/* Header Bảng Tâm lý định lượng */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#e8e2da]">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase font-sans">
                  {language === 'vi' ? 'BẢNG ĐO LƯỜNG TÂM LÝ & HIỆU SUẤT ĐỊNH LƯỢNG (QUANTIFIED PSYCHOLOGY AUDIT)' : 'QUANTIFIED PERFORMANCE PSYCHOLOGY SCORECARD'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase font-mono ${
                  psychologyQuantitativeData.psychScore >= 80
                    ? 'bg-[#e8e2da] text-[#4a6152] border-[#d8d0c5]'
                    : psychologyQuantitativeData.psychScore >= 60
                    ? 'bg-[#e8e2da] text-[#1d1b17] border-[#d8d0c5]'
                    : 'bg-[#e8e2da] text-[#825249] border-[#d8d0c5]'
                }`}>
                  {language === 'vi' ? 'Điểm Kỷ Luật:' : 'Mindset Score:'} {psychologyQuantitativeData.psychScore}/100
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 text-[11px] font-mono text-[#737973] bg-[#ede7df] px-2.5 py-1 rounded-lg border border-[#e8e2da]">
              <span>{language === 'vi' ? 'Tổng lệnh kiểm toán:' : 'Audited orders:'}</span>
              <strong className="text-[#1d1b17]">{closedTrades.length}</strong>
            </div>
          </div>

          {/* 4 THẺ SỐ HỌC TÂM LÝ CỐT LÕI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Thuế Tự Mãn / Hưng Phấn (Overconfidence Clawback) */}
            <div className="p-3 bg-[#ede7df] rounded-lg border border-[#e8e2da] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#737973] font-medium uppercase">
                    {language === 'vi' ? '1. Thuế Tự Mãn (Clawback)' : '1. Overconfidence Drag'}
                  </span>
                  <span className={`text-[10px] font-bold font-mono ${
                    psychologyQuantitativeData.clawback.clawbackPct > 30 ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {psychologyQuantitativeData.clawback.clawbackPct}%
                  </span>
                </div>
                <p className={`text-xl font-bold font-mono mt-1 ${
                  psychologyQuantitativeData.clawback.clawedBackUsd > 0 ? 'text-rose-400' : 'text-[#1d1b17]'
                }`}>
                  -${psychologyQuantitativeData.clawback.clawedBackUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <p className="text-[10px] text-[#737973] mt-2 border-t border-[#e8e2da]/50 pt-1.5">
                {language === 'vi'
                  ? `Tiền nộp lại ở các lệnh kế sau ${psychologyQuantitativeData.clawback.streakCount} chuỗi thắng liên tiếp.`
                  : `Drawdown incurred immediately following winning streaks.`}
              </p>
            </div>

            {/* Card 2: Chi Phí Sợ Hãi & Chốt Non (Fear & Regret Drain) */}
            <div className="p-3 bg-[#ede7df] rounded-lg border border-[#e8e2da] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#737973] font-medium uppercase">
                    {language === 'vi' ? '2. Chi Phí Chốt Non (Fear)' : '2. Fear Left-on-Table'}
                  </span>
                  <span className="text-[10px] font-bold font-mono text-[#424843]">
                    -{psychologyQuantitativeData.fearLeftOnTable.avgLeftOnTableR}R / {language === 'vi' ? 'lệnh win' : 'win'}
                  </span>
                </div>
                <p className="text-xl font-bold font-mono text-[#1d1b17] mt-1">
                  -${psychologyQuantitativeData.fearLeftOnTable.totalLeftOnTable.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <p className="text-[10px] text-[#737973] mt-2 border-t border-[#e8e2da]/50 pt-1.5">
                {language === 'vi'
                  ? `${psychologyQuantitativeData.fearLeftOnTable.prematureExitRate}% lệnh thắng bị cắt non trước khi chạm đỉnh tiềm năng.`
                  : `${psychologyQuantitativeData.fearLeftOnTable.prematureExitRate}% of winning orders exited prematurely.`}
              </p>
            </div>

            {/* Card 3: Độ Lệch Cay Cú Sau Hụt Ăn (Post-Greed Tilt Delta) */}
            <div className="p-3 bg-[#ede7df] rounded-lg border border-[#e8e2da] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#737973] font-medium uppercase">
                    {language === 'vi' ? '3. Độ Lệch Cay Cú (Tilt Δ)' : '3. Post-Greed Tilt Δ'}
                  </span>
                  <span className={`text-[10px] font-bold font-mono ${
                    psychologyQuantitativeData.greedTilt.greedTiltDelta > 0 ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {psychologyQuantitativeData.greedTilt.greedTiltDelta > 0 ? `+${psychologyQuantitativeData.greedTilt.greedTiltDelta}%` : `${psychologyQuantitativeData.greedTilt.greedTiltDelta}%`}
                  </span>
                </div>
                <p className={`text-xl font-bold font-mono mt-1 ${
                  psychologyQuantitativeData.greedTilt.greedPostLossRate >= 60 ? 'text-rose-400' : 'text-[#1d1b17]'
                }`}>
                  {psychologyQuantitativeData.greedTilt.greedPostLossRate}% <span className="text-xs font-normal text-[#737973] font-sans">{language === 'vi' ? 'thua sau hụt ăn' : 'post loss rate'}</span>
                </p>
              </div>
              <p className="text-[10px] text-[#737973] mt-2 border-t border-[#e8e2da]/50 pt-1.5">
                {language === 'vi'
                  ? `So với tỷ lệ thua chuẩn (${psychologyQuantitativeData.greedTilt.greedBaselineLossRate}%) qua ${psychologyQuantitativeData.greedTilt.greedEventCount} sự kiện bốc hơi đỉnh.`
                  : `Compared to baseline loss rate (${psychologyQuantitativeData.greedTilt.greedBaselineLossRate}%).`}
              </p>
            </div>

            {/* Card 4: Sức Bền Nhận Thức (Cognitive Fatigue Drop) */}
            <div className="p-3 bg-[#ede7df] rounded-lg border border-[#e8e2da] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-[#737973] font-medium uppercase">
                    {language === 'vi' ? '4. Độ Hụt Hơi Lệnh #3+' : '4. Fatigue WinRate Drop'}
                  </span>
                  <span className={`text-[10px] font-bold font-mono ${
                    psychologyQuantitativeData.fatigue.fatigueWinRateDrop > 10 ? 'text-rose-400' : 'text-emerald-400'
                  }`}>
                    {psychologyQuantitativeData.fatigue.fatigueWinRateDrop > 0 ? `-${psychologyQuantitativeData.fatigue.fatigueWinRateDrop}%` : `+${Math.abs(psychologyQuantitativeData.fatigue.fatigueWinRateDrop)}%`}
                  </span>
                </div>
                <p className="text-xl font-bold font-mono text-[#1d1b17] mt-1">
                  {psychologyQuantitativeData.fatigue.fatigueRows[0].winRate}% → {psychologyQuantitativeData.fatigue.fatigueRows[2].winRate}%
                </p>
              </div>
              <p className="text-[10px] text-[#737973] mt-2 border-t border-[#e8e2da]/50 pt-1.5">
                {language === 'vi'
                  ? 'Chênh lệch Win Rate giữa Lệnh 1 (tươi mới) và Lệnh 3+ trong cùng 1 ngày.'
                  : 'Win rate drop from trade #1 to trade #3+ on same trading day.'}
              </p>
            </div>
          </div>

          {/* HAI BẢNG BÓC TÁCH CHI TIẾT: THỨ TỰ LỆNH TRONG NGÀY & TỶ SỐ KIÊN NHẪN */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5 pt-1">
            {/* BẢNG 1: HIỆU SUẤT THEO THỨ TỰ VÀO LỆNH TRONG NGÀY (INTRADAY ORDER FATIGUE) */}
            <div className="bg-[#ede7df] rounded-lg border border-[#e8e2da] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-[#e8e2da]">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase font-sans">
                    {language === 'vi' ? 'BÓC TÁCH SỨC BỀN: THỨ TỰ LỆNH TRONG NGÀY' : 'FATIGUE AUDIT: INTRADAY TRADE SEQUENCE'}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#737973]">
                  {language === 'vi' ? 'Theo dấu mệt mỏi nhận thức' : 'Cognitive fatigue tracking'}
                </span>
              </div>

              <div className="overflow-x-auto rounded border border-[#e8e2da]">
                <table className="w-full text-xs text-left border-collapse">
                  <thead className="bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] text-[#737973] font-mono text-[10px] uppercase tracking-wider border-b border-[#e8e2da]">
                    <tr>
                      <th className="py-2 px-2.5 text-left">{language === 'vi' ? 'Thứ Tự Lệnh' : 'Order Sequence'}</th>
                      <th className="py-2 px-2 text-center">{language === 'vi' ? 'Số Lệnh' : 'Count'}</th>
                      <th className="py-2 px-2 text-right">{language === 'vi' ? 'Tỷ Lệ Thắng' : 'Win Rate'}</th>
                      <th className="py-2 px-2 text-right">{language === 'vi' ? 'Tổng PnL ($)' : 'Total PnL ($)'}</th>
                      <th className="py-2 px-2.5 text-right">{language === 'vi' ? 'Kỳ Vọng / Lệnh' : 'Avg Expectancy'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#30363d]/60 font-mono text-[11px]">
                    {psychologyQuantitativeData.fatigue.fatigueRows.map(row => (
                      <tr key={row.bucketKey} className="hover:bg-[#e8e2da] hover:text-emerald-400 transition-colors">
                        <td className="py-2 px-2.5 font-sans">
                          <span className="font-bold text-[#1d1b17] block">{row.title}</span>
                          <span className="text-[10px] text-[#737973] font-normal">{row.subtitle}</span>
                        </td>
                        <td className="py-2 px-2 text-center text-[#424843]">
                          {row.count}
                        </td>
                        <td className="py-2 px-2 text-right">
                          <span className={`font-bold ${row.winRate >= 50 ? 'text-emerald-400' : 'text-[#424843]'}`}>
                            {row.winRate}%
                          </span>
                          <span className="block text-[9px] text-[#737973] font-normal">
                            {row.lossRate}% loss
                          </span>
                        </td>
                        <td className="py-2 px-2 text-right font-bold">
                          <span className={row.pnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                            {row.pnlUsd >= 0 ? '+' : ''}${row.pnlUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                          <span className="block text-[9px] text-[#737973] font-normal">
                            {row.pnlR >= 0 ? '+' : ''}{row.pnlR.toFixed(2)}R
                          </span>
                        </td>
                        <td className="py-2 px-2.5 text-right">
                          <span className={row.avgPnlUsd >= 0 ? 'text-emerald-400 font-bold' : 'text-rose-400 font-bold'}>
                            {row.avgPnlUsd >= 0 ? '+' : ''}${row.avgPnlUsd.toFixed(1)}
                          </span>
                          <span className="block text-[9px] text-[#737973] font-normal">
                            {row.avgPnlR >= 0 ? '+' : ''}{row.avgPnlR.toFixed(2)}R
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* BẢNG 2: TỶ SỐ KIÊN NHẪN CHECKLIST VS BỘT PHÁT (PATIENCE VS IMPULSE RATIO) */}
            <div className="bg-[#ede7df] rounded-lg border border-[#e8e2da] p-3.5 space-y-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-[#e8e2da]">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase font-sans">
                    {language === 'vi' ? 'TỶ SỐ KIÊN NHẪN: KÈO HẠNG A VS KÈO BỘT PHÁT' : 'PATIENCE RATIO: GRADE A VS IMPULSE TRADES'}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#737973]">
                  Edge Δ: <strong className={psychologyQuantitativeData.patienceEdge.patienceEdgeWinRate >= 0 ? 'text-emerald-400' : 'text-rose-400'}>{psychologyQuantitativeData.patienceEdge.patienceEdgeWinRate >= 0 ? `+${psychologyQuantitativeData.patienceEdge.patienceEdgeWinRate}%` : `${psychologyQuantitativeData.patienceEdge.patienceEdgeWinRate}%`}</strong>
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Cột 1: Kèo Kiên Nhẫn (Hạng A/A+ >= 3 checklist) */}
                <div className="p-3 bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-lg border border-[#e8e2da] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[#1d1b17] uppercase">
                      {language === 'vi' ? 'Kèo Kiên Nhẫn (≥3 Check)' : 'Disciplined (≥3 Check)'}
                    </span>
                    <span className="text-[10px] font-mono text-[#737973]">
                      {psychologyQuantitativeData.patienceEdge.patientCount} {language === 'vi' ? 'lệnh' : 'trades'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-xs text-[#737973]">{language === 'vi' ? 'Tỷ lệ thắng:' : 'Win Rate:'}</span>
                    <span className="text-base font-bold font-mono text-emerald-400">
                      {psychologyQuantitativeData.patienceEdge.patientWinRate}%
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-[#737973]">{language === 'vi' ? 'Tổng PnL Net:' : 'Net Realized:'}</span>
                    <span className={`text-sm font-bold font-mono ${psychologyQuantitativeData.patienceEdge.patientPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {psychologyQuantitativeData.patienceEdge.patientPnlUsd >= 0 ? '+' : ''}${psychologyQuantitativeData.patienceEdge.patientPnlUsd.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-[#e8e2da]/50 pt-1">
                    <span className="text-[10px] text-[#737973]">{language === 'vi' ? 'Lợi nhuận R:' : 'Total R:'}</span>
                    <span className="text-xs font-mono text-[#1d1b17]">
                      {psychologyQuantitativeData.patienceEdge.patientPnlR >= 0 ? '+' : ''}{(psychologyQuantitativeData?.patienceEdge?.patientPnlR ?? 0).toFixed(2)}R
                    </span>
                  </div>
                </div>

                {/* Cột 2: Kèo Bột Phát / Thiếu Chuẩn (<= 1 checklist) */}
                <div className="p-3 bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-lg border border-[#e8e2da] space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[var(--text-primary)] uppercase">
                      {language === 'vi' ? 'Kèo Bột Phát (≤1 Check)' : 'Impulse (≤1 Check)'}
                    </span>
                    <span className="text-[10px] font-mono text-[#737973]">
                      {psychologyQuantitativeData.patienceEdge.impulseCount} {language === 'vi' ? 'lệnh' : 'trades'}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between pt-1">
                    <span className="text-xs text-[#737973]">{language === 'vi' ? 'Tỷ lệ thắng:' : 'Win Rate:'}</span>
                    <span className="text-base font-bold font-mono text-[#424843]">
                      {psychologyQuantitativeData.patienceEdge.impulseWinRate}%
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xs text-[#737973]">{language === 'vi' ? 'Tổng PnL Net:' : 'Net Realized:'}</span>
                    <span className={`text-sm font-bold font-mono ${psychologyQuantitativeData.patienceEdge.impulsePnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {psychologyQuantitativeData.patienceEdge.impulsePnlUsd >= 0 ? '+' : ''}${psychologyQuantitativeData.patienceEdge.impulsePnlUsd.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between border-t border-[#e8e2da]/50 pt-1">
                    <span className="text-[10px] text-[#737973]">{language === 'vi' ? 'Lợi nhuận R:' : 'Total R:'}</span>
                    <span className="text-xs font-mono text-[#1d1b17]">
                      {psychologyQuantitativeData.patienceEdge.impulsePnlR >= 0 ? '+' : ''}{(psychologyQuantitativeData?.patienceEdge?.impulsePnlR ?? 0).toFixed(2)}R
                    </span>
                  </div>
                </div>
              </div>

              <p className="text-[10px] text-[#737973] italic">
                {language === 'vi'
                  ? 'Bằng chứng số học cho thấy mức độ kiên nhẫn đợi đủ điều kiện vào lệnh quyết định trực tiếp tới tỷ lệ sống sót và lợi nhuận tài khoản.'
                  : 'Empirical quantitative evidence that waiting for full confluence setups protects edge and account longevity.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 5.4.3 RÀ SOÁT TÂM LÝ: HẬU QUẢ HỤT ĂN ĐỈNH DẪN ĐẾN TRẢ THÙ THỊ TRƯỜNG */}
      {(activeSection === 'ALL' || activeSection === 'PSYCHOLOGY') && (
        <div className="bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] p-4 shadow-lg space-y-4">
          {/* Header & Bộ lọc cấu hình (Thiết kế đồng nhất, không icon rườm rà, hover chữ xanh nền xám) */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#e8e2da]">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase font-sans">
                  {language === 'vi' ? 'RÀ SOÁT TÂM LÝ: HẬU QUẢ HỤT ĂN ĐỈNH (GREED & REVENGE AUDIT)' : 'PSYCHOLOGY AUDIT: POST-MFE GREED & REVENGE'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase font-mono ${
                  postGreedPsychologyData.tiltSeverity === 'CRITICAL'
                    ? 'bg-[#e8e2da] text-[#825249] border-[#d8d0c5]'
                    : postGreedPsychologyData.tiltSeverity === 'ELEVATED'
                    ? 'bg-[#e8e2da] text-[#1d1b17] border-[#d8d0c5]'
                    : 'bg-[#e8e2da] text-[#4a6152] border-[#d8d0c5]'
                }`}>
                  {postGreedPsychologyData.tiltSeverity === 'CRITICAL' 
                    ? (language === 'vi' ? 'Báo Động: Cay Cú' : 'Critical Tilt Warning')
                    : postGreedPsychologyData.tiltSeverity === 'ELEVATED'
                    ? (language === 'vi' ? 'Cảnh Báo: Cuốn Lệnh' : 'Elevated Tilt Risk')
                    : (language === 'vi' ? 'Tâm Lý Ổn Định' : 'Controlled Mindset')}
                </span>
              </div>
            </div>

            {/* Bộ điều khiển tương tác: Ngưỡng MFE, Tỷ Lệ Giữ Lãi, Thời Gian Gồng, Cửa sổ theo dõi */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Ngưỡng Đỉnh MFE */}
              <div className="flex items-center gap-1.5 bg-[#ede7df] px-2 py-1 rounded-lg border border-[#e8e2da]">
                <span className="text-[10px] text-[#737973] font-medium">
                  {language === 'vi' ? 'Đỉnh MFE ≥' : 'Peak MFE ≥'}
                </span>
                {[2.0, 2.5, 3.0, 4.0].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setPsychologyMfeThreshold(r)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                      psychologyMfeThreshold === r
                        ? 'bg-white text-[#1d1b17] font-bold border border-[#d8d0c5] shadow-xs'
                        : 'text-[#737973] hover:bg-[#e8e2da] hover:text-[#4a6152]'
                    }`}
                  >
                    {r}R
                  </button>
                ))}
              </div>

              {/* Ngưỡng Tỷ Lệ Giữ Lãi (Capture Rate %) */}
              <div className="flex items-center gap-1.5 bg-[#ede7df] px-2 py-1 rounded-lg border border-[#e8e2da]">
                <span className="text-[10px] text-[#737973] font-medium">
                  {language === 'vi' ? 'Giữ Lãi ≤' : 'Capture ≤'}
                </span>
                {[15, 20, 25, 30].map(pct => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => setPsychologyCaptureRateMax(pct)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                      psychologyCaptureRateMax === pct
                        ? 'bg-white text-[#1d1b17] font-bold border border-[#d8d0c5] shadow-xs'
                        : 'text-[#737973] hover:bg-[#e8e2da] hover:text-[#4a6152]'
                    }`}
                  >
                    {pct}%
                  </button>
                ))}
              </div>

              {/* Ngưỡng Thời Gian Gồng Lệnh (Holding Duration) */}
              <div className="flex items-center gap-1.5 bg-[#ede7df] px-2 py-1 rounded-lg border border-[#e8e2da]">
                <span className="text-[10px] text-[#737973] font-medium">
                  {language === 'vi' ? 'Gồng ≥' : 'Hold ≥'}
                </span>
                {[
                  { m: 0, label: language === 'vi' ? 'Tất cả' : 'All' },
                  { m: 15, label: '15p' },
                  { m: 30, label: '30p' },
                  { m: 60, label: '1h' }
                ].map(item => (
                  <button
                    key={item.m}
                    type="button"
                    onClick={() => setPsychologyMinHoldingMinutes(item.m)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                      psychologyMinHoldingMinutes === item.m
                        ? 'bg-white text-[#1d1b17] font-bold border border-[#d8d0c5] shadow-xs'
                        : 'text-[#737973] hover:bg-[#e8e2da] hover:text-[#4a6152]'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Cửa sổ quan sát (Window size: 1, 3, 5, 10 lệnh sau) */}
              <div className="flex items-center gap-1.5 bg-[#ede7df] px-2 py-1 rounded-lg border border-[#e8e2da]">
                <span className="text-[10px] text-[#737973] font-medium">
                  {language === 'vi' ? 'Quan sát:' : 'Window:'}
                </span>
                {[1, 3, 5, 10].map(w => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setPsychologyWindowSize(w)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                      psychologyWindowSize === w
                        ? 'bg-white text-[#1d1b17] font-bold border border-[#d8d0c5] shadow-xs'
                        : 'text-[#737973] hover:bg-[#e8e2da] hover:text-[#4a6152]'
                    }`}
                  >
                    +{w} {language === 'vi' ? 'lệnh' : 'trades'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4 Thẻ KPI Phản Ánh Mức Độ Thiệt Hại Tâm Lý */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Số lần dính bẫy hụt ăn */}
            <div className="p-3 bg-[#ede7df] rounded-lg border border-[#e8e2da]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#737973] font-medium uppercase">
                  {language === 'vi' ? 'Số Cú Hụt Ăn Đỉnh' : 'Triggered Greed Traps'}
                </span>
                <span className="text-[10px] font-mono text-[#737973]">
                  ≥{psychologyMfeThreshold}R &amp; Giữ ≤{psychologyCaptureRateMax}%
                </span>
              </div>
              <p className="text-xl font-bold font-mono text-[#1d1b17] mt-1">
                {postGreedPsychologyData.totalTriggered}{' '}
                <span className="text-xs font-normal text-[#737973] font-sans">
                  {language === 'vi' ? 'lần' : 'times'}
                </span>
              </p>
              <p className="text-[10px] text-[#737973] mt-0.5">
                {language === 'vi'
                  ? `Chiếm ${closedTrades.length > 0 ? ((postGreedPsychologyData.totalTriggered / closedTrades.length) * 100).toFixed(1) : 0}% tổng số lệnh đã đóng`
                  : `${closedTrades.length > 0 ? ((postGreedPsychologyData.totalTriggered / closedTrades.length) * 100).toFixed(1) : 0}% of all trades`}
              </p>
            </div>

            {/* Card 2: Tỷ lệ thua sau cú hụt ăn vs Trung bình */}
            <div className="p-3 bg-[#ede7df] rounded-lg border border-[#e8e2da]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#737973] font-medium uppercase">
                  {language === 'vi' ? `Tỷ Lệ Thua (${psychologyWindowSize} Lệnh Kế)` : `Loss Rate (+${psychologyWindowSize} Trades)`}
                </span>
                <span className={`text-[10px] font-bold font-mono ${postGreedPsychologyData.lossRateDelta > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {postGreedPsychologyData.lossRateDelta > 0 ? `+${postGreedPsychologyData.lossRateDelta}%` : `${postGreedPsychologyData.lossRateDelta}%`}
                </span>
              </div>
              <p className={`text-xl font-bold font-mono mt-1 ${postGreedPsychologyData.postLossRate >= 60 ? 'text-rose-400' : 'text-[#1d1b17]'}`}>
                {postGreedPsychologyData.postLossRate}%
              </p>
              <p className="text-[10px] text-[#737973] mt-0.5">
                {language === 'vi'
                  ? `Bình thường cả tài khoản chỉ thua ${postGreedPsychologyData.baselineLossRate}%`
                  : `Baseline account loss rate is ${postGreedPsychologyData.baselineLossRate}%`}
              </p>
            </div>

            {/* Card 3: Thiệt hại tiền bạc trong các lệnh trả thù sau đó */}
            <div className="p-3 bg-[#ede7df] rounded-lg border border-[#e8e2da]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#737973] font-medium uppercase">
                  {language === 'vi' ? 'Thiệt Hại Lệnh Sau Đó' : 'Post-Tilt Drawdown'}
                </span>
                <span className="text-[10px] font-mono text-[#737973]">
                  {metricUnit === 'R' 
                    ? `${postGreedPsychologyData.totalRevengePnlR >= 0 ? '+' : ''}${(postGreedPsychologyData?.totalRevengePnlR ?? 0).toFixed(2)}R`
                    : `${((postGreedPsychologyData.totalRevengePnlUsd / initialBalance) * 100).toFixed(1)}%`}
                </span>
              </div>
              <p className={`text-xl font-bold font-mono mt-1 ${postGreedPsychologyData.totalRevengePnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {postGreedPsychologyData.totalRevengePnlUsd >= 0 ? '+' : ''}
                ${postGreedPsychologyData.totalRevengePnlUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-[#737973] mt-0.5">
                {language === 'vi'
                  ? 'Tổng PnL thực tế bị mất trong các lệnh kế tiếp'
                  : 'Cumulative PnL lost across following trades'}
              </p>
            </div>

            {/* Card 4: Chuỗi thua kỷ lục sau cú hụt ăn (Không dùng icon màu mè) */}
            <div className="p-3 bg-[#ede7df] rounded-lg border border-[#e8e2da]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#737973] font-medium uppercase">
                  {language === 'vi' ? 'Chuỗi Thua Liền Tù Tì' : 'Max Loss Streak After'}
                </span>
                <span className="text-[10px] font-mono text-[#737973]">
                  {language === 'vi' ? 'Kỷ lục' : 'Record'}
                </span>
              </div>
              <p className={`text-xl font-bold font-mono mt-1 ${postGreedPsychologyData.maxLossStreakAfter >= 3 ? 'text-rose-400' : 'text-[#1d1b17]'}`}>
                {postGreedPsychologyData.maxLossStreakAfter}{' '}
                <span className="text-xs font-normal text-[#737973] font-sans">
                  {language === 'vi' ? 'lệnh liên tiếp' : 'trades in a row'}
                </span>
              </p>
              <p className="text-[10px] text-[#737973] mt-0.5">
                {language === 'vi'
                  ? 'Số lệnh thua liên tiếp sau khi hụt ăn đỉnh'
                  : 'Consecutive losses immediately following greed event'}
              </p>
            </div>
          </div>

          {/* Bảng Kiểm Toán Chi Tiết Từng Cú Hụt Ăn Kèm Diễn Biến Các Lệnh Kế Tiếp */}
          <div className="bg-[#ede7df] rounded-lg border border-[#e8e2da] overflow-hidden">
            <div className="px-3.5 py-2.5 bg-[#ede7df] border-b border-[#e8e2da] flex items-center justify-between gap-3 flex-wrap">
              <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase font-sans">
                {language === 'vi' ? 'DANH SÁCH KIỂM TOÁN TỪNG CÚ HỤT ĂN & DIỄN BIẾN LỆNH SAU ĐÓ' : 'AUDIT BREAKDOWN: GREED EVENTS & CONSECUTIVE TRADES'}
              </span>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#737973]">
                  {language === 'vi' ? 'Hiển thị:' : 'Show:'}
                </span>
                {[5, 10, 20, 0].map(sz => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setPsychologyPageSize(sz)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                      psychologyPageSize === sz
                        ? 'bg-white text-[#1d1b17] font-bold border border-[#d8d0c5] shadow-xs'
                        : 'text-[#737973] hover:bg-[#e8e2da] hover:text-[#4a6152]'
                    }`}
                  >
                    {sz === 0 ? (language === 'vi' ? 'Tất cả' : 'All') : sz}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#424843]">
                <thead className="bg-white border-b border-[var(--border-main)] text-[var(--text-muted)] font-medium text-[11px] uppercase">
                  <tr>
                    <th className="px-3 py-2 text-center">#</th>
                    <th className="px-3 py-2">{language === 'vi' ? 'Lệnh Hụt Ăn' : 'Trigger Trade'}</th>
                    <th className="px-3 py-2 text-right">{language === 'vi' ? 'Đỉnh MFE Thật' : 'Peak MFE'}</th>
                    <th className="px-3 py-2 text-right">{language === 'vi' ? 'Thực Nhận' : 'Actual PnL'}</th>
                    <th className="px-3 py-2 text-center">{language === 'vi' ? 'Tỷ Lệ Giữ' : 'Capture %'}</th>
                    <th className="px-3 py-2 text-center">{language === 'vi' ? 'Thời Gian Gồng' : 'Holding Time'}</th>
                    <th className="px-3 py-2">{language === 'vi' ? `Diễn Biến ${psychologyWindowSize} Lệnh Kế Tiếp (Timeline)` : `Next ${psychologyWindowSize} Trades`}</th>
                    <th className="px-3 py-2 text-right">{language === 'vi' ? 'Tỷ Lệ Thua' : 'Post Loss %'}</th>
                    <th className="px-3 py-2 text-right">{language === 'vi' ? 'PnL Hậu Quả' : 'Post PnL'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8e2da] font-mono text-[11px]">
                  {paginatedPsychologyEvents.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-6 text-[#737973] font-sans italic">
                        {language === 'vi'
                          ? 'Tuyệt vời! Không phát hiện cú hụt ăn nào vượt ngưỡng tham số đang chọn.'
                          : 'No greed trap events detected under current threshold settings.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedPsychologyEvents.map(evt => {
                      const tr = evt.triggerTrade;
                      const hrs = Math.floor(evt.holdingMinutes / 60);
                      const mins = Math.floor(evt.holdingMinutes % 60);
                      const holdStr = hrs > 0 ? `${hrs}h ${mins}p` : `${mins}p`;

                      return (
                        <tr 
                          key={evt.triggerIndex} 
                          className="hover:bg-[#f6f2ec] transition-colors cursor-pointer group"
                          onClick={() => {
                            const rawTr = closedTrades.find(t => String(t.ticket || t.position_id) === String(tr.ticket));
                            if (rawTr && onSelectTrade) onSelectTrade(rawTr);
                          }}
                        >
                          <td className="px-3 py-2.5 text-center text-[#737973] group-hover:text-[#4a6152] font-medium">
                            {evt.triggerIndex}
                          </td>
                          <td className="px-3 py-2.5 font-sans">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#1d1b17] group-hover:text-[#4a6152]">#{tr.ticket}</span>
                              <span className="text-[10px] text-[#737973] font-mono">({tr.symbol})</span>
                              <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${tr.type === 'BUY' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {tr.type}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="text-[#4a6152] font-bold">
                              +{(evt.effectiveMaxR ?? 0).toFixed(2)}R
                            </span>
                            <span className="block text-[10px] text-[#737973]">
                              +${(evt.effectiveMaxR * tr.risk1R).toFixed(2)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className={`font-bold ${tr.net > 1 ? 'text-[#4a6152]' : tr.net < -1 ? 'text-[#825249]' : 'text-[#737973]'}`}>
                              {tr.net >= 0 ? '+' : ''}${tr.net.toFixed(2)}
                            </span>
                            <span className="block text-[10px] text-[#737973]">
                              {evt.actualR >= 0 ? '+' : ''}{(evt.actualR ?? 0).toFixed(2)}R
                            </span>
                          </td>
                          {/* CỘT TỶ LỆ GIỮ LÃI */}
                          <td className="px-3 py-2.5 text-center">
                            <span className={`font-bold px-1.5 py-0.5 rounded text-[10px] border ${
                              evt.captureRatePercent <= 10 
                                ? 'bg-rose-50 text-[#825249] border-rose-200'
                                : evt.captureRatePercent <= 20
                                ? 'bg-[#ede7df] text-[#1d1b17] border-[#d8d0c5]'
                                : 'bg-white text-[#424843] border-[#e8e2da]'
                            }`}>
                              {(evt.captureRatePercent ?? 0).toFixed(1)}%
                            </span>
                            <span className="block text-[9px] text-[#737973] mt-0.5">
                              {language === 'vi' ? `mất ${(100 - evt.captureRatePercent).toFixed(0)}%` : `lost ${(100 - evt.captureRatePercent).toFixed(0)}%`}
                            </span>
                          </td>
                          {/* CỘT THỜI GIAN GỒNG LỆNH */}
                          <td className="px-3 py-2.5 text-center text-[#424843]">
                            <span className="font-mono text-[11px] font-medium">
                              {holdStr}
                            </span>
                            <span className="block text-[9px] text-[#737973]">
                              {evt.holdingMinutes >= 60 ? (language === 'vi' ? 'ngâm rất lâu' : 'long hold') : (language === 'vi' ? 'trung bình' : 'standard')}
                            </span>
                          </td>
                          {/* Timeline các lệnh kế tiếp với pills màu sắc */}
                          <td className="px-3 py-2.5 font-sans">
                            {evt.followUps.length === 0 ? (
                              <span className="text-[#737973] text-[10px] italic">
                                {language === 'vi' ? '(Chưa có lệnh sau)' : '(No subsequent trades)'}
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {evt.followUps.map(fu => {
                                  let bgClass = 'bg-[#ede7df] text-[var(--text-muted)] border-[#d8d0c5]';
                                  let label = 'BE';
                                  if (fu.isLoss) {
                                    bgClass = 'bg-rose-50 text-[#825249] border-rose-200 font-bold';
                                    label = 'L';
                                  } else if (fu.isWin) {
                                    bgClass = 'bg-emerald-50 text-[#4a6152] border-emerald-200 font-bold';
                                    label = 'W';
                                  }
                                  return (
                                    <span
                                      key={fu.ticket}
                                      title={`Lệnh #${fu.ticket} (${fu.symbol}): ${fu.net >= 0 ? '+' : ''}$${fu.net.toFixed(2)}`}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono border hover:bg-[#e8e2da] cursor-help transition-colors ${bgClass}`}
                                    >
                                      #{fu.ticket}: {label} ({fu.net >= 0 ? '+' : ''}${fu.net.toFixed(0)})
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className={`font-bold ${evt.postEventLossRate >= 66 ? 'text-[#825249]' : 'text-[#1d1b17]'}`}>
                              {evt.postEventLossRate}%
                            </span>
                            <span className="block text-[10px] text-[#737973]">
                              ({evt.followUpLossCount}L - {evt.followUpWinCount}W - {evt.followUpBeCount}BE)
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold">
                            <span className={evt.followUpTotalPnlUsd >= 0 ? 'text-[#4a6152]' : 'text-[#825249]'}>
                              {evt.followUpTotalPnlUsd >= 0 ? '+' : ''}${(evt.followUpTotalPnlUsd ?? 0).toFixed(2)}
                            </span>
                            <span className="block text-[10px] text-[#737973]">
                              {evt.followUpTotalPnlR >= 0 ? '+' : ''}{(evt.followUpTotalPnlR ?? 0).toFixed(2)}R
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Phân trang dưới đáy bảng */}
            <div className="px-4 py-2 bg-[var(--bg-card)] border-t border-[var(--border-main)] flex items-center justify-between text-xs text-[#737973]">
              <span className="text-[11px]">
                {language === 'vi' ? 'Tổng cộng' : 'Total'}:{' '}
                <strong className="text-[#1d1b17]">{postGreedPsychologyData.triggeredEvents.length}</strong> {language === 'vi' ? 'sự kiện hụt ăn' : 'events'}
              </span>

              <div className="flex items-center gap-1 font-mono text-[11px]">
                <button
                  type="button"
                  disabled={safePsychologyPage <= 1}
                  onClick={() => setPsychologyPage(p => Math.max(1, p - 1))}
                  className="w-5 h-5 rounded flex items-center justify-center bg-[#ede7df] hover:bg-[#e8e2da] text-[#737973] hover:text-[#1d1b17] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors text-[10px] border border-[#d8d0c5]"
                  title="Previous page"
                >
                  &lt;
                </button>

                {psychologyPaginationNumbers.map((pNum, idx) => {
                  if (pNum === -1) {
                    return (
                      <span key={`psy-ell-${idx}`} className="w-3 text-center text-[#737973] text-[10px]">
                        ...
                      </span>
                    );
                  }
                  const isCur = pNum === safePsychologyPage;
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setPsychologyPage(pNum)}
                      className={`w-5 h-5 rounded flex items-center justify-center font-medium text-[10px] transition-colors cursor-pointer ${
                        isCur
                          ? 'bg-[#e8e2da] text-[#1d1b17] font-bold border border-[#d8d0c5]'
                          : 'hover:bg-[#e8e2da] text-[#737973] hover:text-[#1d1b17]'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={safePsychologyPage >= totalPsychologyPages}
                  onClick={() => setPsychologyPage(p => Math.min(totalPsychologyPages, p + 1))}
                  className="w-5 h-5 rounded flex items-center justify-center bg-[#ede7df] hover:bg-[#e8e2da] text-[#737973] hover:text-[#1d1b17] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors text-[10px] border border-[#d8d0c5]"
                  title="Next page"
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5.4.4 RÀ SOÁT TÂM LÝ: HẬU QUẢ THẮNG ĐẬM / ĐỦ TP (EUPHORIA & OVERCONFIDENCE AUDIT) */}
      {(activeSection === 'ALL' || activeSection === 'PSYCHOLOGY') && (
        <div className="bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] p-4 shadow-lg space-y-4">
          {/* Header & Bộ lọc cấu hình (Thiết kế đồng nhất, không icon rườm rà, hover chữ xanh nền xám) */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#e8e2da]">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase font-sans">
                  {language === 'vi' ? 'RÀ SOÁT TÂM LÝ: HẬU QUẢ THẮNG ĐẬM / ĐỦ TP (EUPHORIA & OVERCONFIDENCE AUDIT)' : 'PSYCHOLOGY AUDIT: POST-TP EUPHORIA & OVERCONFIDENCE'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase font-mono ${
                  postEuphoriaPsychologyData.euphoriaSeverity === 'CRITICAL'
                    ? 'bg-[#e8e2da] text-[#825249] border-[#d8d0c5]'
                    : postEuphoriaPsychologyData.euphoriaSeverity === 'ELEVATED'
                    ? 'bg-[#e8e2da] text-[#1d1b17] border-[#d8d0c5]'
                    : 'bg-[#e8e2da] text-[#4a6152] border-[#d8d0c5]'
                }`}>
                  {postEuphoriaPsychologyData.euphoriaSeverity === 'CRITICAL' 
                    ? (language === 'vi' ? 'Báo Động: Hưng Phấn Quá Đà' : 'Critical Euphoria Warning')
                    : postEuphoriaPsychologyData.euphoriaSeverity === 'ELEVATED'
                    ? (language === 'vi' ? 'Cảnh Báo: Tự Phụ Lỏng Quy Tắc' : 'Overconfidence Risk')
                    : (language === 'vi' ? 'Kỷ Luật Vững Vàng' : 'Disciplined Win Follow-up')}
                </span>
              </div>
            </div>

            {/* Bộ điều khiển tương tác: Ngưỡng Lãi Đủ TP, Tỷ Lệ Giữ Lãi, Cửa sổ theo dõi */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Ngưỡng Lãi Thực Nhận Đủ TP */}
              <div className="flex items-center gap-1.5 bg-[#ede7df] px-2 py-1 rounded-lg border border-[#e8e2da]">
                <span className="text-[10px] text-[#737973] font-medium">
                  {language === 'vi' ? 'Thắng Đậm ≥' : 'Big Win ≥'}
                </span>
                {[1.5, 2.0, 3.0, 4.0].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setEuphoriaTpThresholdR(r)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                      euphoriaTpThresholdR === r
                        ? 'bg-white text-[#1d1b17] font-bold border border-[#d8d0c5] shadow-xs'
                        : 'text-[#737973] hover:bg-[#e8e2da] hover:text-[#4a6152]'
                    }`}
                  >
                    {r}R
                  </button>
                ))}
              </div>

              {/* Ngưỡng Tỷ Lệ Giữ Lãi (Capture Rate %) */}
              <div className="flex items-center gap-1.5 bg-[#ede7df] px-2 py-1 rounded-lg border border-[#e8e2da]">
                <span className="text-[10px] text-[#737973] font-medium">
                  {language === 'vi' ? 'Giữ Lãi ≥' : 'Capture ≥'}
                </span>
                {[50, 66.7, 80].map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setEuphoriaCaptureRateMin(c)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                      euphoriaCaptureRateMin === c
                        ? 'bg-white text-[#1d1b17] font-bold border border-[#d8d0c5] shadow-xs'
                        : 'text-[#737973] hover:bg-[#e8e2da] hover:text-[#4a6152]'
                    }`}
                  >
                    {c}%
                  </button>
                ))}
              </div>

              {/* Cửa sổ quan sát (Window size: 1, 3, 5, 10 lệnh sau) */}
              <div className="flex items-center gap-1.5 bg-[#ede7df] px-2 py-1 rounded-lg border border-[#e8e2da]">
                <span className="text-[10px] text-[#737973] font-medium">
                  {language === 'vi' ? 'Quan sát:' : 'Window:'}
                </span>
                {[1, 3, 5, 10].map(w => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setEuphoriaWindowSize(w)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                      euphoriaWindowSize === w
                        ? 'bg-white text-[#1d1b17] font-bold border border-[#d8d0c5] shadow-xs'
                        : 'text-[#737973] hover:bg-[#e8e2da] hover:text-[#4a6152]'
                    }`}
                  >
                    +{w} {language === 'vi' ? 'lệnh' : 'trades'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4 Thẻ KPI Phản Ánh Độ Hưng Phấn & Hiệu Suất Sau Thắng Đậm */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Số cú thắng đậm */}
            <div className="p-3 bg-[#ede7df] rounded-lg border border-[#e8e2da]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#737973] font-medium uppercase">
                  {language === 'vi' ? 'Số Cú Thắng Đậm' : 'Big Win Events'}
                </span>
                <span className="text-[10px] font-mono text-[#737973]">
                  ≥{euphoriaTpThresholdR}R &amp; ≥{euphoriaCaptureRateMin}%
                </span>
              </div>
              <p className="text-xl font-bold font-mono text-[#1d1b17] mt-1">
                {postEuphoriaPsychologyData.totalTriggered}{' '}
                <span className="text-xs font-normal text-[#737973] font-sans">
                  {language === 'vi' ? 'lệnh' : 'trades'}
                </span>
              </p>
              <p className="text-[10px] text-[#737973] mt-0.5">
                {language === 'vi'
                  ? `Chiếm ${closedTrades.length > 0 ? ((postEuphoriaPsychologyData.totalTriggered / closedTrades.length) * 100).toFixed(1) : 0}% tổng số lệnh đã đóng`
                  : `${closedTrades.length > 0 ? ((postEuphoriaPsychologyData.totalTriggered / closedTrades.length) * 100).toFixed(1) : 0}% of all trades`}
              </p>
            </div>

            {/* Card 2: Tỷ lệ thua sau khi thắng đậm */}
            <div className="p-3 bg-[#ede7df] rounded-lg border border-[#e8e2da]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#737973] font-medium uppercase">
                  {language === 'vi' ? `Tỷ Lệ Thua (${euphoriaWindowSize} Lệnh Kế)` : `Loss Rate (+${euphoriaWindowSize} Trades)`}
                </span>
                <span className={`text-[10px] font-bold font-mono ${postEuphoriaPsychologyData.lossRateDelta > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {postEuphoriaPsychologyData.lossRateDelta > 0 ? `+${postEuphoriaPsychologyData.lossRateDelta}%` : `${postEuphoriaPsychologyData.lossRateDelta}%`}
                </span>
              </div>
              <p className={`text-xl font-bold font-mono mt-1 ${postEuphoriaPsychologyData.postLossRate >= 60 ? 'text-rose-400' : 'text-[#1d1b17]'}`}>
                {postEuphoriaPsychologyData.postLossRate}%
              </p>
              <p className="text-[10px] text-[#737973] mt-0.5">
                {language === 'vi'
                  ? `Bình thường cả tài khoản thua ${postEuphoriaPsychologyData.baselineLossRate}%`
                  : `Baseline account loss rate is ${postEuphoriaPsychologyData.baselineLossRate}%`}
              </p>
            </div>

            {/* Card 3: PnL thực tế của các lệnh sau đó */}
            <div className="p-3 bg-[#ede7df] rounded-lg border border-[#e8e2da]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#737973] font-medium uppercase">
                  {language === 'vi' ? 'PnL Các Lệnh Kế Tiếp' : 'Post-Win PnL'}
                </span>
                <span className="text-[10px] font-mono text-[#737973]">
                  {metricUnit === 'R' 
                    ? `${postEuphoriaPsychologyData.totalPostPnlR >= 0 ? '+' : ''}${(postEuphoriaPsychologyData?.totalPostPnlR ?? 0).toFixed(2)}R`
                    : `${((postEuphoriaPsychologyData.totalPostPnlUsd / initialBalance) * 100).toFixed(1)}%`}
                </span>
              </div>
              <p className={`text-xl font-bold font-mono mt-1 ${postEuphoriaPsychologyData.totalPostPnlUsd >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {postEuphoriaPsychologyData.totalPostPnlUsd >= 0 ? '+' : ''}
                ${postEuphoriaPsychologyData.totalPostPnlUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-[#737973] mt-0.5">
                {language === 'vi'
                  ? 'Tổng PnL tích lũy thu được sau các cú ăn đậm'
                  : 'Cumulative PnL made across subsequent trades'}
              </p>
            </div>

            {/* Card 4: Chuỗi thua dài nhất sau thắng đậm */}
            <div className="p-3 bg-[#ede7df] rounded-lg border border-[#e8e2da]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#737973] font-medium uppercase">
                  {language === 'vi' ? 'Chuỗi Thua Sau Thắng' : 'Max Post-Win Loss Streak'}
                </span>
                <span className="text-[10px] font-mono text-[#737973]">
                  {language === 'vi' ? 'Kỷ lục' : 'Record'}
                </span>
              </div>
              <p className={`text-xl font-bold font-mono mt-1 ${postEuphoriaPsychologyData.maxLossStreakAfter >= 3 ? 'text-rose-400' : 'text-[#1d1b17]'}`}>
                {postEuphoriaPsychologyData.maxLossStreakAfter}{' '}
                <span className="text-xs font-normal text-[#737973] font-sans">
                  {language === 'vi' ? 'lệnh liên tiếp' : 'trades in a row'}
                </span>
              </p>
              <p className="text-[10px] text-[#737973] mt-0.5">
                {language === 'vi'
                  ? 'Dấu hiệu trả lại tiền cho sàn do hưng phấn'
                  : 'Indicator of giving back profits due to overconfidence'}
              </p>
            </div>
          </div>

          {/* Bảng Kiểm Toán Chi Tiết Từng Cú Thắng Đậm Kèm Diễn Biến Các Lệnh Kế Tiếp */}
          <div className="bg-[#ede7df] rounded-lg border border-[#e8e2da] overflow-hidden">
            <div className="px-3.5 py-2.5 bg-[#ede7df] border-b border-[#e8e2da] flex items-center justify-between gap-3 flex-wrap">
              <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase font-sans">
                {language === 'vi' ? 'DANH SÁCH KIỂM TOÁN TỪNG CÚ THẮNG ĐẬM & DIỄN BIẾN LỆNH SAU ĐÓ' : 'AUDIT BREAKDOWN: BIG WINS & SUBSEQUENT TRADES'}
              </span>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#737973]">
                  {language === 'vi' ? 'Hiển thị:' : 'Show:'}
                </span>
                {[5, 10, 20, 0].map(sz => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setEuphoriaPageSize(sz)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                      euphoriaPageSize === sz
                        ? 'bg-white text-[#1d1b17] font-bold border border-[#d8d0c5] shadow-xs'
                        : 'text-[#737973] hover:bg-[#e8e2da] hover:text-[#4a6152]'
                    }`}
                  >
                    {sz === 0 ? (language === 'vi' ? 'Tất cả' : 'All') : sz}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#424843]">
                <thead className="bg-white border-b border-[var(--border-main)] text-[var(--text-muted)] font-medium text-[11px] uppercase">
                  <tr>
                    <th className="px-3 py-2 text-center">#</th>
                    <th className="px-3 py-2">{language === 'vi' ? 'Lệnh Thắng Đậm' : 'Big Win Trade'}</th>
                    <th className="px-3 py-2 text-right">{language === 'vi' ? 'Thực Nhận' : 'Actual PnL'}</th>
                    <th className="px-3 py-2 text-right">{language === 'vi' ? 'Đỉnh MFE' : 'Peak MFE'}</th>
                    <th className="px-3 py-2 text-right">{language === 'vi' ? 'Tỷ Lệ Giữ' : 'Capture %'}</th>
                    <th className="px-3 py-2 text-center">{language === 'vi' ? 'Thời Gian Gồng' : 'Holding Time'}</th>
                    <th className="px-3 py-2">{language === 'vi' ? `Diễn Biến ${euphoriaWindowSize} Lệnh Kế Tiếp (Timeline)` : `Next ${euphoriaWindowSize} Trades`}</th>
                    <th className="px-3 py-2 text-right">{language === 'vi' ? 'Tỷ Lệ Thua' : 'Post Loss %'}</th>
                    <th className="px-3 py-2 text-right">{language === 'vi' ? 'PnL Kế Tiếp' : 'Post PnL'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8e2da] font-mono text-[11px]">
                  {paginatedEuphoriaEvents.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-6 text-[#737973] font-sans italic">
                        {language === 'vi'
                          ? 'Chưa có lệnh thắng đậm nào đạt ngưỡng tham số đang chọn.'
                          : 'No big win events detected under current threshold settings.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedEuphoriaEvents.map(evt => {
                      const tr = evt.triggerTrade;
                      const hrs = Math.floor(evt.holdingMinutes / 60);
                      const mins = Math.floor(evt.holdingMinutes % 60);
                      const holdStr = hrs > 0 ? `${hrs}h ${mins}p` : `${mins}p`;

                      return (
                        <tr 
                          key={evt.triggerIndex} 
                          className="hover:bg-[#f6f2ec] transition-colors cursor-pointer group"
                          onClick={() => {
                            const rawTr = closedTrades.find(t => String(t.ticket || t.position_id) === String(tr.ticket));
                            if (rawTr && onSelectTrade) onSelectTrade(rawTr);
                          }}
                        >
                          <td className="px-3 py-2.5 text-center text-[#737973] group-hover:text-[#4a6152] font-medium">
                            {evt.triggerIndex}
                          </td>
                          <td className="px-3 py-2.5 font-sans">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#1d1b17] group-hover:text-[#4a6152]">#{tr.ticket}</span>
                              <span className="text-[10px] text-[#737973] font-mono">({tr.symbol})</span>
                              <span className={`text-[9px] px-1 py-0.2 rounded font-bold ${tr.type === 'BUY' ? 'text-emerald-500' : 'text-rose-500'}`}>
                                {tr.type}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="text-[#4a6152] font-bold">
                              +{(evt.actualR ?? 0).toFixed(2)}R
                            </span>
                            <span className="block text-[10px] text-[#737973]">
                              +${(evt.actualUsd ?? 0).toFixed(2)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className="text-[#424843] font-medium">
                              +{(evt.effectiveMaxR ?? 0).toFixed(2)}R
                            </span>
                            <span className="block text-[10px] text-[#737973]">
                              +${(evt.effectiveMaxR * tr.risk1R).toFixed(2)}
                            </span>
                          </td>
                          {/* CỘT TỶ LỆ GIỮ LÃI */}
                          <td className="px-3 py-2.5 text-right">
                            <span className="text-[#4a6152] font-bold">
                              {(evt.captureRatePercent ?? 0).toFixed(1)}%
                            </span>
                          </td>
                          {/* CỘT THỜI GIAN GỒNG LỆNH */}
                          <td className="px-3 py-2.5 text-center text-[#424843]">
                            <span className="font-mono text-[11px] font-medium">
                              {holdStr}
                            </span>
                          </td>
                          {/* Timeline các lệnh kế tiếp với pills màu sắc */}
                          <td className="px-3 py-2.5 font-sans">
                            {evt.followUps.length === 0 ? (
                              <span className="text-[#737973] text-[10px] italic">
                                {language === 'vi' ? '(Chưa có lệnh sau)' : '(No subsequent trades)'}
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {evt.followUps.map(fu => {
                                  let bgClass = 'bg-[#ede7df] text-[var(--text-muted)] border-[#d8d0c5]';
                                  let label = 'BE';
                                  if (fu.isLoss) {
                                    bgClass = 'bg-rose-50 text-[#825249] border-rose-200 font-bold';
                                    label = 'L';
                                  } else if (fu.isWin) {
                                    bgClass = 'bg-emerald-50 text-[#4a6152] border-emerald-200 font-bold';
                                    label = 'W';
                                  }
                                  return (
                                    <span
                                      key={fu.ticket}
                                      title={`Lệnh #${fu.ticket} (${fu.symbol}): ${fu.net >= 0 ? '+' : ''}$${fu.net.toFixed(2)}`}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono border hover:bg-[#e8e2da] cursor-help transition-colors ${bgClass}`}
                                    >
                                      #{fu.ticket}: {label} ({fu.net >= 0 ? '+' : ''}${fu.net.toFixed(0)})
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className={`font-bold ${evt.postEventLossRate >= 66 ? 'text-[#825249]' : 'text-[#1d1b17]'}`}>
                              {evt.postEventLossRate}%
                            </span>
                            <span className="block text-[10px] text-[#737973]">
                              ({evt.followUpLossCount}L - {evt.followUpWinCount}W - {evt.followUpBeCount}BE)
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold">
                            <span className={evt.followUpTotalPnlUsd >= 0 ? 'text-[#4a6152]' : 'text-[#825249]'}>
                              {evt.followUpTotalPnlUsd >= 0 ? '+' : ''}${(evt.followUpTotalPnlUsd ?? 0).toFixed(2)}
                            </span>
                            <span className="block text-[10px] text-[#737973]">
                              {evt.followUpTotalPnlR >= 0 ? '+' : ''}{(evt.followUpTotalPnlR ?? 0).toFixed(2)}R
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Phân trang dưới đáy bảng */}
            <div className="px-4 py-2 bg-[var(--bg-card)] border-t border-[var(--border-main)] flex items-center justify-between text-xs text-[#737973]">
              <span className="text-[11px]">
                {language === 'vi' ? 'Tổng cộng' : 'Total'}:{' '}
                <strong className="text-[#1d1b17]">{postEuphoriaPsychologyData.triggeredEvents.length}</strong> {language === 'vi' ? 'cú thắng đậm' : 'big win events'}
              </span>

              <div className="flex items-center gap-1 font-mono text-[11px]">
                <button
                  type="button"
                  disabled={safeEuphoriaPage <= 1}
                  onClick={() => setEuphoriaPage(p => Math.max(1, p - 1))}
                  className="w-5 h-5 rounded flex items-center justify-center bg-[#ede7df] hover:bg-[#e8e2da] text-[#737973] hover:text-[#1d1b17] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors text-[10px] border border-[#d8d0c5]"
                  title="Previous page"
                >
                  &lt;
                </button>

                {euphoriaPaginationNumbers.map((pNum, idx) => {
                  if (pNum === -1) {
                    return (
                      <span key={`eu-ell-${idx}`} className="w-3 text-center text-[#737973] text-[10px]">
                        ...
                      </span>
                    );
                  }
                  const isCur = pNum === safeEuphoriaPage;
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setEuphoriaPage(pNum)}
                      className={`w-5 h-5 rounded flex items-center justify-center font-medium text-[10px] transition-colors cursor-pointer ${
                        isCur
                          ? 'bg-[#e8e2da] text-[#1d1b17] font-bold border border-[#d8d0c5]'
                          : 'hover:bg-[#e8e2da] text-[#737973] hover:text-[#1d1b17]'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={safeEuphoriaPage >= totalEuphoriaPages}
                  onClick={() => setEuphoriaPage(p => Math.min(totalEuphoriaPages, p + 1))}
                  className="w-5 h-5 rounded flex items-center justify-center bg-[#ede7df] hover:bg-[#e8e2da] text-[#737973] hover:text-[#1d1b17] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors text-[10px] border border-[#d8d0c5]"
                  title="Next page"
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5.4.5 RÀ SOÁT TÂM LÝ: TRẢ LẠI TIỀN SAU CHUỖI THẮNG (POST-WIN STREAK CLAWBACK AUDIT) */}
      {(activeSection === 'ALL' || activeSection === 'PSYCHOLOGY') && (
        <div className="bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] p-4 shadow-lg space-y-4">
          {/* Header & Bộ lọc cấu hình */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-3 border-b border-[#e8e2da]">
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase font-sans">
                  {language === 'vi' ? 'RÀ SOÁT TÂM LÝ: TRẢ LẠI TIỀN SAU CHUỖI THẮNG (STREAK CLAWBACK AUDIT)' : 'PSYCHOLOGY AUDIT: POST-WIN STREAK CLAWBACK'}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase font-mono ${
                  postStreakClawbackData.clawbackSeverity === 'CRITICAL'
                    ? 'bg-[#e8e2da] text-[#825249] border-[#d8d0c5]'
                    : postStreakClawbackData.clawbackSeverity === 'ELEVATED'
                    ? 'bg-[#e8e2da] text-[#1d1b17] border-[#d8d0c5]'
                    : 'bg-[#e8e2da] text-[#4a6152] border-[#d8d0c5]'
                }`}>
                  {postStreakClawbackData.clawbackSeverity === 'CRITICAL' 
                    ? (language === 'vi' ? 'Báo Động: Bị Rút Lại > 50%' : 'Critical Clawback Drag')
                    : postStreakClawbackData.clawbackSeverity === 'ELEVATED'
                    ? (language === 'vi' ? 'Cảnh Báo: Bị Rút Lại > 30%' : 'Elevated Clawback Risk')
                    : (language === 'vi' ? 'Giữ Thành Quả Tốt' : 'Profit Retained')}
                </span>
              </div>
            </div>

            {/* Bộ điều khiển tương tác */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Chuỗi Thắng Tối Thiểu */}
              <div className="flex items-center gap-1.5 bg-[#ede7df] px-2 py-1 rounded-lg border border-[#e8e2da]">
                <span className="text-[10px] text-[#737973] font-medium">
                  {language === 'vi' ? 'Chuỗi Thắng ≥' : 'Min Streak ≥'}
                </span>
                {[2, 3, 4, 5].map(stk => (
                  <button
                    key={stk}
                    type="button"
                    onClick={() => setStreakClawbackMinStreak(stk)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                      streakClawbackMinStreak === stk
                        ? 'bg-white text-[#1d1b17] font-bold border border-[#d8d0c5] shadow-xs'
                        : 'text-[#737973] hover:bg-[#e8e2da] hover:text-[#4a6152]'
                    }`}
                  >
                    {stk} {language === 'vi' ? 'lệnh' : 'trades'}
                  </button>
                ))}
              </div>

              {/* Cửa sổ quan sát sau chuỗi */}
              <div className="flex items-center gap-1.5 bg-[#ede7df] px-2 py-1 rounded-lg border border-[#e8e2da]">
                <span className="text-[10px] text-[#737973] font-medium">
                  {language === 'vi' ? 'Quan sát:' : 'Window:'}
                </span>
                {[1, 3, 5].map(w => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setStreakClawbackWindowSize(w)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                      streakClawbackWindowSize === w
                        ? 'bg-white text-[#1d1b17] font-bold border border-[#d8d0c5] shadow-xs'
                        : 'text-[#737973] hover:bg-[#e8e2da] hover:text-[#4a6152]'
                    }`}
                  >
                    +{w} {language === 'vi' ? 'lệnh' : 'trades'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 4 Thẻ KPI */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {/* Card 1: Số chuỗi thắng ghi nhận */}
            <div className="p-3 bg-[#ede7df] rounded-lg border border-[#e8e2da]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#737973] font-medium uppercase">
                  {language === 'vi' ? 'Số Chuỗi Thắng' : 'Win Streaks'}
                </span>
                <span className="text-[10px] font-mono text-[#737973]">
                  ≥{streakClawbackMinStreak} {language === 'vi' ? 'lệnh liên tiếp' : 'in a row'}
                </span>
              </div>
              <p className="text-xl font-bold font-mono text-[#1d1b17] mt-1">
                {postStreakClawbackData.totalTriggered}{' '}
                <span className="text-xs font-normal text-[#737973] font-sans">
                  {language === 'vi' ? 'chuỗi' : 'streaks'}
                </span>
              </p>
              <p className="text-[10px] text-[#737973] mt-0.5">
                {language === 'vi'
                  ? `Tổng lãi từ các chuỗi: +$${postStreakClawbackData.totalGainedInStreaksUsd.toLocaleString()}`
                  : `Total profit in streaks: +$${postStreakClawbackData.totalGainedInStreaksUsd.toLocaleString()}`}
              </p>
            </div>

            {/* Card 2: Tỷ lệ trả lại lợi nhuận (%) */}
            <div className="p-3 bg-[#ede7df] rounded-lg border border-[#e8e2da]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#737973] font-medium uppercase">
                  {language === 'vi' ? 'Tỷ Lệ Bị Rút Lại' : 'Clawback Drag %'}
                </span>
                <span className={`text-[10px] font-bold font-mono ${postStreakClawbackData.clawbackPercent > 30 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {postStreakClawbackData.clawbackPercent}%
                </span>
              </div>
              <p className={`text-xl font-bold font-mono mt-1 ${postStreakClawbackData.clawbackPercent > 30 ? 'text-rose-400' : 'text-[#1d1b17]'}`}>
                -${postStreakClawbackData.totalClawedBackUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <p className="text-[10px] text-[#737973] mt-0.5">
                {language === 'vi'
                  ? 'Tổng số tiền nộp lại ngay sau khi vừa xong chuỗi thắng'
                  : 'Money given back right after winning streak ended'}
              </p>
            </div>

            {/* Card 3: Tỷ lệ thua sau chuỗi thắng */}
            <div className="p-3 bg-[#ede7df] rounded-lg border border-[#e8e2da]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#737973] font-medium uppercase">
                  {language === 'vi' ? `Tỷ Lệ Thua (+${streakClawbackWindowSize} Lệnh)` : `Loss Rate (+${streakClawbackWindowSize})`}
                </span>
                <span className={`text-[10px] font-bold font-mono ${postStreakClawbackData.lossRateDelta > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {postStreakClawbackData.lossRateDelta > 0 ? `+${postStreakClawbackData.lossRateDelta}%` : `${postStreakClawbackData.lossRateDelta}%`}
                </span>
              </div>
              <p className={`text-xl font-bold font-mono mt-1 ${postStreakClawbackData.postLossRate >= 60 ? 'text-rose-400' : 'text-[#1d1b17]'}`}>
                {postStreakClawbackData.postLossRate}%
              </p>
              <p className="text-[10px] text-[#737973] mt-0.5">
                {language === 'vi'
                  ? `So với trung bình tài khoản ${postStreakClawbackData.baselineLossRate}%`
                  : `Compared to account average ${postStreakClawbackData.baselineLossRate}%`}
              </p>
            </div>

            {/* Card 4: Chuỗi thua tối đa sau chuỗi thắng */}
            <div className="p-3 bg-[#ede7df] rounded-lg border border-[#e8e2da]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-[#737973] font-medium uppercase">
                  {language === 'vi' ? 'Chuỗi Thua Kế Tiếp' : 'Subsequent Loss Streak'}
                </span>
                <span className="text-[10px] font-mono text-[#737973]">
                  {language === 'vi' ? 'Tối đa' : 'Peak'}
                </span>
              </div>
              <p className={`text-xl font-bold font-mono mt-1 ${postStreakClawbackData.maxLossStreakAfter >= 3 ? 'text-rose-400' : 'text-[#1d1b17]'}`}>
                {postStreakClawbackData.maxLossStreakAfter}{' '}
                <span className="text-xs font-normal text-[#737973] font-sans">
                  {language === 'vi' ? 'lệnh liên tiếp' : 'trades in a row'}
                </span>
              </p>
              <p className="text-[10px] text-[#737973] mt-0.5">
                {language === 'vi'
                  ? 'Dấu hiệu trả thù hoặc nới lỏng setup sau chuỗi thắng'
                  : 'Signs of discipline drift following winning run'}
              </p>
            </div>
          </div>

          {/* Bảng Kiểm Toán Chi Tiết Từng Chuỗi Thắng */}
          <div className="bg-[#ede7df] rounded-lg border border-[#e8e2da] overflow-hidden">
            <div className="px-3.5 py-2.5 bg-[#ede7df] border-b border-[#e8e2da] flex items-center justify-between gap-3 flex-wrap">
              <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase font-sans">
                {language === 'vi' ? 'DANH SÁCH KIỂM TOÁN TỪNG CHUỖI THẮNG & MỨC ĐỘ RÚT LẠI TIỀN' : 'AUDIT BREAKDOWN: WIN STREAKS & CLAWBACK LOSS'}
              </span>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#737973]">
                  {language === 'vi' ? 'Hiển thị:' : 'Show:'}
                </span>
                {[5, 10, 20, 0].map(sz => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setStreakClawbackPageSize(sz)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold font-mono transition-colors cursor-pointer ${
                      streakClawbackPageSize === sz
                        ? 'bg-white text-[#1d1b17] font-bold border border-[#d8d0c5] shadow-xs'
                        : 'text-[#737973] hover:bg-[#e8e2da] hover:text-[#4a6152]'
                    }`}
                  >
                    {sz === 0 ? (language === 'vi' ? 'Tất cả' : 'All') : sz}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-[#424843]">
                <thead className="bg-white border-b border-[var(--border-main)] text-[var(--text-muted)] font-medium text-[11px] uppercase">
                  <tr>
                    <th className="px-3 py-2 text-center">#</th>
                    <th className="px-3 py-2">{language === 'vi' ? 'Chuỗi Thắng' : 'Win Streak'}</th>
                    <th className="px-3 py-2 text-right">{language === 'vi' ? 'Lợi Nhuận Chuỗi' : 'Streak Gain'}</th>
                    <th className="px-3 py-2 text-center">{language === 'vi' ? 'Các Lệnh Trong Chuỗi' : 'Streak Tickets'}</th>
                    <th className="px-3 py-2">{language === 'vi' ? `Diễn Biến ${streakClawbackWindowSize} Lệnh Kế Tiếp` : `Next ${streakClawbackWindowSize} Trades`}</th>
                    <th className="px-3 py-2 text-right">{language === 'vi' ? 'Tỷ Lệ Thua' : 'Post Loss %'}</th>
                    <th className="px-3 py-2 text-right">{language === 'vi' ? 'PnL Hậu Quả' : 'Post PnL'}</th>
                    <th className="px-3 py-2 text-right">{language === 'vi' ? 'Bị Rút Lại' : 'Clawback %'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#e8e2da] font-mono text-[11px]">
                  {paginatedStreakClawbackEvents.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="text-center py-6 text-[#737973] font-sans italic">
                        {language === 'vi'
                          ? 'Chưa có chuỗi thắng nào đạt độ dài đang chọn.'
                          : 'No win streak events detected under current threshold settings.'}
                      </td>
                    </tr>
                  ) : (
                    paginatedStreakClawbackEvents.map((evt, eIdx) => {
                      return (
                        <tr 
                          key={`sc-${evt.streakStartIndex}-${evt.streakEndIndex}`} 
                          className="hover:bg-[#f6f2ec] transition-colors cursor-pointer group"
                        >
                          <td className="px-3 py-2.5 text-center text-[#737973] group-hover:text-[#4a6152] font-medium">
                            {eIdx + 1}
                          </td>
                          <td className="px-3 py-2.5 font-sans">
                            <div className="flex items-center gap-1.5">
                              <span className="font-bold text-[#1d1b17] group-hover:text-[#4a6152]">
                                {evt.streakLength} {language === 'vi' ? 'lệnh thắng liên tiếp' : 'wins in a row'}
                              </span>
                              <span className="text-[10px] text-[#737973] font-mono">
                                (Lệnh #{evt.streakStartIndex} → #{evt.streakEndIndex})
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold text-[#4a6152]">
                            +${evt.streakTotalUsd.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            <span className="block text-[10px] text-[#737973] font-normal">
                              +{(evt.streakTotalR ?? 0).toFixed(2)}R
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-center font-sans">
                            <div className="flex items-center justify-center gap-1 flex-wrap max-w-xs mx-auto">
                              {evt.streakTrades.map(st => (
                                <span
                                  key={st.ticket}
                                  title={`#${st.ticket} (${st.symbol}): +$${st.net.toFixed(2)}`}
                                  className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-white text-[#4a6152] border border-[#d8d0c5]"
                                >
                                  #{st.ticket}
                                </span>
                              ))}
                            </div>
                          </td>
                          {/* Timeline lệnh kế tiếp */}
                          <td className="px-3 py-2.5 font-sans">
                            {evt.followUps.length === 0 ? (
                              <span className="text-[#737973] text-[10px] italic">
                                {language === 'vi' ? '(Chưa có lệnh sau)' : '(No subsequent trades)'}
                              </span>
                            ) : (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                {evt.followUps.map(fu => {
                                  let bgClass = 'bg-[#ede7df] text-[var(--text-muted)] border-[#d8d0c5]';
                                  let label = 'BE';
                                  if (fu.isLoss) {
                                    bgClass = 'bg-rose-50 text-[#825249] border-rose-200 font-bold';
                                    label = 'L';
                                  } else if (fu.isWin) {
                                    bgClass = 'bg-emerald-50 text-[#4a6152] border-emerald-200 font-bold';
                                    label = 'W';
                                  }
                                  return (
                                    <span
                                      key={fu.ticket}
                                      title={`Lệnh #${fu.ticket} (${fu.symbol}): ${fu.net >= 0 ? '+' : ''}$${fu.net.toFixed(2)}`}
                                      className={`px-1.5 py-0.5 rounded text-[10px] font-mono border hover:bg-[#e8e2da] cursor-help transition-colors ${bgClass}`}
                                    >
                                      #{fu.ticket}: {label} ({fu.net >= 0 ? '+' : ''}${fu.net.toFixed(0)})
                                    </span>
                                  );
                                })}
                              </div>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className={`font-bold ${evt.postEventLossRate >= 66 ? 'text-[#825249]' : 'text-[#1d1b17]'}`}>
                              {evt.postEventLossRate}%
                            </span>
                            <span className="block text-[10px] text-[#737973]">
                              ({evt.followUpLossCount}L - {evt.followUpWinCount}W - {evt.followUpBeCount}BE)
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right font-bold">
                            <span className={evt.followUpTotalPnlUsd >= 0 ? 'text-[#4a6152]' : 'text-[#825249]'}>
                              {evt.followUpTotalPnlUsd >= 0 ? '+' : ''}${(evt.followUpTotalPnlUsd ?? 0).toFixed(2)}
                            </span>
                            <span className="block text-[10px] text-[#737973]">
                              {evt.followUpTotalPnlR >= 0 ? '+' : ''}{(evt.followUpTotalPnlR ?? 0).toFixed(2)}R
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right">
                            <span className={`font-bold ${evt.clawbackPercent >= 50 ? 'text-[#825249]' : evt.clawbackPercent >= 25 ? 'text-[#1d1b17]' : 'text-[#4a6152]'}`}>
                              {evt.clawbackPercent}%
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Phân trang dưới đáy bảng */}
            <div className="px-4 py-2 bg-[var(--bg-card)] border-t border-[var(--border-main)] flex items-center justify-between text-xs text-[#737973]">
              <span className="text-[11px]">
                {language === 'vi' ? 'Tổng cộng' : 'Total'}:{' '}
                <strong className="text-[#1d1b17]">{postStreakClawbackData.triggeredEvents.length}</strong> {language === 'vi' ? 'chuỗi thắng' : 'win streaks'}
              </span>

              <div className="flex items-center gap-1 font-mono text-[11px]">
                <button
                  type="button"
                  disabled={safeStreakClawbackPage <= 1}
                  onClick={() => setStreakClawbackPage(p => Math.max(1, p - 1))}
                  className="w-5 h-5 rounded flex items-center justify-center bg-[#ede7df] hover:bg-[#e8e2da] text-[#737973] hover:text-[#1d1b17] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors text-[10px] border border-[#d8d0c5]"
                  title="Previous page"
                >
                  &lt;
                </button>

                {streakClawbackPaginationNumbers.map((pNum, idx) => {
                  if (pNum === -1) {
                    return (
                      <span key={`sc-ell-${idx}`} className="w-3 text-center text-[#737973] text-[10px]">
                        ...
                      </span>
                    );
                  }
                  const isCur = pNum === safeStreakClawbackPage;
                  return (
                    <button
                      key={pNum}
                      type="button"
                      onClick={() => setStreakClawbackPage(pNum)}
                      className={`w-5 h-5 rounded flex items-center justify-center font-medium text-[10px] transition-colors cursor-pointer ${
                        isCur
                          ? 'bg-[#e8e2da] text-[#1d1b17] font-bold border border-[#d8d0c5]'
                          : 'hover:bg-[#e8e2da] text-[#737973] hover:text-[#1d1b17]'
                      }`}
                    >
                      {pNum}
                    </button>
                  );
                })}

                <button
                  type="button"
                  disabled={safeStreakClawbackPage >= totalStreakClawbackPages}
                  onClick={() => setStreakClawbackPage(p => Math.min(totalStreakClawbackPages, p + 1))}
                  className="w-5 h-5 rounded flex items-center justify-center bg-[#ede7df] hover:bg-[#e8e2da] text-[#737973] hover:text-[#1d1b17] disabled:opacity-20 disabled:cursor-not-allowed cursor-pointer transition-colors text-[10px] border border-[#d8d0c5]"
                  title="Next page"
                >
                  &gt;
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5.5 QUẢN LÝ VỐN & PHÍ SÀN */}
      {(activeSection === 'ALL' || activeSection === 'CAPITAL') && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3.5">
          <div className="bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] p-4 shadow-lg space-y-3">
            <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase block pb-2 border-b border-[#e8e2da]">
              {language === 'vi' ? 'Lệnh Đơn (1.1) vs Nhồi Lệnh Scaling (1.1 + 1.2)' : 'Single Entry vs Scaling Clusters'}
            </span>
            <div className="grid grid-cols-2 gap-3 text-center">
              <div className="p-3 bg-[#ede7df] rounded-lg border border-[#e8e2da]">
                <span className="text-[10px] text-[#737973] uppercase">{language === 'vi' ? 'Lệnh Đơn' : 'Single'}</span>
                <p className={`text-base font-bold font-mono mt-1 ${capitalAndFeesData.singlePnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {capitalAndFeesData.singlePnl >= 0 ? '+' : ''}${(capitalAndFeesData?.singlePnl ?? 0).toFixed(2)}
                </p>
                <p className="text-[10px] text-[#737973] mt-0.5">{capitalAndFeesData.singleCount} {language === 'vi' ? 'vị thế' : 'positions'}</p>
              </div>
              <div className="p-3 bg-[#ede7df] rounded-lg border border-[#e8e2da]">
                <span className="text-[10px] text-[#737973] uppercase">{language === 'vi' ? 'Nhồi Lệnh Scaling' : 'Clusters'}</span>
                <p className={`text-base font-bold font-mono mt-1 ${capitalAndFeesData.clusterPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {capitalAndFeesData.clusterPnl >= 0 ? '+' : ''}${(capitalAndFeesData?.clusterPnl ?? 0).toFixed(2)}
                </p>
                <p className="text-[10px] text-[#737973] mt-0.5">{capitalAndFeesData.clusterCount} {language === 'vi' ? 'cụm' : 'clusters'}</p>
              </div>
            </div>
          </div>

          <div className="bg-white shadow-[6px_8px_18px_rgba(125,110,95,0.08),inset_1px_1px_2px_rgba(255,255,255,0.95)] rounded-xl border border-[#e8e2da] p-4 shadow-lg space-y-3">
            <span className="font-bold text-[#1d1b17] text-xs tracking-wider uppercase block pb-2 border-b border-[#e8e2da]">
              {language === 'vi' ? 'Bào Mòn Do Phí Sàn (Commission & Swap)' : 'Broker Friction Drag'}
            </span>
            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between text-[#737973]">
                <span>Commission:</span>
                <span className="font-mono text-rose-400 font-bold">-${(capitalAndFeesData?.totalComm ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#737973]">
                <span>Swap:</span>
                <span className="font-mono text-rose-400 font-bold">-${(capitalAndFeesData?.totalSwap ?? 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#1d1b17] font-bold pt-1.5 border-t border-[#e8e2da]">
                <span>{language === 'vi' ? 'Tổng phí đã nộp cho sàn:' : 'Total Friction:'}</span>
                <span className="font-mono text-rose-400">-${(capitalAndFeesData?.totalFeeDrag ?? 0).toFixed(2)} ({(capitalAndFeesData?.feeDragPercent ?? 0)}%)</span>
              </div>
            </div>
          </div>
        </div>
      )}



    </div>
  );
};

export default ReportsTab;
