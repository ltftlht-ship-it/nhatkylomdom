import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
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
  DEFAULT_PLANS, 
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
  computePositionWinStats,
  getSavedNoiseFilter,
  saveNoiseFilter,
  getSavedHideNoiseRows,
  saveHideNoiseRows,
  parseChecklistArray
} from './utils/tradeCalculations';
import { 
  fetchTradesFromSupabase,
  subscribeToTradesRealtime,
  fetchPlansFromSupabase,
  savePlanToSupabase,
  updatePlanStatusOnSupabase,
  deletePlanFromSupabase,
  updateTradeMappingOnSupabase,
  updateTradeJournalOnSupabase,
  cancelPendingOrderOnSupabase,
  DetectedAccountInfo,
  extractAccountsFromTrades,
  getTradeJournalFromLocalCache,
  getAuthUser,
  signOutAuthUser,
  subscribeToAuthChanges,
  checkIsAdmin
} from './lib/supabase';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { HistoryTable } from './components/HistoryTable';
import { PendingOrdersTable } from './components/PendingOrdersTable';
import { TradeDetailCard } from './components/TradeDetailCard';
import { SettingsModal } from './components/SettingsModal';
import { ChecklistEditorModal } from './components/ChecklistEditorModal';
import { ImportModal } from './components/ImportModal';
import { ImageViewerModal } from './components/ImageViewerModal';
import { AuthModal } from './components/AuthModal';
import { AuthGateScreen } from './components/AuthGateScreen';
import { ConnectEAModal } from './components/ConnectEAModal';
import { LicenseGateScreen } from './components/LicenseGateScreen';
import { LicenseManagerModal } from './components/LicenseManagerModal';
import { verifyUserLicense } from './lib/licenseApi';
import { LicenseCheckResult } from './types/license';
import { OverviewTab } from './components/OverviewTab';
import { PlansTab } from './components/PlansTab';
import { ChartTab } from './components/ChartTab';
import { ReportsTab } from './components/ReportsTab';
import { SettingsTab } from './components/SettingsTab';
import { Clock, Layers, Zap, CheckCircle2, Lock, Key, ShieldCheck } from 'lucide-react';

