import React, { useState } from 'react';
import { X, Copy, Check, Terminal, ExternalLink, Zap, Shield, Key } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface ConnectEAModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userEmail?: string;
  isAdmin?: boolean;
}

export const ConnectEAModal: React.FC<ConnectEAModalProps> = ({
  isOpen,
  onClose,
  userId,
  userEmail,
  isAdmin
}) => {
  const { language } = useLanguage();
  const [copiedToken, setCopiedToken] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  if (!isOpen) return null;

  const serverUrl = 'https://fvwcanltqxeorfgemxel.supabase.co';

  const handleCopyToken = () => {
    navigator.clipboard.writeText(userId);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(serverUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-lg clay-card rounded-2xl shadow-2xl p-6 border border-[var(--border-main)] flex flex-col gap-4 text-xs font-sans">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-main)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400">
              <Key className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] font-mono">
                {language === 'vi' ? 'Kết Nối EA MetaTrader 5' : 'Connect MT5 EA'}
              </h2>
              <p className="text-[11px] text-[var(--text-muted)]">
                {isAdmin ? 'Mã kết nối quản trị viên (Admin)' : 'Mã định danh đồng bộ lệnh riêng của bạn'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Mã User Token */}
        <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              Mã Kết Nối Của Bạn (User Token)
            </span>
            <span className="text-[10px] text-teal-600 dark:text-teal-400 font-mono font-semibold">
              {isAdmin ? 'Quyền Admin' : 'Riêng tư & Bảo mật'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={userId || 'Chưa đăng nhập'}
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-main)] font-mono text-xs text-[var(--text-primary)] select-all focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopyToken}
              className="px-3 py-2 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              {copiedToken ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedToken ? 'Đã chép' : 'Sao chép'}</span>
            </button>
          </div>
          <span className="text-[10px] text-[var(--text-muted)]">
            * Dán mã này vào thông số thiết lập <code className="text-teal-600 dark:text-teal-400">User_Token</code> trong con EA trên MT5.
          </span>
        </div>

        {/* URL Máy Chủ */}
        <div className="flex flex-col gap-1.5 p-3 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)]">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-wider">
              URL Máy Chủ Đồng Bộ (WebRequest URL)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={serverUrl}
              className="flex-1 px-3 py-2 rounded-lg bg-[var(--bg-card)] border border-[var(--border-main)] font-mono text-xs text-[var(--text-primary)] select-all focus:outline-none"
            />
            <button
              type="button"
              onClick={handleCopyUrl}
              className="px-3 py-2 rounded-lg clay-btn-secondary text-[var(--text-primary)] hover:border-emerald-500 font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
            >
              {copiedUrl ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedUrl ? 'Đã chép' : 'Sao chép'}</span>
            </button>
          </div>
        </div>

        {/* Hướng Dẫn Cài Đặt 3 Bước */}
        <div className="flex flex-col gap-2 pt-2 border-t border-[var(--border-main)] text-xs text-[var(--text-secondary)]">
          <span className="font-bold text-[var(--text-primary)]">Hướng dẫn kích hoạt MT5 (Mất 1 phút):</span>
          <div className="flex flex-col gap-1.5 text-[11px] leading-relaxed">
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">1</span>
              <span>Kéo file EA lên biểu đồ MT5 bất kỳ, mở tab <b>Inputs</b> và dán <b>Mã User Token</b> ở trên vào ô cài đặt.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">2</span>
              <span>Trên MT5: Vào <b>Tools</b> &rarr; <b>Options</b> &rarr; <b>Expert Advisors</b> &rarr; Tích chọn <i>"Allow WebRequest for listed URL"</i> và thêm đường link máy chủ ở trên.</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="w-4 h-4 rounded-full bg-teal-500/20 text-teal-600 dark:text-teal-400 flex items-center justify-center font-bold text-[10px] shrink-0 mt-0.5">3</span>
              <span>Xong! Mỗi khi bạn vào lệnh hoặc chốt lời/cắt lỗ trên MT5, toàn bộ dữ liệu sẽ tự động nhảy lên bảng nhật ký của bạn 24/7!</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-2 py-2 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-all cursor-pointer"
        >
          Đã Hiểu & Đóng
        </button>

      </div>
    </div>
  );
};
