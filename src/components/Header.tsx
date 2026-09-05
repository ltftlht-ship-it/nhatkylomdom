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
  EyeOff
} from 'lucide-react';
import { AccountInfo, SetupTagItem } from '../types';

interface HeaderProps {
  currentTab?: string;
  activeAccount: AccountInfo;
  selectedAccountId: string;
  onAccountIdChange: (accId: string) => void;
  onUpdateAccountName?: (newName: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onOpenSettings: () => void;
  onOpenImport: () => void;
  supabaseStatus?: 'connected' | 'demo' | 'loading' | 'error';
  onSync: () => void;
  isSyncing?: boolean;
  lastSyncTime?: string | null;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  timezoneOffset?: number;

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
}

export const Header: React.FC<HeaderProps> = ({
  currentTab = 'lich-su',
  activeAccount,
  selectedAccountId,
  onAccountIdChange,
  onUpdateAccountName,
  searchQuery,
  onSearchChange,
  onOpenSettings,
  onOpenImport,
  supabaseStatus = 'demo',
  onSync,
  isSyncing = false,
  lastSyncTime = null,
  isDarkMode,
  onToggleTheme,
  timezoneOffset = 0,

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
  // Account Name Edit State
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(activeAccount.name || '');

  // Synchronize when activeAccount changes
  useEffect(() => {
    setNameInput(activeAccount.name || '');
  }, [activeAccount.name]);

  const handleNameSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = nameInput.trim();
    if (clean && onUpdateAccountName) {
      onUpdateAccountName(clean);
    }
    setIsEditingName(false);
  };

  // Popover States
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const settingsRef = useRef<HTMLDivElement>(null);
  const filterRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
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
    <header className="h-16 px-5 bg-[var(--bg-card)] border-b border-[var(--border-main)] flex items-center justify-between gap-4 select-none shrink-0 transition-colors duration-200 z-30 relative">
      {/* ========================================================
          LEFT: Tên & ID Tài Khoản + Settings Popover + Dropdown Filter + Search Bar
         ======================================================== */}
      <div className="flex items-center gap-2.5 flex-wrap">
        {/* 1. Tên & ID Tài Khoản (Cho phép chỉnh sửa tên hiển thị - Tuyệt đối không để chú thích rác bên dưới) */}
        <div className="flex items-center bg-[var(--bg-subtle)] border border-[var(--border-main)] rounded-lg px-2.5 py-1 text-xs">
          {isEditingName ? (
            <form onSubmit={handleNameSubmit} className="flex items-center gap-1">
              <input
                type="text"
                autoFocus
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={() => handleNameSubmit()}
                placeholder="Tên tài khoản"
                className="w-32 px-1.5 py-0.5 bg-[var(--bg-input)] border border-teal-500 rounded text-[var(--text-primary)] font-semibold text-xs focus:outline-none"
              />
              <button
                type="button"
                onClick={() => handleNameSubmit()}
                className="p-1 rounded text-teal-400 hover:bg-teal-500/20"
                title="Lưu tên"
              >
                <Check className="w-3 h-3" />
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => {
                setNameInput(activeAccount.name || '');
                setIsEditingName(true);
              }}
              className="flex items-center gap-1.5 font-bold text-[var(--text-primary)] hover:text-teal-400 transition-colors cursor-pointer group"
              title="Bấm để sửa tên hiển thị tài khoản"
            >
              <span className="truncate max-w-[140px] sm:max-w-[200px]">{activeAccount.name || `MT5 #${selectedAccountId}`}</span>
              <Edit2 className="w-3 h-3 text-[var(--text-muted)] group-hover:text-teal-400 transition-colors shrink-0" />
            </button>
          )}
          <span className="mx-2 text-[var(--border-main)] font-light">|</span>
          <span className="font-mono text-teal-500 dark:text-teal-400 font-bold text-[11px]">
            #{selectedAccountId}
          </span>
        </div>

