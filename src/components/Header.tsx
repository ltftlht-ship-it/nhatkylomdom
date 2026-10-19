import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Search, 
  Settings as SettingsIcon, 
  Upload, 
  Filter, 
  Database,
  TrendingDown,
  TrendingUp,
  RefreshCw,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  ChevronDown,
  Moon,
  Sun,
  Edit2,
  Check,
  X,
  Clock,
  Eye,
  EyeOff,
  Globe,
  User
} from 'lucide-react';
import { AccountInfo, SetupTagItem } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface HeaderProps {
  currentTab?: string;
  activeAccount: AccountInfo;
  selectedAccountId: string;
  onAccountIdChange: (accId: string) => void;
  onUpdateAccountName?: (newName: string) => void;
  accounts?: AccountInfo[];
  onUpdateAccount?: (accId: string, updates: { name?: string; initial_balance?: number }) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenSettings: () => void;
  onOpenImport: () => void;
  supabaseStatus?: 'connected' | 'demo' | 'loading' | 'error';
  onSync: () => void;
  isSyncing?: boolean;
  lastSyncTime?: string | null;
  isDarkMode?: boolean;
  onToggleTheme?: () => void;
  timezoneOffset?: number;
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;

  // Smart Dropdown Filter Props
  uniqueSymbols?: string[];
  selectedSymbol?: string;
  onSymbolChange?: (sym: string) => void;
  selectedType?: string;
  onTypeChange?: (t: string) => void;
  selectedSession?: string;
  onSessionChange?: (s: string) => void;
  selectedResult?: string;
  onResultChange?: (r: string) => void;
  selectedSetup?: string;
  onSetupChange?: (st: string) => void;
  setupTags?: SetupTagItem[];
  noiseFilterActive?: boolean;
  onToggleNoiseFilter?: () => void;
  hideNoiseRows?: boolean;
  onToggleHideNoiseRows?: () => void;
  onResetFilters?: () => void;
  authUser?: any;
  isAdmin?: boolean;
  onOpenConnectEA?: () => void;
  onOpenAuth?: () => void;
  onSignOut?: () => void;
  onOpenLicenseManager?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab = 'lich-su',
  activeAccount,
  selectedAccountId,
  onAccountIdChange,
  onUpdateAccountName,
  accounts = [],
  onUpdateAccount,
  searchQuery,
  onSearchChange,
  onOpenSettings,
  onOpenImport,
  authUser,
  isAdmin,
  onOpenConnectEA,
  onOpenAuth,
  onSignOut,
  onOpenLicenseManager,
  supabaseStatus = 'demo',
  onSync,
  isSyncing = false,
  lastSyncTime = null,
  isDarkMode,
  onToggleTheme,
  timezoneOffset = 0,
  pageSize = 5,
  onPageSizeChange,

  // Dropdown filter props
  uniqueSymbols = [],
  selectedSymbol = 'ALL',
  onSymbolChange,
  selectedType = 'ALL',
  onTypeChange,
  selectedSession = 'ALL',
  onSessionChange,
  selectedResult = 'ALL',
  onResultChange,
  selectedSetup = 'ALL',
  onSetupChange,
  setupTags = [],
  noiseFilterActive = true,
  onToggleNoiseFilter,
  hideNoiseRows = false,
  onToggleHideNoiseRows,
  onResetFilters,
}) => {
  const { t, language, setLanguage } = useLanguage();

  // Account Edit Popover State
  const [isAccountEditOpen, setIsAccountEditOpen] = useState(false);
  const [editName, setEditName] = useState(activeAccount.name || '');
  const [editInitBalance, setEditInitBalance] = useState(String(activeAccount.initial_balance ?? 10000));
  const accountRef = useRef<HTMLDivElement>(null);

  // Synchronize when activeAccount or selectedAccountId changes
  useEffect(() => {
    setEditName(activeAccount.name || '');
    setEditInitBalance(String(activeAccount.initial_balance ?? 10000));
  }, [activeAccount.name, activeAccount.initial_balance, selectedAccountId]);

  const handleAccountSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanName = editName.trim();
    const cleanBalance = parseFloat(editInitBalance) || 0;
    if (onUpdateAccount) {
      onUpdateAccount(selectedAccountId, {
        name: cleanName || activeAccount.name,
        initial_balance: cleanBalance,
      });
    } else if (onUpdateAccountName && cleanName) {
      onUpdateAccountName(cleanName);
    }
    setIsAccountEditOpen(false);
  };

  // Popover States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const settingsRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (accountRef.current && !accountRef.current.contains(event.target as Node)) {
        setIsAccountEditOpen(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setIsSettingsOpen(false);
      }
      if (filterRef.current && !filterRef.current.contains(event.target as Node)) {
        setIsFilterOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (selectedSymbol !== 'ALL') count++;
    if (selectedType !== 'ALL') count++;
    if (selectedSession !== 'ALL') count++;
    if (selectedResult !== 'ALL') count++;
    if (selectedSetup !== 'ALL') count++;
    if (noiseFilterActive) count++;
    return count;
  }, [selectedSymbol, selectedType, selectedSession, selectedResult, selectedSetup, noiseFilterActive]);

  const isLoss = activeAccount.pnl < 0;

  return (
    <header className="h-16 px-5 lg:px-6 bg-[var(--bg-card)]/90 backdrop-blur-md border-b border-[var(--border-main)] flex items-center justify-between gap-4 select-none shrink-0 transition-colors duration-200 z-30 relative shadow-sm">
      {/* ========================================================
          LEFT: Tên & ID Tài Khoản + Settings Popover + Dropdown Filter + Search Bar
         ======================================================== */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* 1. Tên & ID Tài Khoản (Bấm để sửa Tên & Tiền gốc, liên kết với Sidebar) */}
        <div className="relative" ref={accountRef}>
          <div className="flex items-center clay-well rounded-full px-3 py-1 text-xs">
            <button
              type="button"
              onClick={() => setIsAccountEditOpen(!isAccountEditOpen)}
              className="flex items-center gap-1.5 font-bold text-[#1d1b17] hover:text-[#424843] transition-colors cursor-pointer group"
              title="Bấm để sửa Tên hiển thị, Tiền gốc ban đầu hoặc đổi tài khoản"
            >
              <span className="truncate max-w-[140px] sm:max-w-[200px] text-[#1d1b17] font-bold">
                {activeAccount.name || `MT5 #${selectedAccountId}`}
              </span>
              <Edit2 className="w-3 h-3 text-[#1d1b17]/70 group-hover:text-[#1d1b17] transition-colors shrink-0" />
            </button>
            <span className="mx-2 text-[var(--border-main)] font-light">|</span>
            <span className="font-mono text-[#1d1b17] font-bold text-[11px]">
              #{selectedAccountId}
            </span>
          </div>

            {/* Popover Chỉnh Sửa Tài Khoản & Nhập Tiền Gốc */}
          {isAccountEditOpen && (
            <div className="absolute left-0 top-full mt-2 w-80 clay-card rounded-2xl shadow-2xl p-4 z-50 text-xs flex flex-col gap-3">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-main)]">
                <span className="font-bold text-[var(--text-primary)]">
                  {language === 'vi' ? 'Cài Đặt Tài Khoản & Tiền Gốc' : 'Account & Capital Settings'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsAccountEditOpen(false)}
                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Chuyển nhanh tài khoản đã có (Đồng bộ với Sidebar) */}
              {accounts && accounts.length > 0 && (
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
                    {language === 'vi' ? 'Chọn tài khoản giao dịch:' : 'Select trading account:'}
                  </span>
                  <select
                    value={selectedAccountId}
                    onChange={(e) => {
                      onAccountIdChange(e.target.value);
                      setIsAccountEditOpen(false);
                    }}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg p-1.5 text-xs text-[var(--text-primary)] font-semibold focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    {accounts.filter(acc => 
                      acc && acc.id && 
                      acc.id !== 'ALL' && 
                      !String(acc.id).startsWith('mock-') && 
                      !String(acc.name || '').toLowerCase().includes('tất cả tài khoản')
                    ).map(acc => {
                      const bal = (acc.id === selectedAccountId && activeAccount?.balance !== undefined)
                        ? activeAccount.balance
                        : (acc.balance ?? acc.initial_balance ?? 10000);
                      return (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} (#{acc.id}) - ${(bal ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </option>
                      );
                    })}
                  </select>
                </div>
              )}

              {/* Form Sửa Tên & Tiền Gốc */}
              <form onSubmit={handleAccountSubmit} className="flex flex-col gap-2.5">
                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                    {language === 'vi' ? 'Tên hiển thị tài khoản:' : 'Account display name:'}
                  </label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Ví dụ: MT5 #12345678"
                    className="w-full px-2.5 py-1.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-primary)] font-semibold focus:outline-none focus:border-teal-500"
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)] block mb-1">
                    {language === 'vi' ? 'Tiền vốn ban đầu (Initial Balance):' : 'Initial Capital ($):'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] font-mono font-bold">$</span>
                    <input
                      type="number"
                      step="any"
                      value={editInitBalance}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditInitBalance(val);
                        const num = parseFloat(val);
                        if (!isNaN(num) && num >= 0 && onUpdateAccount) {
                          onUpdateAccount(selectedAccountId, { initial_balance: num });
                        }
                      }}
                      placeholder="10000"
                      className="w-full pl-6 pr-2.5 py-1.5 bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg text-xs text-[var(--text-primary)] font-mono font-bold focus:outline-none focus:border-[#1d1b17]"
                    />
                  </div>
                  <div className="mt-2 p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)] space-y-1 text-[11px]">
                    <div className="flex justify-between text-[var(--text-secondary)]">
                      <span>{language === 'vi' ? 'Lãi/Lỗ lũy kế (Net PnL):' : 'Net P&L:'}</span>
                      <span className={`font-mono font-bold ${activeAccount.pnl >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {activeAccount.pnl >= 0 ? `+$${activeAccount.pnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `-$${Math.abs(activeAccount.pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      </span>
                    </div>
                    <div className="flex justify-between font-bold text-[var(--text-primary)] border-t border-[var(--border-main)] pt-1">
                      <span>{language === 'vi' ? 'Số dư hiện tại (Equity):' : 'Current Equity:'}</span>
                      <span className="font-mono text-[#1d1b17] font-bold">
                        ${((parseFloat(editInitBalance) || 0) + (activeAccount.pnl || 0)).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>
                  <p className="text-[10px] text-[var(--text-muted)] mt-1.5">
                    {language === 'vi' 
                      ? 'Vốn và Equity ở hàng 1 cùng cột BALANCE tự động tính lũy kế theo số tiền vốn này.' 
                      : 'Capital and Balance columns automatically calculate trajectory based on this value.'}
                  </p>
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-main)]">
                  <button
                    type="button"
                    onClick={() => setIsAccountEditOpen(false)}
                    className="px-2.5 py-1 rounded-lg text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] cursor-pointer"
                  >
                    {language === 'vi' ? 'Hủy' : 'Cancel'}
                  </button>
                  <button
                    type="submit"
                    className="px-3 py-1 rounded-lg bg-[#1d1b17] hover:bg-[#30363d] text-white font-bold text-xs shadow-sm transition-all cursor-pointer"
                  >
                    {language === 'vi' ? 'Lưu & Cập nhật' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* 2. Bộ Lọc Lệnh Thông Minh (Đã chuyển xuống thanh Trading History của Bảng Lịch Sử) */}

        {/* 4. Ô Tìm Kiếm (Search Bar - Chỉ hiển thị ở các tab khác nếu có, tab Lịch Sử đã đưa xuống thanh Trading History) */}
        {currentTab !== 'lich-su' && (
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="text"
              placeholder={language === 'vi' ? 'Tìm kiếm...' : 'Search...'}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-8 pr-7 py-1.5 rounded-full clay-well text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-teal-500 w-36 sm:w-48 font-mono transition-colors"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}
      </div>

      {/* ========================================================
          RIGHT: Thống Kê Số Dư MT5 + Theme Toggle + Nạp Import
         ======================================================== */}
      <div className="flex items-center gap-2.5">
        {/* 5. Thống Kê Số Dư MT5 (Account Balance Strip): Chỉ xuất hiện duy nhất ở Tab Lịch Sử */}
        {currentTab === 'lich-su' && (
          <div className="hidden lg:flex items-center gap-2.5 px-3.5 py-1.5 rounded-full clay-well text-xs font-mono">
            {/* Vốn (Tiền gốc ban đầu lấy trực tiếp từ cài đặt tài khoản MT5) */}
            <div className="flex items-center gap-1 text-[var(--text-secondary)]">
              <span className="font-sans font-medium text-[11px]">{language === 'vi' ? 'Vốn:' : 'Capital:'}</span>
              <span className="font-bold text-[var(--text-primary)]">
                ${(activeAccount.initial_balance ?? 10000).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <span className="text-[var(--border-main)]">|</span>

            {/* Equity (Số dư hiện tại = Vốn + Lãi/Lỗ) */}
            <div className="flex items-center gap-1 text-[var(--text-secondary)]">
              <span className="font-sans font-medium text-[11px]">Equity:</span>
              <span className="font-bold text-[var(--text-primary)]">
                ${activeAccount.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <span className="text-[var(--border-main)]">|</span>

            {/* PnL */}
            <div className="flex items-center gap-1">
              <span className="font-sans font-medium text-[11px] text-[var(--text-secondary)]">{language === 'vi' ? 'Lãi/Lỗ:' : 'PnL:'}</span>
              <span className={`font-bold flex items-center ${isLoss ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
                {isLoss ? <TrendingDown className="w-3 h-3 mr-0.5" /> : <TrendingUp className="w-3 h-3 mr-0.5" />}
                {activeAccount.pnl >= 0 ? `+$${activeAccount.pnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `-$${Math.abs(activeAccount.pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              </span>
            </div>

            <span className="text-[var(--border-main)]">|</span>

            {/* Winrate */}
            <div className="flex items-center gap-1 text-[var(--text-secondary)]">
              <span className="font-sans font-medium text-[11px]">Win:</span>
              <span className="font-bold text-[#1d1b17]">
                {activeAccount.win_rate}%
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">
                ({activeAccount.wins}W/{activeAccount.losses}L)
              </span>
            </div>
          </div>
        )}

        {/* Nút Đăng Nhập / Thông Tin Tài Khoản */}
        {authUser ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl clay-card border border-[var(--border-main)] text-xs font-mono shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            {isAdmin ? (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-500 border border-amber-500/30">
                👑 ADMIN
              </span>
            ) : (
              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/30">
                TRADER
              </span>
            )}
            <span className="text-[var(--text-primary)] font-semibold max-w-[120px] truncate" title={authUser.email}>
              {authUser.email?.split('@')[0] || 'User'}
            </span>

            {/* Nút Quản Lý Bản Quyền Dành Riêng Cho Admin (Thầy Tài) */}
            {isAdmin && (
              <button
                type="button"
                onClick={onOpenLicenseManager}
                className="px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/25 text-amber-500 text-[10px] font-sans font-bold border border-amber-500/40 transition-all cursor-pointer ml-1"
                title="Quản lý khách hàng bản quyền & số MT5 được duyệt"
              >
                👑 Bản Quyền
              </button>
            )}

            {/* Nút Mã EA MT5 cho khách hàng kết nối */}
            <button
              type="button"
              onClick={onOpenConnectEA}
              className="px-2 py-0.5 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--border-main)]/60 text-[var(--text-primary)] text-[10px] font-sans font-semibold border border-[var(--border-main)] transition-all cursor-pointer ml-1"
              title="Xem mã kết nối EA MT5 của bạn"
            >
              Mã EA
            </button>

            <button
              type="button"
              onClick={onSignOut}
              className="ml-1 text-[10px] text-rose-500 hover:text-rose-400 font-sans cursor-pointer hover:underline"
              title={language === 'vi' ? 'Đăng xuất' : 'Sign out'}
            >
              {language === 'vi' ? 'Thoát' : 'Exit'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={onOpenAuth}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-teal-500/10 hover:bg-teal-500/20 text-teal-600 dark:text-teal-400 border border-teal-500/30 text-xs font-semibold transition-all cursor-pointer shrink-0"
            title={language === 'vi' ? 'Đăng nhập / Đăng ký' : 'Sign In / Register'}
          >
            <User className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Đăng nhập' : 'Sign In'}</span>
          </button>
        )}

        {/* Nút Nạp Import */}
        <button
          type="button"
          onClick={onOpenImport}
          className="p-2 rounded-xl clay-btn-secondary text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shrink-0"
          title={language === 'vi' ? 'Nạp Import CSV' : 'Import MT5 CSV'}
        >
          <Upload className="w-4 h-4" />
        </button>

        {/* Nút Bánh Răng Cài Đặt */}
        <div className="relative shrink-0" ref={settingsRef}>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`p-2 rounded-xl transition-all cursor-pointer ${
              isSettingsOpen || isSyncing
                ? 'clay-pill text-[#1d1b17] font-bold'
                : 'clay-btn-secondary text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title={language === 'vi' ? 'Cài đặt kết nối & Đồng bộ Supabase' : 'Connection Settings & Supabase Sync'}
          >
            <SettingsIcon className={`w-4 h-4 ${isSyncing ? 'animate-spin text-[#1d1b17]' : ''}`} />
          </button>

          {/* Popover Bánh Răng (Mở từ bên phải vào để không bị tràn màn hình) */}
          {isSettingsOpen && (
            <div className="absolute right-0 top-full mt-2 w-72 clay-card rounded-2xl shadow-2xl p-3.5 z-50 text-xs flex flex-col gap-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-main)]">
                <span className="font-bold text-[var(--text-primary)]">
                  {language === 'vi' ? 'Cài Đặt & Kết Nối' : 'Settings & Connection'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Nút Chọn Ngôn Ngữ (Language Switcher) */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)]">
                <span className="text-[var(--text-secondary)] font-medium flex items-center gap-1.5">
                  <Globe className="w-3.5 h-3.5 text-teal-400" />
                  <span>{language === 'vi' ? 'Ngôn ngữ' : 'Language'}:</span>
                </span>
                <div className="flex items-center gap-1 bg-[var(--bg-card)] p-0.5 rounded-lg border border-[var(--border-main)]">
                  <button
                    type="button"
                    onClick={() => setLanguage('en')}
                    className={`px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                      language === 'en'
                        ? 'bg-teal-500 text-slate-950 shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    🇬🇧 EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setLanguage('vi')}
                    className={`px-2 py-0.5 rounded text-xs font-bold transition-all cursor-pointer ${
                      language === 'vi'
                        ? 'bg-teal-500 text-slate-950 shadow-sm'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    🇻🇳 VI
                  </button>
                </div>
              </div>

              {/* Chỉnh số dòng hiển thị mỗi trang (5, 10, 20 dòng) */}
              {currentTab === 'lich-su' && (
                <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)]">
                  <span className="text-[var(--text-secondary)] font-medium">
                    {language === 'vi' ? 'Số dòng / trang:' : 'Rows / page:'}
                  </span>
                  <div className="flex items-center gap-1">
                    {[5, 10, 20].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => onPageSizeChange?.(size)}
                        className={`px-2.5 py-1 rounded text-xs font-mono font-bold transition-all cursor-pointer ${
                          pageSize === size
                            ? 'bg-teal-500 text-slate-950 shadow-sm'
                            : 'bg-[var(--bg-card)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-main)]'
                        }`}
                      >
                        {size}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Tình trạng Supabase Live */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)]">
                <span className="text-[var(--text-secondary)]">
                  {language === 'vi' ? 'Trạng thái Supabase:' : 'Supabase Status:'}
                </span>
                <div className="flex items-center gap-1.5 font-bold">
                  <span className={`w-2 h-2 rounded-full ${
                    supabaseStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : supabaseStatus === 'loading' ? 'bg-cyan-400 animate-ping' : 'bg-amber-400'
                  }`} />
                  <span className={supabaseStatus === 'connected' ? 'text-emerald-500 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'}>
                    {supabaseStatus === 'connected' 
                      ? 'Supabase Live' 
                      : supabaseStatus === 'loading' 
                        ? (language === 'vi' ? 'Đang kết nối...' : 'Connecting...') 
                        : (language === 'vi' ? 'Chưa kết nối' : 'Not Connected')}
                  </span>
                </div>
              </div>

              {/* Nút Đồng Bộ Supabase */}
              <button
                type="button"
                onClick={() => {
                  onSync();
                }}
                disabled={isSyncing}
                className="w-full flex items-center justify-between p-2 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--border-main)]/40 border border-[var(--border-main)] text-[var(--text-primary)] font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{language === 'vi' ? 'Đồng bộ dữ liệu Supabase' : 'Sync Supabase Data'}</span>
                </span>
                <span className="text-[10px] font-mono text-[var(--text-muted)]">
                  {isSyncing ? (language === 'vi' ? 'Đang tải...' : 'Syncing...') : lastSyncTime ? lastSyncTime : (language === 'vi' ? 'Ngay' : 'Now')}
                </span>
              </button>

              {/* Cài đặt Múi giờ & Hệ thống */}
              <button
                type="button"
                onClick={() => {
                  setIsSettingsOpen(false);
                  onOpenSettings();
                }}
                className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-[var(--bg-subtle)] border border-transparent hover:border-[var(--border-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>{language === 'vi' ? 'Cài đặt hệ thống & Offset' : 'System Settings & Offset'}</span>
                </span>
                <span className="text-[10px] font-mono text-[var(--text-primary)] font-bold">
                  Offset: {timezoneOffset >= 0 ? `+${timezoneOffset}h` : `${timezoneOffset}h`}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
