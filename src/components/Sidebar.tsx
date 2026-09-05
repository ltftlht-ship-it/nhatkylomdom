import React, { useState } from 'react';
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
  Sun
} from 'lucide-react';
import { AccountInfo } from '../types';

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
  onAddAccount
}) => {
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

  const navItems = [
    { id: 'tong-quan', label: 'Tổng Quan', icon: BarChart2 },
    { id: 'lich-su', label: 'Lịch Sử', icon: Clock },
    { id: 'ke-hoach', label: 'Kế Hoạch', icon: Compass },
    { id: 'bao-cao', label: 'Báo Cáo', icon: FileText },
    { id: 'cai-dat', label: 'Cài Đặt', icon: SettingsIcon },
  ];

  return (
    <>
      <aside className="w-64 bg-[var(--bg-panel)] border-r border-[var(--border-main)] flex flex-col justify-between shrink-0 select-none transition-colors duration-200">
        {/* Top Section */}
        <div className="flex flex-col">
          {/* Brand Header */}
          <div className="h-16 px-5 flex items-center gap-3 border-b border-[var(--border-main)]">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center shadow-md shadow-teal-500/20 text-slate-950 font-black text-lg">
              <TrendingUp className="w-5 h-5 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold tracking-tight text-[var(--text-primary)] text-base">Trade Journal</span>
              </div>
              <p className="text-[11px] font-semibold text-teal-500 tracking-wide">Trading System Pro</p>
            </div>
          </div>

          {/* Account Switcher Section */}
          <div className="p-4 border-b border-[var(--border-main)]">
            <div className="flex items-center justify-between mb-2 px-1">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">Tài khoản</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-[var(--bg-subtle)] text-[var(--text-secondary)] font-mono font-semibold border border-[var(--border-main)]">
                  {accounts.length}
                </span>
              </div>
              <button 
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="p-1 rounded hover:bg-teal-500/15 text-[var(--text-muted)] hover:text-teal-400 border border-transparent hover:border-teal-500/30 transition-all cursor-pointer"
                title="Thêm tài khoản MT5 mới"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {accounts.map(acc => {
                const isSelected = acc.id === selectedAccountId;
                return (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => onSelectAccount(acc.id)}
                    className={`w-full text-left p-2.5 rounded-lg border transition-all duration-150 cursor-pointer ${
                      isSelected
                        ? 'bg-teal-500/10 border-teal-500/40 text-[var(--text-primary)] shadow-sm'
                        : 'bg-[var(--bg-subtle)] border-[var(--border-main)] hover:border-slate-400/30 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold truncate max-w-[130px] text-[var(--text-primary)]">{acc.name}</span>
                      <span className="flex items-center gap-1 text-[10px] text-emerald-500 font-medium">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Connected
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-mono">
                      <span className="text-[10px] text-[var(--text-muted)]">{acc.ticket_server.split(' ')[0]}</span>
                      <span className={`font-semibold ${isSelected ? 'text-teal-500 font-bold' : 'text-[var(--text-primary)]'}`}>
                        ${acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="p-3 space-y-1">
            {navItems.map(item => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-teal-500/15 text-teal-400 border border-teal-500/30 font-semibold'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] border border-transparent'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-teal-400' : 'text-[var(--text-muted)]'}`} />
                  <span>{item.label}</span>
                  {item.id === 'lich-su' && (
                    <span className="ml-auto text-[10px] bg-teal-500/20 text-teal-400 px-1.5 py-0.5 rounded font-mono font-bold">
                      PRO
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom User & Preferences Section */}
        <div className="p-4 border-t border-[var(--border-main)] space-y-3">
          <div className="flex items-center justify-between text-[var(--text-muted)] px-1 text-xs">
            <button 
              type="button" 
              className="flex items-center gap-1.5 hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Thông báo</span>
            </button>
            <button 
              type="button" 
              className="flex items-center gap-1.5 hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Trợ giúp</span>
            </button>
          </div>

          {/* User Card */}
          <div className="flex items-center gap-3 p-2 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)]">
            <div className="w-8 h-8 rounded-full bg-teal-500/20 text-teal-400 border border-teal-500/30 flex items-center justify-center font-bold text-xs">
              T
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">Trader Pro</p>
              <p className="text-[10px] text-[var(--text-muted)] truncate">ltf.tlht@gmail.com</p>
            </div>
          </div>

          {/* Dark / Light Mode Switch */}
          <div className="flex items-center justify-between px-1 pt-1">
            <span className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5 font-medium">
              {isDarkMode ? <Moon className="w-3.5 h-3.5 text-teal-400" /> : <Sun className="w-3.5 h-3.5 text-amber-500" />}
              {isDarkMode ? 'Dark Mode' : 'Light Mode'}
            </span>
            <button
              type="button"
              onClick={onToggleTheme}
              className={`w-10 h-5.5 rounded-full transition-colors relative p-0.5 cursor-pointer ${
                isDarkMode ? 'bg-teal-500' : 'bg-slate-300'
              }`}
              title={isDarkMode ? 'Chuyển sang giao diện Sáng' : 'Chuyển sang giao diện Tối'}
            >
              <div
                className={`w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-transform ${
                  isDarkMode ? 'translate-x-4.5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      </aside>

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
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">Thêm Tài Khoản MT5 Mới</h3>
                  <p className="text-[11px] text-[var(--text-muted)]">Tạo tài khoản và sẵn sàng nhận dữ liệu MT5</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4 text-xs">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--text-secondary)] mb-1">
                  Tên hiển thị gợi ý
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
                  Mã số tài khoản MT5 (Account ID)
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
                  Vốn khởi điểm ($)
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
                Khi bot hoặc EA MT5 gửi dữ liệu giao dịch khớp mã ID này lên Supabase, hệ thống sẽ tự động đồng bộ tên, lịch sử lệnh và số dư theo số liệu thực tế từ MT5.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-main)]">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[var(--bg-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] font-medium transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold transition-all shadow-md shadow-teal-500/20 cursor-pointer"
                >
                  Tạo tài khoản
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};

