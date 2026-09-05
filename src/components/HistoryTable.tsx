import React, { useState, useMemo } from 'react';
import { 
  TradeRow, 
  TradeGroup, 
  TradeType, 
  TradeResult,
  TradingPlan,
  PendingOrder
} from '../types';
import { 
  groupTradesByPosition, 
  formatCurrency, 
  formatDuration, 
  formatDateTimeWithOffset, 
  formatSessionLabel,
  formatPipSl,
  isNoiseTrade,
  getSavedNoiseFilter,
  getSavedHideNoiseRows
} from '../utils/tradeCalculations';
import { fetchPlansForTrade } from '../lib/supabase';
import { 
  ChevronDown, 
  ChevronRight, 
  Filter, 
  RefreshCw,
  Database,
  Settings as SettingsIcon,
  Link2,
  Sparkles,
  Check,
  Plus,
  X
} from 'lucide-react';

interface HistoryTableProps {
  trades: TradeRow[];
  pendingOrders?: PendingOrder[];
  selectedTradeId: string | null;
  onSelectTrade: (trade: TradeRow) => void;
  searchFilter: string;
  onSearchChange?: (q: string) => void;
  isLoading?: boolean;
  accountId?: string;
  timezoneOffset?: number;
  onSync?: () => void;
  onOpenSettings?: () => void;
  plans?: TradingPlan[];
  onMapPlanToTrade?: (tradeId: string, planId: string | null, planObj?: TradingPlan) => void;
  onNavigateToPlans?: () => void;

  // Active filter values passed from the Hàng 1 Dropdown Filter
  selectedSymbol?: string;
  selectedType?: string;
  selectedSession?: string;
  selectedResult?: string;
  selectedSetup?: string;
  noiseFilterActive?: boolean;
  hideNoiseRows?: boolean;
}