        {/* 2. Nút Bánh Răng Cài Đặt (Tích hợp Gom Đồng Bộ + Supabase Live Status vào Popover) */}
        <div className="relative" ref={settingsRef}>
          <button
            type="button"
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
            className={`p-2 rounded-lg border transition-all cursor-pointer ${
              isSettingsOpen || isSyncing
                ? 'bg-teal-500/15 border-teal-500/40 text-teal-400'
                : 'bg-[var(--bg-subtle)] border-[var(--border-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
            title="Cài đặt kết nối & Đồng bộ Supabase"
          >
            <SettingsIcon className={`w-4 h-4 ${isSyncing ? 'animate-spin text-teal-400' : ''}`} />
          </button>

          {/* Popover Bánh Răng */}
          {isSettingsOpen && (
            <div className="absolute left-0 top-full mt-2 w-72 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl shadow-2xl p-3 z-50 text-xs flex flex-col gap-2.5">
              <div className="flex items-center justify-between pb-2 border-b border-[var(--border-main)]">
                <span className="font-bold text-[var(--text-primary)]">Cài Đặt & Kết Nối</span>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Tình trạng Supabase Live */}
              <div className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)]">
                <span className="text-[var(--text-secondary)]">Trạng thái Supabase:</span>
                <div className="flex items-center gap-1.5 font-bold">
                  <span className={`w-2 h-2 rounded-full ${
                    supabaseStatus === 'connected' ? 'bg-emerald-400 animate-pulse' : supabaseStatus === 'loading' ? 'bg-cyan-400 animate-ping' : 'bg-amber-400'
                  }`} />
                  <span className={supabaseStatus === 'connected' ? 'text-emerald-500 dark:text-emerald-400' : 'text-amber-500 dark:text-amber-400'}>
                    {supabaseStatus === 'connected' ? 'Supabase Live' : supabaseStatus === 'loading' ? 'Đang kết nối...' : 'Chưa kết nối'}
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
                className="w-full flex items-center justify-between p-2 rounded-lg bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/30 text-teal-500 dark:text-teal-400 font-semibold transition-colors cursor-pointer disabled:opacity-50"
              >
                <span className="flex items-center gap-2">
                  <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>Đồng bộ dữ liệu Supabase</span>
                </span>
                <span className="text-[10px] font-mono text-[var(--text-muted)]">
                  {isSyncing ? 'Đang tải...' : lastSyncTime ? lastSyncTime : 'Ngay'}
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
                  <span>Cài đặt hệ thống & Offset</span>
                </span>
                <span className="text-[10px] font-mono text-teal-500 dark:text-teal-400">
                  Offset: {timezoneOffset >= 0 ? `+${timezoneOffset}h` : `${timezoneOffset}h`}
                </span>
              </button>
            </div>
          )}
        </div>

        {/* 3. Bộ Lọc Lệnh Thông Minh (Dropdown Filter) - Chỉ hiển thị khi ở Tab Lịch Sử */}
        {currentTab === 'lich-su' && (
          <div className="relative" ref={filterRef}>
            <button
              type="button"
              onClick={() => setIsFilterOpen(!isFilterOpen)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer ${
                activeFiltersCount > 0 || isFilterOpen
                  ? 'bg-teal-500/15 border-teal-500/40 text-teal-500 dark:text-teal-400'
                  : 'bg-[var(--bg-subtle)] border-[var(--border-main)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="Mở Bộ Lọc Lệnh Thông Minh"
            >
              <Filter className="w-3.5 h-3.5 text-teal-400" />
              <span>Bộ lọc</span>
              {activeFiltersCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-teal-500 text-slate-950 font-mono text-[10px] font-bold">
                  {activeFiltersCount}
                </span>
              )}
              <ChevronDown className={`w-3 h-3 text-[var(--text-muted)] transition-transform ${isFilterOpen ? 'rotate-180' : ''}`} />
            </button>

            {/* Popover Bộ Lọc */}
            {isFilterOpen && (
              <div className="absolute left-0 top-full mt-2 w-80 bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl shadow-2xl p-4 z-50 text-xs flex flex-col gap-3">
                <div className="flex items-center justify-between pb-2 border-b border-[var(--border-main)]">
                  <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                    <Filter className="w-3.5 h-3.5 text-teal-400" />
                    <span>Bộ Lọc Lệnh Thông Minh</span>
                  </div>
                  {activeFiltersCount > 0 && onResetFilters && (
                    <button
                      type="button"
                      onClick={onResetFilters}
                      className="text-[11px] text-teal-500 dark:text-teal-400 hover:underline font-semibold"
                    >
                      Đặt lại
                    </button>
                  )}
                </div>

                {/* 1. Lọc Cặp tiền */}
                <div className="flex flex-col gap-1">
                  <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Cặp tiền:</span>
                  <select
                    value={selectedSymbol}
                    onChange={(e) => onSymbolChange?.(e.target.value)}
                    className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg p-1.5 text-[var(--text-primary)] font-semibold focus:outline-none focus:border-teal-500 cursor-pointer"
                  >
                    <option value="ALL">Tất cả cặp tiền</option>
                    {uniqueSymbols.map(sym => (
                      <option key={sym} value={sym}>{sym}</option>
                    ))}
                  </select>
                </div>

                {/* 2. Lọc Loại Lệnh & Phiên Giao Dịch */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Loại lệnh:</span>
                    <select
                      value={selectedType}
                      onChange={(e) => onTypeChange?.(e.target.value)}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg p-1.5 text-[var(--text-primary)] font-semibold focus:outline-none focus:border-teal-500 cursor-pointer"
                    >
                      <option value="ALL">Tất cả</option>
                      <option value="BUY">BUY</option>
                      <option value="SELL">SELL</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Phiên:</span>
                    <select
                      value={selectedSession}
                      onChange={(e) => onSessionChange?.(e.target.value)}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg p-1.5 text-[var(--text-primary)] font-semibold focus:outline-none focus:border-teal-500 cursor-pointer"
                    >
                      <option value="ALL">Tất cả</option>
                      <option value="Á">Á (Tokyo)</option>
                      <option value="Âu">Âu (London)</option>
                      <option value="Mỹ">Mỹ (New York)</option>
                    </select>
                  </div>
                </div>

                {/* 3. Lọc Kết Quả & Setup */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Kết quả:</span>
                    <select
                      value={selectedResult}
                      onChange={(e) => onResultChange?.(e.target.value)}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg p-1.5 text-[var(--text-primary)] font-semibold focus:outline-none focus:border-teal-500 cursor-pointer"
                    >
                      <option value="ALL">Tất cả</option>
                      <option value="Win">Win</option>
                      <option value="Loss">Loss</option>
                      <option value="BE">Hòa (BE)</option>
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Setup:</span>
                    <select
                      value={selectedSetup}
                      onChange={(e) => onSetupChange?.(e.target.value)}
                      className="w-full bg-[var(--bg-input)] border border-[var(--border-main)] rounded-lg p-1.5 text-[var(--text-primary)] font-semibold focus:outline-none focus:border-teal-500 cursor-pointer"
                    >
                      <option value="ALL">Tất cả</option>
                      {setupTags.map(st => (
                        <option key={st.id} value={st.label}>{st.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* 4. Lọc Lệnh Rác (Noise Trades: volume <= 0.01) */}
                <div className="pt-2 border-t border-[var(--border-main)] flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-[var(--text-primary)]">Lọc Rác (&le;0.01 lot)</span>
                    <p className="text-[10px] text-[var(--text-muted)]">Loại khỏi Winrate, RR & PnL</p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {noiseFilterActive && onToggleHideNoiseRows && (
                      <button
                        type="button"
                        onClick={onToggleHideNoiseRows}
                        className={`px-2 py-1 rounded text-[10px] font-semibold flex items-center gap-1 border transition-colors cursor-pointer ${
                          hideNoiseRows
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            : 'bg-[var(--bg-subtle)] text-[var(--text-secondary)] border-[var(--border-main)]'
                        }`}
                        title={hideNoiseRows ? "Đang ẩn lệnh rác khỏi bảng. Nhấn để chuyển sang làm mờ." : "Đang làm mờ lệnh rác. Nhấn để ẩn."}
                      >
                        {hideNoiseRows ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                        <span>{hideNoiseRows ? 'Ẩn' : 'Mờ'}</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onToggleNoiseFilter}
                      className={`px-2 py-1 rounded text-xs font-bold border transition-all cursor-pointer ${
                        noiseFilterActive
                          ? 'bg-teal-500 text-slate-950 border-teal-500'
                          : 'bg-[var(--bg-subtle)] text-[var(--text-muted)] border-[var(--border-main)]'
                      }`}
                    >
                      {noiseFilterActive ? 'BẬT' : 'TẮT'}
                    </button>
                  </div>
                </div>

                {/* Đóng */}
                <button
                  type="button"
                  onClick={() => setIsFilterOpen(false)}
                  className="w-full mt-1 py-1.5 rounded-lg bg-[var(--bg-subtle)] hover:bg-[var(--border-main)] text-[var(--text-primary)] font-semibold transition-colors cursor-pointer text-center"
                >
                  Áp dụng & Đóng
                </button>
              </div>
            )}
          </div>
        )}

        {/* 4. Ô Tìm Kiếm (Search Bar - Giữ nguyên ô nhập từ khóa tìm kiếm symbol/ticket) */}
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
          <input
            type="text"
            placeholder="Tìm symbol / ticket..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-8 pr-7 py-1.5 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-teal-500 w-36 sm:w-48 font-mono transition-colors"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            >
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* ========================================================
          RIGHT: Thống Kê Số Dư MT5 + Theme Toggle + Nạp Import
         ======================================================== */}
      <div className="flex items-center gap-3">
        {/* 5. Thống Kê Số Dư MT5 (Account Balance Strip): Chỉ xuất hiện duy nhất ở Tab Lịch Sử */}
        {currentTab === 'lich-su' && (
          <div className="hidden lg:flex items-center gap-2 px-3 py-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)] text-xs font-mono">
            {/* Balance */}
            <div className="flex items-center gap-1 text-[var(--text-secondary)]">
              <span className="font-sans font-medium text-[11px]">Số dư:</span>
              <span className="font-bold text-[var(--text-primary)]">
                ${activeAccount.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <span className="text-[var(--border-main)]">|</span>

            {/* Equity */}
            <div className="flex items-center gap-1 text-[var(--text-secondary)]">
              <span className="font-sans font-medium text-[11px]">Equity:</span>
              <span className="font-bold text-[var(--text-primary)]">
                ${activeAccount.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>

            <span className="text-[var(--border-main)]">|</span>

            {/* PnL */}
            <div className="flex items-center gap-1">
              <span className="font-sans font-medium text-[11px] text-[var(--text-secondary)]">Lãi/Lỗ:</span>
              <span className={`font-bold flex items-center ${isLoss ? 'text-rose-500 dark:text-rose-400' : 'text-emerald-500 dark:text-emerald-400'}`}>
                {isLoss ? <TrendingDown className="w-3 h-3 mr-0.5" /> : <TrendingUp className="w-3 h-3 mr-0.5" />}
                {activeAccount.pnl >= 0 ? `+$${activeAccount.pnl.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : `-$${Math.abs(activeAccount.pnl).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
              </span>
            </div>

            <span className="text-[var(--border-main)]">|</span>

            {/* Winrate */}
            <div className="flex items-center gap-1 text-[var(--text-secondary)]">
              <span className="font-sans font-medium text-[11px]">Win:</span>
              <span className="font-bold text-teal-500 dark:text-teal-400">
                {activeAccount.win_rate}%
              </span>
              <span className="text-[10px] text-[var(--text-muted)]">
                ({activeAccount.wins}W/{activeAccount.losses}L)
              </span>
            </div>
          </div>
        )}

        {/* Global Dark / Light Theme Toggle Switch */}
        <button
          type="button"
          onClick={onToggleTheme}
          className="p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)] hover:border-teal-500/40 text-[var(--text-secondary)] hover:text-teal-500 dark:hover:text-teal-400 transition-all cursor-pointer"
          title={isDarkMode ? "Chuyển sang Giao diện Sáng (Light Mode)" : "Chuyển sang Giao diện Tối (Dark Mode)"}
        >
          {isDarkMode ? (
            <Sun className="w-4 h-4 text-amber-400" />
          ) : (
            <Moon className="w-4 h-4 text-slate-700" />
          )}
        </button>

        {/* Nút Nạp Import */}
        <button
          type="button"
          onClick={onOpenImport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-teal-500 to-teal-600 hover:from-teal-400 hover:to-teal-500 text-slate-950 font-bold text-xs shadow-md shadow-teal-500/20 transition-all cursor-pointer active:scale-98 shrink-0"
        >
          <Upload className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>Nạp Import</span>
        </button>
      </div>
    </header>
  );
};
