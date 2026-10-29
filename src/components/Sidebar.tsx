import React, { useState, useEffect, useRef } from 'react';
import { 
  BarChart2, 
  Clock, 
  Compass, 
  FileText, 
  Settings as SettingsIcon, 
  Plus, 
  HelpCircle, 
  Bell, 
  CheckCircle2, 
  TrendingUp, 
  Layers,
  X,
  Database,
  Moon,
  Sun,
  ChevronDown,
  CandlestickChart,
  Calendar
} from 'lucide-react';
import { AccountInfo } from '../types';
import { useLanguage } from '../context/LanguageContext';

interface SidebarProps {
  currentTab: string;
  onTabChange: (tab: string) => void;
  accounts: AccountInfo[];
  selectedAccountId: string;
  onSelectAccount: (id: string) => void;
  onOpenSettings: () => void;
  isDarkMode: boolean;
  onToggleTheme: () => void;
  onAddAccount: (acc: AccountInfo) => void;
  activeAccount?: AccountInfo;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  accounts,
  selectedAccountId,
  onSelectAccount,
  onOpenSettings,
  isDarkMode,
  onToggleTheme,
  onAddAccount,
  activeAccount
}) => {
  const { t, language } = useLanguage();
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [newAccName, setNewAccName] = useState('Funded - Alpha');
  const [newAccId, setNewAccId] = useState('');
  const [newAccBalance, setNewAccBalance] = useState('10000');

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    const finalId = newAccId.trim() || `2632${Math.floor(1000 + Math.random() * 9000)}`;
    const finalName = newAccName.trim() || 'Funded - Alpha';
    const initBal = parseFloat(newAccBalance) || 10000;

    const newAccount: AccountInfo = {
      id: finalId,
      name: finalName,
      ticket_server: `${finalId} (Live MT5)`,
      balance: initBal,
      initial_balance: initBal,
      pnl: 0,
      win_rate: 0,
      wins: 0,
      losses: 0,
      breakeven: 0,
      connected: true,
      currency: 'USD'
    };

    onAddAccount(newAccount);
    onSelectAccount(finalId);
    setIsAddModalOpen(false);
    setNewAccName('Funded - Alpha');
    setNewAccId('');
    setNewAccBalance('10000');
  };

  useEffect(() => {
    if (!isAddModalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        setIsAddModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAddModalOpen]);

  const navItems = [
    { id: 'tong-quan', label: t('nav.overview', 'Tổng Quan'), icon: BarChart2 },
    { id: 'lich-su', label: t('nav.history', 'Lịch Sử'), icon: Clock },
    { id: 'ke-hoach', label: t('nav.plans', 'Kế Hoạch'), icon: Compass },
    { id: 'bieu-do', label: language === 'vi' ? 'Biểu Đồ' : 'Chart', icon: CandlestickChart },
    { id: 'bao-cao', label: t('nav.reports', 'Báo Cáo'), icon: FileText },
    { id: 'cai-dat', label: t('nav.settings', 'Cài Đặt'), icon: SettingsIcon },
  ];

  // Lọc bỏ tài khoản ALL và mockdata không hợp lệ
  const realAccounts = React.useMemo(() => {
    return accounts.filter(a => 
      a && a.id && 
      a.id !== 'ALL' && 
      !String(a.id).startsWith('mock-') && 
      !String(a.name || '').toLowerCase().includes('tất cả tài khoản')
    );
  }, [accounts]);

  // Hiển thị tối đa 3 tài khoản đầu tiên (giữ nguyên vị trí gốc)
  const visibleAccounts = React.useMemo(() => realAccounts.slice(0, 3), [realAccounts]);
  // Các tài khoản còn lại đưa vào trình chọn thả xuống (dropdown)
  const remainingAccounts = React.useMemo(() => realAccounts.slice(3), [realAccounts]);

  // State quản lý tab đang được rê chuột vào trên Rail (hoveredTab)
  const [hoveredTab, setHoveredTab] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnterRailItem = (tabId: string) => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setHoveredTab(tabId);
  };

  const handleMouseLeaveRailArea = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    hoverTimeoutRef.current = setTimeout(() => {
      setHoveredTab(null);
    }, 320);
  };

  const handleMouseEnterSubmenu = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  // Tab đang được chọn hiển thị trong Không Gian Làm Việc
  const activeHoverItem = navItems.find(item => item.id === hoveredTab);

  // Danh sách các mục con theo từng tab
  const getSubItemsForTab = (tabId: string) => {
    switch (tabId) {
      case 'bieu-do':
        return [
          {
            id: 'tradingview',
            label: 'TradingView Pro',
            desc: 'Biểu đồ kỹ thuật đa khung thời gian',
            action: () => {
              try {
                localStorage.setItem('deal_active_chart_mode', 'tradingview');
              } catch {}
              onTabChange('bieu-do');
              window.dispatchEvent(new CustomEvent('deal_chart_mode_changed', { detail: 'tradingview' }));
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('deal_chart_mode_changed', { detail: 'tradingview' }));
              }, 60);
            }
          },
          {
            id: 'execution',
            label: 'Cắm Cờ Lệnh MT5',
            desc: 'Hiển thị điểm vào/ra lệnh trực quan trên nến',
            action: () => {
              try {
                localStorage.setItem('deal_active_chart_mode', 'execution');
              } catch {}
              onTabChange('bieu-do');
              window.dispatchEvent(new CustomEvent('deal_chart_mode_changed', { detail: 'execution' }));
              setTimeout(() => {
                window.dispatchEvent(new CustomEvent('deal_chart_mode_changed', { detail: 'execution' }));
              }, 60);
            }
          }
        ];
      case 'bao-cao':
        // Mục lục Tab Báo Cáo: bấm để nhảy tới đúng mục
        return ([
          ['tong-quan', 'Tổng quan kỳ'], ['tam-ly', 'Điểm Tâm Lý'], ['plan', 'Tuân thủ Plan'], ['luat-quy', 'Luật Quỹ'],
          ['hieu-suat', 'Hiệu suất'], ['mfe-mae', 'MFE & MAE'], ['cat-tung-phan', 'Cắt từng phần'], ['gia-lap', 'Giả lập What-If'],
        ] as [string, string][]).map(([id, label]) => ({
          id,
          label,
          desc: '',
          action: () => {
            onTabChange('bao-cao');
            setTimeout(() => window.dispatchEvent(new CustomEvent('bd_report_jump', { detail: id })), 80);
          }
        }));
      case 'ke-hoach':
        return [
          {
            id: 'ALL',
            label: 'Tất Cả Kế Hoạch',
            desc: 'Xem toàn bộ danh sách plan đã tạo',
            action: () => {
              onTabChange('ke-hoach');
              window.dispatchEvent(new CustomEvent('deal_plan_filter_changed', { detail: 'ALL' }));
            }
          },
          {
            id: 'PENDING',
            label: 'Plan Chờ Khớp (Pending)',
            desc: 'Các kế hoạch đang rình setup và chờ giá vào vùng',
            action: () => {
              onTabChange('ke-hoach');
              window.dispatchEvent(new CustomEvent('deal_plan_filter_changed', { detail: 'PENDING' }));
            }
          },
          {
            id: 'EXECUTED',
            label: 'Plan Đã Khớp (Done)',
            desc: 'Kế hoạch đã kích hoạt hoặc đã hoàn tất',
            action: () => {
              onTabChange('ke-hoach');
              window.dispatchEvent(new CustomEvent('deal_plan_filter_changed', { detail: 'EXECUTED' }));
            }
          }
        ];
      case 'lich-su':
        return [
          {
            id: 'all-trades',
            label: 'Toàn Bộ Lịch Sử Lệnh',
            desc: 'Danh sách lệnh đóng & lệnh mở trực tiếp từ MT5',
            action: () => onTabChange('lich-su')
          }
        ];
      case 'cai-dat':
        return [
          {
            id: 'settings-app',
            label: 'Cài Đặt Hệ Thống',
            desc: 'Múi giờ Offset, kết nối Supabase & danh mục setup',
            action: () => onTabChange('cai-dat')
          }
        ];
      case 'tong-quan':
      default:
        return [
          {
            id: 'overview-dashboard',
            label: 'Bảng Điều Khiển Tổng Quan',
            desc: 'Chỉ số hiệu suất cốt lõi của tài khoản',
            action: () => onTabChange('tong-quan')
          }
        ];
    }
  };

  return (
    <>
      <div 
        className="relative flex h-full shrink-0 z-30"
        onMouseLeave={handleMouseLeaveRailArea}
      >
      {/* 1. TACTILE RAIL (Cột hẹp bên trái với nền Deep Sage Green #4a6152 chuẩn Stitch) */}
      <aside className="w-20 bg-[#4a6152] flex flex-col items-center justify-between py-5 shrink-0 select-none shadow-[6px_0_20px_rgba(74,97,82,0.18),inset_-2px_0_4px_rgba(0,0,0,0.06),inset_1px_0_2px_rgba(255,255,255,0.3)] z-30 transition-colors">
        {/* Top Rail Icons */}
        <div className="flex flex-col items-center gap-4 w-full">
          {/* Logo Candlestick Clay Button */}
          <div className="w-12 h-12 rounded-full bg-[#627a6a] flex items-center justify-center shadow-[4px_6px_12px_rgba(30,45,35,0.25),inset_1px_1px_2px_rgba(255,255,255,0.35)] text-[#f6fff6]">
            <CandlestickChart className="w-6 h-6 stroke-[2.2]" />
          </div>

          <div className="w-8 h-[2px] bg-[#627a6a]/60 rounded-full my-1"></div>

          {/* Quick tab switcher icons */}
          <div className="flex flex-col items-center gap-2.5 w-full">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              const isHovered = hoveredTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => handleMouseEnterRailItem(item.id)}
                  onClick={() => {
                    onTabChange(item.id);
                  }}
                  title={item.label}
                  className={`w-11 h-11 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#627a6a] text-white font-bold shadow-[4px_6px_14px_rgba(30,45,35,0.35),inset_1px_1px_2px_rgba(255,255,255,0.45)] scale-105'
                      : isHovered
                        ? 'bg-[#56705e] text-white scale-105 shadow-md'
                        : 'bg-[#4a6152]/90 text-white/75 hover:bg-[#627a6a] hover:text-white hover:scale-105'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Rail Theme & User */}
        <div className="flex flex-col items-center gap-3">
          <button
            type="button"
            onClick={onToggleTheme}
            title={isDarkMode ? 'Chuyển sang Sáng' : 'Chuyển sang Tối'}
            className="w-10 h-10 rounded-full bg-[#627a6a] text-white flex items-center justify-center hover:bg-[#728d7b] transition-all cursor-pointer shadow-[3px_4px_10px_rgba(30,45,35,0.25),inset_1px_1px_2px_rgba(255,255,255,0.3)]"
          >
            {isDarkMode ? <Sun className="w-4.5 h-4.5 text-amber-300" /> : <Moon className="w-4.5 h-4.5 text-white" />}
          </button>
          <div className="w-10 h-10 rounded-full bg-[#627a6a] text-white flex items-center justify-center font-bold text-xs shadow-[3px_4px_10px_rgba(30,45,35,0.25),inset_1px_1px_2px_rgba(255,255,255,0.3)]">
            T
          </div>
        </div>
      </aside>

      {/* 2. TACTILE SUBMENU (Không gian làm việc Trading Hub - HIỆN RA UYỂN CHUYỂN, MƯỢT MÀ) */}
      <aside 
        onMouseEnter={handleMouseEnterSubmenu}
        className={`bg-[#ede7df] border-r border-[#d8d0c5] flex flex-col justify-between shrink-0 select-none shadow-[10px_0_30px_rgba(125,110,95,0.18),inset_1px_0_3px_rgba(255,255,255,0.9)] z-20 overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          hoveredTab && activeHoverItem
            ? 'w-64 opacity-100 translate-x-0 pointer-events-auto'
            : 'w-0 opacity-0 -translate-x-3 pointer-events-none'
        }`}
      >
        <div className="w-64 flex flex-col p-4 space-y-4 h-full">
          {/* Header Workspace */}
          <div className="px-1 pt-1 border-b border-[#d8d0c5]/70 pb-3">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#737973] block">
              Không gian làm việc
            </span>
            <div className="flex items-center justify-between mt-1">
              <span className="text-base font-bold text-[#1d1b17] tracking-tight">Trading Hub</span>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#4a6152]/15 text-[#4a6152] font-bold border border-[#4a6152]/30 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-[#4a6152] animate-pulse"></span>
                LIVE
              </span>
            </div>

            {/* Tên Tab chính đang mở danh mục */}
            {activeHoverItem && (
              <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[#d8d0c5]/50">
                <activeHoverItem.icon className="w-4 h-4 text-[#1d1b17]" />
                <span className="text-xs font-bold text-[#1d1b17] uppercase tracking-wide">
                  {activeHoverItem.label}
                </span>
              </div>
            )}
          </div>

          {/* Contextual Sub-tab Menu List */}
          <div className="flex flex-col gap-1.5 flex-1 overflow-y-auto pr-0.5">
            <span className="text-[10px] font-bold text-[#737973] uppercase tracking-wider px-1">
              Danh mục tùy chọn
            </span>
            <div className="flex flex-col gap-1.5">
              {hoveredTab && getSubItemsForTab(hoveredTab).map((sub, idx) => {
                return (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => {
                      sub.action();
                      setHoveredTab(null);
                    }}
                    style={{ animationDelay: `${idx * 25}ms` }}
                    className="w-full text-left p-2.5 rounded-xl transition-all duration-200 cursor-pointer bg-white hover:bg-[#f6f2ec] text-[#1d1b17] border border-[#d8d0c5]/60 hover:border-[#1d1b17]/40 shadow-xs hover:shadow-md hover:translate-x-1 group"
                  >
                    <div className="font-bold text-xs text-[#1d1b17] group-hover:text-[#4a6152] transition-colors flex items-center justify-between">
                      <span>{sub.label}</span>
                      <span className="text-[10px] text-[#737973] group-hover:translate-x-1 transition-transform">→</span>
                    </div>
                    {sub.desc && (
                      <div className="text-[11px] text-[#737973] mt-0.5 leading-snug line-clamp-1">
                        {sub.desc}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

            {/* Account Management Inset Well */}
            <div className="p-3 rounded-2xl bg-[#e8e2da] clay-well space-y-2 mt-auto">
              <div className="flex items-center justify-between px-0.5">
                <span className="text-[10px] font-bold text-[#737973] uppercase tracking-wider">
                  {language === 'vi' ? 'Tài khoản MT5' : 'MT5 Accounts'}
                </span>
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(true)}
                  className="w-5 h-5 rounded-full bg-white clay-pill flex items-center justify-center text-[#424843] hover:text-[#1d1b17] transition-all cursor-pointer"
                  title={language === 'vi' ? 'Thêm tài khoản MT5 mới' : 'Add new account'}
                >
                  <Plus className="w-3 h-3" />
                </button>
              </div>

              {/* List Accounts */}
              <div className="space-y-1">
                {visibleAccounts.map(acc => {
                  const isSelected = acc.id === selectedAccountId;
                  const displayName = acc.name || `MT5 #${acc.id}`;
                  const displayBalance = acc.balance ?? acc.initial_balance ?? 10000;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => onSelectAccount(acc.id)}
                      className={`w-full text-left p-1.5 rounded-xl transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-[var(--bg-card)] clay-card text-[var(--text-primary)]'
                          : 'bg-transparent hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[11px] font-bold truncate max-w-[110px] text-[var(--text-primary)]">
                          {displayName}
                        </span>
                        <span className="w-1.5 h-1.5 rounded-full bg-[#737973]"></span>
                      </div>
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-[9px] text-[var(--text-muted)]">#{acc.id}</span>
                        <span className={`font-semibold ${isSelected ? 'text-[#1d1b17] font-bold' : 'text-[var(--text-primary)]'}`}>
                          ${(displayBalance ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Modal Thêm Tài Khoản MT5 */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-md bg-[var(--bg-card)] border border-[var(--border-main)] rounded-xl shadow-2xl p-6 relative">
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[var(--border-main)]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-teal-500/15 text-teal-400 border border-teal-500/30 flex items-center justify-center font-bold">
                  <Database className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">
                    {language === 'vi' ? 'Thêm Tài Khoản MT5 Mới' : 'Add New MT5 Account'}
                  </h3>
                  <p className="text-[11px] text-[var(--text-muted)]">
                    {language === 'vi' ? 'Tạo tài khoản và sẵn sàng nhận dữ liệu MT5' : 'Create account & prepare for MT5 data sync'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  {language === 'vi' ? 'Tên hiển thị gợi ý' : 'Account display name'}
                </label>
                <input
                  type="text"
                  required
                  value={newAccName}
                  onChange={(e) => setNewAccName(e.target.value)}
                  placeholder="Ví dụ: Funded - Alpha"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-primary)] focus:outline-none focus:border-teal-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  {language === 'vi' ? 'Mã số tài khoản MT5 (Account ID)' : 'MT5 Account ID'}
                </label>
                <input
                  type="text"
                  value={newAccId}
                  onChange={(e) => setNewAccId(e.target.value)}
                  placeholder="Ví dụ: 26325349 hoặc để trống tạo tự động"
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-primary)] focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  {language === 'vi' ? 'Vốn khởi điểm ($)' : 'Starting Capital ($)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step="100"
                  value={newAccBalance}
                  onChange={(e) => setNewAccBalance(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-[var(--bg-input)] border border-[var(--border-main)] text-[var(--text-primary)] focus:outline-none focus:border-teal-500 font-mono"
                />
              </div>

              <div className="p-3 rounded-lg bg-teal-500/10 border border-teal-500/20 text-[11px] text-teal-400 leading-relaxed">
                {language === 'vi' 
                  ? 'Khi bot hoặc EA MT5 gửi dữ liệu giao dịch khớp mã ID này lên Supabase, hệ thống sẽ tự động đồng bộ tên, lịch sử lệnh và số dư theo số liệu thực tế từ MT5.'
                  : 'When your MT5 EA syncs trade data matching this ID to Supabase, trade history and balance will update automatically.'}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-main)]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors cursor-pointer"
                >
                  {language === 'vi' ? 'Hủy' : 'Cancel'}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold transition-all shadow-md shadow-teal-500/20 cursor-pointer"
                >
                  {language === 'vi' ? 'Tạo tài khoản' : 'Create Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

