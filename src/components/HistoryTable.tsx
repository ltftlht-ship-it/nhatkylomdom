import { useLanguage } from '../context/LanguageContext';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { 
  TradeRow, 
  TradeGroup, 
  TradeType, 
  TradeResult,
  TradingPlan,
  PendingOrder,
  SetupTagItem
} from '../types';
import { 
  groupTradesByPosition, 
  formatCurrency, 
  formatDateTimeWithOffset, 
  formatSessionLabel,
  isNoiseTrade,
  getSavedNoiseFilter,
  getSavedHideNoiseRows
} from '../utils/tradeCalculations';
import { 
  ChevronDown, 
  ChevronRight, 
  RefreshCw,
  Database,
  Settings as SettingsIcon,
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
  onCancelPendingOrder?: (ticketOrId: string) => void;

  // Active filter values passed from the Hàng 1 Dropdown Filter
  selectedSymbol?: string;
  selectedType?: string;
  selectedSession?: string;
  selectedResult?: string;
  selectedSetup?: string;
  noiseFilterActive?: boolean;
  hideNoiseRows?: boolean;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;

  // Filter callbacks for the integrated Trading History top bar
  onSymbolChange?: (sym: string) => void;
  onTypeChange?: (t: string) => void;
  onSessionChange?: (s: string) => void;
  onResultChange?: (r: string) => void;
  onSetupChange?: (st: string) => void;
  onToggleHideNoiseRows?: () => void;
  onResetFilters?: () => void;
  setupTags?: SetupTagItem[];
  uniqueSymbols?: string[];
}

