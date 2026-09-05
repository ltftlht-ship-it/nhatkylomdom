import React, { useState, useRef, useEffect } from 'react';
import { 
  TradeRow, 
  TradingPlan, 
  PreChecklistItem, 
  PostMistakeItem, 
  SetupTagItem 
} from '../types';
import { 
  formatCurrency, 
  formatDuration, 
  formatSessionLabel, 
  calculatePreTradeScore,
  formatDateTimeWithOffset,
  getSavedTimezoneOffset
} from '../utils/tradeCalculations';
import { fetchPlansForTrade } from '../lib/supabase';
import { 
  FolderOpen, 
  Maximize2, 
  Trash2, 
  Settings as SettingsIcon, 
  Check, 
  AlertTriangle, 
  Flame, 
  Clock, 
  Target, 
  Link2, 
  ChevronDown, 
  CheckCircle2, 
  Image as ImageIcon,
  DollarSign,
  TrendingDown,
  Info,
  Sparkles,
  RefreshCw,
  X
} from 'lucide-react';

interface TradeDetailCardProps {
  trade?: TradeRow | null;
  plans: TradingPlan[];
  accountId?: string;
  preChecklistItems: PreChecklistItem[];
  postMistakeItems: PostMistakeItem[];
  setupTags: SetupTagItem[];
  timezoneOffset?: number;
  onUpdateTrade: (updated: TradeRow) => void;
  onMapPlanToTrade?: (tradeId: string, planId: string | null, planObj?: TradingPlan) => void;
  onOpenSettingsModal: () => void;
  onViewImage: (imgUrl: string, title: string) => void;
}

