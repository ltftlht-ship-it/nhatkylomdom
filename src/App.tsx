import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { 
  TradeRow, 
  TradeType,
  TradeStatus, 
  PendingOrder, 
  TradingPlan, 
  AccountInfo, 
  AppSettings,
  PreChecklistItem,
  PostMistakeItem,
  SetupTagItem
} from './types';
import { 
  INITIAL_PENDING_ORDERS, 
  DEFAULT_PLANS, 
  DEFAULT_ACCOUNTS, 
  DEFAULT_PRE_CHECKLIST, 
  DEFAULT_POST_MISTAKES, 
  DEFAULT_SETUP_TAGS 
} from './data/mockTrades';
import { 
  computeTradeMetrics, 
  determineSession,
  processSupabaseTrades,
  calculateNetPnl,
  calculateRisk1R,
  calculateActualRR,
  getSavedTimezoneOffset,
  computeTradeStatistics,
  getSavedNoiseFilter,
  saveNoiseFilter,
  getSavedHideNoiseRows,
  saveHideNoiseRows
} from './utils/tradeCalculations';
import { 
  fetchTradesFromSupabase,
  fetchPlansFromSupabase,
  savePlanToSupabase,
  updatePlanStatusOnSupabase,
  updateTradeMappingOnSupabase
} from './lib/supabase';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { HistoryTable } from './components/HistoryTable';
import { PendingOrdersTable } from './components/PendingOrdersTable';
import { TradeDetailCard } from './components/TradeDetailCard';
import { SettingsModal } from './components/SettingsModal';
import { ImportModal } from './components/ImportModal';
import { ImageViewerModal } from './components/ImageViewerModal';
import { OverviewTab } from './components/OverviewTab';
import { PlansTab } from './components/PlansTab';
import { ReportsTab } from './components/ReportsTab';
import { SettingsTab } from './components/SettingsTab';
import { Clock, Layers, Zap, CheckCircle2 } from 'lucide-react';

