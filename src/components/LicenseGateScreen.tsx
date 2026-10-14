import React, { useState } from 'react';
import { Lock, ShieldAlert, RefreshCw, LogOut, ExternalLink, Clock, CheckCircle2 } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';

interface LicenseGateScreenProps {
  userEmail: string;
  errorMessage: string;
  isExpired?: boolean;
  isBlocked?: boolean;
  onRefreshCheck: () => void;
  onSignOut: () => void;
}

export const LicenseGateScreen: React.FC<LicenseGateScreenProps> = ({
  userEmail,
  errorMessage,
  isExpired,
  isBlocked,
  onRefreshCheck,
  onSignOut
}) => {
  const { language } = useLanguage();
  const [checking, setChecking] = useState(false);

  const handleCheckAgain = async () => {
    setChecking(true);
    await onRefreshCheck();
    setTimeout(() => setChecking(false), 600);
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-[var(--bg-main)] text-[var(--text-primary)] font-sans select-none">
      <div className="w-full max-w-md clay-card rounded-2xl shadow-2xl p-7 border border-[var(--border-main)] flex flex-col gap-5 text-center">
        
        {/* Biểu tượng khóa bảo mật */}
        <div className="flex flex-col items-center gap-2">
          <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm border ${
            isExpired 
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-500' 
              : isBlocked 
                ? 'bg-rose-500/10 border-rose-500/30 text-rose-500' 
                : 'bg-teal-500/10 border-teal-500/30 text-teal-600 dark:text-teal-400'
          }`}>
            {isExpired ? (
              <Clock className="w-7 h-7" />
            ) : isBlocked ? (
              <ShieldAlert className="w-7 h-7" />
            ) : (
              <Lock className="w-7 h-7" />
            )}
          </div>

          <h1 className="text-lg font-bold tracking-tight text-[var(--text-primary)] font-mono uppercase mt-1">
            {isExpired 
              ? (language === 'vi' ? 'Bản Quyền Đã Hết Hạn' : 'License Expired')
              : isBlocked 
                ? (language === 'vi' ? 'Bản Quyền Bị Khóa' : 'License Blocked')
                : (language === 'vi' ? 'Chưa Kích Hoạt Bản Quyền' : 'License Activation Required')}
          </h1>

          <div className="px-3 py-1 rounded-full bg-[var(--bg-subtle)] border border-[var(--border-main)] text-xs font-mono text-teal-600 dark:text-teal-400">
            {userEmail}
          </div>
        </div>

        {/* Nội dung thông báo */}
        <div className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-[var(--border-main)] text-xs text-[var(--text-secondary)] leading-relaxed text-left flex flex-col gap-2">
          <p className="font-semibold text-[var(--text-primary)]">
            {errorMessage || (language === 'vi' ? 'Tài khoản chưa được cấp phép truy cập.' : 'Access not authorized.')}
          </p>
          <p className="text-[11px] text-[var(--text-muted)]">
            {language === 'vi' 
              ? 'BIG-DEAL Terminal là phần mềm phân tích và đồng bộ MT5 độc quyền. Vui lòng liên hệ Admin để đăng ký số tài khoản MT5 và kích hoạt gói bản quyền.' 
              : 'BIG-DEAL Terminal is a proprietary execution analytics system. Please contact Admin to register your MT5 accounts and activate license.'}
          </p>
        </div>

        {/* Nút thao tác */}
        <div className="flex flex-col gap-2.5 pt-1">
          <button
            type="button"
            onClick={handleCheckAgain}
            disabled={checking}
            className="w-full py-2.5 px-4 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? (language === 'vi' ? 'Đang kiểm tra lại...' : 'Checking...') : (language === 'vi' ? 'Tôi Đã Kích Hoạt (Kiểm Tra Lại)' : 'Check License Again')}</span>
          </button>

          <button
            type="button"
            onClick={onSignOut}
            className="w-full py-2.5 px-4 rounded-xl clay-btn-secondary hover:border-rose-500/50 text-[var(--text-secondary)] hover:text-rose-500 text-xs font-semibold transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>{language === 'vi' ? 'Đăng Xuất / Đổi Tài Khoản' : 'Sign Out / Switch Account'}</span>
          </button>
        </div>

        <div className="pt-2 border-t border-[var(--border-main)] text-[10px] text-[var(--text-muted)]">
          BIG-DEAL Commercial License Guard v3.0
        </div>

      </div>
    </div>
  );
};