export default function App() {
  // Global State
  const [currentTab, setCurrentTab] = useState<string>(() => {
    const saved = localStorage.getItem('deal_current_tab');
    if (saved === 'bieu-do') return 'ke-hoach';
    return saved || 'lich-su';
  });

  const handleTabChange = (tab: string) => {
    setCurrentTab(tab);
    localStorage.setItem('deal_current_tab', tab);
  };
  
  // Dark / Light Mode Global Theme
  const [isDarkMode, setIsDarkMode] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const migrated = localStorage.getItem('tactile_clay_v1_active');
    if (!migrated) {
      localStorage.setItem('tactile_clay_v1_active', 'true');
      localStorage.setItem('trade_journal_theme', 'light');
      document.documentElement.classList.remove('dark');
      return false;
    }
    const saved = localStorage.getItem('trade_journal_theme');
    return saved === 'dark';
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
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [plans, setPlans] = useState<TradingPlan[]>(() => {
    try {
      const saved = localStorage.getItem('trade_journal_plans');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return [];
  });
  // Danh sách tài khoản lưu tạm để hiển thị ngay khi mở app; số dư được tính lại từ dữ liệu EA sau khi tải lệnh
  const [accounts, setAccounts] = useState<AccountInfo[]>(() => {
    try {
      const parsed = JSON.parse(localStorage.getItem('deal_accounts_list') || '[]');
      if (Array.isArray(parsed)) {
        return parsed
          .filter((a: any) =>
            a && a.id &&
            a.id !== 'ALL' &&
            !String(a.id).startsWith('mock-') &&
            !String(a.name || '').toLowerCase().includes('tất cả tài khoản')
          )
          .map((a: any) => ({ ...a, id: String(a.id).replace(/^acc-/, '').trim() }));
      }
    } catch (e) {
      console.warn('Failed to parse deal_accounts_list from localStorage', e);
    }
    return [];
  });

  const accountsRef = useRef<AccountInfo[]>(accounts);
  accountsRef.current = accounts;

  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    const saved = localStorage.getItem('deal_selected_account_id');
    return saved && saved !== 'ALL' ? saved : '';
  });

  const selectedAccountIdRef = useRef<string>(selectedAccountId);
  selectedAccountIdRef.current = selectedAccountId;

  // Bộ nhớ đệm trades giữa các tài khoản để chuyển tab tài khoản tức thì (0ms latency, không giật về 10k)
  const tradesCacheRef = useRef<Record<string, { trades: TradeRow[]; pending: PendingOrder[]; rawClosed: any[] }>>({});

  const handleAccountIdChange = (accId: string) => {
    if (!accId || accId === 'ALL') return;
    const cleanId = String(accId).replace(/^acc-/, '').trim();
    selectedAccountIdRef.current = cleanId;
    setSelectedAccountId(cleanId);
    localStorage.setItem('deal_selected_account_id', cleanId);

    // Tải danh sách plans của tài khoản
    loadPlans(cleanId);

    // Nạp tức thì từ cache nếu tài khoản này đã được nạp trước đó (0ms delay!)
    const cached = tradesCacheRef.current[cleanId];
    if (cached && cached.trades && cached.trades.length > 0) {
      setTrades(cached.trades);
      setPendingOrders(cached.pending);
      rawClosedTradesRef.current = cached.rawClosed;
      setSelectedTradeId(cached.trades[0]?.id || '');
    } else {
      // Nếu chưa có trong cache, reset rỗng để không bị dính lệnh của tài khoản trước!
      setTrades([]);
      setPendingOrders([]);
      rawClosedTradesRef.current = [];
      setSelectedTradeId('');
    }

    // Gọi nạp dữ liệu tức thì từ Supabase cho tài khoản mới chọn
    loadTrades(cleanId, false);
  };

  // Supabase connection & sync state
  const [supabaseStatus, setSupabaseStatus] = useState<'connected' | 'demo' | 'loading' | 'error'>('loading');
  const [isRefreshingSupabase, setIsRefreshingSupabase] = useState<boolean>(false);
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Active Selected Trade for Detail Card
  const [selectedTradeId, setSelectedTradeId] = useState<string>(() => {
    return localStorage.getItem('deal_selected_trade_id') || '';
  });

  const handleSelectTrade = (tradeId: string) => {
    setSelectedTradeId(tradeId);
    localStorage.setItem('deal_selected_trade_id', tradeId);
  };
  const [journalSaveStatus, setJournalSaveStatus] = useState<string>('Tự động lưu khi nhập');
  const debounceTimersRef = useRef<Record<string, NodeJS.Timeout>>({});
  const rawClosedTradesRef = useRef<any[]>([]);

  // Checklists & Setup items persisted in localStorage
  const [preChecklist, setPreChecklist] = useState<PreChecklistItem[]>(() => {
    const saved = localStorage.getItem('deal_pre_checklist');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.warn('Failed to parse deal_pre_checklist', e);
      }
    }
    return DEFAULT_PRE_CHECKLIST;
  });

  const [postMistakes, setPostMistakes] = useState<PostMistakeItem[]>(() => {
    const saved = localStorage.getItem('deal_post_mistakes');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.warn('Failed to parse deal_post_mistakes', e);
      }
    }
    return DEFAULT_POST_MISTAKES;
  });

  const [setupTags, setSetupTags] = useState<SetupTagItem[]>(() => {
    const saved = localStorage.getItem('deal_setup_tags');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {
        console.warn('Failed to parse deal_setup_tags', e);
      }
    }
    return DEFAULT_SETUP_TAGS;
  });

  const handleSaveChecklistConfig = (
    newPre: PreChecklistItem[],
    newPost: PostMistakeItem[],
    newSetups: SetupTagItem[]
  ) => {
    setPreChecklist(newPre);
    setPostMistakes(newPost);
    setSetupTags(newSetups);
    localStorage.setItem('deal_pre_checklist', JSON.stringify(newPre));
    localStorage.setItem('deal_post_mistakes', JSON.stringify(newPost));
    localStorage.setItem('deal_setup_tags', JSON.stringify(newSetups));
  };

  const handleResetChecklistConfig = () => {
    setPreChecklist(DEFAULT_PRE_CHECKLIST);
    setPostMistakes(DEFAULT_POST_MISTAKES);
    setSetupTags(DEFAULT_SETUP_TAGS);
    localStorage.removeItem('deal_pre_checklist');
    localStorage.removeItem('deal_post_mistakes');
    localStorage.removeItem('deal_setup_tags');
  };

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

  const handleUpdateSettings = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
    // Xóa bộ nhớ đệm trades giữa các tài khoản để đảm bảo tính toán lại theo múi giờ và thiết lập mới
    tradesCacheRef.current = {};
    if (rawClosedTradesRef.current && rawClosedTradesRef.current.length > 0) {
      const targetAcc = accountsRef.current.find(a => a.id === selectedAccountIdRef.current);
      let initialBalToUse = targetAcc?.initial_balance || 10000;
      const reprocessed = processSupabaseTrades(
        rawClosedTradesRef.current,
        initialBalToUse,
        100,
        newSettings.contract_sizes,
        newSettings.timezone_offset_hours
      );
      setTrades(reprocessed);
    }
  }, []);

  // Modal States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isChecklistEditorOpen, setIsChecklistEditorOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [isConnectEAOpen, setIsConnectEAOpen] = useState(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [authUser, setAuthUser] = useState<any>(null);
  const isAdmin = useMemo(() => checkIsAdmin(authUser), [authUser]);

  // Quản lý Bản Quyền Thương Mại (Commercial License Gate)
  const [isLicenseManagerOpen, setIsLicenseManagerOpen] = useState(false);
  const [licenseCheck, setLicenseCheck] = useState<LicenseCheckResult | null>(null);
  const [licenseLoading, setLicenseLoading] = useState(false);

  useEffect(() => {
    if (!authUser) {
      setLicenseCheck(null);
      return;
    }
    // Nếu là Admin Thầy Tài -> Miễn kiểm tra, toàn quyền
    if (isAdmin) {
      setLicenseCheck({
        isValid: true,
        isExpired: false,
        isBlocked: false,
        allowedAccountsList: [],
        message: '👑 Quản trị viên tối cao'
      });
      return;
    }

    setLicenseLoading(true);
    verifyUserLicense(authUser.email, false).then(res => {
      setLicenseCheck(res);
      setLicenseLoading(false);
    }).catch(() => {
      setLicenseLoading(false);
    });
  }, [authUser, isAdmin]);

  const [imageViewer, setImageViewer] = useState<{ isOpen: boolean; url: string; title: string }>({
    isOpen: false,
    url: '',
    title: '',
  });

  // Lắng nghe trạng thái đăng nhập Supabase Auth
  useEffect(() => {
    let isMounted = true;

    // Phiên đăng nhập chỉ lấy từ Supabase Auth (xác minh với máy chủ), xóa phiên tự dựng cũ còn sót
    try {
      localStorage.removeItem('deal_admin_session');
      localStorage.removeItem('deal_user_session');
    } catch {}

    getAuthUser().then(user => {
      if (isMounted) {
        setAuthUser(user);
        setAuthLoading(false);
      }
    }).catch(() => {
      if (isMounted) setAuthLoading(false);
    });

    const sub = subscribeToAuthChanges((user) => {
      if (isMounted) {
        setAuthUser(user);
        setAuthLoading(false);
      }
    });

    return () => {
      isMounted = false;
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    };
  }, []);

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  // Table rows per page (default 5, supports 5, 10, 20, 99999 for All)
  const [pageSize, setPageSize] = useState<number>(() => {
    const saved = localStorage.getItem('deal_history_page_size');
    return saved ? parseInt(saved, 10) || 5 : 5;
  });

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    localStorage.setItem('deal_history_page_size', String(newSize));
  };

  // Active base account
  const activeAccount = useMemo(() => {
    const found = accounts.find(a => a.id === selectedAccountId);
    if (found) return found;
    if (accounts.length > 0) return accounts[0];
    return {
      id: selectedAccountId,
      name: `MT5 #${selectedAccountId}`,
      ticket_server: `${selectedAccountId} (MT5 Live)`,
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
  const loadTrades = useCallback(async (targetAccountId?: string, isSilent = false) => {
    // Chỉ nạp dữ liệu khi đã đăng nhập
    if (!authUser) {
      if (!isSilent) setIsRefreshingSupabase(false);
      return;
    }

    const accId = targetAccountId !== undefined ? targetAccountId : selectedAccountIdRef.current;
    if (!isSilent) {
      setIsRefreshingSupabase(true);
      setSupabaseStatus('loading');
    }

    try {
      const data = await fetchTradesFromSupabase(String(accId), authUser?.id, isAdmin, licenseCheck?.allowedAccountsList || []);
      const detectedAccounts: DetectedAccountInfo[] = (data as any)?.detectedAccounts || extractAccountsFromTrades(data);

      const allRaw: any[] = (data as any)?.allRawTrades || data || [];

      // Admin chưa chọn tài khoản (hoặc tài khoản đã chọn không còn dữ liệu): tự chọn tài khoản MT5 có lệnh mới nhất
      const detectedIds = new Set((detectedAccounts || []).map(d => String(d.id).replace(/^acc-/, '').trim()));
      const cleanAccId = String(accId || '').replace(/^acc-/, '').trim();
      if (isAdmin && Array.isArray(allRaw) && allRaw.length > 0 && (!cleanAccId || !detectedIds.has(cleanAccId))) {
        const sortedNewest = [...allRaw].filter(t => t.close_time || t.open_time).sort((a, b) => {
          const timeA = new Date((a.close_time || a.open_time || '').replace(/[.-]/g, '/')).getTime() || 0;
          const timeB = new Date((b.close_time || b.open_time || '').replace(/[.-]/g, '/')).getTime() || 0;
          return timeB - timeA;
        });
        const newestTrade = sortedNewest[0];
        if (newestTrade) {
          const newestAcc = String(
            newestTrade.account_id ?? newestTrade.account ?? newestTrade.login ?? ''
          ).replace(/^acc-/, '').trim();
          if (newestAcc && newestAcc !== cleanAccId) {
            console.log(`[Auto-Switch] Chuyển tự động sang tài khoản MT5 đang chạy lệnh: #${newestAcc}`);
            selectedAccountIdRef.current = newestAcc;
            setSelectedAccountId(newestAcc);
            localStorage.setItem('deal_selected_account_id', newestAcc);
            return loadTrades(newestAcc, isSilent);
          }
        }
      }

      // Gom toàn bộ lệnh closed theo account_id để tính số dư thực tế cho TOÀN BỘ tài khoản cùng lúc
      const tradesByAccount = new Map<string, { totalNetPnl: number; count: number; initialBal?: number }>();
      if (Array.isArray(allRaw)) {
        allRaw.forEach(t => {
          const rawAcc = String(
            t.account_id ?? t.account ?? t.login ?? t.mt5_account ?? t.user_id ?? ''
          ).replace(/^acc-/, '').trim();
          if (!rawAcc || rawAcc === 'ALL') return;

          const st = (t.status || 'CLOSED').toUpperCase().trim();
          if (st === 'CLOSED') {
            const pnl = Number(t.pnl || 0);
            const comm = Number(t.commission || 0);
            const sw = Number(t.swap || 0);
            const net = Number((pnl + comm + sw).toFixed(2));
            const init = t.initial_balance && !isNaN(Number(t.initial_balance)) && Number(t.initial_balance) > 0
              ? Number(t.initial_balance)
              : undefined;

            const cur = tradesByAccount.get(rawAcc) || { totalNetPnl: 0, count: 0 };
            cur.totalNetPnl = Number((cur.totalNetPnl + net).toFixed(2));
            cur.count += 1;
            if (!cur.initialBal && init) cur.initialBal = init;
            tradesByAccount.set(rawAcc, cur);
          }
        });
      }

      // Phân tách tài khoản đa người dùng thương mại (Multi-tenant Account Isolation)
      if (!isAdmin) {
        const allowedList = licenseCheck?.allowedAccountsList || [];
        // Khách chỉ thấy đúng các tài khoản MT5 được cấp phép; danh sách trống = không thấy gì
        const filteredDetected = (detectedAccounts || []).filter(d => {
          const cleanId = String(d.id).replace(/^acc-/, '').trim();
          return allowedList.includes(cleanId);
        });

        const userAccList: AccountInfo[] = filteredDetected.map(d => {
          const cleanId = String(d.id).replace(/^acc-/, '').trim();
          const accStats = tradesByAccount.get(cleanId);
          const initBal = d.initial_balance || accStats?.initialBal || 10000;
          const pnl = accStats?.totalNetPnl || 0;
          return {
            id: cleanId,
            name: `MT5 #${cleanId}`,
            ticket_server: `${cleanId} (MT5 Live)`,
            balance: Number((initBal + pnl).toFixed(2)),
            initial_balance: initBal,
            pnl: pnl,
            win_rate: 0,
            wins: 0,
            losses: 0,
            breakeven: 0,
            connected: true,
            currency: 'USD',
          };
        });
        setAccounts(userAccList);
        if (userAccList.length > 0) {
          if (!selectedAccountIdRef.current || !userAccList.some(a => a.id === selectedAccountIdRef.current)) {
            selectedAccountIdRef.current = userAccList[0].id;
            setSelectedAccountId(userAccList[0].id);
          }
        } else {
          selectedAccountIdRef.current = '';
          setSelectedAccountId('');
        }
      } else {
        // Quản trị viên (Thầy Tài): Cập nhật số dư và lãi lỗ cho toàn bộ tài khoản MT5 gốc
        setAccounts(prevAccounts => {
        let hasChange = false;
        const cleanedPrev = prevAccounts.filter(a => 
          a && a.id && 
          a.id !== 'ALL' && 
          !String(a.id).startsWith('mock-') && 
          !String(a.name || '').toLowerCase().includes('tất cả tài khoản')
        );

        const next = cleanedPrev.map(a => {
          const cleanId = String(a.id).replace(/^acc-/, '').trim();
          const accStats = tradesByAccount.get(cleanId);
          if (accStats) {
            // Vốn ban đầu lấy từ dữ liệu EA gửi lên (initial_balance), không gán cứng theo số tài khoản
            const effectiveInit = accStats.initialBal || a.initial_balance || 10000;

            const calculatedBal = Number((effectiveInit + accStats.totalNetPnl).toFixed(2));
            if (a.balance !== calculatedBal || a.pnl !== accStats.totalNetPnl || a.initial_balance !== effectiveInit) {
              hasChange = true;
              return {
                ...a,
                initial_balance: effectiveInit,
                balance: calculatedBal,
                pnl: accStats.totalNetPnl,
              };
            }
          } else {
            const init = a.initial_balance || 10000;
            if (a.balance !== init || a.initial_balance !== init) {
              hasChange = true;
              return {
                ...a,
                initial_balance: init,
                balance: init,
              };
            }
          }
          return a;
        });

        // Tự động thêm tài khoản MT5 mới phát hiện nếu chưa có
        if (detectedAccounts && detectedAccounts.length > 0) {
          detectedAccounts.forEach(d => {
            const cleanId = String(d.id).replace(/^acc-/, '').trim();
            if (!cleanId || cleanId === 'ALL' || cleanId.startsWith('mock-')) return;
            const exists = next.some(
              a => a.id === cleanId || a.id === `acc-${cleanId}` || String(a.id).replace(/^acc-/, '') === cleanId
            );
            if (!exists) {
              hasChange = true;
              const accStats = tradesByAccount.get(cleanId);
              const initBal = d.initial_balance || accStats?.initialBal || 10000;
              const bal = accStats ? Number((initBal + accStats.totalNetPnl).toFixed(2)) : initBal;
              const newAcc: AccountInfo = {
                id: cleanId,
                name: `MT5 #${cleanId}`,
                ticket_server: `${cleanId} (MT5 Live)`,
                balance: bal,
                initial_balance: initBal,
                pnl: accStats?.totalNetPnl || 0,
                win_rate: 0,
                wins: 0,
                losses: 0,
                breakeven: 0,
                connected: true,
                currency: 'USD',
              };
              next.push(newAcc);
              console.log(`[Auto-Account] Phát hiện tài khoản MT5 mới: #${cleanId}`);
            }
          });
        }

        if (hasChange || cleanedPrev.length !== prevAccounts.length) {
          localStorage.setItem('deal_accounts_list', JSON.stringify(next));
          return next;
        }
        return prevAccounts;
      });
      }

      if (data && data.length > 0) {
        // Tách biệt các lệnh CLOSED và PENDING
        const closedRaw = data.filter(d => (d.status || 'CLOSED').toUpperCase().trim() === 'CLOSED');
        
        // Tự động kế thừa plan_id và setup từ lệnh chờ gốc (thông qua position_id) nếu lệnh đóng chưa có plan
        const pendingMapByTicket = new Map<string, any>();
        data.forEach(d => {
          if (d.ticket) pendingMapByTicket.set(String(d.ticket), d);
        });
        closedRaw.forEach(c => {
          if (!c.plan_id && c.position_id) {
            const parent = pendingMapByTicket.get(String(c.position_id));
            if (parent && parent.plan_id) {
              c.plan_id = parent.plan_id;
              if (!c.notes && parent.notes) c.notes = parent.notes;
              if (!c.setup && parent.setup) c.setup = parent.setup;
              if (!c.plan_name && parent.plan_name) c.plan_name = parent.plan_name;
            }
          }
        });

        rawClosedTradesRef.current = closedRaw;

        // Tập hợp tất cả position_id và ticket đã đóng (CLOSED) để đối soát
        const closedTicketAndPosSet = new Set<string>();
        closedRaw.forEach(c => {
          if (c.ticket) closedTicketAndPosSet.add(String(c.ticket).trim());
          if (c.position_id) closedTicketAndPosSet.add(String(c.position_id).trim());
        });

        const pendingOrOpenRaw = data.filter(d => {
          const st = (d.status || '').toUpperCase().trim();
          // Chỉ giữ lệnh chờ / đang mở (lệnh đã hủy, xóa, hết hạn bị loại ở đây)
          const isPendingOrOpen = st === 'PENDING_PLAN' || st === 'OPEN' || st === 'PENDING';
          if (!isPendingOrOpen) return false;

          // Lọc bỏ nếu lệnh có position_id hoặc ticket đã nằm trong danh sách lệnh đã đóng (CLOSED)
          const ticketStr = String(d.ticket || '').trim();
          const posStr = String(d.position_id || '').trim();
          if (ticketStr && closedTicketAndPosSet.has(ticketStr)) return false;
          if (posStr && closedTicketAndPosSet.has(posStr)) return false;

          return true;
        });

        // 1. Xử lý các lệnh CLOSED:
        // Lấy initial_balance của đúng tài khoản đang load (từ accountsRef)
        const targetAcc = accountsRef.current.find(a => a.id === accId) || activeAccount;
        const initialBalToUse = tradesByAccount.get(cleanAccId)?.initialBal || targetAcc.initial_balance || 10000;

        const processed = processSupabaseTrades(
          closedRaw,
          initialBalToUse,
          100, // 1R mặc định $100 USD
          settings.contract_sizes,
          settings.timezone_offset_hours
        );
        setTrades(prevTrades => {
          const prevMap = new Map<string, TradeRow>(prevTrades.map(t => [String(t.ticket || t.id), t]));
          return processed.map(pt => {
            const prev = prevMap.get(String(pt.ticket || pt.id));
            if (!prev) return pt;
            return {
              ...pt,
              htf_image_url: pt.htf_image_url || prev.htf_image_url || '',
              image_url_1: pt.image_url_1 || prev.image_url_1 || '',
              ltf_image_url: pt.ltf_image_url || prev.ltf_image_url || pt.image_base64 || prev.image_base64 || '',
              image_base64: pt.image_base64 || prev.image_base64 || pt.ltf_image_url || prev.ltf_image_url || '',
              notes: pt.notes || prev.notes,
              setup: pt.setup || prev.setup,
              timeframe: pt.timeframe || prev.timeframe,
              plan_id: pt.plan_id || prev.plan_id,
              plan_name: pt.plan_name || prev.plan_name,
              pre_checklist_ids: pt.pre_checklist_ids && pt.pre_checklist_ids.length > 0 ? pt.pre_checklist_ids : prev.pre_checklist_ids,
              post_checklist_ids: pt.post_checklist_ids && pt.post_checklist_ids.length > 0 ? pt.post_checklist_ids : prev.post_checklist_ids,
            };
          });
        });
        setSupabaseStatus('connected');
        setSelectedTradeId(prev => {
          if (prev && processed.some(p => String(p.id) === String(prev) || String(p.ticket) === String(prev))) return prev;
          return processed[0]?.id || processed[0]?.ticket || '';
        });

        // 2. Tách biệt các lệnh PENDING_PLAN / OPEN sang Tab Lệnh Chờ
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

        // Lưu vào cache bộ nhớ để chuyển qua lại tức thì (0ms latency)
        tradesCacheRef.current[String(accId)] = {
          trades: processed,
          pending: mappedPending,
          rawClosed: closedRaw,
        };
      } else {
        // Supabase chưa có dữ liệu hoặc không khớp account: Giữ mảng rỗng và hiển thị Empty State
        setTrades([]);
        setPendingOrders([]);
        setSelectedTradeId('');
        setSupabaseStatus('connected');
        tradesCacheRef.current[String(accId)] = {
          trades: [],
          pending: [],
          rawClosed: [],
        };
      }
    } catch (err) {
      console.warn('Không thể nạp trades từ Supabase:', err);
      if (!isSilent) {
        setTrades([]);
        setPendingOrders([]);
        setSelectedTradeId('');
        setSupabaseStatus('error');
      }
    } finally {
      if (!isSilent) {
        setIsRefreshingSupabase(false);
      }
      const now = new Date();
      setLastSyncTime(now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, [settings.contract_sizes, settings.timezone_offset_hours, activeAccount, authUser, isAdmin, licenseCheck]);

  // Tự động gọi API Supabase, lắng nghe Realtime WebSocket và Heartbeat Auto-polling
  useEffect(() => {
    // Chỉ kích hoạt đồng bộ khi đã đăng nhập và là Quản trị viên (Admin)
    if (!authUser || !isAdmin) return;

    // 1. Nạp dữ liệu ngay khi mount hoặc khi đổi tài khoản
    loadTrades(selectedAccountId);

    // 2. Kênh Realtime WebSocket: Bắt sự kiện ngay khi MT5 chốt lệnh đẩy lên Supabase (~0.1s)
    const unsubscribe = subscribeToTradesRealtime(() => {
      console.log('⚡ [Realtime] Phát hiện biến động lệnh từ Supabase, tự động đồng bộ...');
      loadTrades(selectedAccountIdRef.current, true);
    });

    // 3. Heartbeat Auto-polling định kỳ mỗi 15 giây (chạy ngầm êm ái, đảm bảo 100% không sót lệnh)
    const intervalId = setInterval(() => {
      loadTrades(selectedAccountIdRef.current, true);
    }, 15000);

    // 4. Đồng bộ tức thì khi người dùng chuyển từ cửa sổ MT5 quay lại cửa sổ Web App
    const handleFocusOrVisible = () => {
      if (!document.hidden) {
        loadTrades(selectedAccountIdRef.current, true);
      }
    };

    window.addEventListener('focus', handleFocusOrVisible);
    document.addEventListener('visibilitychange', handleFocusOrVisible);

    return () => {
      unsubscribe();
      clearInterval(intervalId);
      window.removeEventListener('focus', handleFocusOrVisible);
      document.removeEventListener('visibilitychange', handleFocusOrVisible);
    };
  }, [loadTrades, selectedAccountId]);

  // Nạp danh sách Plans từ Supabase theo selectedAccountId và User
  const loadPlans = useCallback(async (accId: string = selectedAccountId) => {
    if (!authUser) {
      setPlans([]);
      return [];
    }
    try {
      const cleanAccId = String(accId || '').replace(/^acc-/, '').trim();
      const remotePlans = await fetchPlansFromSupabase(cleanAccId, authUser?.id, isAdmin, licenseCheck?.allowedAccountsList || []);
      // Luôn setPlans kể cả khi rỗng [] để tài khoản không bị dính plan của tài khoản trước
      setPlans(remotePlans || []);
      return remotePlans || [];
    } catch (err) {
      console.warn('Không thể nạp danh sách Plans:', err);
      setPlans([]);
      return [];
    }
  }, [selectedAccountId, authUser, isAdmin, licenseCheck]);

  useEffect(() => {
    loadPlans(selectedAccountId);
  }, [loadPlans, selectedAccountId]);

  // Dynamic Account with Realtime Fintech Accumulation
  // Vì trades đã được reverse để lệnh mới nhất lên đầu, nên trades[0] chính là lệnh gần nhất có running_balance mới nhất!
  const dynamicAccount = useMemo(() => {
    const isNoiseFilterActive = getSavedNoiseFilter();
    const cleanActiveId = String(selectedAccountId).replace(/^acc-/, '').trim();
    const currentAccount = accounts.find(a => String(a.id).replace(/^acc-/, '').trim() === cleanActiveId) || activeAccount;

    // KIỂM TRA BẢO VỆ: Chỉ tính toán từ mảng trades nếu mảng trades thực sự thuộc về selectedAccountId!
    const isMatchingTrades = trades.length > 0 && trades.every(t => {
      const tAcc = String(t.account_id || '').replace(/^acc-/, '').trim();
      return !tAcc || tAcc === cleanActiveId;
    });

    if (!isMatchingTrades || trades.length === 0) {
      return {
        ...currentAccount,
        balance: currentAccount.balance ?? currentAccount.initial_balance ?? 10000,
        pnl: currentAccount.pnl ?? 0,
        wins: currentAccount.wins ?? 0,
        losses: currentAccount.losses ?? 0,
        breakeven: currentAccount.breakeven ?? 0,
        win_rate: currentAccount.win_rate ?? 0,
        total_rr: 0,
        noise_count: 0,
      };
    }

    const stats = computeTradeStatistics(trades, isNoiseFilterActive);
    // Thắng/Thua/Winrate theo vị thế, cùng công thức với Tab Tổng Quan & Báo Cáo
    const posStats = computePositionWinStats(trades, hideNoiseRows);
    const totalNetPnl = trades.reduce((sum, t) => sum + (t.net_pnl || 0), 0);
    const latestRunningBalance = trades[0]?.running_balance ?? (currentAccount.initial_balance + totalNetPnl);

    return {
      ...currentAccount,
      balance: Number((latestRunningBalance ?? 0).toFixed(2)),
      pnl: Number((totalNetPnl ?? 0).toFixed(2)),
      wins: posStats.wins,
      losses: posStats.losses,
      breakeven: posStats.breakeven,
      win_rate: Number(posStats.winRate.toFixed(1)),
      total_rr: stats?.totalRR ?? 0,
      noise_count: stats?.noiseTradesCount ?? 0,
    };
  }, [trades, activeAccount, accounts, selectedAccountId, hideNoiseRows]);

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
      const cached = getTradeJournalFromLocalCache(foundPending.ticket);
      const cachedHtf = cached?.htf_image_url || cached?.pre_image || cached?.image_open || cached?.image_url_1;
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
        timeframe: cached?.timeframe || 'M15',
        session: 'Á' as any,
        pre_checklist_ids: cached?.pre_checklist_ids || [],
        post_checklist_ids: cached?.post_checklist_ids || [],
        notes: cached?.notes || foundPending.notes || '',
        plan_id: cached?.plan_id || foundPending.plan_id,
        plan_name: cached?.plan_name || foundPending.plan_title,
        status: 'PENDING',
        is_noise: foundPending.volume <= 0.01,
        result: 'BE' as any,
        htf_image_url: cachedHtf,
        image_url_1: cachedHtf,
        ltf_image_url: cached?.ltf_image_url,
        image_base64: cached?.image_base64,
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

  // Update account (Name & Tiền gốc / Initial Balance) and persist to localStorage
  const handleUpdateAccount = useCallback((accId: string, updates: { name?: string; initial_balance?: number }) => {
    setAccounts(prevAccounts => {
      const exists = prevAccounts.some(a => a.id === accId);
      let next: AccountInfo[];
      if (exists) {
        next = prevAccounts.map(a => {
          if (a.id === accId) {
            const newInit = updates.initial_balance !== undefined ? updates.initial_balance : (a.initial_balance ?? 10000);
            const currentPnl = a.pnl || 0;
            return {
              ...a,
              name: updates.name !== undefined ? updates.name : a.name,
              initial_balance: newInit,
              balance: Number((newInit + currentPnl).toFixed(2)),
            };
          }
          return a;
        });
      } else {
        const initBal = updates.initial_balance ?? 10000;
        next = [
          ...prevAccounts,
          {
            id: accId,
            name: updates.name || `MT5 #${accId}`,
            ticket_server: `${accId} (MT5 Live)`,
            balance: initBal,
            initial_balance: initBal,
            pnl: 0,
            win_rate: 0,
            wins: 0,
            losses: 0,
            breakeven: 0,
            connected: true,
            currency: 'USD',
          }
        ];
      }
      localStorage.setItem('deal_accounts_list', JSON.stringify(next));
      return next;
    });

    // Cập nhật ngay lập tức Running Balance của các lệnh giao dịch nếu thay đổi Tiền gốc
    if (updates.initial_balance !== undefined && accId === selectedAccountId && rawClosedTradesRef.current.length > 0) {
      const processed = processSupabaseTrades(
        rawClosedTradesRef.current,
        updates.initial_balance,
        100,
        settings.contract_sizes,
        settings.timezone_offset_hours
      );
      setTrades(processed);
      if (tradesCacheRef.current[String(accId)]) {
        tradesCacheRef.current[String(accId)].trades = processed;
      }
    }
  }, [selectedAccountId, settings.contract_sizes, settings.timezone_offset_hours]);

  const handleUpdateAccountName = (newName: string) => {
    handleUpdateAccount(selectedAccountId, { name: newName });
  };

  // Update a trade in list with 300ms debounced persistence to Supabase
  const handleUpdateTrade = useCallback((updated: TradeRow) => {
    // 1. Phản hồi UI tức thì trong React state
    setTrades(prev => prev.map(t => t.id === updated.id ? updated : t));

    // 2. Debounce 300ms ghi nhận xuống Supabase
    setJournalSaveStatus('Đang lưu...');
    const tradeKey = updated.id || String(updated.ticket);

    if (debounceTimersRef.current[tradeKey]) {
      clearTimeout(debounceTimersRef.current[tradeKey]);
    }

    debounceTimersRef.current[tradeKey] = setTimeout(async () => {
      try {
        const res = await updateTradeJournalOnSupabase(
          updated.id,
          updated.ticket,
          {
            timeframe: updated.timeframe,
            setup: updated.setup,
            setups: updated.setups,
            notes: updated.notes,
            pre_checklist_ids: updated.pre_checklist_ids,
            post_checklist_ids: updated.post_checklist_ids,
            plan_pnl: updated.plan_pnl,
            lost_profit: updated.lost_profit,
            image_url_1: updated.image_url_1 || undefined,
            htf_image_url: updated.htf_image_url || undefined,
            image_base64: updated.image_base64 || updated.ltf_image_url || undefined,
            ltf_image_url: updated.ltf_image_url || updated.image_base64 || undefined,
            plan_id: updated.plan_id,
            plan_name: updated.plan_name,
          },
          updated.account_id || selectedAccountId
        );

        if (res && res.success) {
          setJournalSaveStatus('Đã lưu Supabase');
          setTimeout(() => {
            setJournalSaveStatus('Tự động lưu khi nhập');
          }, 2000);
        } else {
          setJournalSaveStatus('Chưa lưu được (Offline)');
        }
      } catch (err) {
        console.error('Lỗi khi lưu journal trade:', err);
        setJournalSaveStatus('Lỗi khi lưu');
      }
    }, 300);
  }, [selectedAccountId]);

  // Hủy lệnh chờ và đồng bộ trạng thái CANCELLED xuống Supabase
  const handleCancelPendingOrder = useCallback(async (ticketOrId: string) => {
    const cleanTicket = String(ticketOrId).replace(/^pending-/, '');

    // 1. Cập nhật state local ngay lập tức
    setPendingOrders(prev => prev.filter(p => String(p.ticket) !== cleanTicket && p.id !== ticketOrId));
    setTrades(prev => prev.map(t => String(t.ticket) === cleanTicket ? { ...t, status: 'CANCELLED' as any } : t));

    // 2. Cập nhật trạng thái CANCELLED trên Supabase
    try {
      await cancelPendingOrderOnSupabase(cleanTicket, selectedAccountId);
    } catch (err) {
      console.error('Lỗi khi hủy lệnh chờ trên Supabase:', err);
    }
  }, [selectedAccountId]);

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
      pre_checklist_ids: order.plan_id ? parseChecklistArray(plans.find(p => p.id === order.plan_id)?.checklist) : [],
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

  // Add or update plan and sync to Supabase
  const handleAddPlan = async (planToSave: TradingPlan) => {
    const cleanAccount = String(planToSave.account_id || selectedAccountId).replace(/^acc-/, '').trim();
    const finalPlan = { ...planToSave, account_id: cleanAccount };
    setPlans(prev => {
      const idx = prev.findIndex(p => p.id === finalPlan.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = finalPlan;
        return next;
      }
      return [finalPlan, ...prev];
    });
    try {
      const res = await savePlanToSupabase(finalPlan);
      if (res?.plan && res.plan.id !== finalPlan.id) {
        setPlans(prev => prev.map(p => p.id === finalPlan.id ? res.plan : p));
      }
    } catch (err) {
      console.warn('Không thể lưu Plan lên Supabase (đã lưu LocalStorage):', err);
    }
  };

  const handleDeletePlan = async (planId: string) => {
    setPlans(prev => prev.filter(p => p.id !== planId));
    try {
      await deletePlanFromSupabase(planId);
    } catch (err) {
      console.warn('Không thể xoá Plan khỏi Supabase (đã xoá LocalStorage):', err);
    }
  };

  const handleUpdatePlanStatus = async (planId: string, status: 'PENDING' | 'EXECUTED' | 'CANCELLED') => {
    setPlans(prev => prev.map(p => p.id === planId ? { ...p, status } : p));
    try {
      await updatePlanStatusOnSupabase(planId, status);
    } catch (err) {
      console.warn('Không thể cập nhật status Plan lên Supabase (đã lưu LocalStorage):', err);
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

    // Clone độc lập checklist từ Plan để đảm bảo DECOUPLED hoàn toàn
    const clonedChecklist = parseChecklistArray(selectedPlan.checklist);

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
          pre_checklist_ids: clonedChecklist.length > 0 
            ? [...clonedChecklist] 
            : (t.pre_checklist_ids || []),
          image_url_1: selectedPlan.image_url || t.image_url_1 || t.htf_image_url,
          htf_image_url: selectedPlan.image_url || t.htf_image_url,
        };
      }
      return t;
    }));

    // 3. Chuyển status Plan sang EXECUTED
    setPlans(prev => {
      const exists = prev.some(p => p.id === selectedPlan.id);
      if (exists) {
        return prev.map(p => p.id === selectedPlan.id ? { ...p, status: 'EXECUTED' } : p);
      }
      return [{ ...selectedPlan, status: 'EXECUTED' }, ...prev];
    });

    // 4. Đẩy đồng bộ lên Supabase
    const targetTrade = trades.find(t => t.id === tradeId);
    if (targetTrade) {
      const newTradeChecklist = clonedChecklist.length > 0 ? [...clonedChecklist] : (targetTrade.pre_checklist_ids || []);
      await updateTradeMappingOnSupabase(targetTrade.id, targetTrade.ticket, {
        plan_id: selectedPlan.id,
        plan_name: selectedPlan.plan_name || selectedPlan.title,
        timeframe: selectedPlan.timeframe,
        setup: selectedPlan.setup,
        notes: selectedPlan.notes,
        pre_checklist_ids: newTradeChecklist,
        checklist: newTradeChecklist,
        image_url_1: selectedPlan.image_url,
      }, targetTrade.account_id || selectedAccountId);
    } else {
      const targetPending = pendingOrders.find(p => p.id === tradeId || `pending-${p.ticket}` === tradeId || String(p.ticket) === tradeId);
      if (targetPending) {
        await updateTradeMappingOnSupabase(targetPending.id, targetPending.ticket, {
          plan_id: selectedPlan.id,
          plan_name: selectedPlan.plan_name || selectedPlan.title,
          timeframe: selectedPlan.timeframe,
          setup: selectedPlan.setup,
          notes: selectedPlan.notes,
          pre_checklist_ids: clonedChecklist.length > 0 ? [...clonedChecklist] : undefined,
          checklist: clonedChecklist.length > 0 ? [...clonedChecklist] : undefined,
          image_url_1: selectedPlan.image_url,
        }, selectedAccountId);
      }
    }
    await updatePlanStatusOnSupabase(selectedPlan.id, 'EXECUTED');
  };

  // 1. Màn hình chờ xác thực ban đầu (Loading)
  if (authLoading) {
    return (
      <div className="flex h-screen w-screen bg-[var(--bg-main)] items-center justify-center font-mono text-xs text-[var(--text-muted)] select-none">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span>Đang xác thực bảo mật tài khoản...</span>
        </div>
      </div>
    );
  }

  // 2. Nếu CHƯA ĐĂNG NHẬP -> Khóa kín 100%, hiển thị màn hình AuthGateScreen
  if (!authUser) {
    return (
      <AuthGateScreen
        onLoginSuccess={(user) => {
          setAuthUser(user);
        }}
      />
    );
  }

  // 3. Nếu KHÔNG PHẢI ADMIN và CHƯA CÓ BẢN QUYỀN / BẢN QUYỀN HẾT HẠN -> Khóa cửa LicenseGateScreen
  if (!isAdmin && licenseCheck && !licenseCheck.isValid) {
    return (
      <LicenseGateScreen
        userEmail={authUser.email || ''}
        errorMessage={licenseCheck.message}
        isExpired={licenseCheck.isExpired}
        isBlocked={licenseCheck.isBlocked}
        onRefreshCheck={async () => {
          const res = await verifyUserLicense(authUser.email, false);
          setLicenseCheck(res);
        }}
        onSignOut={async () => {
          try {
            localStorage.removeItem('deal_admin_session');
            localStorage.removeItem('deal_user_session');
          } catch {}
          await signOutAuthUser();
          setAuthUser(null);
        }}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen bg-[var(--bg-main)] text-[var(--text-primary)] overflow-hidden select-none transition-colors duration-200">
      {/* 1. APP SHELL SIDEBAR */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={handleTabChange}
        accounts={accounts}
        selectedAccountId={selectedAccountId}
        onSelectAccount={handleAccountIdChange}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isDarkMode={isDarkMode}
        onToggleTheme={handleToggleTheme}
        activeAccount={dynamicAccount}
        onAddAccount={(newAcc: AccountInfo) => {
          setAccounts(prev => {
            const next = [...prev, newAcc];
            localStorage.setItem('deal_accounts_list', JSON.stringify(next));
            return next;
          });
          handleAccountIdChange(newAcc.id);
        }}
      />

      {/* 2. MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-[var(--bg-main)] transition-colors duration-200">
        {/* TOP HEADER */}
        <Header
          currentTab={currentTab}
          activeAccount={dynamicAccount}
          selectedAccountId={selectedAccountId}
          onAccountIdChange={handleAccountIdChange}
          onUpdateAccountName={handleUpdateAccountName}
          accounts={accounts}
          onUpdateAccount={handleUpdateAccount}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenImport={() => setIsImportOpen(true)}
          authUser={authUser}
          isAdmin={isAdmin}
          onOpenConnectEA={() => setIsConnectEAOpen(true)}
          onOpenLicenseManager={() => setIsLicenseManagerOpen(true)}
          onOpenAuth={() => setIsAuthOpen(true)}
          onSignOut={async () => {
            try {
              localStorage.removeItem('deal_admin_session');
              localStorage.removeItem('deal_user_session');
            } catch {}
            await signOutAuthUser();
            setAuthUser(null);
          }}
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
          pageSize={pageSize}
          onPageSizeChange={handlePageSizeChange}
        />

        {/* VIEW CONTAINER BY TAB */}
        <main className="flex-1 overflow-y-auto bg-[var(--bg-main)] transition-colors duration-200">
          {/* ========================================================
              TAB LỊCH SỬ (UNIFIED CLOSED HISTORY & PENDING ORDERS)
             ======================================================== */}
          {currentTab === 'lich-su' && (
            <div className="flex flex-col min-h-full py-4 px-4 sm:px-6 lg:px-[8%] xl:px-[10%] space-y-4 max-w-[1700px] mx-auto w-full transition-all font-sans">
              {/* 1. BẢNG DỮ LIỆU MT5 (FULL WIDTH PHÍA TRÊN) */}
              <div className="w-full">
                <HistoryTable
                  trades={trades}
                  pendingOrders={pendingOrders}
                  plans={plans}
                  selectedTradeId={selectedTradeId}
                  onSelectTrade={(trade) => handleSelectTrade(trade.id)}
                  searchFilter={searchQuery}
                  onSearchChange={setSearchQuery}
                  isLoading={isRefreshingSupabase}
                  accountId={selectedAccountId}
                  timezoneOffset={settings.timezone_offset_hours}
                  onSync={() => loadTrades(selectedAccountId)}
                  onOpenSettings={() => setIsSettingsOpen(true)}
                  onMapPlanToTrade={handleMapPlanToTrade}
                  onCancelPendingOrder={handleCancelPendingOrder}
                  onNavigateToPlans={() => setCurrentTab('ke-hoach')}
                  selectedSymbol={selectedSymbol}
                  selectedType={selectedType}
                  selectedSession={selectedSession}
                  selectedResult={selectedResult}
                  selectedSetup={selectedSetup}
                  noiseFilterActive={noiseFilterActive}
                  hideNoiseRows={hideNoiseRows}
                  pageSize={pageSize}
                  onPageSizeChange={handlePageSizeChange}
                  onSymbolChange={setSelectedSymbol}
                  onTypeChange={setSelectedType}
                  onSessionChange={setSelectedSession}
                  onResultChange={setSelectedResult}
                  onSetupChange={setSelectedSetup}
                  onToggleHideNoiseRows={() => setHideNoiseRows(!hideNoiseRows)}
                  onResetFilters={handleResetFilters}
                  setupTags={setupTags}
                  uniqueSymbols={uniqueSymbols}
                />
              </div>

              {/* 2. CARD CHI TIẾT LỆNH & CHECKLIST TRONG 1 KHUNG */}
              <div className="w-full">
                <TradeDetailCard
                  trade={activeTrade}
                  allTrades={trades}
                  plans={plans}
                  accountId={selectedAccountId}
                  preChecklistItems={preChecklist}
                  postMistakeItems={postMistakes}
                  setupTags={setupTags}
                  timezoneOffset={settings.timezone_offset_hours}
                  saveStatusText={journalSaveStatus}
                  onUpdateTrade={handleUpdateTrade}
                  onMapPlanToTrade={handleMapPlanToTrade}
                  onOpenSettingsModal={() => setIsSettingsOpen(true)}
                  onOpenChecklistEditor={() => setIsChecklistEditorOpen(true)}
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
              hideNoiseRows={hideNoiseRows}
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
              postMistakes={postMistakes}
              setupTags={setupTags}
              onAddPlan={handleAddPlan}
              onDeletePlan={handleDeletePlan}
              onUpdatePlanStatus={handleUpdatePlanStatus}
              onReloadPlans={() => loadPlans(selectedAccountId)}
              onNavigateToHistory={() => setCurrentTab('lich-su')}
              onViewImage={(url, title) => setImageViewer({ isOpen: true, url, title })}
              onSelectTrade={(tr) => {
                setSelectedTradeId(tr.id);
                setCurrentTab('lich-su');
              }}
            />
          )}

          {/* TAB BIỂU ĐỒ (TRADE EXECUTION CHART) - GIỮ SỐNG TRONG DOM ĐỂ KHÔNG BỊ MẤT BẢN VẼ KHI CHUYỂN TAB */}
          <div className={currentTab === 'bieu-do' ? 'w-full h-full block' : 'hidden'}>
            <ChartTab
              trades={trades}
              activeAccount={activeAccount}
              selectedTradeId={selectedTradeId}
              onSelectTrade={(tr) => setSelectedTradeId(tr.id || tr.ticket)}
              timezoneOffset={settings.timezone_offset_hours}
            />
          </div>

          {/* TAB BÁO CÁO */}
          {currentTab === 'bao-cao' && (
            <ReportsTab
              trades={trades}
              activeAccount={activeAccount}
              plans={plans}
              hideNoiseRows={hideNoiseRows}
              preChecklist={preChecklist}
              timezoneOffset={settings.timezone_offset_hours}
              onSelectTrade={(tr) => {
                setSelectedTradeId(tr?.id || tr?.ticket || null);
                setCurrentTab('lich-su');
              }}
            />
          )}

          {/* TAB CÀI ĐẶT */}
          {currentTab === 'cai-dat' && (
            <SettingsTab
              settings={settings}
              onUpdateSettings={handleUpdateSettings}
              accounts={accounts}
            />
          )}
        </main>
      </div>

      {/* 3. MODALS */}
      {/* Settings Modal (opened via Header Cog) */}
      {isSettingsOpen && (
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onUpdateSettings={handleUpdateSettings}
          preChecklist={preChecklist}
          onUpdatePreChecklist={setPreChecklist}
          postMistakes={postMistakes}
          onUpdatePostMistakes={setPostMistakes}
          onRefreshSupabase={() => loadTrades(selectedAccountId)}
        />
      )}

      {/* Checklist & Scoring Editor Modal (opened via Checklist panel header Cog) */}
      {isChecklistEditorOpen && (
        <ChecklistEditorModal
          isOpen={isChecklistEditorOpen}
          onClose={() => setIsChecklistEditorOpen(false)}
          preChecklistItems={preChecklist}
          postMistakeItems={postMistakes}
          setupTags={setupTags}
          onSave={handleSaveChecklistConfig}
          onResetDefaults={handleResetChecklistConfig}
        />
      )}

      {/* Import Modal (opened via Header "Nạp Import" button) */}
      {isImportOpen && (
        <ImportModal
          isOpen={isImportOpen}
          onClose={() => setIsImportOpen(false)}
          onImportTrades={handleImportTrades}
          onResetDemoData={handleResetDemoData}
        />
      )}

      {/* Fullscreen Image Zoom Viewer */}
      {imageViewer.isOpen && (
        <ImageViewerModal
          isOpen={imageViewer.isOpen}
          onClose={() => setImageViewer({ isOpen: false, url: '', title: '' })}
          imageUrl={imageViewer.url}
          title={imageViewer.title}
        />
      )}

      {/* Auth Modal (Đăng nhập / Đăng ký Google, GitHub, Email) */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onSuccess={() => {
          setIsAuthOpen(false);
        }}
      />

      {/* Connect EA MT5 Modal (Dành cho khách hàng lấy User Token kết nối MT5) */}
      <ConnectEAModal
        isOpen={isConnectEAOpen}
        onClose={() => setIsConnectEAOpen(false)}
        userId={authUser?.id || ''}
        userEmail={authUser?.email}
        isAdmin={isAdmin}
      />

      {/* License Manager Modal (Dành riêng cho Admin Thầy Tài quản lý khách hàng & số MT5) */}
      {isAdmin && (
        <LicenseManagerModal
          isOpen={isLicenseManagerOpen}
          onClose={() => setIsLicenseManagerOpen(false)}
        />
      )}
    </div>
  );
}
