import React, { useState } from 'react';
import { X, Mail, Lock, LogIn, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { signInWithEmailPassword } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { language } = useLanguage();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg(language === 'vi' ? 'Vui lòng nhập địa chỉ Gmail / Email.' : 'Please enter your Gmail / Email.');
      return;
    }

    const cleanPass = password.trim();
    if (!cleanPass) {
      setErrorMsg(language === 'vi' ? 'Vui lòng nhập mật khẩu.' : 'Please enter your password.');
      return;
    }

    if (cleanPass.length < 6) {
      setErrorMsg(language === 'vi' ? 'Mật khẩu phải có tối thiểu 6 ký tự.' : 'Password must be at least 6 characters.');
      return;
    }

    try {
      setLoading(true);

      // Chỉ chấp nhận phiên do Supabase Auth cấp; sai mật khẩu là dừng, không tự dựng phiên
      const { data, error } = await signInWithEmailPassword(cleanEmail, cleanPass);
      if (error || !data?.user) {
        setErrorMsg(language === 'vi' ? 'Sai email hoặc mật khẩu.' : 'Invalid email or password.');
        return;
      }

      setSuccessMsg(language === 'vi' ? 'Đăng nhập thành công!' : 'Sign in successful!');
      setTimeout(() => {
        onSuccess?.();
        onClose();
        window.location.reload();
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi xử lý yêu cầu xác thực');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md clay-card rounded-2xl shadow-2xl p-6 border border-[var(--border-main)] flex flex-col gap-4 text-xs">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-main)]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-[var(--text-primary)]">
              {language === 'vi' ? 'Đăng Nhập Tài Khoản' : 'Account Sign In'}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thông báo */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="leading-snug">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="leading-snug">{successMsg}</span>
          </div>
        )}

        {/* Form Đăng Nhập Gmail */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)]">
              {language === 'vi' ? 'Địa chỉ Gmail của bạn' : 'Gmail Address'}
            </label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="trader@gmail.com"
                required
                className="w-full px-3 py-2 pl-8 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-teal-500 font-mono text-xs transition-colors"
              />
              <Mail className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center justify-between">
              <span>{language === 'vi' ? 'Mật khẩu' : 'Password'}</span>
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2 pl-8 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-teal-500 font-mono text-xs transition-colors"
              />
              <Lock className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-2.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>{language === 'vi' ? 'ĐĂNG NHẬP TERMINAL' : 'SIGN IN'}</span>
              </>
            )}
          </button>
        </form>

      </div>
    </div>
  );
};
