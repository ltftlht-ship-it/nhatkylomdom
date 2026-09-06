import React, { useState, useEffect, useRef } from 'react';
import { TradingPlan, TradeRow, PreChecklistItem, SetupTagItem } from '../types';
import { supabase, fetchPlansFromSupabase, savePlanToSupabase } from '../lib/supabase';
import { compressImage, uploadImageToSupabaseStorage } from '../utils/imageUtils';
import { 
  Compass, 
  Plus, 
  Check, 
  Clock, 
  Tag, 
  Image as ImageIcon, 
  Trash2, 
  Maximize2, 
  Upload, 
  FileText, 
  CheckCircle2, 
  Sparkles, 
  ArrowRight, 
  AlertCircle,
  FolderOpen,
  Filter,
  Layers,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

interface PlansTabProps {
  plans: TradingPlan[];
  trades?: TradeRow[];
  accountId?: string;
  selectedAccountId?: string;
  preChecklist: PreChecklistItem[];
  setupTags: SetupTagItem[];
  onAddPlan?: (plan: TradingPlan) => Promise<void> | void;
  onReloadPlans?: () => Promise<void> | void;
  onUpdatePlanStatus?: (planId: string, status: 'PENDING' | 'EXECUTED' | 'CANCELLED') => void;
  onNavigateToHistory: () => void;
  onViewImage: (url: string, title: string) => void;
  onSelectTrade?: (trade: TradeRow) => void;
}

// Hàm sinh tên Plan theo chuẩn [Symbol] - [YYYY-MM-DD HH:mm]
function generateAutoPlanName(sym: string): string {
  const cleanSym = (sym || 'EURUSD').replace('/', '').trim().toUpperCase();
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  return `${cleanSym} - ${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

const COMMON_SYMBOLS = ['EURUSD', 'XAUUSD', 'GBPUSD', 'BTCUSD', 'USDJPY', 'US30'];
const TIMEFRAMES = ['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'];

export const PlansTab: React.FC<PlansTabProps> = ({
  plans,
  trades = [],
  accountId = '26325348',
  selectedAccountId,
  preChecklist,
  setupTags,
  onAddPlan,
  onReloadPlans,
  onUpdatePlanStatus,
  onNavigateToHistory,
  onViewImage,
  onSelectTrade
}) => {
  const [showAddForm, setShowAddForm] = useState(false);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING' | 'EXECUTED'>('ALL');

  const cleanAccountId = String(accountId || '').replace(/^acc-/, '').trim();

  // Form State
  const [symbol, setSymbol] = useState('EURUSD');
  const [planName, setPlanName] = useState(() => generateAutoPlanName('EURUSD'));
  const [isNameManuallyEdited, setIsNameManuallyEdited] = useState(false);
  const [timeframe, setTimeframe] = useState('M15');
  const [setup, setSetup] = useState('POI sau IDM');
  const [notes, setNotes] = useState('');
  const [selectedChecklist, setSelectedChecklist] = useState<string[]>(['bias', 'poi', 'liquidity', 'sl_safe']);
  const [preTradeImage, setPreTradeImage] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // File input ref
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  // Khi symbol thay đổi, nếu người dùng chưa tự gõ tay tên khác thì tự động cập nhật plan_name
  const handleSymbolChange = (newSym: string) => {
    setSymbol(newSym);
    if (!isNameManuallyEdited) {
      setPlanName(generateAutoPlanName(newSym));
    }
  };

  // Reset form và tạo tên mới khi mở form
  const handleOpenForm = () => {
    const freshName = generateAutoPlanName(symbol);
    setPlanName(freshName);
    setIsNameManuallyEdited(false);
    setShowAddForm(true);
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // TÍNH NĂNG DÁN ẢNH (Ctrl + V) trên form hoặc toàn window khi form mở
  useEffect(() => {
    if (!showAddForm) return;

    const handleWindowPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) {
            try {
              const { blob, dataUrl } = await compressImage(file, 1600, 0.78);
              setPreTradeImage(dataUrl);
              const cleanSym = (symbol || 'EURUSD').replace('/', '');
              const fileName = `plan_${cleanSym}_${Date.now()}.webp`;
              const storageUrl = await uploadImageToSupabaseStorage(blob, fileName, 'trade-images');
              if (storageUrl) {
                setPreTradeImage(storageUrl);
              }
            } catch (err) {
              console.warn('Lỗi xử lý paste ảnh plan:', err);
            }
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => {
      window.removeEventListener('paste', handleWindowPaste);
    };
  }, [showAddForm, symbol]);

  // Xử lý chọn file ảnh từ máy tính
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const { blob, dataUrl } = await compressImage(file, 1600, 0.78);
        setPreTradeImage(dataUrl);
        const cleanSym = (symbol || 'EURUSD').replace('/', '');
        const fileName = `plan_${cleanSym}_${Date.now()}.webp`;
        const storageUrl = await uploadImageToSupabaseStorage(blob, fileName, 'trade-images');
        if (storageUrl) {
          setPreTradeImage(storageUrl);
        }
      } catch (err) {
        console.warn('Lỗi xử lý chọn file ảnh plan:', err);
      }
    }
  };

  // Xử lý Toggle Checklist item
  const toggleChecklist = (id: string) => {
    setSelectedChecklist(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  // 1. Hàm lưu Plan trực tiếp xuống Supabase database
  async function handleSavePlan(planData: {
    symbol: string;
    timeframe: string;
    setup: string;
    notes: string;
    imageUrl: string;
    checklist: string[];
    plan_name?: string;
  }) {
    // Lấy account_id từ Global State đang chọn trên Header
    const currentAccountId = selectedAccountId || accountId; 

    // Đảm bảo không lưu chuỗi base64 nặng hàng megabyte vào bảng plans
    let cleanImageUrl = planData.imageUrl || '';
    if (cleanImageUrl.startsWith('data:image')) {
      try {
        const res = await fetch(cleanImageUrl);
        const blob = await res.blob();
        const uploaded = await uploadImageToSupabaseStorage(blob, `plan_${Date.now()}.webp`, 'trade-images');
        if (uploaded) {
          cleanImageUrl = uploaded;
        } else {
          cleanImageUrl = '';
        }
      } catch {
        cleanImageUrl = '';
      }
    }

    const newPlan: TradingPlan = {
      id: `plan-${Date.now()}`,
      account_id: currentAccountId,
      symbol: planData.symbol,
      plan_name: planData.plan_name?.trim() || `${planData.symbol} - ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`,
      timeframe: planData.timeframe,
      setup: planData.setup,
      notes: planData.notes,
      image_url: cleanImageUrl,
      checklist: planData.checklist,
      status: 'PENDING',
      created_at: new Date().toISOString(),
    };

    if (onAddPlan) {
      await onAddPlan(newPlan);
    } else {
      await savePlanToSupabase(newPlan);
    }

    if (onReloadPlans) {
      await onReloadPlans();
    }
    return true;
  }

  // Lưu Plan khi bấm submit Form tạo Plan (Tab Plan)
  const handleSubmitPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim() || !planName.trim()) return;

    setIsSubmitting(true);
    const finalName = planName.trim() || generateAutoPlanName(symbol);

    try {
      const ok = await handleSavePlan({
        symbol: symbol.toUpperCase().trim(),
        timeframe,
        setup: setup.trim(),
        notes: notes.trim(),
        imageUrl: preTradeImage,
        checklist: selectedChecklist,
        plan_name: finalName
      });

      if (ok) {
        setSuccessToast(`Đã lưu Plan "${finalName}" thành công xuống Supabase (Status: PENDING)!`);
        setTimeout(() => setSuccessToast(null), 5000);

        // Reset form
        setShowAddForm(false);
        setNotes('');
        setPreTradeImage('');
        setIsNameManuallyEdited(false);
      }
    } catch (err: any) {
      console.error('Lỗi khi lưu Plan:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Lọc danh sách plans theo Tài khoản đang chọn và Filter trạng thái
  const filteredPlans = plans.filter(p => {
    if (cleanAccountId && cleanAccountId !== 'ALL') {
      const pAcc = String(p.account_id || '').replace(/^acc-/, '').trim();
      if (pAcc && pAcc !== cleanAccountId) return false;
    }
    if (activeFilter === 'ALL') return true;
    if (activeFilter === 'PENDING') return p.status === 'PENDING' || p.status === 'READY';
    if (activeFilter === 'EXECUTED') return p.status === 'EXECUTED' || p.status === 'TRIGGERED';
    return true;
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toast thông báo */}
      {successToast && (
        <div className="p-3 bg-emerald-950/90 border border-emerald-500/60 rounded-xl text-emerald-200 text-xs font-semibold flex items-center justify-between shadow-lg shadow-emerald-950/40 animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{successToast}</span>
          </div>
          <button
            type="button"
            onClick={onNavigateToHistory}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-emerald-800/80 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors"
          >
            <span>Đến Bảng Lịch Sử để Map lệnh</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#0f141f] border border-slate-800 p-4 rounded-2xl">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Compass className="w-5 h-5 text-cyan-400" />
              <span>Kế Hoạch Giao Dịch (Plan-First Workflow)</span>
            </h2>
            <span className="px-2 py-0.5 rounded bg-blue-950/80 border border-blue-500/40 text-cyan-300 font-mono text-[11px] font-bold">
              {cleanAccountId === 'ALL' ? 'Tất cả tài khoản (ALL)' : `MT5 #${cleanAccountId}`}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Lập kế hoạch phân tích trước phiên (Pre-trade), dán ảnh Ctrl+V, lưu trạng thái <span className="text-amber-400 font-bold">PENDING</span> và 1-Click Mapping chuẩn xác theo tài khoản MT5.
          </p>
        </div>
        
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onNavigateToHistory}
            className="px-3 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-slate-300 text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <span>Xem Bảng Lịch Sử</span>
          </button>
          <button
            type="button"
            onClick={handleOpenForm}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white text-xs font-bold transition-all shadow-lg shadow-cyan-900/30"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Kế Hoạch (Plan) Mới</span>
          </button>
        </div>
      </div>

      {/* FORM TẠO KẾ HOẠCH (PLAN-FIRST FORM) */}
      {showAddForm && (
        <div ref={formRef} className="rounded-2xl bg-[#111724] border border-cyan-500/40 shadow-2xl p-4 sm:p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-cyan-400" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Lập Kế Hoạch Giao Dịch Mới</h3>
                <span className="text-[11px] text-slate-400">Trạng thái ban đầu: <strong className="text-amber-400 font-mono">PENDING</strong></span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="text-slate-400 hover:text-slate-200 text-xs px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Đóng form
            </button>
          </div>

          <form onSubmit={handleSubmitPlan} className="space-y-4">
            {/* ROW 1: Symbol & Tên Plan tự động */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Symbol */}
              <div className="md:col-span-4">
                <label className="block text-slate-300 font-semibold text-xs mb-1">
                  1. Cặp tiền (Symbol) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={symbol}
                  onChange={(e) => handleSymbolChange(e.target.value)}
                  placeholder="VD: EURUSD, XAUUSD..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white font-mono font-bold text-xs uppercase focus:border-cyan-400 focus:outline-none"
                  required
                />
                {/* Gợi ý Symbol nhanh */}
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {COMMON_SYMBOLS.map(sym => (
                    <button
                      key={sym}
                      type="button"
                      onClick={() => handleSymbolChange(sym)}
                      className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold border transition-colors ${
                        symbol.toUpperCase().replace('/', '') === sym
                          ? 'bg-cyan-950 border-cyan-500 text-cyan-300'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {sym}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tên Plan Tự Động sinh: [Symbol] - [YYYY-MM-DD HH:mm] */}
              <div className="md:col-span-8">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-300 font-semibold text-xs">
                    Tên Kế Hoạch (<code className="text-cyan-400 font-mono">plan_name</code>)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setPlanName(generateAutoPlanName(symbol));
                      setIsNameManuallyEdited(false);
                    }}
                    className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
                    title="Sinh lại tên theo thời điểm hiện tại"
                  >
                    <Clock className="w-3 h-3" />
                    <span>Lấy giờ hiện tại</span>
                  </button>
                </div>
                <input
                  type="text"
                  value={planName}
                  onChange={(e) => {
                    setPlanName(e.target.value);
                    setIsNameManuallyEdited(true);
                  }}
                  placeholder="[Symbol] - [YYYY-MM-DD HH:mm]"
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-cyan-300 font-mono font-bold text-xs focus:border-cyan-400 focus:outline-none"
                  required
                />
                <span className="text-[10px] text-slate-500 mt-1 block">
                  Định dạng chuẩn: <span className="font-mono text-slate-400">[Symbol] - [YYYY-MM-DD HH:mm]</span> (tự động cập nhật khi đổi Symbol)
                </span>
              </div>
            </div>

            {/* ROW 2: Timeframe & Setup */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
              {/* Timeframe */}
              <div className="md:col-span-4">
                <label className="block text-slate-300 font-semibold text-xs mb-1">
                  2. Khung thời gian (Timeframe) <span className="text-rose-400">*</span>
                </label>
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 font-bold text-xs focus:border-cyan-400 focus:outline-none"
                >
                  {TIMEFRAMES.map(tf => (
                    <option key={tf} value={tf}>{tf}</option>
                  ))}
                </select>
              </div>

              {/* Setup */}
              <div className="md:col-span-8">
                <label className="block text-slate-300 font-semibold text-xs mb-1">
                  3. Setup / Mô hình vào lệnh <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={setup}
                  onChange={(e) => setSetup(e.target.value)}
                  placeholder="VD: Cực Trị, POI sau IDM, Sweep IDM, Breaker Block..."
                  className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs focus:border-cyan-400 focus:outline-none"
                  required
                />
                {/* Gợi ý Setup nhanh */}
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {setupTags.map(tag => (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => setSetup(tag.label)}
                      className={`text-[10px] px-2 py-0.5 rounded font-medium border transition-colors ${
                        setup === tag.label
                          ? 'bg-blue-950 border-blue-500 text-blue-300'
                          : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* ROW 3: Ghi chú phân tích */}
            <div>
              <label className="block text-slate-300 font-semibold text-xs mb-1">
                4. Ghi chú phân tích & Vùng giá (Notes)
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Nhận định cấu trúc HTF, Orderflow, vùng POI cần canh, điều kiện xác nhận (LTF CHoCH / Flip), tin tức sắp ra..."
                className="w-full px-3 py-2 rounded-lg bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:border-cyan-400 focus:outline-none leading-relaxed"
              />
            </div>

            {/* ROW 4: Checklist Kỷ Luật */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-semibold text-xs flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>5. Checklist Kỷ Luật & Điều Kiện Vào Lệnh ({selectedChecklist.length}/{preChecklist.length})</span>
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedChecklist(preChecklist.map(c => c.id))}
                    className="text-[10px] text-cyan-400 hover:underline"
                  >
                    Chọn tất cả
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedChecklist([])}
                    className="text-[10px] text-slate-500 hover:underline"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-3 rounded-xl bg-slate-900/80 border border-slate-800">
                {preChecklist.map(item => {
                  const isChecked = selectedChecklist.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      onClick={() => toggleChecklist(item.id)}
                      className={`flex items-start gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-200 font-medium'
                          : 'bg-slate-950/40 border-slate-800/80 text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}} // Controlled via label click
                        className="mt-0.5 rounded border-slate-700 text-cyan-500 focus:ring-0"
                      />
                      <span className="flex-1 leading-tight">{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* ROW 5: DÁN ẢNH (Ctrl + V) & TẢI ẢNH PRE-TRADE */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-slate-300 font-semibold text-xs flex items-center gap-1.5">
                  <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                  <span>6. Ảnh Phân Tích Pre-Trade (Hỗ trợ phím tắt Ctrl + V)</span>
                </label>
                {preTradeImage && (
                  <button
                    type="button"
                    onClick={() => setPreTradeImage('')}
                    className="text-rose-400 hover:text-rose-300 text-[11px] flex items-center gap-1"
                  >
                    <Trash2 className="w-3 h-3" />
                    <span>Xóa ảnh</span>
                  </button>
                )}
              </div>

              {/* Box dán ảnh / preview */}
              <div
                tabIndex={0}
                className={`relative rounded-xl border-2 border-dashed p-4 transition-all flex flex-col items-center justify-center min-h-[160px] cursor-pointer focus:outline-none ${
                  preTradeImage 
                    ? 'border-cyan-500/50 bg-slate-950/60' 
                    : 'border-slate-700 hover:border-cyan-500/40 bg-slate-900/40 hover:bg-slate-900/60'
                }`}
                onClick={() => {
                  if (!preTradeImage) fileInputRef.current?.click();
                }}
              >
                {preTradeImage ? (
                  <div className="w-full relative group">
                    <img
                      src={preTradeImage}
                      alt="Pre-trade analysis preview"
                      className="max-h-72 w-auto mx-auto object-contain rounded-lg shadow-lg"
                    />
                    <div className="absolute top-2 right-2 flex gap-1.5">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewImage(preTradeImage, `Pre-trade Analysis - ${planName}`);
                        }}
                        className="p-1.5 rounded-lg bg-black/70 hover:bg-black text-white text-xs flex items-center gap-1"
                        title="Xem toàn màn hình"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Xem to</span>
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fileInputRef.current?.click();
                        }}
                        className="p-1.5 rounded-lg bg-black/70 hover:bg-black text-cyan-300 text-xs flex items-center gap-1"
                        title="Đổi ảnh khác"
                      >
                        <FolderOpen className="w-3.5 h-3.5" />
                        <span>Đổi ảnh</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center space-y-2 py-4">
                    <div className="w-10 h-10 rounded-full bg-cyan-950/60 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400">
                      <Upload className="w-5 h-5" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-200 font-semibold">
                        Bấm phím <kbd className="px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-400 font-mono font-bold">Ctrl + V</kbd> bất kỳ lúc nào để dán ảnh chụp từ Clipboard
                      </p>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        hoặc bấm vào khung này để chọn ảnh từ máy tính (PNG, JPG, WebP)
                      </p>
                    </div>
                  </div>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageFileChange}
                  className="hidden"
                />
              </div>
            </div>

            {/* ACTION BUTTONS */}
            <div className="flex items-center justify-between pt-3 border-t border-slate-800">
              <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-cyan-400" />
                <span>Kế hoạch sau khi lưu sẽ có trạng thái <strong className="text-amber-400 font-mono">PENDING</strong> và sẵn sàng để 1-Click Map vào lệnh MT5.</span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition-colors"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-lg shadow-cyan-900/30 flex items-center gap-2"
                >
                  <Check className="w-4 h-4" />
                  <span>{isSubmitting ? 'Đang lưu...' : 'Lưu Kế Hoạch (PENDING)'}</span>
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* FILTER & STATS BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 font-medium">Lọc trạng thái:</span>
          <div className="inline-flex rounded-lg bg-slate-900 p-0.5 border border-slate-800 text-xs">
            <button
              type="button"
              onClick={() => setActiveFilter('ALL')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                activeFilter === 'ALL'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Tất cả ({plans.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('PENDING')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                activeFilter === 'PENDING'
                  ? 'bg-amber-600 text-white shadow-sm'
                  : 'text-amber-400 hover:text-amber-300'
              }`}
            >
              Chờ khớp (PENDING) ({plans.filter(p => p.status === 'PENDING' || p.status === 'READY').length})
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('EXECUTED')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                activeFilter === 'EXECUTED'
                  ? 'bg-emerald-600 text-white shadow-sm'
                  : 'text-emerald-400 hover:text-emerald-300'
              }`}
            >
              Đã khớp (EXECUTED) ({plans.filter(p => p.status === 'EXECUTED' || p.status === 'TRIGGERED').length})
            </button>
          </div>
        </div>

        <span className="text-xs text-slate-400 font-mono">
          Tổng cộng: <strong className="text-cyan-400 font-bold">{filteredPlans.length}</strong> kế hoạch
        </span>
      </div>

      {/* DANH SÁCH PLANS */}
      {filteredPlans.length === 0 ? (
        <div className="text-center py-16 bg-[#0d121c] rounded-2xl border border-slate-800 p-6 space-y-3">
          <Compass className="w-10 h-10 text-slate-600 mx-auto" />
          <h3 className="text-sm font-bold text-slate-300">Không có kế hoạch nào trong danh mục này</h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Hãy bắt đầu quy trình "Plan-First" bằng cách tạo kế hoạch trước khi vào lệnh để giữ vững kỷ luật giao dịch.
          </p>
          <button
            type="button"
            onClick={handleOpenForm}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-all shadow-md"
          >
            <Plus className="w-4 h-4" />
            <span>Tạo Kế Hoạch Đầu Tiên</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredPlans.map(plan => {
            const isExecuted = plan.status === 'EXECUTED' || plan.status === 'TRIGGERED';
            const mappedTrades = trades.filter(t => t.plan_id === plan.id);
            const totalMappedVolume = mappedTrades.reduce((sum, t) => sum + (Number(t.volume) || 0), 0);
            const totalMappedPnl = mappedTrades.reduce((sum, t) => sum + (Number(t.net_pnl ?? t.pnl) || 0), 0);

            return (
              <div
                key={plan.id}
                className="p-4 rounded-2xl bg-[#111724] border border-slate-800 hover:border-slate-700 flex flex-col justify-between space-y-3 transition-all group shadow-sm"
              >
                <div>
                  {/* Card Header */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-cyan-400 font-black text-xs px-2 py-0.5 rounded bg-cyan-950/60 border border-cyan-800/40">
                      {plan.symbol}
                    </span>

                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] font-mono font-bold text-slate-300 px-1.5 py-0.5 rounded bg-slate-900 border border-slate-800">
                        {plan.timeframe}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                          isExecuted
                            ? 'bg-emerald-950 text-emerald-400 border-emerald-500/40'
                            : 'bg-amber-950 text-amber-300 border-amber-500/40 animate-pulse'
                        }`}
                      >
                        {isExecuted ? 'EXECUTED' : 'PENDING'}
                      </span>
                    </div>
                  </div>

                  {/* Plan Name */}
                  <h3 className="text-sm font-bold text-white leading-snug group-hover:text-cyan-300 transition-colors">
                    {plan.plan_name || plan.title}
                  </h3>

                  {/* Setup & Time */}
                  <div className="flex items-center gap-2 mt-1.5 text-xs text-slate-400">
                    <span className="inline-flex items-center gap-1 text-slate-300 font-medium">
                      <Tag className="w-3 h-3 text-cyan-400" />
                      {plan.setup || 'Setup Tiêu Chuẩn'}
                    </span>
                    <span className="text-slate-600">•</span>
                    <span className="text-slate-400 font-mono text-[11px]">{plan.created_at}</span>
                  </div>

                  {/* Pre-trade Image Thumbnail */}
                  {plan.image_url ? (
                    <div 
                      className="mt-3 relative h-36 rounded-xl overflow-hidden bg-slate-950 border border-slate-800 cursor-pointer group/img"
                      onClick={() => onViewImage(plan.image_url!, `Kế hoạch: ${plan.plan_name}`)}
                    >
                      <img
                        src={plan.image_url}
                        alt={plan.plan_name}
                        className="w-full h-full object-cover group-hover/img:scale-105 transition-transform duration-300"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent flex items-end p-2.5">
                        <span className="text-[10px] text-cyan-300 font-semibold flex items-center gap-1">
                          <Maximize2 className="w-3 h-3" />
                          <span>Ảnh Pre-Trade (Click để phóng to)</span>
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 p-3 rounded-xl bg-slate-950/60 border border-dashed border-slate-800 text-center">
                      <span className="text-[11px] text-slate-500 italic">Chưa có ảnh Pre-trade</span>
                    </div>
                  )}

                  {/* Notes snippet */}
                  {plan.notes && (
                    <p className="mt-2.5 text-xs text-slate-300 bg-slate-900/70 p-2 rounded-lg border border-slate-800/80 line-clamp-2 leading-relaxed">
                      "{plan.notes}"
                    </p>
                  )}

                  {/* Checklist count */}
                  {plan.checklist && plan.checklist.length > 0 && (
                    <div className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                      <span>Đã đạt <strong>{plan.checklist.length}</strong> tiêu chí kỷ luật</span>
                    </div>
                  )}
                </div>

                {/* Card Footer: Lệnh đã map (1 Plan -> Nhiều Lệnh) */}
                <div className="pt-3 border-t border-slate-800/80 space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-400 flex items-center gap-1 text-[11px]">
                      <Layers className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Đã map: <strong>{mappedTrades.length}</strong> lệnh</span>
                    </span>

                    {mappedTrades.length > 0 && (
                      <span className={`font-mono text-xs font-bold ${
                        totalMappedPnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}>
                        {totalMappedPnl >= 0 ? `+$${totalMappedPnl.toFixed(2)}` : `-$${Math.abs(totalMappedPnl).toFixed(2)}`}
                      </span>
                    )}
                  </div>

                  {mappedTrades.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {mappedTrades.map(tr => (
                        <button
                          key={tr.id}
                          type="button"
                          onClick={() => {
                            if (onSelectTrade) onSelectTrade(tr);
                            onNavigateToHistory();
                          }}
                          className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-cyan-300 transition-colors flex items-center gap-1"
                          title={`Xem chi tiết lệnh #${tr.ticket} trên bảng lịch sử`}
                        >
                          <span>#{tr.ticket}</span>
                          <span className="text-slate-500">({tr.volume}L)</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Quick Action */}
                  <button
                    type="button"
                    onClick={onNavigateToHistory}
                    className="w-full mt-1 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[11px] font-medium transition-colors flex items-center justify-center gap-1.5"
                  >
                    <span>Xem trên Bảng Lịch Sử</span>
                    <ChevronRight className="w-3 h-3 text-cyan-400" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