export default function App() {
  // Global State
  const [currentTab, setCurrentTab] = useState<string>('lich-su');
  
  // Dark / Light Mode Global Theme
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    const saved = localStorage.getItem('trade_journal_theme');
    return saved ? saved === 'dark' : true;
  });

  const handleToggleTheme = () => {
    const next = !isDarkMode;
    setIsDarkMode(next);
    localStorage.setItem('trade_journal_theme', next ? 'dark' : 'light');
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // Hàng 1 Dropdown Filter States
  const [selectedSymbol, setSelectedSymbol] = useState<string>('ALL');
  const [selectedType, setSelectedType] = useState<string>('ALL');
  const [selectedSession, setSelectedSession] = useState<string>('ALL');
  const [selectedResult, setSelectedResult] = useState<string>('ALL');
  const [selectedSetup, setSelectedSetup] = useState<string>('ALL');
  const [noiseFilterActive, setNoiseFilterActive] = useState<boolean>(() => getSavedNoiseFilter());
  const [hideNoiseRows, setHideNoiseRows] = useState<boolean>(() => getSavedHideNoiseRows());

  const handleToggleNoiseFilter = () => {
    const next = !noiseFilterActive;
    setNoiseFilterActive(next);
    saveNoiseFilter(next);
  };

  const handleToggleHideNoiseRows = () => {
    const next = !hideNoiseRows;
    setHideNoiseRows(next);
    saveHideNoiseRows(next);
  };

  const handleResetFilters = () => {
    setSelectedSymbol('ALL');
    setSelectedType('ALL');
    setSelectedSession('ALL');
    setSelectedResult('ALL');
    setSelectedSetup('ALL');
    setSearchQuery('');
  };
  
  // Data States - Khởi tạo mảng rỗng không dán cứng dữ liệu giả
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>(INITIAL_PENDING_ORDERS);
  const [plans, setPlans] = useState<TradingPlan[]>([]);
  const [accounts, setAccounts] = useState<AccountInfo[]>(DEFAULT_ACCOUNTS);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('26325348');

  // Supabase connection & sync state
  const [supabaseStatus, setSupabaseStatus] = useState<'connected' | 'demo' | 'loading' | 'error'>('loading');
  const [isRefreshingSupabase, setIsRefreshingSupabase] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Active Selected Trade for Detail Card
  const [selectedTradeId, setSelectedTradeId] = useState<string>('');

  // Checklists & Setup items
  const [preChecklist, setPreChecklist] = useState<PreChecklistItem[]>(DEFAULT_PRE_CHECKLIST);
  const [postMistakes, setPostMistakes] = useState<PostMistakeItem[]>(DEFAULT_POST_MISTAKES);
  const [setupTags, setSetupTags] = useState<SetupTagItem[]>(DEFAULT_SETUP_TAGS);

  // Settings State
  const [settings, setSettings] = useState<AppSettings>({
    timezone_offset_hours: getSavedTimezoneOffset(), // Đọc offset đã lưu từ LocalStorage (hoặc 0)
    auto_classify_session: true,
    contract_sizes: {
      'XAU/USD': 100,
      'EUR/USD': 100000,
      'GBP/USD': 100000,
    }
  });

  // Modal States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [imageViewer, setImageViewer] = useState<{ isOpen: boolean; url: string; title: string }>({
    isOpen: false,
    url: '',
    title: '',
  });

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Active base account
  const activeAccount = useMemo(() => {
    const found = accounts.find(a => a.id === selectedAccountId);
    if (found) return found;
    return {
      id: selectedAccountId,
      name: selectedAccountId === 'ALL' ? 'Tất cả tài khoản (ALL)' : `MT5 #${selectedAccountId}`,
      ticket_server: selectedAccountId === 'ALL' ? 'Tất cả lệnh MT5' : `${selectedAccountId} (MT5 Live)`,
      balance: 10000,
      initial_balance: 10000,
      pnl: 0,
      win_rate: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      connected: true,
      currency: 'USD',
    };
  }, [accounts, selectedAccountId]);

  // Load and calculate trades from Supabase:
  // 1. Tách biệt Lệnh Pending ('PENDING_PLAN', 'OPEN', 'PENDING') và Lệnh Closed ('CLOSED')
  // 2. Tính Running Balance trên mảng tăng dần, sau đó reverse để lệnh mới nhất lên đầu
  const loadTrades = useCallback(async (targetAccountId?: string) => {
    const accId = targetAccountId !== undefined ? targetAccountId : selectedAccountId;
    setIsRefreshingSupabase(true);
    setSupabaseStatus('loading');

    try {
      const data = await fetchTradesFromSupabase(String(accId));

      if (data && data.length > 0) {
        // Tách biệt các lệnh CLOSED và PENDING
        const closedRaw = data.filter(d => (d.status || 'CLOSED').toUpperCase().trim() === 'CLOSED');
        const pendingOrOpenRaw = data.filter(d => {
          const st = (d.status || '').toUpperCase().trim();
          return st === 'PENDING_PLAN' || st === 'OPEN' || st === 'PENDING';
        });

        // 1. Xử lý các lệnh CLOSED:
        // - Sắp xếp tăng dần theo close_time để tính Running Balance lũy kế
        // - Đảo ngược (reverse) để hiển thị lệnh mới nhất lên đầu Bảng Lịch Sử
        const processed = processSupabaseTrades(
          closedRaw,
          activeAccount.initial_balance,
          100, // 1R mặc định $100 USD
          settings.contract_sizes,
          settings.timezone_offset_hours
        );
        setTrades(processed);
        setSupabaseStatus('connected');
        setSelectedTradeId(prev => {
          if (prev && processed.some(p => p.id === prev)) return prev;
          return processed[0]?.id || '';
        });

        // 2. Tách biệt các lệnh PENDING_PLAN / OPEN sang Tab Lệnh Chờ
        if (pendingOrOpenRaw.length > 0) {
          const mappedPending: PendingOrder[] = pendingOrOpenRaw.map((p, idx) => {
            const isSell = (p.type || '').toUpperCase().includes('SELL');
            return {
              id: p.id ? String(p.id) : `pending-${p.ticket || idx}`,
              ticket: String(p.ticket || `P-${idx + 1}`),
              symbol: p.symbol || 'XAU/USD',
              type: isSell ? 'SELL' : 'BUY',
              order_type: isSell ? 'SELL LIMIT' : 'BUY LIMIT',
              volume: Number(p.volume || 0.1),
              price: Number(p.open_price || 0),
              sl: Number(p.initial_sl || 0),
              tp: Number(p.close_price || 0),
              status: 'PENDING',
              placed_time: p.open_time || '',
              plan_id: p.plan_id || null,
            };
          });
          setPendingOrders(mappedPending);
        }
      } else {
        // Supabase chưa có dữ liệu hoặc không khớp account: Giữ mảng rỗng và hiển thị Empty State
        setTrades([]);
        setSelectedTradeId('');
        setSupabaseStatus('connected');
      }
    } catch (err) {
      console.error('Lỗi nạp trades từ Supabase:', err);
      setTrades([]);
      setSelectedTradeId('');
      setSupabaseStatus('error');
    } finally {
      setIsRefreshingSupabase(false);
      const now = new Date();
      setLastSyncTime(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, [selectedAccountId, activeAccount.initial_balance, settings.contract_sizes, settings.timezone_offset_hours]);

  // Tự động gọi API Supabase lấy dữ liệu thật khi mount hoặc khi thay đổi account_id
  useEffect(() => {
    loadTrades(selectedAccountId);
  }, [loadTrades, selectedAccountId]);

  // Nạp danh sách Plans từ Supabase theo selectedAccountId
  const loadPlans = useCallback(async (accId: string = selectedAccountId) => {
    try {
      const remotePlans = await fetchPlansFromSupabase(accId);
      if (remotePlans && remotePlans.length > 0) {
        setPlans(remotePlans);
      } else {
        setPlans([]);
      }
      return remotePlans;
    } catch (err) {
      console.error('Lỗi khi nạp danh sách Plans:', err);
      setPlans([]);
      return [];
    }
  }, [selectedAccountId]);

  useEffect(() => {
    loadPlans(selectedAccountId);
  }, [loadPlans, selectedAccountId]);

  // Dynamic Account with Realtime Fintech Accumulation
  // Vì trades đã được reverse để lệnh mới nhất lên đầu, nên trades[0] chính là lệnh gần nhất có running_balance mới nhất!
  const dynamicAccount = useMemo(() => {
    const isNoiseFilterActive = getSavedNoiseFilter();
    const stats = computeTradeStatistics(trades, isNoiseFilterActive);
    const totalNetPnl = trades.reduce((sum, t) => sum + (t.net_pnl || 0), 0);
    const latestRunningBalance = trades.length > 0
      ? (trades[0].running_balance ?? (activeAccount.initial_balance + totalNetPnl))
      : activeAccount.initial_balance;

    return {
      ...activeAccount,
      balance: Number(latestRunningBalance.toFixed(2)),
      pnl: Number(totalNetPnl.toFixed(2)),
      wins: stats.wins,
      losses: stats.losses,
      breakeven: stats.breakeven,
      win_rate: Number(stats.winRate.toFixed(1)),
      total_rr: stats.totalRR,
      noise_count: stats.noiseTradesCount,
    };
  }, [trades, activeAccount]);

  // Active selected trade (hỗ trợ cả lệnh khớp và lệnh chờ PENDING)
  const activeTrade = useMemo(() => {
    if (!selectedTradeId) return trades[0] || null;
    const foundInTrades = trades.find(t => t.id === selectedTradeId);
    if (foundInTrades) return foundInTrades;
    const foundPending = pendingOrders.find(p => (
      p.id === selectedTradeId || 
      String(p.ticket) === selectedTradeId || 
      `pending-${p.ticket}` === selectedTradeId
    ));
    if (foundPending) {
      const isSell = (foundPending.type || '').toUpperCase().includes('SELL');
      const orderType: TradeType = isSell ? 'SELL' : 'BUY';
      return {
        id: foundPending.id || `pending-${foundPending.ticket}`,
        ticket: String(foundPending.ticket),
        position_id: String(foundPending.ticket),
        account_id: selectedAccountId,
        symbol: foundPending.symbol,
        type: orderType,
        volume: foundPending.volume,
        open_price: foundPending.price,
        close_price: 0,
        initial_sl: foundPending.sl,
        pnl: 0,
        commission: 0,
        swap: 0,
        open_time: foundPending.placed_time || '',
        close_time: '-',
        pip_sl: foundPending.sl > 0 ? Math.abs(foundPending.price - foundPending.sl) : 0,
        risk_1r_usd: 100,
        net_pnl: 0,
        weighted_rr: 0,
        lost_profit: 0,
        timeframe: 'M15',
        session: 'Á' as any,
        pre_checklist_ids: [],
        post_checklist_ids: [],
        notes: foundPending.notes || '',
        plan_id: foundPending.plan_id,
        plan_name: foundPending.plan_title,
        status: 'PENDING',
        is_noise: foundPending.volume <= 0.01,
        result: 'BE' as any
      };
    }
    return trades[0] || null;
  }, [trades, pendingOrders, selectedTradeId, selectedAccountId]);

  // Unique symbols list for Dropdown Filter
  const uniqueSymbols = useMemo(() => {
    const set = new Set<string>();
    trades.forEach(t => { if (t.symbol) set.add(t.symbol); });
    pendingOrders.forEach(p => { if (p.symbol) set.add(p.symbol); });
    return Array.from(set).sort();
  }, [trades, pendingOrders]);

  // Update account name handler
  const handleUpdateAccountName = (newName: string) => {
    setAccounts(prev => prev.map(a => a.id === selectedAccountId ? { ...a, name: newName } : a));
  };

  // Update a trade in list
  const handleUpdateTrade = (updated: TradeRow) => {
    setTrades(prev => prev.map(t => t.id === updated.id ? updated : t));
  };

  // Assign plan to pending order
  const handleAssignPlanToPendingOrder = (orderId: string, planId: string) => {
    setPendingOrders(prev => prev.map(o => {
      if (o.id === orderId) {
        const p = plans.find(plan => plan.id === planId);
        return {
          ...o,
          plan_id: planId,
          plan_title: p?.title
        };
      }
      return o;
    }));
  };

  // Khớp lệnh pending order -> chuyển sang Bảng Lịch Sử chính và giữ nguyên Plan đã gán
  const handleExecutePendingOrder = (orderId: string) => {
    const order = pendingOrders.find(o => o.id === orderId);
    if (!order) return;

    // Simulate market fill prices
    const openPrice = order.price;
    const isBuy = order.type === 'BUY';
    const closePrice = isBuy ? openPrice + 18.5 : openPrice - 18.5;
    const grossPnl = isBuy ? (closePrice - openPrice) * order.volume * 100 : (openPrice - closePrice) * order.volume * 100;

    const newFilledTrade = computeTradeMetrics({
      id: `trade-filled-${Date.now()}`,
      ticket: order.ticket,
      position_id: order.ticket,
      symbol: order.symbol,
      type: order.type,
      volume: order.volume,
      open_price: openPrice,
      close_price: closePrice,
      initial_sl: order.sl,
      pnl: Number(grossPnl.toFixed(2)),
      commission: -2.5,
      swap: 0,
      open_time: new Date().toISOString().replace('T', ' ').slice(0, 19),
      close_time: new Date(Date.now() + 3600000).toISOString().replace('T', ' ').slice(0, 19),
      timeframe: 'M15',
      session: determineSession(new Date().toISOString(), settings.timezone_offset_hours),
      pre_checklist_ids: ['bias', 'poi', 'liquidity', 'session', 'sl_safe', 'rr_ratio'],
      post_checklist_ids: [],
      notes: `Lệnh limit #${order.ticket} cào từ MT5 đã khớp tự động. ${order.notes || ''}`,
      plan_id: order.plan_id, // Giữ nguyên Plan đã gán!
      status: 'CLOSED',
      running_balance: activeAccount.balance + grossPnl,
      setups: ['POI sau IDM'],
    }, settings.contract_sizes, settings.timezone_offset_hours);

    // Add to trades, remove from pending
    setTrades(prev => [newFilledTrade, ...prev]);
    setPendingOrders(prev => prev.filter(o => o.id !== orderId));
    setSelectedTradeId(newFilledTrade.id);
  };

  // Import trades handler
  const handleImportTrades = (newTrades: TradeRow[]) => {
    setTrades(prev => [...newTrades, ...prev]);
    if (newTrades.length > 0) {
      setSelectedTradeId(newTrades[0].id);
    }
  };

  // Reset or reload from Supabase
  const handleResetDemoData = () => {
    loadTrades(selectedAccountId);
  };

  // Add plan and sync to Supabase with status PENDING
  const handleAddPlan = async (newPlan: TradingPlan) => {
    setPlans(prev => [newPlan, ...prev]);
    try {
      await savePlanToSupabase(newPlan);
    } catch (err) {
      console.error('Lỗi khi lưu Plan lên Supabase:', err);
    }
  };

  // 1-Click Map Plan to Trade (and sync metadata)
  const handleMapPlanToTrade = async (tradeId: string, planId: string | null, planObj?: TradingPlan) => {
    if (!planId) {
      // Hủy liên kết Plan ở cả trades và pending orders
      setTrades(prev => prev.map(t => {
        if (t.id === tradeId) {
          return { ...t, plan_id: null, plan_name: undefined };
        }
        return t;
      }));
      setPendingOrders(prev => prev.map(p => {
        if (p.id === tradeId || `pending-${p.ticket}` === tradeId || String(p.ticket) === tradeId) {
          return { ...p, plan_id: null, plan_title: undefined };
        }
        return p;
      }));
      const targetTrade = trades.find(t => t.id === tradeId);
      if (targetTrade) {
        await updateTradeMappingOnSupabase(targetTrade.id, targetTrade.ticket, { plan_id: null, plan_name: null });
      }
      return;
    }

    const selectedPlan = planObj || plans.find(p => p.id === planId);
    if (!selectedPlan) return;

    // 1. Đồng bộ metadata từ Plan sang Pending Orders nếu là lệnh chờ
    setPendingOrders(prev => prev.map(p => {
      if (p.id === tradeId || `pending-${p.ticket}` === tradeId || String(p.ticket) === tradeId) {
        return {
          ...p,
          plan_id: selectedPlan.id,
          plan_title: selectedPlan.plan_name || selectedPlan.title,
        };
      }
      return p;
    }));

    // 2. Đồng bộ metadata từ Plan sang Trade
    setTrades(prev => prev.map(t => {
      if (t.id === tradeId) {
        return {
          ...t,
          plan_id: selectedPlan.id,
          plan_name: selectedPlan.plan_name || selectedPlan.title,
          timeframe: (selectedPlan.timeframe as any) || t.timeframe,
          setup: selectedPlan.setup || t.setup,
          setups: selectedPlan.setup ? [selectedPlan.setup] : t.setups,
          notes: selectedPlan.notes 
            ? (t.notes ? `${selectedPlan.notes}\n---\n${t.notes}` : selectedPlan.notes) 
            : t.notes,
          pre_checklist_ids: selectedPlan.checklist && selectedPlan.checklist.length > 0 
            ? selectedPlan.checklist 
            : t.pre_checklist_ids,
          image_url_1: selectedPlan.image_url || t.image_url_1 || t.htf_image_url,
          htf_image_url: selectedPlan.image_url || t.htf_image_url,
        };
      }
      return t;
    }));

    // 2. Chuyển status Plan sang EXECUTED
    setPlans(prev => {
      const exists = prev.some(p => p.id === selectedPlan.id);
      if (exists) {
        return prev.map(p => p.id === selectedPlan.id ? { ...p, status: 'EXECUTED' } : p);
      }
      return [{ ...selectedPlan, status: 'EXECUTED' }, ...prev];
    });

    // 3. Đẩy đồng bộ lên Supabase
    const targetTrade = trades.find(t => t.id === tradeId);
    if (targetTrade) {
      await updateTradeMappingOnSupabase(targetTrade.id, targetTrade.ticket, {
        plan_id: selectedPlan.id,
        plan_name: selectedPlan.plan_name || selectedPlan.title,
        timeframe: selectedPlan.timeframe,
        setup: selectedPlan.setup,
        notes: selectedPlan.notes,
        pre_checklist_ids: selectedPlan.checklist,
        image_url_1: selectedPlan.image_url,
      });
    }
    await updatePlanStatusOnSupabase(selectedPlan.id, 'EXECUTED');
  };

  return (
    <div className="flex h-screen w-screen bg-[var(--bg-main)] text-[var(--text-primary)] overflow-hidden select-none transition-colors duration-200">
      {/* 1. APP SHELL SIDEBAR */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={setCurrentTab}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onSelectAccount={setSelectedAccountId}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        onAddAccount={() => {
          const newId = prompt('Nhập Account ID MT5 mới:');
          if (newId && newId.trim()) {
            const cleanId = newId.trim();
            setAccounts(prev => [
              ...prev,
              {
                id: cleanId,
                name: `MT5 #${cleanId}`,
                ticket_server: `${cleanId} (MT5 Live)`,
                balance: 10000,
                initial_balance: 10000,
                pnl: 0,
                win_rate: 0,
                wins: 0,
                losses: 0,
                breakeven: 0,
                total_rr: 0,
              }
            ]);
            setSelectedAccountId(cleanId);
          }
        }}
      />

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--bg-main)] transition-colors duration-200">
        {/* TOP HEADER */}
        <Header
          currentTab={currentTab}
          activeAccount={dynamicAccount}
          selectedAccountId={selectedAccountId}
          onAccountIdChange={setSelectedAccountId}
          onUpdateAccountName={handleUpdateAccountName}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenImport={() => setIsImportOpen(true)}
          supabaseStatus={supabaseStatus}
          onSync={() => loadTrades(selectedAccountId)}
          isSyncing={isRefreshingSupabase}
          lastSyncTime={lastSyncTime}
          isDarkMode={isDarkMode}
          onToggleTheme={handleToggleTheme}
          uniqueSymbols={uniqueSymbols}
          selectedSymbol={selectedSymbol}
          onSymbolChange={setSelectedSymbol}
          selectedType={selectedType}
          onTypeChange={setSelectedType}
          selectedSession={selectedSession}
          onSessionChange={setSelectedSession}
          selectedResult={selectedResult}
          onResultChange={setSelectedResult}
          selectedSetup={selectedSetup}
          onSetupChange={setSelectedSetup}
          setupTags={setupTags}
          noiseFilterActive={noiseFilterActive}
          onToggleNoiseFilter={handleToggleNoiseFilter}
          hideNoiseRows={hideNoiseRows}
          onToggleHideNoiseRows={handleToggleHideNoiseRows}
          onResetFilters={handleResetFilters}
        />

        {/* VIEW CONTAINER BY TAB */}
        <main className="flex-1 overflow-y-auto bg-[var(--bg-main)] transition-colors duration-200">
          {/* ========================================================
              TAB LỊCH SỬ (UNIFIED CLOSED HISTORY & PENDING ORDERS)
             ======================================================== */}
          {currentTab === 'lich-su' && (
            <div className="flex flex-col min-h-full">
              {/* BẢNG LỊCH SỬ DUY NHẤT (GOM LỆNH KHỚP + LỆNH CHỜ, LỌC HÀNG 1 Ở HEADER) */}
              <div className="border-b border-[var(--border-main)]">
                <HistoryTable
                  trades={trades}
                  pendingOrders={pendingOrders}
                  plans={plans}
                  selectedTradeId={selectedTradeId}
                  onSelectTrade={(trade) => setSelectedTradeId(trade.id)}
                  searchFilter={searchQuery}
                  onSearchChange={setSearchQuery}
                  isLoading={isRefreshingSupabase}
                  accountId={selectedAccountId}
                  timezoneOffset={settings.timezone_offset_hours}
                  onSync={() => loadTrades(selectedAccountId)}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  onMapPlanToTrade={handleMapPlanToTrade}
                  onNavigateToPlans={() => setCurrentTab('ke-hoach')}
                  selectedSymbol={selectedSymbol}
                  selectedType={selectedType}
                  selectedSession={selectedSession}
                  selectedResult={selectedResult}
                  selectedSetup={selectedSetup}
                  noiseFilterActive={noiseFilterActive}
                  hideNoiseRows={hideNoiseRows}
                />
              </div>

              {/* CARD CHI TIẾT LỆNH (LAYOUT PHÍA DƯỚI BẢNG) */}
              <div className="flex-1">
                <TradeDetailCard
                  trade={activeTrade}
                  plans={plans}
                  accountId={selectedAccountId}
                  preChecklistItems={preChecklist}
                  postMistakeItems={postMistakes}
                  setupTags={setupTags}
                  timezoneOffset={settings.timezone_offset_hours}
                  onUpdateTrade={handleUpdateTrade}
                  onMapPlanToTrade={handleMapPlanToTrade}
                  onOpenSettingsModal={() => setIsSettingsOpen(true)}
                  onViewImage={(url, title) => setImageViewer({ isOpen: true, url, title })}
                />
              </div>
            </div>
          )}

          {/* TAB TỔNG QUAN */}
          {currentTab === 'tong-quan' && (
            <OverviewTab
              trades={trades}
              activeAccount={activeAccount}
              onNavigateToHistory={() => setCurrentTab('lich-su')}
            />
          )}

          {/* TAB KẾ HOẠCH */}
          {currentTab === 'ke-hoach' && (
            <PlansTab
              plans={plans}
              trades={trades}
              accountId={selectedAccountId}
              selectedAccountId={selectedAccountId}
              preChecklist={preChecklist}
              setupTags={setupTags}
              onAddPlan={handleAddPlan}
              onReloadPlans={() => loadPlans(selectedAccountId)}
              onNavigateToHistory={() => setCurrentTab('lich-su')}
              onViewImage={(url, title) => setImageViewer({ isOpen: true, url, title })}
              onSelectTrade={(tr) => {
                setSelectedTradeId(tr.id);
                setCurrentTab('lich-su');
              }}
            />
          )}

          {/* TAB BÁO CÁO */}
          {currentTab === 'bao-cao' && (
            <ReportsTab
              trades={trades}
              activeAccount={activeAccount}
            />
          )}

          {/* TAB CÀI ĐẶT */}
          {currentTab === 'cai-dat' && (
            <SettingsTab
              settings={settings}
              onUpdateSettings={setSettings}
              accounts={accounts}
            />
          )}
        </main>
      </div>

      {/* 3. MODALS */}
      {/* Settings Modal (opened via Header Cog) */}
      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={setSettings}
        preChecklist={preChecklist}
        onUpdatePreChecklist={setPreChecklist}
        postMistakes={postMistakes}
        onUpdatePostMistakes={setPostMistakes}
        onRefreshSupabase={() => loadTrades(selectedAccountId)}
      />

      {/* Import Modal (opened via Header "Nạp Import" button) */}
      <ImportModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        onImportTrades={handleImportTrades}
        onResetDemoData={handleResetDemoData}
      />

      {/* Fullscreen Image Zoom Viewer */}
      <ImageViewerModal
        isOpen={imageViewer.isOpen}
        onClose={() => setImageViewer({ isOpen: false, url: '', title: '' })}
        imageUrl={imageViewer.url}
        title={imageViewer.title}
      />
    </div>
  );
}
