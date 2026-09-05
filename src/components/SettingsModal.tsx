import React, { useState } from 'react';
import { 
  X, 
  Clock, 
  Globe, 
  Settings as SettingsIcon, 
  Check, 
  HelpCircle,
  ShieldCheck,
  Zap,
  RotateCcw,
  Database,
  CheckCircle2,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { AppSettings, PreChecklistItem, PostMistakeItem } from '../types';
import { 
  getSupabaseCredentials, 
  saveSupabaseCredentials, 
  testSupabaseConnection, 
  cleanSupabaseUrl, 
  cleanSupabaseKey 
} from '../lib/supabase';
import { saveTimezoneOffset, formatDateTimeWithOffset } from '../utils/tradeCalculations';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onUpdateSettings: (newSettings: AppSettings) => void;
  preChecklist: PreChecklistItem[];
  onUpdatePreChecklist: (items: PreChecklistItem[]) => void;
  postMistakes: PostMistakeItem[];
  onUpdatePostMistakes: (items: PostMistakeItem[]) => void;
  onRefreshSupabase?: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onUpdateSettings,
  preChecklist,
  onUpdatePreChecklist,
  postMistakes,
  onUpdatePostMistakes,
  onRefreshSupabase,
}) => {
  if (!isOpen) return null;

  const currentCreds = getSupabaseCredentials();
  const [offsetHours, setOffsetHours] = useState<number>(settings.timezone_offset_hours);
  const [autoSession, setAutoSession] = useState<boolean>(settings.auto_classify_session);
  const [activeTab, setActiveTab] = useState<'timezone' | 'checklist' | 'contract' | 'supabase'>('supabase');

  // Supabase credentials state
  const [supabaseUrl, setSupabaseUrl] = useState<string>(currentCreds.url);
  const [supabaseKey, setSupabaseKey] = useState<string>(currentCreds.anonKey);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ success?: boolean; message?: string } | null>(null);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const cleanedUrl = cleanSupabaseUrl(supabaseUrl);
    const cleanedKey = cleanSupabaseKey(supabaseKey);
    setSupabaseUrl(cleanedUrl);
    setSupabaseKey(cleanedKey);

    try {
      const res = await testSupabaseConnection(cleanedUrl, cleanedKey);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err?.message || 'Lỗi không xác định' });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = () => {
    const cleanedUrl = cleanSupabaseUrl(supabaseUrl);
    const cleanedKey = cleanSupabaseKey(supabaseKey);
    saveSupabaseCredentials(cleanedUrl, cleanedKey);
    saveTimezoneOffset(offsetHours);
    onUpdateSettings({
      ...settings,
      timezone_offset_hours: offsetHours,
      auto_classify_session: autoSession,
    });
    if (onRefreshSupabase) {
      onRefreshSupabase();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#0f141d] border border-slate-700 rounded-xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[#121824] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Cài Đặt Hệ Thống & Cấu Hình MT5</h3>
              <p className="text-[11px] text-slate-400">Múi giờ Offset, phân loại Phiên Á/Âu/Mỹ, và Tiêu chí Kỷ luật</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Sub-tabs inside Settings */}
        <div className="px-5 pt-3 bg-[#0d1117] border-b border-slate-800 flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => setActiveTab('timezone')}
            className={`pb-2.5 px-2 font-semibold border-b-2 transition-colors ${
              activeTab === 'timezone'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Múi Giờ Offset & Phiên
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('checklist')}
            className={`pb-2.5 px-2 font-semibold border-b-2 transition-colors ${
              activeTab === 'checklist'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Tiêu Chí Kỷ Luật (Checklist)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('contract')}
            className={`pb-2.5 px-2 font-semibold border-b-2 transition-colors ${
              activeTab === 'contract'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            Contract Size
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('supabase')}
            className={`pb-2.5 px-2 font-semibold border-b-2 transition-colors flex items-center gap-1.5 ${
              activeTab === 'supabase'
                ? 'border-cyan-400 text-cyan-300'
                : 'border-transparent text-slate-400 hover:text-slate-300'
            }`}
          >
            <Database className="w-3.5 h-3.5" />
            <span>Kết Nối Supabase (MT5)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {activeTab === 'timezone' && (
            <div className="space-y-4">
              {/* CẤU HÌNH MÚI GIỜ OFFSET (SERVER TIME OFFSET) */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200 text-sm block">Server Time Offset (Giờ)</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Quy đổi giờ MT5 Server (ví dụ ICMarkets/Exness GMT+2/+3) về giờ hiển thị địa phương. Giữ nguyên gốc timestamp trong Supabase.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400 text-[11px]">Nhập số giờ:</span>
                    <input
                      type="number"
                      step="1"
                      min="-14"
                      max="14"
                      value={offsetHours}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setOffsetHours(isNaN(val) ? 0 : val);
                      }}
                      className="w-16 px-2 py-1 rounded bg-slate-950 border border-cyan-500/50 text-cyan-400 font-mono font-bold text-center text-sm"
                    />
                    <span className="font-mono text-xs text-slate-400">h</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <span className="text-slate-500 font-mono text-xs">-12h</span>
                  <input
                    type="range"
                    min="-12"
                    max="12"
                    step="1"
                    value={offsetHours}
                    onChange={(e) => setOffsetHours(parseInt(e.target.value, 10))}
                    className="flex-1 accent-cyan-400 cursor-pointer"
                  />
                  <span className="text-slate-500 font-mono text-xs">+12h</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setOffsetHours(4)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      offsetHours === 4 
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    MT5 Exness (+4h)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOffsetHours(5)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      offsetHours === 5 
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    ICMarkets (+5h)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOffsetHours(7)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      offsetHours === 7 
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    Việt Nam UTC+7 (+7h)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOffsetHours(0)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      offsetHours === 0 
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    Mặc định (0h)
                  </button>
                  <button
                    type="button"
                    onClick={() => setOffsetHours(-2)}
                    className={`px-2.5 py-1 rounded text-[11px] font-medium transition-colors ${
                      offsetHours === -2 
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40' 
                        : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                    }`}
                  >
                    GMT-2 (-2h)
                  </button>
                </div>

                {/* XEM TRƯỚC THỜI GIAN THỰC TẾ TRÊN UI */}
                <div className="mt-2 p-2.5 rounded-lg bg-[#0b0e14] border border-slate-800/80 flex items-center justify-between text-[11px]">
                  <span className="text-slate-400">Xem trước quy đổi:</span>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-slate-500">Gốc: 05-30 02:41</span>
                    <span className="text-slate-600">→</span>
                    <span className="text-cyan-300 font-bold">
                      {formatDateTimeWithOffset('2026-05-30 02:41:00', offsetHours, 'MM-DD HH:mm')}
                    </span>
                  </div>
                </div>
              </div>

              {/* TỰ ĐỘNG PHÂN LOẠI PHIÊN */}
              <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-200">Tự Động Phân Loại Phiên (Á / Âu / Mỹ)</span>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Dựa trên <code className="text-cyan-400">open_time</code> sau khi cộng Múi Giờ Offset.
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={autoSession}
                    onChange={(e) => setAutoSession(e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 bg-slate-800 border-slate-700 focus:ring-0 cursor-pointer"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 text-[11px]">
                  <div className="p-2 rounded bg-[#0b0e14] border border-slate-800">
                    <span className="font-bold text-slate-300 block">Phiên Á (Tokyo)</span>
                    <span className="font-mono text-slate-400">06:00 - 14:00 VN</span>
                  </div>
                  <div className="p-2 rounded bg-[#0b0e14] border border-slate-800">
                    <span className="font-bold text-slate-300 block">Phiên Âu (London)</span>
                    <span className="font-mono text-slate-400">14:00 - 19:00 VN</span>
                  </div>
                  <div className="p-2 rounded bg-[#0b0e14] border border-slate-800">
                    <span className="font-bold text-slate-300 block">Phiên Mỹ (New York)</span>
                    <span className="font-mono text-slate-400">19:00 - 04:00 VN</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'checklist' && (
            <div className="space-y-4">
              <div>
                <h4 className="font-bold text-slate-200 mb-1">Checklist Tiêu Chí Kỷ Luật (Pre-Trade)</h4>
                <p className="text-[11px] text-slate-400 mb-2">Điều chỉnh điểm số cho từng tiêu chí để xếp loại Grade A+:</p>
                <div className="space-y-1.5 max-h-56 overflow-y-auto">
                  {preChecklist.map((item, idx) => (
                    <div key={item.id} className="flex items-center justify-between p-2 rounded bg-slate-900 border border-slate-800">
                      <span className="text-slate-300 font-medium truncate pr-2">{item.label}</span>
                      <div className="flex items-center gap-1.5 shrink-0 font-mono">
                        <span className="text-slate-500 text-[10px]">Điểm:</span>
                        <input
                          type="number"
                          value={item.points}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10) || 0;
                            const copy = [...preChecklist];
                            copy[idx].points = val;
                            onUpdatePreChecklist(copy);
                          }}
                          className="w-14 px-1.5 py-0.5 rounded bg-slate-950 border border-slate-700 text-cyan-400 font-bold text-right"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'contract' && (
            <div className="space-y-3">
              <h4 className="font-bold text-slate-200">Cấu hình Kích thước Hợp đồng (Contract Size)</h4>
              <p className="text-[11px] text-slate-400">
                Dùng để tính toán chính xác <code className="text-cyan-400">risk_1r_usd = pip_sl * volume * contract_size</code>:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-300 font-bold block">XAU/USD (Gold)</span>
                  <span className="text-[11px] text-slate-500">100 oz / Lot tiêu chuẩn</span>
                  <input
                    type="number"
                    defaultValue={100}
                    className="w-full mt-1.5 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-cyan-300 font-bold"
                  />
                </div>
                <div className="p-3 rounded-lg bg-slate-900 border border-slate-800">
                  <span className="text-slate-300 font-bold block">Forex (EUR/USD, GBP/USD)</span>
                  <span className="text-[11px] text-slate-500">100,000 units / Lot</span>
                  <input
                    type="number"
                    defaultValue={100000}
                    className="w-full mt-1.5 px-2 py-1 rounded bg-slate-950 border border-slate-700 font-mono text-cyan-300 font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'supabase' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-900/90 border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                      <Database className="w-4 h-4 text-cyan-400" />
                      <span>Cấu Hình Kết Nối Supabase Bảng "trades"</span>
                    </h4>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Ứng dụng sẽ kết nối trực tiếp đến bảng <code className="text-cyan-400 font-mono">trades</code> trên Supabase của bạn để lấy dữ liệu MT5.
                    </p>
                  </div>
                </div>

                {/* Form fields */}
                <div className="space-y-3 pt-2">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[11px] font-semibold text-slate-300">
                        Project URL <span className="text-cyan-400 font-normal">(ví dụ: https://xyzcompany.supabase.co)</span>
                      </label>
                      <span className="text-[10px] text-slate-500">
                        *Tự động lọc bỏ /rest/v1 để tránh lỗi PGRST125
                      </span>
                    </div>
                    <input
                      type="text"
                      placeholder="https://your-project.supabase.co"
                      value={supabaseUrl}
                      onChange={(e) => setSupabaseUrl(e.target.value)}
                      onBlur={() => setSupabaseUrl(cleanSupabaseUrl(supabaseUrl))}
                      className="w-full px-3 py-2 rounded-lg bg-[#0b0e14] border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                      Anon Public Key <span className="text-cyan-400 font-normal">(Khóa công khai anon)</span>
                    </label>
                    <input
                      type="password"
                      placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                      value={supabaseKey}
                      onChange={(e) => setSupabaseKey(e.target.value)}
                      onBlur={() => setSupabaseKey(cleanSupabaseKey(supabaseKey))}
                      className="w-full px-3 py-2 rounded-lg bg-[#0b0e14] border border-slate-800 text-slate-100 font-mono text-xs focus:outline-none focus:border-cyan-500/50"
                    />
                  </div>

                  {/* Test Connection Button */}
                  <div className="pt-1 flex items-center gap-3">
                    <button
                      type="button"
                      disabled={isTesting || !supabaseUrl || !supabaseKey}
                      onClick={handleTestConnection}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-semibold text-cyan-300 border border-slate-700 transition-colors"
                    >
                      {isTesting ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                          <span>Đang kiểm tra...</span>
                        </>
                      ) : (
                        <>
                          <Zap className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Kiểm tra kết nối</span>
                        </>
                      )}
                    </button>
                    <span className="text-[11px] text-slate-500">
                      *Cũng có thể cấu hình thông qua biến môi trường VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY
                    </span>
                  </div>

                  {/* Test Result Message */}
                  {testResult && (
                    <div className={`p-3 rounded-lg flex items-center gap-2 text-xs border ${
                      testResult.success
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                        : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
                    }`}>
                      {testResult.success ? (
                        <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                      ) : (
                        <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      )}
                      <span>{testResult.message}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Table Schema Info */}
              <div className="p-3.5 rounded-xl bg-[#0b0e14] border border-slate-800 text-[11px] text-slate-400 space-y-1.5">
                <span className="font-semibold text-slate-300 block text-xs">Yêu cầu bảng `trades` trên Supabase:</span>
                <p>
                  Các trường bắt buộc: <code className="text-cyan-300">ticket</code>, <code className="text-cyan-300">symbol</code>, <code className="text-cyan-300">type</code> (BUY/SELL), <code className="text-cyan-300">volume</code>, <code className="text-cyan-300">open_price</code>, <code className="text-cyan-300">close_price</code>, <code className="text-cyan-300">pnl</code>, <code className="text-cyan-300">commission</code>, <code className="text-cyan-300">swap</code>, <code className="text-cyan-300">initial_balance</code>, <code className="text-cyan-300">open_time</code>, <code className="text-cyan-300">close_time</code>, <code className="text-cyan-300">status</code> ('CLOSED' / 'OPEN'), <code className="text-cyan-300">account_id</code>.
                </p>
                <p className="text-slate-500">
                  Hệ thống tự động thực hiện truy vấn: <code className="text-slate-400 font-mono">.from('trades').select('*').eq('status', 'CLOSED').order('close_time', &#123; ascending: true &#125;)</code>
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-[#121824] border-t border-slate-800 flex items-center justify-between">
          <span className="text-[11px] text-slate-500">Thiết lập tự động đồng bộ hóa phiên giao dịch</span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md shadow-blue-900/30"
            >
              Lưu Cấu Hình
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