export const TradeDetailCard: React.FC<TradeDetailCardProps> = ({
  trade,
  plans,
  accountId = '26325348',
  preChecklistItems,
  postMistakeItems,
  setupTags,
  timezoneOffset,
  onUpdateTrade,
  onMapPlanToTrade,
  onOpenSettingsModal,
  onViewImage
}) => {
  const activeOffset = timezoneOffset !== undefined ? timezoneOffset : getSavedTimezoneOffset();
  const [activePlanDropdown, setActivePlanDropdown] = useState(false);
  const [fetchedTradePlans, setFetchedTradePlans] = useState<TradingPlan[] | null>(null);
  const [isLoadingTradePlans, setIsLoadingTradePlans] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('Tự động lưu khi nhập');
  const htfFileInputRef = useRef<HTMLInputElement>(null);
  const ltfFileInputRef = useRef<HTMLInputElement>(null);

  if (!trade) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[#0d1117] rounded-xl border border-slate-800/80">
        <div className="w-12 h-12 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-3">
          <Clock className="w-6 h-6 text-slate-500 animate-pulse" />
        </div>
        <h3 className="text-sm font-bold text-slate-200">Chờ dữ liệu từ MT5...</h3>
        <p className="text-xs text-slate-500 mt-1.5 max-w-xs leading-relaxed">
          Chưa có lệnh nào được chọn hoặc đang chờ đồng bộ dữ liệu giao dịch từ Supabase.
        </p>
      </div>
    );
  }

  const isBuy = trade.type === 'BUY';
  const isWin = trade.result === 'Win';
  const isLoss = trade.result === 'Loss';
  const duration = formatDuration(trade.open_time, trade.close_time);
  const sessionLabel = formatSessionLabel(trade.session);

  // Pre-trade score & grade
  const { score, maxScore, grade, badgeClass } = calculatePreTradeScore(
    trade.pre_checklist_ids,
    preChecklistItems
  );

  // Check if Early Exit (Cắt non) is selected
  const hasCutEarly = trade.post_checklist_ids.includes('cut_early');
  const currentPlan = plans.find(p => p.id === trade.plan_id);

  // Flash save feedback
  const triggerSaveNotification = () => {
    setSaveStatus('Đã lưu thay đổi ✓');
    setTimeout(() => {
      setSaveStatus('Tự động lưu khi nhập');
    }, 1500);
  };

  // Pre-trade image (Slot 1: image_url_1 from Plan) & Post-trade image (Slot 2: image_base64 from EA / MT5)
  const preTradeImage = trade.image_url_1 || trade.htf_image_url || currentPlan?.image_url || '';
  const postTradeImage = trade.image_base64 || trade.ltf_image_url || '';

  // Handle image upload from file picker
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'HTF' | 'LTF') => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        if (type === 'HTF') {
          onUpdateTrade({ ...trade, image_url_1: base64, htf_image_url: base64 });
        } else {
          onUpdateTrade({ ...trade, image_base64: base64, ltf_image_url: base64 });
        }
        triggerSaveNotification();
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Ctrl+V paste on image box
  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>, type: 'HTF' | 'LTF') => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => {
            const base64 = event.target?.result as string;
            if (type === 'HTF') {
              onUpdateTrade({ ...trade, image_url_1: base64, htf_image_url: base64 });
            } else {
              onUpdateTrade({ ...trade, image_base64: base64, ltf_image_url: base64 });
            }
            triggerSaveNotification();
          };
          reader.readAsDataURL(blob);
          e.preventDefault();
          break;
        }
      }
    }
  };

  // 1-Click Map Plan Handler with Metadata & Checklist Sync
  const handleSelectPlan = (planId: string | null) => {
    if (!planId) {
      onMapPlanToTrade?.(trade.id, null);
      onUpdateTrade({
        ...trade,
        plan_id: null,
        plan_name: undefined,
      });
      setActivePlanDropdown(false);
      triggerSaveNotification();
      return;
    }

    const p = (fetchedTradePlans ?? plans).find(item => item.id === planId);
    if (!p) return;

    onMapPlanToTrade?.(trade.id, p.id, p);
    onUpdateTrade({
      ...trade,
      plan_id: p.id,
      plan_name: p.plan_name || p.title,
      timeframe: (p.timeframe as any) || trade.timeframe,
      setup: p.setup || trade.setup,
      setups: p.setup ? [p.setup] : trade.setups,
      notes: p.notes ? (trade.notes ? `${p.notes}\n---\n${trade.notes}` : p.notes) : trade.notes,
      pre_checklist_ids: p.checklist && p.checklist.length > 0 ? p.checklist : trade.pre_checklist_ids,
      image_url_1: p.image_url || trade.image_url_1 || trade.htf_image_url,
      htf_image_url: p.image_url || trade.htf_image_url,
    });

    setActivePlanDropdown(false);
    triggerSaveNotification();
  };

  const handleTogglePlanDropdown = async () => {
    const nextState = !activePlanDropdown;
    setActivePlanDropdown(nextState);
    if (nextState && trade) {
      const tradeAcc = trade.account_id || accountId;
      setIsLoadingTradePlans(true);
      try {
        const result = await fetchPlansForTrade(tradeAcc, trade.symbol);
        setFetchedTradePlans(result);
      } catch (err) {
        console.warn('Lỗi fetchPlansForTrade trong TradeDetailCard:', err);
      } finally {
        setIsLoadingTradePlans(false);
      }
    }
  };

  // Toggle pre-trade checklist
  const togglePreChecklist = (id: string) => {
    const exists = trade.pre_checklist_ids.includes(id);
    const updated = exists 
      ? trade.pre_checklist_ids.filter(i => i !== id)
      : [...trade.pre_checklist_ids, id];
    onUpdateTrade({ ...trade, pre_checklist_ids: updated });
    triggerSaveNotification();
  };

  // Toggle post-trade mistake
  const togglePostMistake = (id: string) => {
    const exists = trade.post_checklist_ids.includes(id);
    const updated = exists 
      ? trade.post_checklist_ids.filter(i => i !== id)
      : [...trade.post_checklist_ids, id];
    
    // Recompute lost profit if cut_early changed
    const nowHasCutEarly = updated.includes('cut_early');
    let lostProfit = 0;
    if (nowHasCutEarly && trade.plan_pnl && trade.plan_pnl > trade.net_pnl) {
      lostProfit = Number((trade.plan_pnl - trade.net_pnl).toFixed(2));
    }

    onUpdateTrade({ 
      ...trade, 
      post_checklist_ids: updated,
      lost_profit: lostProfit
    });
    triggerSaveNotification();
  };

  // Toggle setup tag
  const toggleSetup = (label: string) => {
    const current = trade.setups || [];
    const exists = current.includes(label);
    const updated = exists ? current.filter(s => s !== label) : [...current, label];
    onUpdateTrade({ ...trade, setups: updated });
    triggerSaveNotification();
  };

  // Update Plan PnL for Lost Profit calculation
  const handlePlanPnlChange = (valStr: string) => {
    const num = parseFloat(valStr) || 0;
    let lostProfit = 0;
    if (hasCutEarly && num > trade.net_pnl) {
      lostProfit = Number((num - trade.net_pnl).toFixed(2));
    }
    onUpdateTrade({
      ...trade,
      plan_pnl: num,
      lost_profit: lostProfit
    });
    triggerSaveNotification();
  };

  return (
    <div className="bg-[#0d1117] border-t border-[#1e293b] flex flex-col select-none">
      {/* 1. THANH HEADER LỆNH (Thu gọn) */}
      <div className="px-5 py-2.5 bg-[#0f141d] border-b border-[#1e293b] flex items-center justify-between gap-4">
        {/* Left: ID, Cặp Tiền, Buy/Sell, KQ, Phiên */}
        <div className="flex items-center gap-2.5 text-xs font-mono">
          <span className="font-bold text-slate-200 text-sm">
            Lệnh #{trade.ticket}
          </span>

          <span className="px-2.5 py-0.5 rounded bg-blue-950/80 border border-blue-500/40 text-blue-300 font-bold font-sans">
            {trade.symbol}
          </span>

          <span className={`px-2 py-0.5 rounded font-bold ${
            isBuy 
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30' 
              : 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
          }`}>
            {trade.type}
          </span>

          <span className={`px-2 py-0.5 rounded font-bold ${
            isWin 
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' 
              : isLoss 
              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' 
              : 'bg-slate-800 text-slate-300 border border-slate-700'
          }`}>
            {trade.result}
          </span>

          <span className="text-slate-500 text-xs font-sans">
            Phiên: <strong className="text-slate-300">{sessionLabel}</strong>
          </span>

          {trade.sub_index && (
            <span className="text-[11px] px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-500/30 text-amber-300 font-sans">
              Scaling {trade.sub_index}
            </span>
          )}

          {trade.open_time && (
            <span className="text-[11px] text-slate-400 font-mono hidden xl:inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
              <Clock className="w-3 h-3 text-cyan-400" />
              <span>Mở: {formatDateTimeWithOffset(trade.open_time, activeOffset, 'MM-DD HH:mm')}</span>
              {trade.close_time && (
                <>
                  <span className="text-slate-600">|</span>
                  <span>Đóng: {formatDateTimeWithOffset(trade.close_time, activeOffset, 'HH:mm')}</span>
                </>
              )}
            </span>
          )}
        </div>

        {/* Right: Nút "Gán Plan" 1-Click Mapping */}
        <div className="relative">
          <button
            type="button"
            onClick={handleTogglePlanDropdown}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all max-w-[240px] ${
              currentPlan
                ? 'bg-cyan-950/80 border-cyan-500/50 text-cyan-300 shadow-sm'
                : 'bg-slate-900 border-dashed border-slate-700 hover:border-cyan-500/50 text-slate-300'
            }`}
            title="1-Click Map Kế Hoạch vào Lệnh (Lọc theo MT5 Acc & Symbol)"
          >
            <Link2 className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span className="truncate">
              {currentPlan ? `Plan: ${currentPlan.plan_name || currentPlan.code}` : '+ 1-Click Map Plan'}
            </span>
            {currentPlan && (
              <span className="text-[9px] px-1 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 font-mono">
                EXECUTED
              </span>
            )}
            <ChevronDown className="w-3 h-3 text-slate-400 shrink-0" />
          </button>

          {/* Plan Dropdown Picker */}
          {activePlanDropdown && (() => {
            const tradeAccId = trade.account_id || accountId;
            const targetAcc = String(tradeAccId || '').replace(/^acc-/, '').trim();
            const rawPlans = fetchedTradePlans ?? plans;
            const symbolPlans = rawPlans.filter(p => {
              const pAcc = String(p.account_id || '').replace(/^acc-/, '').trim();
              const matchAcc = !targetAcc || targetAcc === 'ALL' || !pAcc || pAcc === targetAcc;
              const matchSym = (p.symbol || '').replace('/', '').toUpperCase() === trade.symbol.replace('/', '').toUpperCase();
              return matchAcc && matchSym;
            });

            return (
              <div className="absolute right-0 top-9 w-84 bg-[#121824] border border-cyan-500/50 rounded-xl shadow-2xl p-3 z-40 font-sans">
                <div className="flex items-start justify-between pb-2 border-b border-slate-800 text-xs font-bold text-white">
                  <div>
                    <span className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      1-Click Map Plan cho #{trade.ticket}
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-slate-400 font-mono">
                      <span className="px-1.5 py-0.2 rounded bg-blue-950/80 text-cyan-300 border border-blue-500/30">
                        MT5 #{tradeAccId}
                      </span>
                      <span>•</span>
                      <span className="px-1.5 py-0.2 rounded bg-slate-800 text-slate-200 font-bold">
                        {trade.symbol}
                      </span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActivePlanDropdown(false)}
                    className="text-slate-400 hover:text-white p-0.5 rounded"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="py-2 text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Kế hoạch phù hợp:</span>
                  <span className="font-mono text-cyan-300 font-bold">{symbolPlans.length} Kế hoạch</span>
                </div>

                {isLoadingTradePlans ? (
                  <div className="py-6 flex flex-col items-center justify-center gap-2 text-slate-400 text-xs">
                    <RefreshCw className="w-4 h-4 text-cyan-400 animate-spin" />
                    <span>Đang lọc Plan theo MT5 #{tradeAccId} & {trade.symbol}...</span>
                  </div>
                ) : (
                  <div className="max-h-56 overflow-y-auto space-y-1.5 pr-1">
                    {currentPlan && (
                      <button
                        type="button"
                        onClick={() => handleSelectPlan(null)}
                        className="w-full text-left p-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-950/70 border border-rose-800/40 text-rose-300 text-[11px] font-medium flex items-center justify-between transition-colors"
                      >
                        <span>✕ Hủy gán Plan hiện tại</span>
                      </button>
                    )}

                    {symbolPlans.length === 0 ? (
                      <div className="p-4 text-center text-slate-400 text-xs space-y-1.5">
                        <p>Không có Plan nào thuộc MT5 #{tradeAccId} cho cặp {trade.symbol}.</p>
                        <p className="text-[11px] text-slate-500">Hãy chuyển sang tab Kế Hoạch để tạo trước khi gán.</p>
                      </div>
                    ) : (
                      symbolPlans.map(p => {
                        const isSelected = trade.plan_id === p.id;
                        const isExecuted = p.status === 'EXECUTED' || p.status === 'TRIGGERED';
                        return (
                          <button
                            key={p.id}
                            type="button"
                            onClick={() => handleSelectPlan(p.id)}
                            className={`w-full text-left p-2 rounded-lg border transition-all text-xs flex flex-col gap-1 ${
                              isSelected
                                ? 'bg-cyan-950/70 border-cyan-500/60 text-cyan-200'
                                : 'bg-slate-900/80 hover:bg-slate-800/90 border-slate-800 text-slate-300'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-bold text-white text-[11px] truncate">
                                {p.plan_name || p.title}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                <span className="font-mono text-[10px] text-cyan-400 bg-cyan-950 px-1 rounded border border-cyan-800/40">
                                  {p.timeframe}
                                </span>
                                <span className={`text-[9px] font-bold px-1 rounded ${
                                  isExecuted
                                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-500/30'
                                    : 'bg-amber-950 text-amber-300 border border-amber-500/30'
                                }`}>
                                  {isExecuted ? 'EXECUTED' : 'PENDING'}
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] text-slate-400">
                              <span className="truncate">{p.setup || 'Setup chuẩn'}</span>
                              {isSelected && (
                                <span className="text-emerald-400 font-bold flex items-center gap-0.5">
                                  <Check className="w-3 h-3" /> Đang gán
                                </span>
                              )}
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>

      {/* 2. CHIA 2 CỘT: CỘT TRÁI (Visual & Note) & CỘT PHẢI (Checklists) */}
      <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ========================================================
            CỘT TRÁI (Visual & Note) - Chiếm 6 cols trên desktop
           ======================================================== */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          {/* 2 Ô CHỨA ẢNH (Pre-trade image_url_1 & Post-trade image_base64) */}
          <div className="grid grid-cols-2 gap-3">
            {/* Ô 1: Ảnh Plan / Pre-trade (image_url_1) */}
            <div
              tabIndex={0}
              onPaste={(e) => handlePaste(e, 'HTF')}
              className="group relative h-48 rounded-lg bg-[#111622] border border-slate-800 hover:border-slate-700 focus:border-cyan-500/50 focus:outline-none flex flex-col overflow-hidden transition-all"
            >
              {/* Box Header */}
              <div className="px-3 py-1.5 bg-[#0b0e14]/90 border-b border-slate-800/80 flex items-center justify-between text-[11px] font-semibold text-slate-300 z-10">
                <span className="flex items-center gap-1.5 truncate max-w-[140px]">
                  <ImageIcon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                  <span className="truncate">1. Pre-Trade (Plan)</span>
                </span>
                <div className="flex items-center gap-1">
                  {preTradeImage && (
                    <>
                      <button
                        type="button"
                        onClick={() => onViewImage(preTradeImage, `${trade.symbol} - Pre-Trade Analysis (Plan)`)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                        title="Phóng to ảnh"
                      >
                        <Maximize2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateTrade({ ...trade, image_url_1: '', htf_image_url: '' });
                          triggerSaveNotification();
                        }}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400"
                        title="Xóa ảnh"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => htfFileInputRef.current?.click()}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-cyan-300"
                    title="Chọn ảnh từ máy tính (Browser)"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-cyan-400" />
                  </button>
                </div>
              </div>

              {/* Box Image / Placeholder */}
              <div className="flex-1 flex items-center justify-center p-2 relative bg-slate-950/40">
                {preTradeImage ? (
                  <img
                    src={preTradeImage}
                    alt="Pre-Trade Analysis (Plan)"
                    className="w-full h-full object-contain rounded cursor-pointer"
                    onClick={() => onViewImage(preTradeImage, `${trade.symbol} - Pre-Trade Analysis (Plan)`)}
                  />
                ) : (
                  <div className="text-center p-3 text-slate-500">
                    <p className="text-xs text-slate-400 font-medium mb-1">Dán ảnh Pre-trade (Plan)</p>
                    <p className="text-[10px] text-slate-500">Nhấn <strong>Ctrl + V</strong> hoặc liên kết Plan để tự lấy ảnh</p>
                  </div>
                )}
              </div>
              <input
                ref={htfFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, 'HTF')}
              />
            </div>

            {/* Ô 2: Ảnh MT5 đóng lệnh / Post-trade (image_base64) */}
            <div
              tabIndex={0}
              onPaste={(e) => handlePaste(e, 'LTF')}
              className="group relative h-48 rounded-lg bg-[#111622] border border-slate-800 hover:border-slate-700 focus:border-cyan-500/50 focus:outline-none flex flex-col overflow-hidden transition-all"
            >
              {/* Box Header */}
              <div className="px-3 py-1.5 bg-[#0b0e14]/90 border-b border-slate-800/80 flex items-center justify-between text-[11px] font-semibold text-slate-300 z-10">
                <span className="flex items-center gap-1.5 truncate max-w-[140px]">
                  <ImageIcon className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">2. Post-Trade (EA)</span>
                </span>
                <div className="flex items-center gap-1">
                  {postTradeImage && (
                    <>
                      <button
                        type="button"
                        onClick={() => onViewImage(postTradeImage, `${trade.symbol} - Post-Trade Close (EA v3.02)`)}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white"
                        title="Phóng to ảnh"
                      >
                        <Maximize2 className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          onUpdateTrade({ ...trade, image_base64: '', ltf_image_url: '' });
                          triggerSaveNotification();
                        }}
                        className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400"
                        title="Xóa ảnh"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => ltfFileInputRef.current?.click()}
                    className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-emerald-300"
                    title="Chọn ảnh từ máy tính (Browser)"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-emerald-400" />
                  </button>
                </div>
              </div>

              {/* Box Image / Placeholder */}
              <div className="flex-1 flex items-center justify-center p-2 relative bg-slate-950/40">
                {postTradeImage ? (
                  <img
                    src={postTradeImage}
                    alt="Post-Trade Close (EA)"
                    className="w-full h-full object-contain rounded cursor-pointer"
                    onClick={() => onViewImage(postTradeImage, `${trade.symbol} - Post-Trade Close (EA v3.02)`)}
                  />
                ) : (
                  <div className="text-center p-3 text-slate-500">
                    <p className="text-xs text-slate-400 font-medium mb-1">Ảnh Đóng Lệnh (EA)</p>
                    <p className="text-[10px] text-slate-500">Tự chụp từ EA v3.02 hoặc nhấn <strong>Ctrl + V</strong></p>
                  </div>
                )}
              </div>
              <input
                ref={ltfFileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleFileChange(e, 'LTF')}
              />
            </div>
          </div>

          {/* SỐ LIỆU TÓM TẮT & R ĐẠT ĐƯỢC + DROPDOWN TIMEFRAME */}
          <div className="p-3 rounded-lg bg-[#111622] border border-slate-800 space-y-2.5">
            {/* Hàng 1: Khối lượng, Thời gian giữ, % Lãi, Lợi nhuận ($) */}
            <div className="grid grid-cols-4 gap-2 text-center text-xs">
              <div className="p-2 rounded bg-slate-900/80 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">Khối lượng (Lot)</span>
                <span className="font-mono font-bold text-slate-200">{trade.volume.toFixed(2)} Lot</span>
              </div>
              <div className="p-2 rounded bg-slate-900/80 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">Thời gian giữ</span>
                <span className="font-mono font-bold text-slate-200">{duration}</span>
              </div>
              <div className="p-2 rounded bg-slate-900/80 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">% Lợi nhuận</span>
                <span className={`font-mono font-bold ${trade.net_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {trade.pnl_percentage ? `${trade.pnl_percentage > 0 ? '+' : ''}${trade.pnl_percentage.toFixed(2)}%` : '-'}
                </span>
              </div>
              <div className="p-2 rounded bg-slate-900/80 border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">Lợi nhuận ($)</span>
                <span className={`font-mono font-bold ${trade.net_pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatCurrency(trade.net_pnl)}
                </span>
              </div>
            </div>

            {/* Hàng 2: [Chi tiết R đạt được (Weighted RR)] + TP Mục tiêu + Timeframe Dropdown */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-800 text-xs">
              {/* Weighted RR Badge */}
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 px-2.5 py-1 rounded bg-blue-950/60 border border-blue-500/40 text-blue-300 font-mono font-bold">
                  <Target className="w-3.5 h-3.5 text-blue-400" />
                  <span>Weighted RR:</span>
                  <span className={trade.weighted_rr >= 0 ? 'text-cyan-300' : 'text-rose-400'}>
                    {trade.weighted_rr > 0 ? `+${trade.weighted_rr} R` : `${trade.weighted_rr} R`}
                  </span>
                </div>

                {/* TP Targets */}
                <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400">
                  <span className="text-slate-500">TP:</span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 text-emerald-400 font-bold border border-slate-800">
                    TP1: {trade.tp1_r || 2.5}R
                  </span>
                  <span className="px-1.5 py-0.5 rounded bg-slate-900 text-slate-400 border border-slate-800">
                    TP2: {trade.tp2_r || 0}R
                  </span>
                </div>
              </div>

              {/* Timeframe Dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500 font-medium text-[11px]">Khung:</span>
                <select
                  value={trade.timeframe}
                  onChange={(e) => {
                    onUpdateTrade({ ...trade, timeframe: e.target.value as any });
                    triggerSaveNotification();
                  }}
                  className="bg-slate-900 text-cyan-300 font-bold px-2 py-1 rounded border border-slate-800 text-xs focus:outline-none cursor-pointer"
                >
                  <option value="D1">D1</option>
                  <option value="H4">H4</option>
                  <option value="H1">H1</option>
                  <option value="M15">M15</option>
                  <option value="M5">M5</option>
                  <option value="M1">M1</option>
                </select>
              </div>
            </div>
          </div>

          {/* Ô GHI CHÚ LỆNH */}
          <div className="flex-1 flex flex-col rounded-lg bg-[#111622] border border-slate-800 p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-cyan-400" />
                Ghi chú lệnh
              </span>
              <span className="text-[10px] text-slate-500 italic">
                {saveStatus}
              </span>
            </div>
            <textarea
              rows={3}
              value={trade.notes}
              onChange={(e) => {
                onUpdateTrade({ ...trade, notes: e.target.value });
                triggerSaveNotification();
              }}
              placeholder="Nhập ghi chú diễn biến lệnh, lý do vào/đóng lệnh, cảm xúc thị trường..."
              className="w-full flex-1 bg-slate-950/70 border border-slate-800/80 rounded-md p-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-cyan-500/50 resize-none font-sans leading-relaxed"
            />
          </div>
        </div>

        {/* ========================================================
            CỘT PHẢI (Checklists & Tâm Lý & Setup) - Chiếm 6 cols
            Thế chỗ cho widget Tổng quan hiệu suất đã xóa theo yêu cầu
           ======================================================== */}
        <div className="lg:col-span-6 flex flex-col gap-3">
          {/* KHỐI 1: SETUP VÀO LỆNH (Co ngắn, kéo dài ngang vừa khung) */}
          <div className="p-3 rounded-lg bg-[#111622] border border-slate-800">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200">Setup Vào Lệnh</span>
                <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-950 text-blue-400 border border-blue-800/40 font-mono font-semibold">
                  {(trade.setups || []).length} đã chọn
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenSettingsModal}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                title="Tùy chỉnh danh sách Setup & Điểm số"
              >
                <SettingsIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Setup Tags Grid */}
            <div className="flex flex-wrap gap-1.5">
              {setupTags.map(tag => {
                const isChecked = (trade.setups || []).includes(tag.label);
                return (
                  <button
                    key={tag.id}
                    type="button"
                    onClick={() => toggleSetup(tag.label)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border transition-all cursor-pointer ${
                      isChecked
                        ? 'bg-blue-600/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                        : 'bg-slate-900/80 text-slate-400 border-slate-800 hover:border-slate-700 hover:text-slate-300'
                    }`}
                  >
                    <div className={`w-3.5 h-3.5 rounded flex items-center justify-center border text-[9px] ${
                      isChecked ? 'bg-cyan-500 border-cyan-400 text-slate-950 font-bold' : 'border-slate-700'
                    }`}>
                      {isChecked && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                    </div>
                    <span>{tag.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* KHỐI 2: CHECKLIST KỶ LUẬT (Pre-Trade) KÈM THANH TÍNH ĐIỂM GRADE A+ */}
          <div className="p-3 rounded-lg bg-[#111622] border border-slate-800">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200">Checklist Kỷ Luật</span>
                <span className="text-[11px] font-mono text-slate-400">
                  <strong className="text-cyan-400">{score}</strong> / {maxScore}đ ({trade.pre_checklist_ids.length}/{preChecklistItems.length})
                </span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider border ${badgeClass}`}>
                  {grade}
                </span>
              </div>
              <button
                type="button"
                onClick={onOpenSettingsModal}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                title="Tùy chỉnh tiêu chí kỷ luật & Điểm số"
              >
                <SettingsIcon className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Checklist items list */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
              {preChecklistItems.map(item => {
                const isChecked = trade.pre_checklist_ids.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className={`flex items-center justify-between p-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                      isChecked
                        ? 'bg-blue-950/30 border-blue-500/40 text-slate-200'
                        : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-800/40'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-1">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePreChecklist(item.id)}
                        className="rounded bg-slate-800 border-slate-700 text-blue-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="truncate text-[11px] font-medium">{item.label}</span>
                    </div>
                    <span className="text-[10px] font-mono font-semibold text-cyan-400 shrink-0">
                      +{item.points}đ
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* KHỐI 3: CHECKLIST TÂM LÝ & TỬ HUYỆT (Post-Trade) GỒM CHECKBOX LỖI & Ô NHẬP PNL KẾ HOẠCH */}
          <div className="p-3 rounded-lg bg-[#111622] border border-slate-800 flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-rose-400 flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-rose-400" />
                    Checklist Tâm Lý & Tử Huyệt (Post-Trade)
                  </span>
                  {trade.post_checklist_ids.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-rose-950/80 text-rose-400 border border-rose-800/50 font-bold">
                      {trade.post_checklist_ids.length} vi phạm
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={onOpenSettingsModal}
                  className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                  title="Chỉnh sửa danh sách tử huyệt"
                >
                  <SettingsIcon className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Mistake Checkboxes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mb-3">
                {postMistakeItems.map(item => {
                  const isChecked = trade.post_checklist_ids.includes(item.id);
                  return (
                    <label
                      key={item.id}
                      className={`flex items-center gap-2 p-1.5 rounded-md border text-xs cursor-pointer transition-colors ${
                        isChecked
                          ? 'bg-rose-950/30 border-rose-500/40 text-rose-300 font-semibold'
                          : 'bg-slate-900/60 border-slate-800/80 text-slate-400 hover:bg-slate-800/40'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => togglePostMistake(item.id)}
                        className="rounded bg-slate-800 border-slate-700 text-rose-600 focus:ring-0 w-3.5 h-3.5 cursor-pointer"
                      />
                      <span className="truncate text-[11px]">{item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Ô NHẬP PNL KẾ HOẠCH (ĐỂ TỰ TÍNH LOST PROFIT NẾU CẮT NON) */}
            <div className="pt-2 border-t border-slate-800/90 space-y-2">
              <div className="flex items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <DollarSign className="w-3.5 h-3.5 text-cyan-400" />
                  <span>PnL Kế Hoạch Đặt Ra:</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500 font-mono">$</span>
                  <input
                    type="number"
                    step="10"
                    placeholder="VD: 850.00"
                    value={trade.plan_pnl ?? ''}
                    onChange={(e) => handlePlanPnlChange(e.target.value)}
                    className="w-28 px-2 py-1 rounded bg-slate-950 border border-slate-700 text-xs font-mono font-bold text-cyan-300 focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-slate-500 text-[10px]">USD</span>
                </div>
              </div>

              {/* CẢNH BÁO LOST PROFIT NẾU CÓ LỖI CẮT NON */}
              {hasCutEarly && (
                <div className="p-2.5 rounded-lg bg-rose-950/40 border border-rose-500/40 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2 text-rose-300">
                    <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
                    <div>
                      <span className="font-bold">Cảnh Báo Cắt Non:</span>
                      <p className="text-[11px] text-rose-300/80">
                        Kế hoạch kỳ vọng: ${trade.plan_pnl || 0} | Thực nhận: ${trade.net_pnl}
                      </p>
                    </div>
                  </div>
                  <div className="text-right font-mono">
                    <span className="text-[10px] text-rose-400 block uppercase font-bold">Lợi Nhuận Bị Mất</span>
                    <span className="text-sm font-black text-rose-400">
                      -${(trade.lost_profit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