export const HistoryTable: React.FC<HistoryTableProps> = ({
  trades,
  pendingOrders = [],
  selectedTradeId,
  onSelectTrade,
  searchFilter,
  onSearchChange,
  isLoading = false,
  accountId = '26325348',
  timezoneOffset = 0,
  onSync,
  onOpenSettings,
  plans = [],
  onCancelPendingOrder,

  // Filters from Dropdown
  selectedSymbol = 'ALL',
  selectedType = 'ALL',
  selectedSession = 'ALL',
  selectedResult = 'ALL',
  selectedSetup = 'ALL',
  noiseFilterActive = getSavedNoiseFilter(),
  hideNoiseRows = false,
  pageSize = 5,
  onPageSizeChange,

  onSymbolChange,
  onTypeChange,
  onSessionChange,
  onResultChange,
  onSetupChange,
  onToggleHideNoiseRows,
  onResetFilters,
  setupTags = [],
  uniqueSymbols = [],
}) => {
  const { t, language } = useLanguage();
  // Expanded scaling child groups (1.1, 1.2)
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    '558385408': true
  });

  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const filterDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (filterDropdownRef.current && !filterDropdownRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

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

    return pendingOrders.map(p => {
      const isSell = (p.type || '').toUpperCase().includes('SELL');
      const orderType: TradeType = isSell ? 'SELL' : 'BUY';

      const masterTrade: TradeRow = {
        id: p.id || `pending-${p.ticket}`,
        ticket: String(p.ticket),
        position_id: String(p.ticket),
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
        session: 'Á' as any,
        pre_checklist_ids: [],
        post_checklist_ids: [],
        notes: p.notes || '',
        plan_id: p.plan_id,
        plan_name: p.plan_title,
        status: 'PENDING',
        is_noise: p.volume <= 0.01,
        result: 'BE' as any
      };

      const group: TradeGroup = {
        position_id: `pending-${p.ticket}`,
        ticket: String(p.ticket),
        symbol: p.symbol,
        type: orderType,
        total_volume: p.volume,
        avg_open_price: p.price,
        avg_close_price: 0,
        net_pnl: 0,
        total_gross_pnl: 0,
        total_commission: 0,
        total_swap: 0,
        open_time: p.placed_time || '',
        close_time: '-',
        result: 'BE' as TradeResult,
        weighted_rr: 0,
        running_balance: 0,
        session: 'Á' as any,
        initial_sl: p.sl || 0,
        pnl_percentage: 0,
        pip_sl: p.sl > 0 ? Math.abs(p.price - p.sl) : 0,
        is_noise: p.volume <= 0.01,
        trades: [masterTrade],
        master_trade: masterTrade,
        plan_id: p.plan_id,
        plan_name: p.plan_title,
      };

      return group;
    });
  }, [pendingOrders, accountId]);

  // Gom cụm các lệnh con thành Master Group (theo position_id)
  const allTradeGroups = useMemo(() => {
    const closedGroups = groupTradesByPosition(closedTrades);
    return [...pendingTradeGroups, ...closedGroups];
  }, [closedTrades, pendingTradeGroups]);

  // Dynamic available symbols
  const availableSymbols = useMemo(() => {
    if (uniqueSymbols && uniqueSymbols.length > 0) return uniqueSymbols;
    const s = new Set<string>();
    allTradeGroups.forEach(g => { if (g.symbol) s.add(g.symbol); });
    return Array.from(s);
  }, [allTradeGroups, uniqueSymbols]);

  // Lọc danh sách theo các tiêu chí
  const filteredGroups = useMemo(() => {
    return allTradeGroups.filter(g => {
      const isPending = g.master_trade.status === 'PENDING';
      const isNoise = Boolean(g.is_noise) || 
        Boolean(g.master_trade?.is_noise) || 
        isNoiseTrade(g.master_trade) ||
        (g.total_volume != null && Number(g.total_volume) <= 0.01 && Number(g.total_volume) > 0) ||
        (g.master_trade?.volume != null && Number(g.master_trade.volume) <= 0.01 && Number(g.master_trade.volume) > 0) ||
        (g.notes || '').toLowerCase().includes('noise') ||
        (g.master_trade?.notes || '').toLowerCase().includes('noise');

      // 1. Lọc lệnh rác (Noise filter)
      if (hideNoiseRows && isNoise && !isPending && selectedResult !== 'NOISE') {
        return false;
      }

      // 2. Dropdown Filters
      if (selectedSymbol !== 'ALL') {
        const sym = g.symbol.replace('/', '').toUpperCase();
        const target = selectedSymbol.replace('/', '').toUpperCase();
        if (sym !== target) return false;
      }

      if (selectedType !== 'ALL') {
        if (g.type !== selectedType) return false;
      }

      if (selectedSession !== 'ALL') {
        const sess = formatSessionLabel(g.session);
        if (sess !== selectedSession && g.session !== selectedSession) return false;
      }

      if (selectedResult !== 'ALL') {
        if (selectedResult === 'NOISE') {
          if (!isNoise) return false;
        } else if (selectedResult === 'PENDING') {
          if (!isPending) return false;
        } else if (isPending) {
          return false;
        } else if (g.result !== selectedResult) {
          return false;
        }
      }

      if (selectedSetup !== 'ALL') {
        const setups = g.master_trade.setups || [];
        const singleSetup = g.master_trade.setup;
        const matchesSetup = setups.includes(selectedSetup) || singleSetup === selectedSetup;
        if (!matchesSetup) return false;
      }

      // 3. Search Filter (Ticket, Symbol, Notes)
      if (searchFilter && searchFilter.trim() !== '') {
        const query = searchFilter.toLowerCase().trim();
        const matchTicket = g.ticket.toLowerCase().includes(query);
        const matchSymbol = g.symbol.toLowerCase().includes(query);
        const matchNotes = (g.master_trade.notes || '').toLowerCase().includes(query);
        const matchSubTickets = g.trades.some(st => st.ticket.toLowerCase().includes(query));
        if (!matchTicket && !matchSymbol && !matchNotes && !matchSubTickets) return false;
      }

      return true;
    });
  }, [allTradeGroups, hideNoiseRows, selectedSymbol, selectedType, selectedSession, selectedResult, selectedSetup, searchFilter]);

  // Phân trang (Pagination)
  const [currentPage, setCurrentPage] = useState<number>(1);
  const effectivePageSize = pageSize;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchFilter, selectedSymbol, selectedType, selectedSession, selectedResult, selectedSetup, effectivePageSize]);

  const totalPages = Math.max(1, Math.ceil(filteredGroups.length / effectivePageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedGroups = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * effectivePageSize;
    return filteredGroups.slice(startIdx, startIdx + effectivePageSize);
  }, [filteredGroups, safeCurrentPage, effectivePageSize]);

  const paginationNumbers = useMemo(() => {
    const pages: number[] = [];
    if (totalPages <= 5) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safeCurrentPage > 3) pages.push(-1);
      const start = Math.max(2, safeCurrentPage - 1);
      const end = Math.min(totalPages - 1, safeCurrentPage + 1);
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      if (safeCurrentPage < totalPages - 2) pages.push(-1);
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }
    return pages;
  }, [totalPages, safeCurrentPage]);

  return (
    <div className="flex flex-col h-full bg-[var(--bg-card)] rounded-3xl clay-card border border-[var(--border-main)] overflow-hidden font-sans">
      {/* 1. CLAY FILTER CONTROLS BAR: Tabs con nhộng nổi + Tìm kiếm Inset Well + Bộ Lọc */}
      <div className="p-4 bg-[var(--bg-panel)] border-b border-[var(--border-main)] flex flex-wrap items-center justify-between gap-3">
        {/* Status Tabs (Tactile Embossed Pill Group) */}
        <div className="flex items-center gap-1.5 p-1 rounded-full bg-[var(--bg-subtle)] clay-well">
          <button
            type="button"
            onClick={() => onResultChange?.('ALL')}
            className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              selectedResult === 'ALL'
                ? 'bg-[var(--bg-card)] text-[#1d1b17] clay-pill font-black'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {language === 'vi' ? 'Tất cả' : 'All'} <span className="ml-1 text-[10px] opacity-75 font-mono">({closedTrades.length})</span>
          </button>
          <button
            type="button"
            onClick={() => onResultChange?.('Win')}
            className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              selectedResult === 'Win'
                ? 'bg-[var(--bg-card)] text-[#1d1b17] clay-pill font-black'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {language === 'vi' ? 'Lệnh thắng' : 'Wins'}
          </button>
          <button
            type="button"
            onClick={() => onResultChange?.('Loss')}
            className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
              selectedResult === 'Loss'
                ? 'bg-[var(--bg-card)] text-[#1d1b17] clay-pill font-black'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {language === 'vi' ? 'Lệnh thua' : 'Losses'}
          </button>
          {pendingOrders.length > 0 && (
            <button
              type="button"
              onClick={() => onResultChange?.('PENDING')}
              className={`px-3.5 py-1 rounded-full text-xs font-bold transition-all cursor-pointer ${
                selectedResult === 'PENDING'
                  ? 'bg-[var(--bg-card)] text-[#1d1b17] clay-pill font-black'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              {language === 'vi' ? 'Lệnh chờ' : 'Pending'} <span className="ml-1 text-[10px] font-mono">({pendingOrders.length})</span>
            </button>
          )}
        </div>

        {/* Search Well & Popover Filter */}
        <div className="flex items-center gap-2 flex-1 max-w-md justify-end">
          {/* Recessed Inset Search Well */}
          <div className="relative flex-1">
            <input
              type="text"
              placeholder={language === 'vi' ? 'Tìm symbol, ticket, setup...' : 'Search symbol, ticket...'}
              value={searchFilter}
              onChange={(e) => onSearchChange?.(e.target.value)}
              className="w-full pl-3.5 pr-8 py-1.5 rounded-full bg-[var(--bg-subtle)] clay-well text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-[#1d1b17] font-mono transition-colors"
            />
            {searchFilter && (
              <button
                type="button"
                onClick={() => onSearchChange?.('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Filter Popover Button - Nền cơ bản không bị trắng khi chưa kích hoạt */}
          <div className="relative" ref={filterDropdownRef}>
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer shrink-0 ${
                isFilterOpen
                  ? 'bg-[var(--bg-card)] text-[#1d1b17] clay-pill font-black'
                  : 'bg-[var(--bg-subtle)] clay-well text-[var(--text-primary)] hover:bg-[var(--bg-card)]'
              }`}
              title="Filter trades"
            >
              <span>{language === 'vi' ? 'Bộ Lọc' : 'Filter'}</span>
              <ChevronDown className={`w-3.5 h-3.5 text-[var(--text-muted)] transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* POPOVER FILTER TIẾNG ANH HOÀN TOÀN */}
            {isFilterOpen && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl shadow-2xl p-4 z-50 text-xs flex flex-col gap-3 font-sans animate-in fade-in zoom-in-95 duration-100">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-main)]">
                  <span className="font-bold text-[#1d1b17] text-xs tracking-wide">{language === 'vi' ? 'Bộ Lọc Lệnh' : 'Trade Filters'}</span>
                  {onResetFilters && (
                    <button
                      type="button"
                      onClick={onResetFilters}
                      className="text-[11px] text-[#424843] hover:text-[#1d1b17] hover:underline font-medium cursor-pointer transition-colors"
                    >
                      Reset
                    </button>
                  )}
                </div>

                {/* 1. Symbol */}
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-[#1d1b17]">Symbol:</span>
                  <select
                    value={selectedSymbol}
                    onChange={(e) => onSymbolChange?.(e.target.value)}
                    className="w-full bg-[var(--bg-subtle)] border border-[var(--border-main)] rounded-lg p-1.5 text-[#1d1b17] font-semibold focus:outline-none focus:border-[#1d1b17] cursor-pointer"
                  >
                    <option value="ALL">All Symbols</option>
                    {availableSymbols.map(sym => (
                      <option key={sym} value={sym}>{sym}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Type & Session */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-[#1d1b17]">Type:</span>
                    <select
                      value={selectedType}
                      onChange={(e) => onTypeChange?.(e.target.value)}
                      className="w-full bg-[var(--bg-subtle)] border border-[var(--border-main)] rounded-lg p-1.5 text-[#1d1b17] font-semibold focus:outline-none focus:border-[#1d1b17] cursor-pointer"
                    >
                      <option value="ALL">All Types</option>
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-[#1d1b17]">Session:</span>
                    <select
                      value={selectedSession}
                      onChange={(e) => onSessionChange?.(e.target.value)}
                      className="w-full bg-[var(--bg-subtle)] border border-[var(--border-main)] rounded-lg p-1.5 text-[#1d1b17] font-semibold focus:outline-none focus:border-[#1d1b17] cursor-pointer"
                    >
                      <option value="ALL">All Sessions</option>
                      <option value="Á">Asian</option>
                      <option value="Âu">London</option>
                      <option value="Mỹ">New York</option>
                    </select>
                  </div>
                </div>

                {/* 3. Result / Status */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-[#1d1b17]">Result / Status:</span>
                    <select
                      value={selectedResult}
                      onChange={(e) => onResultChange?.(e.target.value)}
                      className="w-full bg-[var(--bg-subtle)] border border-[var(--border-main)] rounded-lg p-1.5 text-[#1d1b17] font-semibold focus:outline-none focus:border-[#1d1b17] cursor-pointer"
                    >
                      <option value="ALL">All Results</option>
                      <option value="Win">Win</option>
                      <option value="Loss">Loss</option>
                      <option value="BE">Breakeven (BE)</option>
                      <option value="NOISE">Noise Only</option>
                      <option value="PENDING">Pending Only</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-[#1d1b17]">Setup:</span>
                    <select
                      value={selectedSetup}
                      onChange={(e) => onSetupChange?.(e.target.value)}
                      className="w-full bg-[var(--bg-subtle)] border border-[var(--border-main)] rounded-lg p-1.5 text-[#1d1b17] font-semibold focus:outline-none focus:border-[#1d1b17] cursor-pointer"
                    >
                      <option value="ALL">All Setups</option>
                      {setupTags.map(st => (
                        <option key={st.id || st.label} value={st.label}>{st.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 4. Noise Trades filter (Không đóng khung, màu chữ đồng nhất) */}
                <div className="pt-2 border-t border-[var(--border-main)] flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-[#1d1b17]">Noise Trades (≤0.01)</span>
                    <p className="text-[10px] text-[var(--text-muted)]">Hide scratch / test trades</p>
                  </div>
                  {onToggleHideNoiseRows && (
                    <button
                      type="button"
                      onClick={onToggleHideNoiseRows}
                      className="text-xs font-semibold text-[#1d1b17] hover:underline transition-colors cursor-pointer"
                    >
                      {hideNoiseRows ? 'Hiding Noise' : 'Show All'}
                    </button>
                  )}
                </div>

                {/* Apply & Close */}
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="w-full mt-1 py-1.5 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--border-main)]/30 text-[#1d1b17] font-semibold transition-colors cursor-pointer text-center"
                >
                  Apply & Close
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. KHUNG CUỘN BẢNG MT5: Cố định kích thước tương đương 10 lệnh, khi PageSize lớn sẽ cuộn mượt mà */}
      <div className="flex-1 max-h-[520px] overflow-auto">
        <table className="w-full border-collapse text-left text-xs font-sans">
          {/* HEADER: TẤT CẢ TIÊU ĐỀ TIẾNG ANH - NỀN TRẮNG SẠCH SẼ */}
          <thead className="sticky top-0 z-10 bg-white border-b border-[var(--border-main)] text-[var(--text-muted)] font-medium tracking-wider text-[11px] uppercase backdrop-blur-xs">
            <tr>
              <th className="py-3 px-1 text-center w-8 font-medium"></th>
              <th className="py-3 pl-3 pr-1 text-left font-medium w-[11%]">Ticket</th>
              <th className="py-3 px-1 text-left font-medium w-[9%]">Status</th>
              <th className="py-3 px-3 text-left font-medium w-[16%]">Instrument</th>
              <th className="py-3 px-2 text-center font-medium w-[8%]">Side</th>
              <th className="py-3 px-2 text-center font-medium w-[8%]">Result</th>
              <th className="py-3 px-2 text-center font-medium w-[11%]">R:R / Profit</th>
              <th className="py-3 px-3 text-right font-medium w-[15%]">PnL</th>
              <th className="py-3 px-3 text-right font-medium w-[14%]">Balance</th>
              <th className="py-3 px-2 text-center font-medium w-[8%]">Session</th>
            </tr>
          </thead>

          <tbody className="divide-y divide-[var(--border-subtle)] font-sans">
            {filteredGroups.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-16 text-center">
                  {isLoading ? (
                    <div className="flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
                      <RefreshCw className="w-7 h-7 text-[var(--text-muted)] animate-spin" />
                      <span className="text-sm font-medium text-[var(--text-primary)]">Loading data from Supabase...</span>
                      <span className="text-xs text-[var(--text-muted)] font-mono">
                        Account ID: #{accountId}
                      </span>
                    </div>
                  ) : trades.length === 0 && pendingOrders.length === 0 ? (
                    <div className="flex flex-col items-center justify-center max-w-md mx-auto p-6 rounded-2xl bg-[var(--bg-subtle)] border border-[var(--border-main)]">
                      <div className="w-12 h-12 rounded-full bg-[var(--bg-card)] border border-[var(--border-main)] flex items-center justify-center mb-3">
                        <Database className="w-5 h-5 text-[var(--text-muted)]" />
                      </div>
                      <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">Waiting for MT5 Trades...</h3>
                      <p className="text-xs text-[var(--text-muted)] mb-4 text-center leading-relaxed">
                        No closed trades found for account <span className="text-[var(--text-primary)] font-mono font-medium">#{accountId}</span>.
                      </p>
                      <div className="flex items-center gap-2">
                        {onSync && (
                          <button
                            type="button"
                            onClick={onSync}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg clay-btn-secondary text-[var(--text-primary)] border border-[var(--border-main)] text-xs font-medium transition-colors cursor-pointer"
                          >
                            <RefreshCw className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                            <span>Sync Now</span>
                          </button>
                        )}
                        {onOpenSettings && (
                          <button
                            type="button"
                            onClick={onOpenSettings}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg clay-btn-secondary text-[var(--text-primary)] border border-[var(--border-main)] text-xs font-medium transition-colors cursor-pointer"
                          >
                            <SettingsIcon className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                            <span>Connection Settings</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
                      <span className="text-sm font-medium text-[var(--text-primary)]">No trades match the current filter</span>
                      <span className="text-xs text-[var(--text-muted)]">Try adjusting your search criteria or resetting filters</span>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              paginatedGroups.map(group => {
                const isPending = group.master_trade.status === 'PENDING';
                const isGroupSelected = group.trades.some(t => t.id === selectedTradeId);
                const hasChildren = group.trades.length > 1;
                const isExpanded = !!expandedGroups[group.position_id];
                const isBuy = group.type === 'BUY';
                const isWin = group.result === 'Win';
                const isLoss = group.result === 'Loss';
                const sessionLabel = formatSessionLabel(group.session);

                // Kiểm tra lệnh rác chuẩn xác (Volume <= 0.01 Lot)
                const isNoise = !isPending && (
                  Boolean(group.is_noise) || 
                  Boolean(group.master_trade?.is_noise) || 
                  isNoiseTrade(group.master_trade) ||
                  (group.total_volume != null && Number(group.total_volume) <= 0.01 && Number(group.total_volume) > 0) ||
                  (group.master_trade?.volume != null && Number(group.master_trade.volume) <= 0.01 && Number(group.master_trade.volume) > 0) ||
                  (group.notes || '').toLowerCase().includes('noise') ||
                  (group.master_trade?.notes || '').toLowerCase().includes('noise')
                );

                // Tìm Plan liên kết nếu có (chỉ hiển thị read-only)
                const planId = group.master_trade.plan_id || group.plan_id;
                const mappedPlan = plans.find(p => p.id === planId);
                const planDisplayName = mappedPlan 
                  ? (mappedPlan.plan_name || mappedPlan.title || mappedPlan.code)
                  : (group.plan_name || '-');

                return (
                  <React.Fragment key={group.position_id}>
                    {/* MASTER ROW */}
                    <tr
                      onClick={() => onSelectTrade(group.master_trade)}
                      className={`cursor-pointer transition-colors duration-150 ${
                        isGroupSelected
                          ? 'bg-[var(--table-row-selected)] border-l-2 border-l-[#825249] text-[var(--text-primary)] font-semibold'
                          : isPending
                          ? 'hover:bg-[var(--table-row-hover)] text-[var(--text-primary)]'
                          : isNoise
                          ? 'opacity-85 hover:opacity-100 hover:bg-[var(--table-row-hover)] text-[var(--text-muted)]'
                          : 'hover:bg-[var(--table-row-hover)] text-[var(--text-primary)]'
                      }`}
                    >
                      {/* CỘT 1: NÚT MỞ RỘNG SCALING (w-8) */}
                      <td className="py-3.5 px-1 text-center w-8 shrink-0">
                        {hasChildren && (
                          <button
                            type="button"
                            onClick={(e) => toggleGroup(group.position_id, e)}
                            className="p-1 rounded hover:bg-[var(--bg-subtle)] text-slate-400 hover:text-slate-200 transition-colors shrink-0 cursor-pointer inline-flex items-center justify-center"
                            title="View scaling deals"
                          >
                            {isExpanded ? (
                              <ChevronDown className="w-3.5 h-3.5 text-teal-400" />
                            ) : (
                              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                            )}
                          </button>
                        )}
                      </td>

                      {/* CỘT 2: TICKET & ENTRY TIME (w-[11%] - CANH GỌN LẠI) */}
                      <td className="py-3.5 pl-3 pr-1 text-left w-[11%]">
                        <div className="flex flex-col">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-medium text-[var(--text-primary)] text-xs hover:underline">
                              #{group.ticket}
                            </span>
                            {hasChildren && (
                              <span className="text-[10px] px-1 py-0.2 rounded bg-[var(--bg-subtle)] text-[var(--text-muted)] border border-[var(--border-main)] font-sans">
                                1.{group.trades.length}
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-[var(--text-muted)] font-mono mt-0.5">
                            {formatDateTimeWithOffset(group.open_time, timezoneOffset, 'MM-DD HH:mm')}
                          </span>
                        </div>
                      </td>

                      {/* CỘT 3: STATUS - ƯU TIÊN PENDING HOẶC NOISE, CÒN LẠI MẶC ĐỊNH CLOSED MÀU XÁM (ĐỒNG NHẤT 1 FONT MONO, KHÔNG ĐÓNG KHUNG) */}
                      <td className="py-3.5 px-1 text-left w-[9%]">
                        <div className="flex items-center">
                          {isPending ? (
                            <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                              <span 
                                className="text-amber-500 font-mono text-[11px] font-medium tracking-wide"
                                title="Pending order"
                              >
                                PENDING
                              </span>
                              {onCancelPendingOrder && (
                                <button
                                  type="button"
                                  onClick={() => onCancelPendingOrder(group.ticket)}
                                  className="text-[10px] text-rose-500 hover:text-rose-400 hover:underline font-mono cursor-pointer transition-colors"
                                  title="Cancel order"
                                >
                                  Cancel
                                </button>
                              )}
                            </div>
                          ) : isNoise ? (
                            <span 
                              className="text-amber-500 font-mono text-[11px] font-medium tracking-wide"
                              title="Noise trade (Volume <= 0.01 Lot)"
                            >
                              NOISE
                            </span>
                          ) : (
                            <span className="text-[var(--text-muted)] font-mono text-[11px] font-medium tracking-wide">
                              CLOSED
                            </span>
                          )}
                        </div>
                      </td>

                      {/* CỘT 4: INSTRUMENT & PLAN (w-[16%]) */}
                      <td className="py-3.5 px-3 text-left w-[16%]">
                        <div className="flex flex-col">
                          <span className="font-sans font-bold text-[var(--text-primary)] text-sm tracking-wide">
                            {group.symbol}
                          </span>
                          <span 
                            className="text-[11px] text-[var(--text-muted)] font-sans truncate max-w-[160px] mt-0.5 font-normal"
                            title={planDisplayName}
                          >
                            {planDisplayName}
                          </span>
                        </div>
                      </td>

                      {/* CỘT 5: SIDE (BUY / SELL KHÔNG ĐÓNG KHUNG - w-[8%]) */}
                      <td className="py-3.5 px-2 text-center w-[8%]">
                        <span className={`font-semibold text-xs tracking-wider ${
                          isBuy ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                        }`}>
                          {group.type}
                        </span>
                      </td>

                      {/* CỘT 6: RESULT (KHÔNG ĐÓNG KHUNG - w-[8%]) */}
                      <td className="py-3.5 px-2 text-center w-[8%]">
                        {isPending ? (
                          <span className="text-[var(--text-muted)] text-xs font-mono">-</span>
                        ) : (
                          <span className={`font-medium text-xs ${
                            isWin ? 'text-[var(--color-win)] font-bold' : isLoss ? 'text-[var(--color-loss)] font-bold' : 'text-[var(--text-muted)]'
                          }`}>
                            {group.result}
                          </span>
                        )}
                      </td>

                      {/* CỘT 7: R:R / LÃI (w-[11%]) */}
                      <td className="py-3.5 px-2 text-center w-[11%]">
                        {isPending ? (
                          <span className="text-[var(--text-muted)] font-mono text-xs">-</span>
                        ) : (
                          <div className="flex flex-col items-center">
                            <span className="font-mono font-medium text-xs text-[var(--text-primary)]">
                              {group.weighted_rr != null && !isNaN(Number(group.weighted_rr)) 
                                ? (Number(group.weighted_rr) > 0 ? `+${Number(group.weighted_rr).toFixed(2)}R` : `${Number(group.weighted_rr).toFixed(2)}R`) 
                                : '-'}
                            </span>
                            <span className="text-[11px] font-mono text-[var(--text-muted)] mt-0.5">
                              {group.pnl_percentage != null && !isNaN(Number(group.pnl_percentage)) 
                                ? `${Number(group.pnl_percentage) > 0 ? '+' : ''}${Number(group.pnl_percentage).toFixed(2)}%` 
                                : '-'}
                            </span>
                          </div>
                        )}
                      </td>

                      {/* CỘT 8: PNL (w-[15%]) */}
                      <td className={`py-3.5 px-3 text-right font-mono font-bold text-xs w-[15%] ${
                        isPending 
                          ? 'text-[var(--text-muted)]' 
                          : group.net_pnl > 0 
                          ? 'text-[var(--color-win)]' 
                          : group.net_pnl < 0 
                          ? 'text-[var(--color-loss)]' 
                          : 'text-[var(--text-primary)]'
                      }`}>
                        {isPending ? (
                          '-'
                        ) : (
                          <div className="flex flex-col items-end">
                            <span>{formatCurrency(group.net_pnl)}</span>
                            {((group.total_commission && group.total_commission !== 0) || (group.total_swap && group.total_swap !== 0)) && (
                              <span className="text-[10px] font-normal text-[var(--text-muted)] font-sans mt-0.5">
                                {group.total_commission !== 0 && `Fee: ${formatCurrency(group.total_commission || 0)}`}
                                {group.total_swap !== 0 && ` Swap: ${formatCurrency(group.total_swap || 0)}`}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* CỘT 9: BALANCE (w-[14%]) */}
                      <td className="py-3.5 px-3 text-right font-mono font-medium text-xs text-[var(--text-primary)] w-[14%]">
                        {isPending ? '-' : `$${group.running_balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      </td>

                      {/* CỘT 10: SESSION (w-[8%]) */}
                      <td className="py-3.5 px-2 text-center font-sans text-[11px] w-[8%]">
                        <span className="text-[var(--text-muted)]">
                          {sessionLabel}
                        </span>
                      </td>
                    </tr>

                    {/* SUB-ROWS (SCALING 1.1, 1.2) */}
                    {hasChildren && isExpanded && group.trades.map((child, idx) => {
                      const isChildSelected = child.id === selectedTradeId;
                      const isChildNoise = Boolean(child.is_noise) || isNoiseTrade(child) || (child.volume != null && Number(child.volume) <= 0.01 && Number(child.volume) > 0);
                      const childPlan = plans.find(p => p.id === (child.plan_id || group.master_trade.plan_id));
                      const childPlanName = childPlan ? (childPlan.plan_name || childPlan.code) : '-';

                      return (
                        <tr
                          key={child.id}
                          onClick={() => onSelectTrade(child)}
                          className={`cursor-pointer transition-colors text-xs ${
                            isChildSelected
                              ? 'bg-[var(--table-row-selected)] text-[var(--text-primary)] font-semibold'
                              : isChildNoise
                              ? 'opacity-85 hover:opacity-100 bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                              : 'bg-[var(--bg-subtle)]/60 hover:bg-[var(--table-row-hover)] text-[var(--text-secondary)]'
                          }`}
                        >
                          {/* Cột 1: Ký hiệu nhánh con └ */}
                          <td className="py-2.5 px-1 text-center w-8 shrink-0">
                            <span className="text-[var(--text-muted)] font-mono text-xs">└</span>
                          </td>

                          {/* Cột 2: Ticket con */}
                          <td className="py-2.5 pl-3 pr-1 text-left w-[11%]">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-1.5 font-mono">
                                <span className="text-[var(--text-primary)] hover:underline">#{child.ticket}</span>
                                <span className="text-[10px] px-1 py-0.1 bg-[var(--bg-card)] rounded text-[var(--text-muted)] font-sans border border-[var(--border-main)]">
                                  {child.sub_index || `1.${idx + 1}`}
                                </span>
                              </div>
                              <span className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">
                                {formatDateTimeWithOffset(child.open_time, timezoneOffset, 'MM-DD HH:mm')}
                              </span>
                            </div>
                          </td>

                          {/* Cột 3: Status con (Ưu tiên NOISE, còn lại CLOSED màu xám, đồng nhất font mono, không đóng khung) */}
                          <td className="py-2.5 px-1 text-left w-[9%]">
                            <div className="flex items-center">
                              {isChildNoise ? (
                                <span className="text-amber-500 font-mono text-[10px] font-medium tracking-wide">
                                  NOISE
                                </span>
                              ) : (
                                <span className="text-[var(--text-muted)] font-mono text-[10px] font-medium tracking-wide">
                                  CLOSED
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Cột 4: Instrument & Plan con */}
                          <td className="py-2.5 px-3 text-left w-[16%]">
                            <div className="flex flex-col">
                              <span className="font-sans font-semibold text-[var(--text-primary)] text-xs">
                                {child.symbol}
                              </span>
                              <span className="text-[10px] text-[var(--text-muted)] font-sans truncate max-w-[150px]">
                                {childPlanName}
                              </span>
                            </div>
                          </td>

                          {/* Cột 5: Side con (không đóng khung) */}
                          <td className="py-2.5 px-2 text-center w-[8%]">
                            <span className={`text-xs font-semibold ${
                              child.type === 'BUY' ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
                            }`}>
                              {child.type}
                            </span>
                          </td>

                          {/* Cột 6: Result con (không đóng khung) */}
                          <td className="py-2.5 px-2 text-center w-[8%]">
                            <span className={`text-xs font-medium ${
                              child.net_pnl > 0 
                                ? 'text-[var(--color-win)] font-bold' 
                                : child.net_pnl < 0 
                                ? 'text-[var(--color-loss)] font-bold' 
                                : 'text-[var(--text-muted)]'
                            }`}>
                              {child.result}
                            </span>
                          </td>

                          {/* Cột 7: R:R / Lãi con */}
                          <td className="py-2.5 px-2 text-center w-[11%]">
                            <div className="flex flex-col items-center">
                              <span className="font-mono text-xs text-[var(--text-primary)]">
                                {child.weighted_rr != null && !isNaN(Number(child.weighted_rr)) 
                                  ? (Number(child.weighted_rr) > 0 ? `+${Number(child.weighted_rr).toFixed(2)}R` : `${Number(child.weighted_rr).toFixed(2)}R`) 
                                  : '-'}
                              </span>
                              <span className="text-[10px] font-mono text-[var(--text-muted)] mt-0.5">
                                {child.pnl_percentage != null && !isNaN(Number(child.pnl_percentage)) 
                                  ? `${Number(child.pnl_percentage) > 0 ? '+' : ''}${Number(child.pnl_percentage).toFixed(2)}%` 
                                  : '-'}
                              </span>
                            </div>
                          </td>

                          {/* Cột 8: PnL con */}
                          <td className={`py-2.5 px-3 text-right font-mono text-xs font-semibold w-[15%] ${
                            child.net_pnl > 0 ? 'text-[var(--color-win)]' : child.net_pnl < 0 ? 'text-[var(--color-loss)]' : 'text-[var(--text-muted)]'
                          }`}>
                            {formatCurrency(child.net_pnl)}
                          </td>

                          {/* Cột 9: Balance con */}
                          <td className="py-2.5 px-3 text-right font-mono text-xs text-[var(--text-secondary)] w-[14%]">
                            ${child.running_balance?.toLocaleString('en-US', { minimumFractionDigits: 2 }) || '-'}
                          </td>

                          {/* Cột 10: Session con */}
                          <td className="py-2.5 px-2 text-center text-[10px] text-[var(--text-muted)] font-sans w-[8%]">
                            {formatSessionLabel(child.session)}
                          </td>
                        </tr>
                      );
                    })}
                  </React.Fragment>
                );
              })
            )}

            {/* Cố định khung tối thiểu 5 dòng: Khoảng cách và chiều cao bằng đúng 1 lệnh thực tế trong bảng */}
            {filteredGroups.length > 0 && paginatedGroups.length < 5 && (
              Array.from({ length: 5 - paginatedGroups.length }).map((_, emptyIdx) => (
                <tr key={`empty-row-${emptyIdx}`} className="border-b border-[var(--border-subtle)] select-none pointer-events-none opacity-25">
                  <td className="py-3.5 px-1 text-center w-8 shrink-0">&nbsp;</td>
                  <td className="py-3.5 pl-3 pr-1 text-left w-[11%]">
                    <div className="flex flex-col">
                      <span className="text-xs leading-normal">&nbsp;</span>
                      <span className="text-[11px] leading-normal mt-0.5">&nbsp;</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-1 text-left w-[9%]">
                    <span className="text-[11px] leading-normal">&nbsp;</span>
                  </td>
                  <td className="py-3.5 px-3 text-left w-[16%]">
                    <div className="flex flex-col">
                      <span className="text-xs leading-normal">&nbsp;</span>
                      <span className="text-[10px] leading-normal mt-0.5">&nbsp;</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-2 text-center w-[8%]">
                    <span className="text-xs leading-normal">&nbsp;</span>
                  </td>
                  <td className="py-3.5 px-2 text-center w-[8%]">
                    <span className="text-xs leading-normal">&nbsp;</span>
                  </td>
                  <td className="py-3.5 px-2 text-center w-[11%]">
                    <div className="flex flex-col items-center">
                      <span className="text-xs leading-normal">&nbsp;</span>
                      <span className="text-[10px] leading-normal mt-0.5">&nbsp;</span>
                    </div>
                  </td>
                  <td className="py-3.5 px-3 text-right w-[15%]">
                    <span className="text-xs leading-normal">&nbsp;</span>
                  </td>
                  <td className="py-3.5 px-3 text-right w-[14%]">
                    <span className="text-xs leading-normal">&nbsp;</span>
                  </td>
                  <td className="py-3.5 px-2 text-center w-[8%]">
                    <span className="text-[11px] leading-normal">&nbsp;</span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* 3. FOOTER: THU GỌN, XOÁ SỐ TRANG VÀ MŨI TÊN SANG TRANG, CHUYỂN PAGE SIZE VỀ CUỐI */}
      <div className="px-4 py-2 bg-[var(--bg-card)] border-t border-[var(--border-main)] flex items-center justify-between gap-3 flex-wrap">
        {/* Vế Trái: Thông tin dòng hiển thị */}
        <div className="flex items-center gap-3">
          <span className="text-[11px] text-[#1d1b17] font-mono">
            Showing {filteredGroups.length === 0 ? 0 : 1}-{Math.min(effectivePageSize, filteredGroups.length)} of {filteredGroups.length} orders
            <span className="text-[var(--text-muted)] text-[10px] ml-1.5">({closedTrades.length} closed, {pendingTradeGroups.length} pending)</span>
          </span>
        </div>

        {/* Vế Phải: Page size 5, 10, 20, All đưa về cuối */}
        <div className="flex items-center gap-1.5 text-xs">
          <span className="text-[#1d1b17] font-medium text-[11px]">Page size:</span>
          {[5, 10, 20, 99999].map((sz) => {
            const isAll = sz === 99999;
            const isSelected = isAll ? effectivePageSize >= 99999 : effectivePageSize === sz;
            return (
              <button
                key={sz}
                type="button"
                onClick={() => onPageSizeChange?.(sz)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors cursor-pointer ${
                  isSelected
                    ? 'bg-[var(--bg-subtle)] text-[#1d1b17] font-bold border border-[#1d1b17]/40'
                    : 'text-[var(--text-muted)] hover:text-[#1d1b17] hover:bg-[var(--bg-subtle)]'
                }`}
              >
                {isAll ? 'All' : sz}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