export const HistoryTable: React.FC<HistoryTableProps> = ({
  trades,
  pendingOrders = [],
  selectedTradeId,
  onSelectTrade,
  searchFilter,
  isLoading = false,
  accountId = '26325348',
  timezoneOffset = 0,
  onSync,
  onOpenSettings,
  plans = [],
  onMapPlanToTrade,
  onNavigateToPlans,

  // Filters from Hàng 1 Dropdown
  selectedSymbol = 'ALL',
  selectedType = 'ALL',
  selectedSession = 'ALL',
  selectedResult = 'ALL',
  selectedSetup = 'ALL',
  noiseFilterActive = getSavedNoiseFilter(),
  hideNoiseRows = getSavedHideNoiseRows(),
}) => {
  // Plan dropdown selector state (1-Click Mapping)
  const [openPlanDropdownTradeId, setOpenPlanDropdownTradeId] = useState<string | null>(null);
  const [showOnlyMatchingSymbolPlans, setShowOnlyMatchingSymbolPlans] = useState<boolean>(true);
  const [queriedPlansByTrade, setQueriedPlansByTrade] = useState<Record<string, TradingPlan[]>>({});
  const [loadingPlansForTrade, setLoadingPlansForTrade] = useState<string | null>(null);

  // 1-Click Map: Tải danh sách Plan theo điều kiện lọc kép (account_id + symbol) khi mở popover
  const handleTogglePlanDropdown = async (trade: TradeRow) => {
    if (openPlanDropdownTradeId === trade.id) {
      setOpenPlanDropdownTradeId(null);
      return;
    }
    setOpenPlanDropdownTradeId(trade.id);
    const tradeAccId = trade.account_id || accountId;
    setLoadingPlansForTrade(trade.id);
    try {
      const fetched = await fetchPlansForTrade(tradeAccId, trade.symbol);
      setQueriedPlansByTrade(prev => ({
        ...prev,
        [trade.id]: fetched,
      }));
    } catch (err) {
      console.warn('Lỗi khi fetchPlansForTrade cho lệnh:', err);
    } finally {
      setLoadingPlansForTrade(null);
    }
  };

  // Expanded scaling child groups (1.1, 1.2)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    '558385408': true
  });

  const toggleGroup = (posId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedGroups(prev => ({
      ...prev,
      [posId]: !prev[posId]
    }));
  };

  // 1. Chỉ lấy các lệnh STATUS = 'CLOSED' cho nhóm đã đóng
  const closedTrades = useMemo(() => {
    return trades.filter(t => (t.status || 'CLOSED').toUpperCase().trim() === 'CLOSED');
  }, [trades]);

  // 2. Chuyển đổi Lệnh Chờ (Pending Orders) thành TradeGroup để hiển thị chung trên cùng 1 bảng
  const pendingTradeGroups = useMemo(() => {
    if (!pendingOrders || pendingOrders.length === 0) return [];
    return pendingOrders.map((p, idx): TradeGroup => {
      const isSell = (p.type || '').toUpperCase().includes('SELL');
      const orderType: TradeType = isSell ? 'SELL' : 'BUY';
      const syntheticTrade: TradeRow = {
        id: p.id || `pending-${p.ticket || idx}`,
        ticket: String(p.ticket || `P-${idx + 1}`),
        position_id: String(p.ticket || `P-${idx + 1}`),
        account_id: accountId,
        symbol: p.symbol,
        type: orderType,
        volume: p.volume,
        open_price: p.price,
        close_price: 0,
        initial_sl: p.sl,
        pnl: 0,
        commission: 0,
        swap: 0,
        open_time: p.placed_time || '',
        close_time: '-',
        pip_sl: p.sl > 0 ? Math.abs(p.price - p.sl) : 0,
        risk_1r_usd: 100,
        net_pnl: 0,
        weighted_rr: 0,
        lost_profit: 0,
        timeframe: 'M15',
        session: 'Á',
        pre_checklist_ids: [],
        post_checklist_ids: [],
        notes: p.notes || '',
        plan_id: p.plan_id,
        plan_name: p.plan_title,
        status: 'PENDING',
        is_noise: p.volume <= 0.01,
        result: 'BE' as any
      };

      return {
        position_id: `pending-${p.ticket}`,
        ticket: String(p.ticket),
        account_id: accountId,
        symbol: p.symbol,
        type: orderType,
        total_volume: p.volume,
        avg_open_price: p.price,
        avg_close_price: 0,
        pip_sl: p.sl > 0 ? Math.abs(p.price - p.sl) : 0,
        initial_sl: p.sl,
        open_time: p.placed_time || '',
        close_time: '-',
        net_pnl: 0,
        weighted_rr: 0,
        pnl_percentage: 0,
        result: 'BE' as TradeResult,
        session: 'Á',
        running_balance: 0,
        is_noise: p.volume <= 0.01,
        plan_id: p.plan_id,
        plan_name: p.plan_title,
        trades: [syntheticTrade],
        master_trade: syntheticTrade
      };
    });
  }, [pendingOrders, accountId]);

  // 3. Gom Lệnh Khớp + Lệnh Chờ vào danh sách tổng
  const allTradeGroups = useMemo(() => {
    const closedGroups = groupTradesByPosition(closedTrades);
    // Đưa lệnh chờ lên đầu danh sách để trader dễ giám sát
    return [...pendingTradeGroups, ...closedGroups];
  }, [pendingTradeGroups, closedTrades]);

  // 4. Áp dụng các bộ lọc từ Dropdown ở Hàng 1
  const filteredGroups = useMemo(() => {
    return allTradeGroups.filter(g => {
      const isPendingOrder = g.master_trade.status === 'PENDING';

      // Ẩn hoàn toàn lệnh rác nếu người dùng chọn ẩn khỏi bảng
      if (noiseFilterActive && hideNoiseRows && g.is_noise) return false;

      // Symbol
      if (selectedSymbol !== 'ALL') {
        const cleanA = g.symbol.replace('/', '').toUpperCase();
        const cleanB = selectedSymbol.replace('/', '').toUpperCase();
        if (cleanA !== cleanB) return false;
      }

      // Type
      if (selectedType !== 'ALL' && g.type !== selectedType) return false;

      // Session
      if (selectedSession !== 'ALL') {
        if (selectedSession === 'Á' && g.session !== 'Á') return false;
        if (selectedSession === 'Âu' && g.session !== 'Âu') return false;
        if (selectedSession === 'Mỹ' && g.session !== 'Mỹ') return false;
      }

      // Result (Win, Loss, BE)
      if (selectedResult !== 'ALL') {
        if (isPendingOrder) return false; // Lệnh chờ không có kết quả Win/Loss/BE
        if (g.result !== selectedResult) return false;
      }

      // Setup
      if (selectedSetup !== 'ALL') {
        const matchesSetup = g.trades.some(t => 
          (t.setup && t.setup.toLowerCase().includes(selectedSetup.toLowerCase())) ||
          (t.setups && t.setups.some(s => s.toLowerCase().includes(selectedSetup.toLowerCase())))
        );
        if (!matchesSetup) return false;
      }

      // Search Filter (Ticket, Symbol, Notes)
      if (searchFilter && searchFilter.trim() !== '') {
        const q = searchFilter.toLowerCase();
        const matchesTicket = g.ticket.toLowerCase().includes(q) || g.position_id.toLowerCase().includes(q);
        const matchesSymbol = g.symbol.toLowerCase().includes(q);
        const matchesChildren = g.trades.some(child => 
          child.ticket.toLowerCase().includes(q) || 
          (child.notes && child.notes.toLowerCase().includes(q))
        );
        if (!matchesTicket && !matchesSymbol && !matchesChildren) return false;
      }

      return true;
    });
  }, [allTradeGroups, noiseFilterActive, hideNoiseRows, selectedSymbol, selectedType, selectedSession, selectedResult, selectedSetup, searchFilter]);

  return (
    <div className="flex flex-col bg-[var(--bg-main)] select-none transition-colors duration-200">
      {/* BẢNG LỊCH SỬ 15 CỘT (HÀNG 3 CŨ ĐÃ BỊ XÓA HOÀN TOÀN NHƯ YÊU CẦU) */}
      <div className="overflow-x-auto max-h-[calc(100vh-280px)] overflow-y-auto">
        <table className="w-full text-left text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-[var(--table-header)] border-b border-[var(--border-main)] text-[var(--text-secondary)] font-semibold tracking-wider text-[11px] uppercase shadow-sm">
            <tr>
              <th className="py-2.5 px-3 font-mono">MÃ LỆNH</th>
              <th className="py-2.5 px-3">CẶP TIỀN</th>
              <th className="py-2.5 px-3 text-center min-w-[150px]">KẾ HOẠCH (PLAN)</th>
              <th className="py-2.5 px-3 text-center">LOẠI</th>
              <th className="py-2.5 px-3 text-right">KL</th>
              <th className="py-2.5 px-3 text-right">GIÁ VÀO</th>
              <th className="py-2.5 px-3 text-right">GIÁ ĐÓNG</th>
              <th className="py-2.5 px-3 text-right">PIP SL</th>
              <th className="py-2.5 px-3">
                VÀO LỆNH {timezoneOffset !== 0 && <span className="text-teal-400 text-[10px]">({timezoneOffset > 0 ? `+${timezoneOffset}h` : `${timezoneOffset}h`})</span>}
              </th>
              <th className="py-2.5 px-3">
                ĐÓNG LỆNH {timezoneOffset !== 0 && <span className="text-teal-400 text-[10px]">({timezoneOffset > 0 ? `+${timezoneOffset}h` : `${timezoneOffset}h`})</span>}
              </th>
              <th className="py-2.5 px-3 text-center">GIỮ LỆNH</th>
              <th className="py-2.5 px-3 text-center">KQ</th>
              <th className="py-2.5 px-3 text-center text-teal-400">R:R ĐẠT ĐƯỢC</th>
              <th className="py-2.5 px-3 text-right">% LÃI</th>
              <th className="py-2.5 px-3 text-right text-emerald-400">NET PNL ($)</th>
              <th className="py-2.5 px-3 text-right font-mono text-teal-400">RUNNING BALANCE</th>
              <th className="py-2.5 px-3 text-center">PHIÊN</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-main)] font-mono">
            {filteredGroups.length === 0 ? (
              <tr>
                <td colSpan={17} className="py-16 text-center font-sans">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center gap-3">
                      <RefreshCw className="w-8 h-8 text-teal-400 animate-spin" />
                      <span className="text-sm font-semibold text-[var(--text-primary)]">Đang tải dữ liệu từ Supabase...</span>
                      <span className="text-xs text-[var(--text-muted)] font-mono">
                        Truy vấn bảng trades với Account ID: #{accountId}
                      </span>
                    </div>
                  ) : trades.length === 0 && pendingOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto p-6 rounded-2xl bg-[var(--bg-card)] border border-[var(--border-main)]">
                      <div className="w-12 h-12 rounded-full bg-teal-500/15 border border-teal-500/30 flex items-center justify-center mb-3">
                        <Database className="w-6 h-6 text-teal-400 animate-pulse" />
                      </div>
                      <h3 className="text-base font-bold text-[var(--text-primary)] mb-1">Chờ dữ liệu từ MT5...</h3>
                      <p className="text-xs text-[var(--text-secondary)] mb-4 text-center leading-relaxed">
                        Chưa có lệnh nào từ tài khoản MT5 <span className="text-teal-400 font-mono font-semibold">#{accountId}</span> trong bảng <code className="text-teal-400 font-mono">trades</code> trên Supabase.
                      </p>
                      <div className="flex items-center gap-2">
                        {onSync && (
                          <button
                            type="button"
                            onClick={onSync}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 text-teal-400 border border-teal-500/40 text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                            <span>Đồng bộ ngay</span>
                          </button>
                        )}
                        {onOpenSettings && (
                          <button
                            type="button"
                            onClick={onOpenSettings}
                            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--border-main)] text-[var(--text-primary)] border border-[var(--border-main)] text-xs font-semibold transition-colors cursor-pointer"
                          >
                            <SettingsIcon className="w-3.5 h-3.5" />
                            <span>Cài đặt kết nối</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
                      <Filter className="w-6 h-6 text-[var(--text-muted)] opacity-60" />
                      <span className="text-sm font-medium text-[var(--text-secondary)]">Không tìm thấy lệnh giao dịch nào khớp với bộ lọc</span>
                      <span className="text-xs text-[var(--text-muted)]">Hãy thử đặt lại bộ lọc tìm kiếm hoặc thay đổi tiêu chí lọc</span>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              filteredGroups.map(group => {
                const isPending = group.master_trade.status === 'PENDING';
                const isGroupSelected = group.trades.some(t => t.id === selectedTradeId);
                const hasChildren = group.trades.length > 1;
                const isExpanded = !!expandedGroups[group.position_id];
                const isBuy = group.type === 'BUY';
                const isWin = group.result === 'Win';
                const isLoss = group.result === 'Loss';
                const sessionLabel = formatSessionLabel(group.session);
                const duration = isPending ? 'Chờ khớp' : formatDuration(group.open_time, group.close_time);

                return (
                  <React.Fragment key={group.position_id}>
                    {/* MASTER ROW */}
                    <tr
                      onClick={() => onSelectTrade(group.master_trade)}
                      className={`cursor-pointer transition-all duration-100 ${
                        isGroupSelected
                          ? 'bg-teal-500/10 border-l-2 border-l-teal-500 text-[var(--text-primary)] font-medium'
                          : isPending
                          ? 'bg-amber-500/5 hover:bg-amber-500/10 text-[var(--text-primary)] border-l-2 border-l-amber-500/40'
                          : group.is_noise
                          ? 'opacity-70 hover:opacity-100 bg-amber-950/10 text-[var(--text-secondary)] border-l-2 border-l-amber-500/40'
                          : 'hover:bg-[var(--table-row-hover)] text-[var(--text-secondary)]'
                      }`}
                    >
                      {/* MÃ LỆNH (Gồm Tag PENDING hoặc NOISE định dạng đồng nhất) */}
                      <td className="py-2.5 px-3 font-semibold text-[var(--text-primary)]">
                        <div className="flex items-center gap-1.5">
                          {hasChildren ? (
                            <button
                              type="button"
                              onClick={(e) => toggleGroup(group.position_id, e)}
                              className="p-0.5 rounded hover:bg-[var(--border-main)] text-teal-400 transition-colors"
                              title="Bấm để xem các lệnh chia nhỏ / scaling"
                            >
                              {isExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5" />
                              )}
                            </button>
                          ) : (
                            <span className="w-4" />
                          )}
                          <span className="text-teal-400 font-mono font-bold hover:underline">#{group.ticket}</span>
                          
                          {/* Tag PENDING cho Lệnh Chờ (Kiểu dáng & Màu sắc đồng bộ với Tag NOISE) */}
                          {isPending && (
                            <span 
                              className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-400 font-sans font-bold"
                              title="Lệnh chờ (Pending Order) chưa khớp từ MT5"
                            >
                              PENDING
                            </span>
                          )}

                          {/* Tag NOISE cho Lệnh Rác */}
                          {!isPending && group.is_noise && (
                            <span 
                              className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 border border-amber-500/40 text-amber-400 font-sans font-bold"
                              title="Lệnh rác (Volume <= 0.01 Lot) - Đã được lọc khỏi Winrate & R:R"
                            >
                              NOISE
                            </span>
                          )}

                          {hasChildren && (
                            <span className="text-[10px] px-1 py-0.2 rounded bg-teal-500/20 border border-teal-500/30 text-teal-400 font-sans font-medium" title="Gom cụm Scaling / Cắt từng phần">
                              1.1, 1.2
                            </span>
                          )}
                        </div>
                      </td>

                      {/* CẶP TIỀN */}
                      <td className="py-2.5 px-3 font-sans font-bold text-[var(--text-primary)]">
                        {group.symbol}
                      </td>

                      {/* KẾ HOẠCH (PLAN) - 1-CLICK MAPPING */}
                      <td 
                        className="py-2 px-3 text-center relative"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {(() => {
                          const planId = group.master_trade.plan_id || group.plan_id;
                          const mappedPlan = plans.find(p => p.id === planId);
                          const isOpen = openPlanDropdownTradeId === group.master_trade.id;
                          const tradeAccId = group.master_trade.account_id || accountId;
                          const isCurrentTradeLoading = loadingPlansForTrade === group.master_trade.id;

                          // Lọc kép 2 lớp chặt chẽ theo Đa Tài Khoản (account_id) và cặp tiền (symbol)
                          const fetchedPlans = queriedPlansByTrade[group.master_trade.id];
                          const symbolPlans = (fetchedPlans ?? plans).filter(p => {
                            const pAcc = String(p.account_id || '').replace(/^acc-/, '').trim();
                            const targetAcc = String(tradeAccId || '').replace(/^acc-/, '').trim();
                            const matchAcc = !targetAcc || targetAcc === 'ALL' || !pAcc || pAcc === targetAcc;
                            const matchSym = (p.symbol || '').replace('/', '').toUpperCase() === group.symbol.replace('/', '').toUpperCase();
                            return matchAcc && matchSym;
                          });

                          const accountPlans = (plans || []).filter(p => {
                            const pAcc = String(p.account_id || '').replace(/^acc-/, '').trim();
                            const targetAcc = String(tradeAccId || '').replace(/^acc-/, '').trim();
                            return !targetAcc || targetAcc === 'ALL' || !pAcc || pAcc === targetAcc;
                          });

                          const displayedPlans = showOnlyMatchingSymbolPlans ? symbolPlans : accountPlans;

                          return (
                            <div className="inline-block relative">
                              {mappedPlan ? (
                                <button
                                  type="button"
                                  onClick={() => handleTogglePlanDropdown(group.master_trade)}
                                  className="group/btn inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-teal-500/15 hover:bg-teal-500/25 border border-teal-500/40 text-teal-500 dark:text-teal-400 text-[11px] font-sans font-semibold transition-all max-w-[170px]"
                                  title={`Đã gán Plan: ${mappedPlan.plan_name || mappedPlan.title}. Bấm để đổi hoặc hủy.`}
                                >
                                  <Link2 className="w-3 h-3 text-teal-400 shrink-0" />
                                  <span className="truncate max-w-[95px]">{mappedPlan.plan_name || mappedPlan.code}</span>
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 shrink-0 font-mono">
                                    EXECUTED
                                  </span>
                                  <ChevronDown className="w-2.5 h-2.5 text-teal-400/80 group-hover/btn:translate-y-0.5 transition-transform shrink-0" />
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleTogglePlanDropdown(group.master_trade)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--border-main)] border border-dashed border-[var(--border-main)] hover:border-teal-500/60 text-[var(--text-secondary)] hover:text-teal-400 text-[11px] font-sans transition-all cursor-pointer"
                                  title="Bấm để 1-Click Map Kế Hoạch (Lọc theo MT5 Acc & Symbol)"
                                >
                                  <Link2 className="w-3 h-3 text-[var(--text-muted)]" />
                                  <span>+ Gán Plan</span>
                                  <ChevronDown className="w-2.5 h-2.5 text-[var(--text-muted)]" />
                                </button>
                              )}

                              {/* Dropdown 1-Click Mapping Popover */}
                              {isOpen && (
                                <div className="absolute left-0 top-full mt-1.5 w-84 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl shadow-2xl p-3 z-50 font-sans text-left animate-fade-in">
                                  {/* Header Popover */}
                                  <div className="flex items-start justify-between pb-2 border-b border-[var(--border-main)]">
                                    <div>
                                      <div className="flex items-center gap-1.5 text-xs font-bold text-[var(--text-primary)]">
                                        <Sparkles className="w-3.5 h-3.5 text-teal-400" />
                                        <span>Gán Plan cho #{group.ticket}</span>
                                      </div>
                                      <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-[var(--text-secondary)] font-mono">
                                        <span className="px-1.5 py-0.2 rounded bg-[var(--bg-subtle)] text-teal-400 border border-[var(--border-main)] font-semibold">
                                          MT5 #{tradeAccId}
                                        </span>
                                        <span>•</span>
                                        <span className="px-1.5 py-0.2 rounded bg-[var(--bg-subtle)] text-[var(--text-primary)] font-bold">
                                          {group.symbol}
                                        </span>
                                      </div>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => setOpenPlanDropdownTradeId(null)}
                                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5 rounded cursor-pointer"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>

                                  {/* Filter Toggle */}
                                  <div className="flex items-center justify-between my-2 text-[10px] text-[var(--text-secondary)]">
                                    <span>Lọc Plan:</span>
                                    <div className="flex gap-1">
                                      <button
                                        type="button"
                                        onClick={() => setShowOnlyMatchingSymbolPlans(true)}
                                        className={`px-1.5 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                                          showOnlyMatchingSymbolPlans 
                                            ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40' 
                                            : 'hover:bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                                        }`}
                                      >
                                        Chỉ {group.symbol} ({symbolPlans.length})
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => setShowOnlyMatchingSymbolPlans(false)}
                                        className={`px-1.5 py-0.5 rounded font-bold transition-colors cursor-pointer ${
                                          !showOnlyMatchingSymbolPlans 
                                            ? 'bg-teal-500/20 text-teal-400 border border-teal-500/40' 
                                            : 'hover:bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                                        }`}
                                      >
                                        Tất cả MT5 #{tradeAccId} ({accountPlans.length})
                                      </button>
                                    </div>
                                  </div>

                                  {/* Danh sách Plan có thể Map hoặc Loading */}
                                  {isCurrentTradeLoading ? (
                                    <div className="py-6 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)] text-xs">
                                      <RefreshCw className="w-4 h-4 text-teal-400 animate-spin" />
                                      <span>Đang lọc Plan theo MT5 #{tradeAccId} & {group.symbol}...</span>
                                    </div>
                                  ) : (
                                    <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                                      {mappedPlan && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            onMapPlanToTrade?.(group.master_trade.id, null);
                                            if (group.trades) {
                                              group.trades.forEach(st => onMapPlanToTrade?.(st.id, null));
                                            }
                                            setOpenPlanDropdownTradeId(null);
                                          }}
                                          className="w-full text-left p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/30 text-rose-400 text-[11px] font-medium flex items-center justify-between transition-colors cursor-pointer"
                                        >
                                          <span>✕ Hủy liên kết Plan hiện tại</span>
                                        </button>
                                      )}

                                      {displayedPlans.length === 0 ? (
                                        <div className="py-4 text-center text-[var(--text-muted)] text-xs space-y-1">
                                          <p>Không có Plan nào thuộc MT5 #{tradeAccId} {showOnlyMatchingSymbolPlans ? `cho cặp ${group.symbol}` : ''}.</p>
                                          {onNavigateToPlans && (
                                            <button
                                              type="button"
                                              onClick={() => {
                                                setOpenPlanDropdownTradeId(null);
                                                onNavigateToPlans();
                                              }}
                                              className="text-teal-400 hover:underline text-[11px] font-bold"
                                            >
                                              + Tạo Kế Hoạch mới cho #{tradeAccId}
                                            </button>
                                          )}
                                        </div>
                                      ) : (
                                        displayedPlans.map(p => {
                                          const isCurrent = p.id === planId;
                                          const isPlanExecuted = p.status === 'EXECUTED' || p.status === 'TRIGGERED';
                                          return (
                                            <button
                                              key={p.id}
                                              type="button"
                                              onClick={() => {
                                                onMapPlanToTrade?.(group.master_trade.id, p.id, p);
                                                if (group.trades) {
                                                  group.trades.forEach(st => onMapPlanToTrade?.(st.id, p.id, p));
                                                }
                                                setOpenPlanDropdownTradeId(null);
                                              }}
                                              className={`w-full text-left p-2 rounded-lg border transition-all text-xs flex flex-col gap-1 cursor-pointer ${
                                                isCurrent
                                                  ? 'bg-teal-500/15 border-teal-500/50 text-teal-300'
                                                  : 'bg-[var(--bg-subtle)] hover:bg-[var(--border-main)] border-[var(--border-main)] text-[var(--text-primary)]'
                                              }`}
                                            >
                                              <div className="flex items-center justify-between">
                                                <span className="font-bold text-[var(--text-primary)] text-[11px] truncate">
                                                  {p.plan_name || p.title}
                                                </span>
                                                <div className="flex items-center gap-1 shrink-0">
                                                  <span className="font-mono text-[10px] text-teal-400 bg-teal-500/10 px-1 rounded border border-teal-500/30">
                                                    {p.timeframe}
                                                  </span>
                                                  <span className={`text-[9px] font-bold px-1 rounded ${
                                                    isPlanExecuted
                                                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                                                      : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                                                  }`}>
                                                    {isPlanExecuted ? 'EXECUTED' : 'PENDING'}
                                                  </span>
                                                </div>
                                              </div>

                                              <div className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]">
                                                <span className="truncate">{p.setup || 'Setup chuẩn'}</span>
                                                {isCurrent && (
                                                  <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                                                    <Check className="w-3 h-3" /> Đang gán
                                                  </span>
                                                )}
                                              </div>
                                            </button>
                                          );
                                        })
                                      )}
                                    </div>
                                  )}

                                  {/* Bottom button */}
                                  {onNavigateToPlans && (
                                    <div className="pt-2 mt-2 border-t border-[var(--border-main)] flex justify-end">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenPlanDropdownTradeId(null);
                                          onNavigateToPlans();
                                        }}
                                        className="text-[11px] text-teal-400 hover:text-teal-300 font-bold flex items-center gap-1 cursor-pointer"
                                      >
                                        <Plus className="w-3 h-3" />
                                        <span>Mở Form Tạo Kế Hoạch mới</span>
                                      </button>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}
                      </td>

                      {/* LOẠI */}
                      <td className="py-2.5 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                          isBuy ? 'text-teal-400' : 'text-rose-400'
                        }`}>
                          {group.type}
                        </span>
                      </td>

                      {/* KL */}
                      <td className="py-2.5 px-3 text-right font-semibold text-[var(--text-primary)]">
                        {group.total_volume.toFixed(2)}
                      </td>

                      {/* GIÁ VÀO */}
                      <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">
                        {group.avg_open_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>

                      {/* GIÁ ĐÓNG */}
                      <td className="py-2.5 px-3 text-right text-[var(--text-secondary)]">
                        {isPending ? '-' : group.avg_close_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>

                      {/* PIP SL CHUẨN HÓA */}
                      <td 
                        className="py-2.5 px-3 text-right text-[var(--text-secondary)] font-sans font-medium"
                        title={group.initial_sl && group.initial_sl > 0 ? `Price Risk: ${Math.abs(group.avg_open_price - group.initial_sl).toFixed(2)} | SL: ${group.initial_sl}` : 'Không đặt SL (Mặc định Risk $100)'}
                      >
                        {formatPipSl(group.pip_sl, group.symbol, group.initial_sl)}
                      </td>

                      {/* VÀO LỆNH */}
                      <td className="py-2.5 px-3 text-[var(--text-muted)] text-[11px]">
                        {formatDateTimeWithOffset(group.open_time, timezoneOffset, 'MM-DD HH:mm')}
                      </td>

                      {/* ĐÓNG LỆNH */}
                      <td className="py-2.5 px-3 text-[var(--text-muted)] text-[11px]">
                        {isPending ? '-' : formatDateTimeWithOffset(group.close_time, timezoneOffset, 'MM-DD HH:mm')}
                      </td>

                      {/* GIỮ LỆNH */}
                      <td className="py-2.5 px-3 text-center text-[var(--text-muted)] text-[11px]">
                        {duration}
                      </td>

                      {/* KQ */}
                      <td className="py-2.5 px-3 text-center">
                        {isPending ? (
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30">
                            PENDING
                          </span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                            isWin 
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' 
                              : isLoss 
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30' 
                              : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-main)]'
                          }`}>
                            {group.result}
                          </span>
                        )}
                      </td>

                      {/* R:R ĐẠT ĐƯỢC */}
                      <td className="py-2.5 px-3 text-center">
                        {isPending ? (
                          <span className="text-[var(--text-muted)]">-</span>
                        ) : (
                          <span className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold ${
                            group.weighted_rr > 0
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : group.weighted_rr < 0
                              ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                              : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-main)]'
                          }`}>
                            {group.weighted_rr > 0 ? `+${group.weighted_rr.toFixed(2)}R` : `${group.weighted_rr.toFixed(2)}R`}
                          </span>
                        )}
                      </td>

                      {/* % LÃI */}
                      <td className={`py-2.5 px-3 text-right font-bold ${
                        isPending ? 'text-[var(--text-muted)]' : group.net_pnl > 0 ? 'text-emerald-400' : group.net_pnl < 0 ? 'text-rose-400' : 'text-[var(--text-muted)]'
                      }`}>
                        {isPending ? '-' : (group.pnl_percentage > 0 ? `+${group.pnl_percentage.toFixed(2)}%` : `${group.pnl_percentage.toFixed(2)}%`)}
                      </td>

                      {/* NET PNL ($) */}
                      <td className={`py-2.5 px-3 text-right font-bold ${
                        isPending ? 'text-[var(--text-muted)]' : group.net_pnl > 0 ? 'text-emerald-400' : group.net_pnl < 0 ? 'text-rose-400' : 'text-[var(--text-muted)]'
                      }`}>
                        {isPending ? (
                          '-'
                        ) : (
                          <>
                            <div>{formatCurrency(group.net_pnl)}</div>
                            {((group.total_commission && group.total_commission !== 0) || (group.total_swap && group.total_swap !== 0)) && (
                              <div 
                                className="text-[10px] font-normal text-[var(--text-muted)] font-sans"
                                title={`Gross PnL: ${formatCurrency(group.total_gross_pnl || group.net_pnl)} | Phí: ${formatCurrency(group.total_commission || 0)} | Swap: ${formatCurrency(group.total_swap || 0)}`}
                              >
                                {group.total_commission !== 0 && <span>Phí {formatCurrency(group.total_commission || 0)} </span>}
                                {group.total_swap !== 0 && <span>Swap {formatCurrency(group.total_swap || 0)}</span>}
                              </div>
                            )}
                          </>
                        )}
                      </td>

                      {/* TỔNG TIỀN (RUNNING BALANCE) */}
                      <td className="py-2.5 px-3 text-right font-bold text-[var(--text-primary)]">
                        {isPending ? '-' : `$${group.running_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      </td>

                      {/* PHIÊN */}
                      <td className="py-2.5 px-3 text-center font-sans text-[var(--text-secondary)] text-[11px]">
                        <span className="px-2 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-main)]">
                          {sessionLabel}
                        </span>
                      </td>
                    </tr>

                    {/* SUB-ROWS (SCALING 1.1, 1.2) */}
                    {hasChildren && isExpanded && group.trades.map((child, idx) => {
                      const isChildSelected = child.id === selectedTradeId;
                      const childDuration = formatDuration(child.open_time, child.close_time);
                      const isChildNoise = isNoiseTrade(child);
                      return (
                        <tr
                          key={child.id}
                          onClick={() => onSelectTrade(child)}
                          className={`cursor-pointer transition-colors text-[11px] ${
                            isChildSelected
                              ? 'bg-teal-500/20 text-[var(--text-primary)] font-medium'
                              : isChildNoise
                              ? 'opacity-65 hover:opacity-100 bg-amber-500/5 text-[var(--text-muted)]'
                              : 'bg-[var(--bg-subtle)]/50 hover:bg-[var(--table-row-hover)] text-[var(--text-secondary)]'
                          }`}
                        >
                          <td className="py-2 px-3 pl-8 text-[var(--text-secondary)] flex items-center gap-1">
                            <span className="text-[var(--text-muted)] font-mono">└</span>
                            <span className="font-mono text-teal-400/90 font-semibold">#{child.ticket}</span>
                            <span className="text-[10px] px-1 py-0.1 bg-[var(--border-main)] rounded text-[var(--text-secondary)] font-sans">
                              {child.sub_index || `1.${idx + 1}`}
                            </span>
                            {isChildNoise && (
                              <span className="text-[9px] px-1 py-0.1 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 font-sans">
                                NOISE
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 font-sans text-[var(--text-secondary)]">{child.symbol}</td>
                          <td className="py-2 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                            {(() => {
                              const planId = child.plan_id || group.master_trade.plan_id || group.plan_id;
                              const childPlan = plans.find(p => p.id === planId);
                              return childPlan ? (
                                <span className="text-[10px] text-teal-400 font-mono px-1.5 py-0.5 rounded bg-teal-500/10 border border-teal-500/30 inline-block max-w-[120px] truncate" title={`Map theo Plan: ${childPlan.plan_name || childPlan.code}`}>
                                  {childPlan.plan_name || childPlan.code}
                                </span>
                              ) : (
                                <span className="text-[10px] text-[var(--text-muted)] font-sans">-</span>
                              );
                            })()}
                          </td>
                          <td className="py-2 px-3 text-center text-[var(--text-secondary)]">{child.type}</td>
                          <td className="py-2 px-3 text-right font-semibold text-[var(--text-secondary)]">{child.volume.toFixed(2)}</td>
                          <td className="py-2 px-3 text-right text-[var(--text-secondary)]">{child.open_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          <td className="py-2 px-3 text-right text-[var(--text-secondary)]">{child.close_price.toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                          <td className="py-2 px-3 text-right font-sans text-[var(--text-secondary)]">{formatPipSl(child.pip_sl, child.symbol, child.initial_sl)}</td>
                          <td className="py-2 px-3 text-[var(--text-muted)]">{formatDateTimeWithOffset(child.open_time, timezoneOffset, 'MM-DD HH:mm')}</td>
                          <td className="py-2 px-3 text-[var(--text-muted)]">{formatDateTimeWithOffset(child.close_time, timezoneOffset, 'MM-DD HH:mm')}</td>
                          <td className="py-2 px-3 text-center text-[var(--text-muted)]">{childDuration}</td>
                          <td className="py-2 px-3 text-center">
                            <span className={`text-[10px] font-bold ${child.net_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                              {child.result}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`font-mono text-[10px] font-bold ${
                              child.weighted_rr > 0 ? 'text-emerald-400' : child.weighted_rr < 0 ? 'text-rose-400' : 'text-[var(--text-muted)]'
                            }`}>
                              {child.weighted_rr > 0 ? `+${child.weighted_rr.toFixed(2)}R` : `${child.weighted_rr.toFixed(2)}R`}
                            </span>
                          </td>
                          <td className={`py-2 px-3 text-right ${child.net_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {child.pnl_percentage ? `${child.pnl_percentage > 0 ? '+' : ''}${child.pnl_percentage.toFixed(2)}%` : '-'}
                          </td>
                          <td className={`py-2 px-3 text-right font-semibold ${child.net_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {formatCurrency(child.net_pnl)}
                          </td>
                          <td className="py-2 px-3 text-right text-[var(--text-secondary)]">
                            ${child.running_balance?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '-'}
                          </td>
                          <td className="py-2 px-3 text-center text-[var(--text-muted)] font-sans">
                            {formatSessionLabel(child.session)}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="px-4 py-2.5 bg-[var(--bg-card)] border-t border-[var(--border-main)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
        <span className="text-[11px] font-medium">
          Hiển thị: <span className="text-teal-400 font-bold font-mono">{filteredGroups.length}</span> lệnh tổng 
          <span className="text-[var(--text-muted)] ml-1">({closedTrades.length} khớp, {pendingTradeGroups.length} chờ)</span>
        </span>
        <div className="flex items-center gap-1 font-mono text-[11px]">
          <button type="button" className="w-6 h-6 rounded flex items-center justify-center bg-[var(--bg-subtle)] text-[var(--text-muted)] cursor-not-allowed">
            &lt;
          </button>
          <button type="button" className="w-6 h-6 rounded flex items-center justify-center bg-teal-500 text-slate-950 font-bold">
            1
          </button>
          <button type="button" className="w-6 h-6 rounded flex items-center justify-center hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            2
          </button>
          <button type="button" className="w-6 h-6 rounded flex items-center justify-center hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            3
          </button>
          <button type="button" className="w-6 h-6 rounded flex items-center justify-center hover:bg-[var(--bg-subtle)] text-[var(--text-secondary)]">
            &gt;
          </button>
        </div>
      </div>
    </div>
  );
};
