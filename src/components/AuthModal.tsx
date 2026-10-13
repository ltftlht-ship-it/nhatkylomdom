import React, { useState } from 'react';
import { X, Mail, Lock, LogIn, UserPlus, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { signInWithEmailPassword, signUpWithEmailPassword, signInWithOAuthProvider } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { language } = useLanguage();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleOAuth = async (provider: 'google' | 'github') => {
    try {
      setLoading(true);
      setErrorMsg(null);
      await signInWithOAuthProvider(provider);
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi xác thực cổng đăng nhập');
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMsg(language === 'vi' ? 'Vui lòng nhập đầy đủ Email và Mật khẩu.' : 'Please enter Email and Password.');
      return;
    }

    if (mode === 'signup' && password !== confirmPassword) {
      setErrorMsg(language === 'vi' ? 'Mật khẩu xác nhận không trùng khớp.' : 'Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg(language === 'vi' ? 'Mật khẩu phải có tối thiểu 6 ký tự.' : 'Password must be at least 6 characters.');
      return;
    }

    try {
      setLoading(true);
      if (mode === 'signin') {
        const { error } = await signInWithEmailPassword(cleanEmail, password);
        if (error) throw error;
        setSuccessMsg(language === 'vi' ? 'Đăng nhập thành công!' : 'Sign in successful!');
        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 600);
      } else {
        const { error } = await signUpWithEmailPassword(cleanEmail, password);
        if (error) throw error;
        setSuccessMsg(
          language === 'vi' 
            ? 'Đăng ký thành công! Kiểm tra hộp thư Email để kích hoạt tài khoản nếu được yêu cầu.' 
            : 'Registration successful! Please check your email to confirm.'
        );
        setTimeout(() => {
          setMode('signin');
          setSuccessMsg(null);
        }, 2000);
      }
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
              {mode === 'signin' 
                ? (language === 'vi' ? 'Đăng Nhập Tài Khoản' : 'Account Sign In') 
                : (language === 'vi' ? 'Đăng Ký Tài Khoản Mới' : 'Create New Account')}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-subtle)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thông báo lỗi / thành công */}
        {errorMsg && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span className="leading-snug">{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="leading-snug">{successMsg}</span>
          </div>
        )}

        {/* Nút Đăng Nhập Mạng Xã Hội (OAuth) */}
        <div className="flex flex-col gap-2">
          {/* Google */}
          <button
            type="button"
            disabled={loading}
            onClick={() => handleOAuth('google')}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl clay-btn-secondary hover:border-emerald-500 text-[var(--text-primary)] font-semibold transition-all cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{language === 'vi' ? 'Tiếp tục với Google' : 'Continue with Google'}</span>
          </button>

          {/* GitHub */}
          <button
            type="button"
            disabled={loading}
            onClick={() => handleOAuth('github')}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl clay-btn-secondary hover:border-emerald-500 text-[var(--text-primary)] font-semibold transition-all cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span>{language === 'vi' ? 'Tiếp tục với GitHub' : 'Continue with GitHub'}</span>
          </button>
        </div>

        {/* Đường phân cách */}
        <div className="flex items-center gap-2 my-1">
          <div className="h-px bg-[var(--border-main)] flex-1" />
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
            {language === 'vi' ? 'Hoặc qua Email' : 'Or via Email'}
          </span>
          <div className="h-px bg-[var(--border-main)] flex-1" />
        </div>

        {/* Form Email & Mật Khẩu */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Email</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nhatkylomdom@gmail.com"
                required
                className="w-full px-3 py-2 pl-8 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-emerald-500 font-mono text-xs transition-colors"
              />
              <Mail className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)]">
              {language === 'vi' ? 'Mật khẩu' : 'Password'}
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2 pl-8 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-emerald-500 font-mono text-xs transition-colors"
              />
              <Lock className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          {mode === 'signup' && (
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)]">
                {language === 'vi' ? 'Xác nhận mật khẩu' : 'Confirm Password'}
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  className="w-full px-3 py-2 pl-8 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-emerald-500 font-mono text-xs transition-colors"
                />
                <Lock className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-1 py-2.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-sm"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'signin' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>{language === 'vi' ? 'Đăng Nhập' : 'Sign In'}</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>{language === 'vi' ? 'Tạo Tài Khoản' : 'Register'}</span>
              </>
            )}
          </button>
        </form>

        {/* Chuyển đổi Đăng nhập / Đăng ký */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-main)] text-[11px]">
          <span className="text-[var(--text-muted)]">
            {mode === 'signin' 
              ? (language === 'vi' ? 'Chưa có tài khoản?' : "Don't have an account?") 
              : (language === 'vi' ? 'Đã có tài khoản?' : 'Already have an account?')}
          </span>
          <button
            type="button"
            onClick={() => {
              setMode(mode === 'signin' ? 'signup' : 'signin');
              setErrorMsg(null);
              setSuccessMsg(null);
            }}
            className="font-bold text-teal-500 hover:underline cursor-pointer"
          >
            {mode === 'signin' 
              ? (language === 'vi' ? 'Đăng ký ngay' : 'Sign up now') 
              : (language === 'vi' ? 'Đăng nhập' : 'Sign in')}
          </button>
        </div>

        {/* Chế độ Khách (Bỏ qua không cần đăng nhập) */}
        <button
          type="button"
          onClick={onClose}
          className="text-center text-[10px] text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:underline cursor-pointer"
        >
          {language === 'vi' ? 'Tiếp tục dùng thử chế độ khách' : 'Continue as guest'}
        </button>

      </div>
    </div>
  );
};
