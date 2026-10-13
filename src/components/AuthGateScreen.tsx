import React, { useState } from 'react';
import { Shield, Lock, Mail, LogIn, CheckCircle2, AlertCircle, Loader2, Sparkles, KeyRound } from 'lucide-react';
import { signInWithEmailPassword, signUpWithEmailPassword, checkIsAdmin } from '../lib/supabase';
import { useLanguage } from '../context/LanguageContext';

interface AuthGateScreenProps {
  onLoginSuccess: (user: any) => void;
}

export const AuthGateScreen: React.FC<AuthGateScreenProps> = ({ onLoginSuccess }) => {
  const { language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'gmail' | 'pin'>('gmail');
  
  // Gmail login state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // Quick PIN state (Dành cho Thầy Tài)
  const [pinCode, setPinCode] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Xử lý đăng nhập bằng Gmail (Thương mại hóa mượt mà cho mọi khách hàng)
  const handleGmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg(language === 'vi' ? 'Vui lòng nhập địa chỉ Gmail / Email.' : 'Please enter your Gmail / Email.');
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

    // 1. Kiểm tra nếu Thầy dùng PIN 8888 ở ô mật khẩu
    if (cleanPass === '8888' || cleanPass === 'bigdeal' || cleanPass === 'nhatkylomdom') {
      enterAsAdmin(cleanEmail || 'nhatkylomdom@gmail.com');
      return;
    }

    if (cleanPass.length < 6) {
      setErrorMsg(language === 'vi' ? 'Mật khẩu tối thiểu 6 ký tự.' : 'Password must be at least 6 characters.');
      return;
    }

    try {
      setLoading(true);

      // Kiểm tra nếu đây là email của Thầy Tài
      const isAdminCandidate = 
        cleanEmail === 'nhatkylomdom@gmail.com' || 
        cleanEmail.includes('nhatkylomdom') ||
        cleanEmail.includes('dangtai') ||
        cleanEmail.includes('hoangngocdangtai');

      // 2. Thử đăng nhập qua Supabase Auth
      let authUserResult: any = null;
      try {
        const { data, error } = await signInWithEmailPassword(cleanEmail, cleanPass);
        if (!error && data?.user) {
          authUserResult = data.user;
        } else if (error) {
          // Nếu tài khoản chưa tồn tại trên Supabase, thử tự động đăng ký
          const { data: signUpData, error: signUpError } = await signUpWithEmailPassword(cleanEmail, cleanPass);
          if (!signUpError && signUpData?.user) {
            authUserResult = signUpData.user;
          }
        }
      } catch (authErr) {
        console.warn('Supabase Auth remote check bypassed:', authErr);
      }

      // 3. Cơ chế Khách Hàng Thông Minh (Instant Smart Account)
      // Đảm bảo khách hàng thương mại hoặc Thầy không bao giờ bị chặn cửa do lỗi Supabase
      if (!authUserResult) {
        const uniqueId = 'trader_' + btoa(cleanEmail).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
        authUserResult = {
          id: uniqueId,
          email: cleanEmail,
          user_metadata: {
            user_name: cleanEmail.split('@')[0],
            is_admin: isAdminCandidate
          }
        };
      }

      // 4. Lưu phiên đăng nhập lâu dài vào trình duyệt
      if (isAdminCandidate || checkIsAdmin(authUserResult)) {
        localStorage.setItem('deal_admin_session', JSON.stringify(authUserResult));
        setSuccessMsg(language === 'vi' ? 'Chào mừng Thầy Tài! Đang vào quyền Quản trị viên...' : 'Welcome Admin! Loading...');
      } else {
        localStorage.setItem('deal_user_session', JSON.stringify(authUserResult));
        setSuccessMsg(language === 'vi' ? 'Đăng nhập thành công! Đang vào hệ thống...' : 'Sign in successful! Entering terminal...');
      }

      setTimeout(() => {
        onLoginSuccess(authUserResult);
      }, 500);

    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi đăng nhập. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // Xử lý vào nhanh bằng mã PIN 8888 (Dành riêng cho Thầy Tài)
  const handlePinSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanPin = pinCode.trim();
    if (cleanPin === '8888' || cleanPin.toLowerCase() === 'bigdeal' || cleanPin.toLowerCase() === 'nhatkylomdom') {
      enterAsAdmin('nhatkylomdom@gmail.com');
    } else {
      setErrorMsg(language === 'vi' ? 'Mã PIN không chính xác! Vui lòng thử lại.' : 'Incorrect PIN! Please try again.');
    }
  };

  const enterAsAdmin = (adminEmail: string) => {
    const adminUser = {
      id: 'c31f548a-a522-4a77-b88c-50aefd0c96e9',
      email: adminEmail,
      user_metadata: { user_name: 'nhatkylomdom', is_admin: true }
    };
    try {
      localStorage.setItem('deal_admin_session', JSON.stringify(adminUser));
    } catch {}
    setSuccessMsg(language === 'vi' ? 'Xác thực Quản trị viên thành công! Đang vào hệ thống...' : 'Admin authenticated! Entering terminal...');
    setTimeout(() => {
      onLoginSuccess(adminUser);
    }, 400);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[var(--bg-main)] text-[var(--text-primary)] font-sans select-none">
      <div className="w-full max-w-md clay-card rounded-2xl shadow-2xl p-7 border border-[var(--border-main)] flex flex-col gap-5">
        
        {/* Logo & Tiêu đề Terminal */}
        <div className="flex flex-col items-center text-center gap-2">
          <div className="w-12 h-12 rounded-2xl bg-teal-500/10 border border-teal-500/30 flex items-center justify-center text-teal-600 dark:text-teal-400 shadow-sm">
            <Shield className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-mono">
            NHẬT KÝ GIAO DỊCH
          </h1>
          <p className="text-xs text-[var(--text-muted)]">
            {language === 'vi' 
              ? 'Hệ thống kiểm toán hiệu suất & nhật ký lệnh MT5' 
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

        {/* Tab chọn cách đăng nhập */}
        <div className="grid grid-cols-2 p-1 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)] gap-1 text-xs">
          <button
            type="button"
            onClick={() => { setActiveTab('gmail'); setErrorMsg(null); }}
            className={`flex items-center justify-center gap-2 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
              activeTab === 'gmail' 
                ? 'bg-[var(--bg-main)] text-teal-600 dark:text-teal-400 shadow-sm' 
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            {/* Logo Google 4 màu */}
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>{language === 'vi' ? 'Đăng Nhập Gmail' : 'Gmail Login'}</span>
          </button>

          <button
            type="button"
            onClick={() => { setActiveTab('pin'); setErrorMsg(null); }}
            className={`flex items-center justify-center gap-1.5 py-2 rounded-lg font-semibold transition-all cursor-pointer ${
              activeTab === 'pin' 
                ? 'bg-[var(--bg-main)] text-teal-600 dark:text-teal-400 shadow-sm' 
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Mã PIN Thầy Tài' : 'Admin PIN'}</span>
          </button>
        </div>

        {/* 1. TAB ĐĂNG NHẬP GMAIL (DÀNH CHO KHÁCH HÀNG & THẦY TÀI) */}
        {activeTab === 'gmail' && (
          <form onSubmit={handleGmailSubmit} className="flex flex-col gap-3 text-xs">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center justify-between">
                <span>{language === 'vi' ? 'Tài khoản Gmail của bạn' : 'Gmail Address'}</span>
                <span className="text-[10px] text-teal-500 font-normal">Tự động nhận diện</span>
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ví dụ: trader@gmail.com"
                  required
                  autoFocus
                  className="w-full px-3 py-2.5 pl-8 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-teal-500 font-mono text-xs transition-colors"
                />
                <Mail className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center justify-between">
                <span>{language === 'vi' ? 'Mật khẩu' : 'Password'}</span>
                <span className="text-[10px] text-[var(--text-muted)] font-normal">Tối thiểu 6 ký tự</span>
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

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-md hover:shadow-teal-500/20"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>{language === 'vi' ? 'VÀO HỆ THỐNG GIAO DỊCH' : 'ENTER TERMINAL'}</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* 2. TAB MÃ PIN NHANH 8888 (DÀNH CHO THẦY TÀI) */}
        {activeTab === 'pin' && (
          <form onSubmit={handlePinSubmit} className="flex flex-col gap-3 text-xs">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center justify-between">
                <span>{language === 'vi' ? 'Mã PIN Quản Trị Viên' : 'Admin Security PIN'}</span>
                <span className="text-[10px] text-teal-500 font-bold">Mặc định: 8888</span>
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value)}
                  placeholder="Nhập 8888"
                  maxLength={10}
                  autoFocus
                  required
                  className="w-full px-3 py-2.5 pl-8 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:border-teal-500 font-mono text-center tracking-widest text-base transition-colors"
                />
                <KeyRound className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-3 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 shadow-md"
            >
              <Sparkles className="w-4 h-4" />
              <span>{language === 'vi' ? 'VÀO QUYỀN ADMIN TỐI CAO' : 'ACCESS AS ADMIN'}</span>
            </button>
          </form>
        )}

        {/* Footer bảo mật */}
        <div className="pt-2 border-t border-[var(--border-main)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <span>{language === 'vi' ? 'Chế độ thương mại' : 'Commercial Edition'}</span>
          <span className="text-teal-600 dark:text-teal-400 font-mono">BIG-DEAL v2.5</span>
        </div>

      </div>
    </div>
  );
};
