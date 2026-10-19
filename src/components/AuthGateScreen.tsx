import React, { useState } from 'react';
import { Shield, Lock, Mail, LogIn, UserPlus, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { signInWithEmailPassword, signUpWithEmailPassword, signInWithOAuthProvider, checkIsAdmin } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

interface AuthGateScreenProps {
  onLoginSuccess: (user: any) => void;
}

export const AuthGateScreen: React.FC<AuthGateScreenProps> = ({ onLoginSuccess }) => {
  const { language } = useLanguage();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Kích hoạt Popup Google hoặc GitHub chính chủ
  const handleOAuth = async (provider: 'google' | 'github') => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const { data, error } = await signInWithOAuthProvider(provider);
      if (error) {
        throw error;
      }
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: any) {
      console.warn('Lỗi kích hoạt OAuth Provider:', err);
      const msg = err.message || '';
      if (msg.includes('Unsupported provider') || (err as any)?.code === 'validation_failed') {
        setErrorMsg(
          provider === 'google'
            ? 'Cổng Google chưa được bật trong Supabase Dashboard (Auth -> Providers -> Google). Tab cấu hình đã được mở trên Chrome của Thầy.'
            : 'Cổng GitHub chưa được bật trong Supabase Dashboard (Auth -> Providers -> GitHub). Tab cấu hình đã được mở trên Chrome của Thầy.'
        );
      } else {
        setErrorMsg(err.message || 'Lỗi kết nối cổng xác thực OAuth.');
      }
      setLoading(false);
    }
  };

  // Xác thực Email & Mật khẩu bảo mật cá nhân
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg(language === 'vi' ? 'Vui lòng nhập Email / Gmail của bạn.' : 'Please enter your Email.');
      return;
    }

    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setErrorMsg(language === 'vi' ? 'Định dạng Email không hợp lệ (ví dụ: yourname@gmail.com).' : 'Invalid email format.');
      return;
    }

    const cleanPass = password.trim();
    if (!cleanPass) {
      setErrorMsg(language === 'vi' ? 'Vui lòng nhập mật khẩu.' : 'Please enter your password.');
      return;
    }

    if (mode === 'signup' && cleanPass !== confirmPassword.trim()) {
      setErrorMsg(language === 'vi' ? 'Mật khẩu xác nhận không khớp.' : 'Passwords do not match.');
      return;
    }

    if (cleanPass.length < 6) {
      setErrorMsg(language === 'vi' ? 'Mật khẩu phải có tối thiểu 6 ký tự để đảm bảo an toàn.' : 'Password must be at least 6 characters.');
      return;
    }

    try {
      setLoading(true);

      // Chỉ chấp nhận phiên do Supabase Auth cấp; sai mật khẩu là dừng, không tự dựng phiên
      const { data, error } = mode === 'signin'
        ? await signInWithEmailPassword(cleanEmail, cleanPass)
        : await signUpWithEmailPassword(cleanEmail, cleanPass);

      if (error) {
        setErrorMsg(
          mode === 'signin'
            ? (language === 'vi' ? 'Sai email hoặc mật khẩu.' : 'Invalid email or password.')
            : (error.message || (language === 'vi' ? 'Không thể đăng ký tài khoản.' : 'Sign up failed.'))
        );
        return;
      }

      if (!data?.session || !data.user) {
        // Supabase bật xác nhận email: user phải bấm link trong hộp thư trước khi đăng nhập
        setSuccessMsg(language === 'vi' ? 'Đã gửi email xác nhận. Vui lòng mở hộp thư để kích hoạt.' : 'Confirmation email sent.');
        return;
      }

      const authUserResult = data.user;
      setSuccessMsg(
        checkIsAdmin(authUserResult)
          ? (language === 'vi' ? 'Xác thực Quản trị viên thành công! Đang vào hệ thống...' : 'Admin authenticated!')
          : (language === 'vi' ? 'Đăng nhập thành công! Đang vào không gian của bạn...' : 'Signed in successfully!')
      );

      setTimeout(() => {
        onLoginSuccess(authUserResult);
      }, 500);

    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi xử lý xác thực');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[var(--bg-main)] text-[var(--text-primary)] font-sans select-none">
      <div className="w-full max-w-md clay-card rounded-2xl shadow-2xl p-7 border border-[var(--border-main)] flex flex-col gap-5">
        
        {/* Header Terminal */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-sm">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-mono">
            NHẬT KÝ GIAO DỊCH
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            {language === 'vi' 
              ? 'Nền tảng kiểm toán hiệu suất & nhật ký lệnh MT5' 
              : 'Trading Journal & Execution Analytics Terminal'}
          </p>
        </div>

        {/* Thông báo lỗi / thành công */}
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

        {/* Nút Đăng Nhập Popup Chính Chủ: Google & GitHub */}
        <div className="flex flex-col gap-2.5">
          {/* Nút Google */}
          <button
            type="button"
            disabled={loading}
            onClick={() => handleOAuth('google')}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl clay-btn-secondary hover:border-emerald-500 text-[var(--text-primary)] text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{language === 'vi' ? 'Tiếp tục với Google' : 'Continue with Google'}</span>
          </button>

          {/* Nút GitHub */}
          <button
            type="button"
            disabled={loading}
            onClick={() => handleOAuth('github')}
            className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl clay-btn-secondary hover:border-emerald-500 text-[var(--text-primary)] text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 shadow-sm"
          >
            <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
              <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
            </svg>
            <span>{language === 'vi' ? 'Tiếp tục với GitHub' : 'Continue with GitHub'}</span>
          </button>
        </div>

        {/* Phân cách */}
        <div className="flex items-center gap-2 my-0.5">
          <div className="h-px bg-[var(--border-main)] flex-1" />
          <span className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
            {language === 'vi' ? 'Hoặc tài khoản Email / Mật khẩu bảo mật' : 'Or Email / Secure Password'}
          </span>
          <div className="h-px bg-[var(--border-main)] flex-1" />
        </div>

        {/* Form Email & Mật Khẩu Bảo Mật Bắt Buộc */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 text-xs">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Email / Gmail</label>
            <div className="relative">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="yourname@gmail.com"
                required
                className="w-full px-3 py-2.5 pl-8 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-teal-500 font-mono text-xs transition-colors"
              />
              <Mail className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-semibold text-[var(--text-secondary)]">
              {language === 'vi' ? 'Mật khẩu bảo mật' : 'Password'}
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-3 py-2.5 pl-8 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-teal-500 font-mono text-xs transition-colors"
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
                  className="w-full px-3 py-2.5 pl-8 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-teal-500 font-mono text-xs transition-colors"
                />
                <Lock className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full mt-2 py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-teal-500/20 text-xs"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : mode === 'signin' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>{language === 'vi' ? 'ĐĂNG NHẬP TERMINAL' : 'SIGN IN'}</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>{language === 'vi' ? 'TẠO TÀI KHOẢN MỚI' : 'CREATE ACCOUNT'}</span>
              </>
            )}
          </button>
        </form>

        {/* Chuyển đổi Sign In / Sign Up */}
        <div className="flex items-center justify-between pt-2 border-t border-[var(--border-main)] text-[11px]">
          <span className="text-[var(--text-muted)]">
            {mode === 'signin' 
              ? (language === 'vi' ? 'Khách hàng mới?' : "New trader?") 
              : (language === 'vi' ? 'Đã có tài khoản?' : 'Already registered?')}
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
              ? (language === 'vi' ? 'Tạo tài khoản' : 'Register now') 
              : (language === 'vi' ? 'Đăng nhập' : 'Sign in')}
          </button>
        </div>

      </div>
    </div>
  );
};
