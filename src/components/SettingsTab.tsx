import React from 'react';
import { Settings as SettingsIcon, Clock, Database, Shield, Zap, Key } from 'lucide-react';
import { AppSettings, AccountInfo } from '../types';
import { saveTimezoneOffset, formatDateTimeWithOffset } from '../utils/tradeCalculations';
import { NotifySettingsCard } from './NotifySettingsCard';

interface SettingsTabProps {
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  accounts: AccountInfo[];
}

export const SettingsTab: React.FC<SettingsTabProps> = ({
  settings,
  onUpdateSettings,
  accounts,
}) => {
  const handleOffsetChange = (newOffset: number) => {
    saveTimezoneOffset(newOffset);
    onUpdateSettings({ ...settings, timezone_offset_hours: newOffset });
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto select-none">
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <SettingsIcon className="w-5 h-5 text-cyan-400" />
          Thiết Lập Hệ Thống & Tích Hợp MT5
        </h2>
        <p className="text-xs text-slate-400">
          Cấu hình thông số múi giờ, tài khoản kết nối và webhook nhận dữ liệu
        </p>
      </div>

      <NotifySettingsCard />

      {/* Timezone offset card */}
      <div className="p-5 rounded-xl bg-[#111622] border border-slate-800 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-200">Server Time Offset (Múi Giờ)</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Quy đổi giờ MT5 Server sang giờ địa phương trên giao diện (giữ nguyên timestamp gốc Supabase):
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">Số giờ:</span>
            <input
              type="number"
              min="-14"
              max="14"
              step="1"
              value={settings.timezone_offset_hours}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                handleOffsetChange(isNaN(val) ? 0 : val);
              }}
              className="w-16 px-2 py-1 rounded bg-slate-900 border border-cyan-500/50 text-cyan-400 font-mono font-bold text-center text-sm"
            />
            <span className="font-mono text-xs text-slate-400">h</span>
          </div>
        </div>

        <input
          type="range"
          min="-12"
          max="12"
          step="1"
          value={settings.timezone_offset_hours}
          onChange={(e) => handleOffsetChange(parseInt(e.target.value, 10))}
          className="w-full accent-cyan-400 cursor-pointer"
        />

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Mẫu phổ biến:</span>
          <button
            type="button"
            onClick={() => handleOffsetChange(4)}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              settings.timezone_offset_hours === 4
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            MT5 Exness (+4h)
          </button>
          <button
            type="button"
            onClick={() => handleOffsetChange(5)}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              settings.timezone_offset_hours === 5
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            ICMarkets (+5h)
          </button>
          <button
            type="button"
            onClick={() => handleOffsetChange(7)}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              settings.timezone_offset_hours === 7
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            Việt Nam UTC+7 (+7h)
          </button>
          <button
            type="button"
            onClick={() => handleOffsetChange(0)}
            className={`px-2.5 py-1 rounded font-medium transition-colors ${
              settings.timezone_offset_hours === 0
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
            }`}
          >
            Mặc định (0h)
          </button>
        </div>

        {/* Live preview */}
        <div className="p-2.5 rounded-lg bg-[#0b0e14] border border-slate-800/80 flex items-center justify-between text-xs">
          <span className="text-slate-400">Xem trước hiển thị:</span>
          <div className="flex items-center gap-2 font-mono">
            <span className="text-slate-500">Gốc: 05-30 02:41</span>
            <span className="text-slate-600">→</span>
            <span className="text-cyan-300 font-bold">
              {formatDateTimeWithOffset('2026-05-30 02:41:00', settings.timezone_offset_hours, 'MM-DD HH:mm')}
            </span>
          </div>
        </div>
      </div>

      {/* Accounts Management */}
      <div className="p-5 rounded-xl bg-[#111622] border border-slate-800 space-y-3">
        <h3 className="text-sm font-bold text-slate-200">Tài Khoản MT5 Đã Đồng Bộ ({accounts.length})</h3>
        <div className="space-y-2">
          {accounts.map(acc => (
            <div key={acc.id} className="p-3 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-between text-xs">
              <div className="flex items-center gap-3">
                <Database className="w-4 h-4 text-cyan-400" />
                <div>
                  <span className="font-bold text-white block">{acc.name}</span>
                  <span className="text-slate-500 font-mono">{acc.ticket_server}</span>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono font-bold text-slate-200">${acc.balance.toLocaleString()}</span>
                <span className="text-emerald-400 text-[11px] font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                  Connected
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Supabase / EA Webhook integration info */}
      <div className="p-5 rounded-xl bg-[#111622] border border-slate-800 space-y-2 text-xs">
        <h3 className="text-sm font-bold text-slate-200 flex items-center gap-2">
          <Key className="w-4 h-4 text-amber-400" />
          Sẵn Sàng Đấu Nối Supabase & EA MT5
        </h3>
        <p className="text-slate-400 leading-relaxed">
          Cấu trúc dữ liệu đã được quy chuẩn sẵn theo TypeScript Interfaces. Khi đấu nối EA qua Webhook hoặc Supabase Realtime, các trường <code className="text-cyan-400">ticket</code>, <code className="text-cyan-400">position_id</code>, <code className="text-cyan-400">volume</code>, <code className="text-cyan-400">open_price</code>, <code className="text-cyan-400">initial_sl</code> sẽ được tự động ánh xạ trực tiếp mà không cần sửa đổi giao diện.
        </p>
      </div>
    </div>
  );
};
