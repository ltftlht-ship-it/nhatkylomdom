import React, { useState, useEffect } from 'react';
import { 
  X, 
  Upload, 
  FileText, 
  Database, 
  Check, 
  Sparkles, 
  AlertCircle,
  PlusCircle
} from 'lucide-react';
import { TradeRow, TradeType } from '../types';
import { computeTradeMetrics } from '../utils/tradeCalculations';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportTrades: (trades: TradeRow[]) => void;
  onResetDemoData: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportTrades,
  onResetDemoData,
}) => {
  const [importMode, setImportMode] = useState<'paste' | 'manual'>('paste');
  const [pastedJson, setPastedJson] = useState<string>('');
  const [errorMsg, setErrorMsg] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState<string>('');

  // Manual Form State
  const [symbol, setSymbol] = useState('XAU/USD');
  const [type, setType] = useState<TradeType>('BUY');
  const [volume, setVolume] = useState('0.30');
  const [openPrice, setOpenPrice] = useState('4520.00');
  const [closePrice, setClosePrice] = useState('4545.00');
  const [initialSl, setInitialSl] = useState('4505.00');
  const [pnl, setPnl] = useState('750.00');

  // Handle Escape key to close modal
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.key === 'Esc') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleProcessPastedData = () => {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      if (!pastedJson.trim()) {
        setErrorMsg('Vui lòng dán chuỗi JSON hoặc báo cáo MT5');
        return;
      }

      const parsed = JSON.parse(pastedJson);
      let list: any[] = [];
      if (Array.isArray(parsed)) {
        list = parsed;
      } else if (parsed.trades && Array.isArray(parsed.trades)) {
        list = parsed.trades;
      } else {
        list = [parsed];
      }

      const formatted = list.map(item => computeTradeMetrics(item));
      onImportTrades(formatted);
      setSuccessMsg(`Đã nạp thành công ${formatted.length} lệnh từ MT5!`);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (e: any) {
      setErrorMsg('Định dạng JSON không hợp lệ. Hãy kiểm tra lại cấu trúc dữ liệu.');
    }
  };

  const handleManualAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const newTrade = computeTradeMetrics({
      ticket: String(Math.floor(550000000 + Math.random() * 9999999)),
      position_id: String(Math.floor(550000000 + Math.random() * 9999999)),
      symbol,
      type,
      volume: parseFloat(volume) || 0.1,
      open_price: parseFloat(openPrice) || 0,
      close_price: parseFloat(closePrice) || 0,
      initial_sl: parseFloat(initialSl) || 0,
      pnl: parseFloat(pnl) || 0,
      commission: -2.5,
      swap: 0,
      open_time: new Date().toISOString().replace('T', ' ').slice(0, 19),
      close_time: new Date().toISOString().replace('T', ' ').slice(0, 19),
      timeframe: 'M15',
      session: 'Mỹ',
      pre_checklist_ids: ['bias', 'poi', 'liquidity'],
      post_checklist_ids: [],
      notes: 'Lệnh nhập thủ công từ giao diện.',
      status: 'CLOSED',
    });

    onImportTrades([newTrade]);
    setSuccessMsg(`Đã thêm lệnh #${newTrade.ticket} thành công!`);
    setTimeout(() => {
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 select-none">
      <div className="bg-[#0f141d] border border-slate-700 rounded-xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 bg-[#121824] border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-blue-600/20 text-blue-400">
              <Upload className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Nạp Import Dữ Liệu Lịch Sử MT5</h3>
              <p className="text-[11px] text-slate-400">Đồng bộ tự động qua webhook EA hoặc dán file báo cáo</p>
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

        {/* Mode Switcher */}
        <div className="px-5 pt-3 bg-[#0d1117] border-b border-slate-800 flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setImportMode('paste')}
              className={`pb-2.5 px-2 font-semibold border-b-2 transition-colors ${
                importMode === 'paste'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              Dán Dữ Liệu JSON / EA
            </button>
            <button
              type="button"
              onClick={() => setImportMode('manual')}
              className={`pb-2.5 px-2 font-semibold border-b-2 transition-colors ${
                importMode === 'manual'
                  ? 'border-cyan-400 text-cyan-300'
                  : 'border-transparent text-slate-400 hover:text-slate-300'
              }`}
            >
              Nhập Thủ Công
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              onResetDemoData();
              setSuccessMsg('Đã khôi phục dữ liệu demo mẫu hoàn chỉnh!');
              setTimeout(onClose, 800);
            }}
            className="flex items-center gap-1.5 pb-2 text-[11px] text-amber-400 hover:text-amber-300 font-semibold"
            title="Khôi phục đầy đủ các lệnh mẫu có gom cụm 1.1, 1.2, FOMO, và Cắt non"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-400" />
            <span>Nạp Lại Dữ Liệu Mẫu Đầy Đủ</span>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/40 text-emerald-300 flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {importMode === 'paste' ? (
            <div className="space-y-3">
              <p className="text-slate-400 leading-relaxed">
                Dán chuỗi mảng JSON chứa các lệnh từ MT5 Expert Advisor (EA) hoặc hệ thống đồng bộ Supabase:
              </p>
              <textarea
                rows={7}
                value={pastedJson}
                onChange={(e) => setPastedJson(e.target.value)}
                placeholder='[
  {
    "ticket": "55890011",
    "symbol": "XAU/USD",
    "type": "BUY",
    "volume": 0.40,
    "open_price": 4518.50,
    "close_price": 4550.00,
    "initial_sl": 4500.00,
    "pnl": 1260.00
  }
]'
                className="w-full bg-[#111622] border border-slate-700 rounded-lg p-3 font-mono text-[11px] text-slate-200 focus:outline-none focus:border-cyan-500/50"
              />

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleProcessPastedData}
                  className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-md shadow-blue-900/30"
                >
                  Xác Nhận Nạp Lệnh
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleManualAdd} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Cặp Tiền</label>
                  <input
                    type="text"
                    value={symbol}
                    onChange={(e) => setSymbol(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#111622] border border-slate-700 text-slate-200 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-medium mb-1">Loại Lệnh</label>
                  <select
                    value={type}
                    onChange={(e) => setType(e.target.value as TradeType)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#111622] border border-slate-700 text-slate-200 font-bold"
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 font-mono">
                <div>
                  <label className="block text-slate-400 font-sans font-medium mb-1">Khối lượng (Lot)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={volume}
                    onChange={(e) => setVolume(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#111622] border border-slate-700 text-slate-200 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-sans font-medium mb-1">Giá Vào</label>
                  <input
                    type="number"
                    step="0.01"
                    value={openPrice}
                    onChange={(e) => setOpenPrice(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#111622] border border-slate-700 text-slate-200 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-sans font-medium mb-1">Giá Đóng</label>
                  <input
                    type="number"
                    step="0.01"
                    value={closePrice}
                    onChange={(e) => setClosePrice(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#111622] border border-slate-700 text-slate-200 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 font-mono">
                <div>
                  <label className="block text-slate-400 font-sans font-medium mb-1">Stop Loss Ban Đầu</label>
                  <input
                    type="number"
                    step="0.01"
                    value={initialSl}
                    onChange={(e) => setInitialSl(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#111622] border border-slate-700 text-rose-300 font-bold"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 font-sans font-medium mb-1">PnL Thực Nhận ($)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={pnl}
                    onChange={(e) => setPnl(e.target.value)}
                    className="w-full px-2.5 py-1.5 rounded bg-[#111622] border border-slate-700 text-emerald-400 font-bold"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition-all shadow-md shadow-emerald-900/30 flex items-center gap-1.5"
                >
                  <PlusCircle className="w-3.5 h-3.5" />
                  <span>Thêm Lệnh Vào Lịch Sử</span>
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
