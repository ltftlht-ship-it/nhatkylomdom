import { useLanguage } from '../context/LanguageContext';
import React, { useState, useRef, useEffect, useMemo } from 'react';
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
  getSavedTimezoneOffset, 
  parseChecklistArray,
  isNoiseTrade,
  getSavedTimeframeOptions
} from '../utils/tradeCalculations';
import { compressImage, uploadImageToSupabaseStorage, normalizeImageSource } from '../utils/imageUtils';
import { fetchPlansForTrade, saveTradeJournalToLocalCache, getTradeJournalFromLocalCache } from '../lib/supabase';
import { 
  FolderOpen, 
  Maximize2, 
  Trash2, 
  Settings as SettingsIcon, 
  Check, 
  Clock, 
  ChevronUp,
  Image as ImageIcon, 
  DollarSign
} from 'lucide-react';

interface TradeDetailCardProps {
  trade?: TradeRow | null;
  allTrades?: TradeRow[];
  plans: TradingPlan[];
  accountId?: string;
  preChecklistItems: PreChecklistItem[];
  postMistakeItems: PostMistakeItem[];
  setupTags: SetupTagItem[];
  timezoneOffset?: number;
  saveStatusText?: string;
  onUpdateTrade: (updated: TradeRow) => void;
  onMapPlanToTrade?: (tradeId: string, planId: string | null, planObj?: TradingPlan) => void;
  onOpenSettingsModal: () => void;
  onOpenChecklistEditor?: () => void;
  onViewImage: (imgUrl: string, title: string) => void;
}

export const TradeDetailCard: React.FC<TradeDetailCardProps> = ({
  trade,
  allTrades = [],
  plans,
  accountId = '',
  preChecklistItems,
  postMistakeItems,
  setupTags,
  timezoneOffset,
  saveStatusText,
  onUpdateTrade,
  onMapPlanToTrade,
  onOpenSettingsModal,
  onOpenChecklistEditor,
  onViewImage
}) => {
  const { t, language } = useLanguage();
  const activeOffset = timezoneOffset !== undefined ? timezoneOffset : getSavedTimezoneOffset();
  
  // Available Timeframes from LocalStorage with event listener
  const [availableTimeframes, setAvailableTimeframes] = useState<string[]>(() => getSavedTimeframeOptions());

  useEffect(() => {
    const handleTfUpdate = () => {
      setAvailableTimeframes(getSavedTimeframeOptions());
    };
    window.addEventListener('timeframe_options_updated', handleTfUpdate);
    return () => window.removeEventListener('timeframe_options_updated', handleTfUpdate);
  }, []);

  // Popover States
  const [activePlanDropdown, setActivePlanDropdown] = useState(false);
  const [setupDropdownOpen, setSetupDropdownOpen] = useState(false);
  const [timeframeDropdownOpen, setTimeframeDropdownOpen] = useState(false);
  const [isPreChecklistOpen, setIsPreChecklistOpen] = useState(false);
  const [isPostMistakesOpen, setIsPostMistakesOpen] = useState(false);
  
  const [fetchedTradePlans, setFetchedTradePlans] = useState<TradingPlan[] | null>(null);
  const [isLoadingTradePlans, setIsLoadingTradePlans] = useState(false);
  const [saveStatus, setSaveStatus] = useState<string>('Auto-saved');
  
  // Local state for notes to support Vietnamese IME / Telex smoothly without dropping characters
  const [localNotes, setLocalNotes] = useState<string>(trade?.notes || '');
  const isComposingRef = useRef(false);
  const isFocusedRef = useRef(false);
  const notesDebounceTimerRef = useRef<any>(null);

  useEffect(() => {
    // Only synchronize localNotes when not actively focused or typing
    if (!isFocusedRef.current) {
      setLocalNotes(trade?.notes || '');
    }
  }, [trade?.id, trade?.notes]);

  useEffect(() => {
    return () => {
      if (notesDebounceTimerRef.current) {
        clearTimeout(notesDebounceTimerRef.current);
      }
    };
  }, []);

  const flushNotes = (val: string) => {
    if (trade && val !== trade.notes) {
      onUpdateTrade({ ...trade, notes: val });
      triggerSaveNotification();
    }
  };

  const handleNotesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setLocalNotes(val);
    if (notesDebounceTimerRef.current) {
      clearTimeout(notesDebounceTimerRef.current);
    }
    // Only debounce push to parent if NOT currently in IME composition
    if (!isComposingRef.current) {
      notesDebounceTimerRef.current = setTimeout(() => {
        flushNotes(val);
      }, 500);
    }
  };

  const handleNotesCompositionStart = () => {
    isComposingRef.current = true;
  };

  const handleNotesCompositionEnd = (e: React.CompositionEvent<HTMLTextAreaElement>) => {
    isComposingRef.current = false;
    const val = e.currentTarget.value;
    setLocalNotes(val);
    if (notesDebounceTimerRef.current) {
      clearTimeout(notesDebounceTimerRef.current);
    }
    notesDebounceTimerRef.current = setTimeout(() => {
      flushNotes(val);
    }, 500);
  };

  const handleNotesFocus = () => {
    isFocusedRef.current = true;
  };

  const handleNotesBlur = () => {
    isFocusedRef.current = false;
    if (notesDebounceTimerRef.current) {
      clearTimeout(notesDebounceTimerRef.current);
    }
    flushNotes(localNotes);
  };

  const planDropdownRef = useRef<HTMLDivElement>(null);
  const setupDropdownRef = useRef<HTMLDivElement>(null);
  const timeframeDropdownRef = useRef<HTMLDivElement>(null);
  const preChecklistRef = useRef<HTMLDivElement>(null);
  const postMistakesRef = useRef<HTMLDivElement>(null);
  const htfFileInputRef = useRef<HTMLInputElement>(null);
  const ltfFileInputRef = useRef<HTMLInputElement>(null);

  // Close all popovers on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (setupDropdownRef.current && !setupDropdownRef.current.contains(event.target as Node)) {
        setSetupDropdownOpen(false);
      }
      if (timeframeDropdownRef.current && !timeframeDropdownRef.current.contains(event.target as Node)) {
        setTimeframeDropdownOpen(false);
      }
      if (preChecklistRef.current && !preChecklistRef.current.contains(event.target as Node)) {
        setIsPreChecklistOpen(false);
      }
      if (postMistakesRef.current && !postMistakesRef.current.contains(event.target as Node)) {
        setIsPostMistakesOpen(false);
      }
      if (planDropdownRef.current && !planDropdownRef.current.contains(event.target as Node)) {
        setActivePlanDropdown(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Esc') {
        setSetupDropdownOpen(false);
        setTimeframeDropdownOpen(false);
        setIsPreChecklistOpen(false);
        setIsPostMistakesOpen(false);
        setActivePlanDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Compute position trades (scaling / partial deals)
  const positionTrades = useMemo(() => {
    if (!trade) return [];
    const posKey = trade.position_id || trade.ticket;
    const list = (allTrades || []).filter(t => (t.position_id || t.ticket) === posKey);
    if (list.length === 0) return [trade];
    return [...list].sort((a, b) => {
      if (a.sub_index && b.sub_index) {
        return a.sub_index.localeCompare(b.sub_index);
      }
      const timeA = new Date((a.open_time || '').replace(/-/g, '/')).getTime() || 0;
      const timeB = new Date((b.open_time || '').replace(/-/g, '/')).getTime() || 0;
      return timeA - timeB;
    });
  }, [trade, allTrades]);

  // Toggle timeframe (Multi-select)
  const currentTimeframes = useMemo(() => {
    if (!trade?.timeframe) return [];
    return trade.timeframe.split(',').map(s => s.trim()).filter(Boolean);
  }, [trade?.timeframe]);

  // Flash save feedback
  const triggerSaveNotification = () => {
    setSaveStatus('Saved changes ✓');
    setTimeout(() => {
      setSaveStatus('Auto-saved');
    }, 1500);
  };

  const [activeBox, setActiveBox] = useState<'HTF' | 'LTF'>('HTF');

  // Lấy dữ liệu ảnh dự phòng an toàn từ Local Cache
  const cachedJournal = useMemo(() => {
    if (!trade?.ticket) return null;
    return getTradeJournalFromLocalCache(trade.ticket);
  }, [trade?.ticket, saveStatus]);

  // Helper áp dụng ảnh lưu vào LocalStorage, Local Cache và State ngay lập tức
  const applyImage = (finalImg: string, type: 'HTF' | 'LTF') => {
    if (!trade) return;
    if (type === 'HTF') {
      try { localStorage.setItem(`deal_user_pre_img_${trade.ticket}`, finalImg); } catch {}
      saveTradeJournalToLocalCache(trade.ticket, { htf_image_url: finalImg, pre_image: finalImg });
      onUpdateTrade({ ...trade, htf_image_url: finalImg, pre_image: finalImg });
    } else {
      try { localStorage.setItem(`deal_user_post_img_${trade.ticket}`, finalImg); } catch {}
      saveTradeJournalToLocalCache(trade.ticket, { image_base64: finalImg, ltf_image_url: finalImg });
      onUpdateTrade({ ...trade, image_base64: finalImg, ltf_image_url: finalImg });
    }
    triggerSaveNotification();
  };

  // Lắng nghe phím tắt Ctrl + V toàn cục trên card chi tiết lệnh
  useEffect(() => {
    if (!trade) return;
    const handleGlobalPaste = async (e: ClipboardEvent) => {
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'TEXTAREA' || target.tagName === 'INPUT')) {
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            e.preventDefault();
            try {
              const { blob, dataUrl } = await compressImage(file, 1280, 0.72);
              let uploadedUrl = '';
              try {
                const res = await uploadImageToSupabaseStorage(blob, `trade_${trade.ticket}_${activeBox.toLowerCase()}`);
                if (res) uploadedUrl = res;
              } catch {}
              const finalImg = uploadedUrl || dataUrl;
              applyImage(finalImg, activeBox);
            } catch (err) {
              console.warn('Error handling global image paste:', err);
            }
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handleGlobalPaste);
    return () => window.removeEventListener('paste', handleGlobalPaste);
  }, [trade, activeBox]);

  if (!trade) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center bg-[#1e232b] rounded-xl border border-[#30363d] text-slate-400">
        <div className="w-12 h-12 rounded-full bg-[#161b22] border border-[#30363d] flex items-center justify-center mb-3">
          <Clock className="w-6 h-6 text-slate-400 animate-pulse" />
        </div>
        <h3 className="text-sm font-bold text-slate-200">Waiting for MT5 data...</h3>
        <p className="text-xs text-slate-400 mt-1 max-w-sm">
          Select a trade from the table above to view details and manage checklists.
        </p>
      </div>
    );
  }

  // Pre & Post checklists
  const preChecklistIds = Array.isArray(trade.pre_checklist_ids) 
    ? trade.pre_checklist_ids 
    : parseChecklistArray(trade.pre_checklist_ids);
  const postChecklistIds = Array.isArray(trade.post_checklist_ids) 
    ? trade.post_checklist_ids 
    : parseChecklistArray(trade.post_checklist_ids);

  const { score, maxScore, percentage } = calculatePreTradeScore(preChecklistIds, preChecklistItems);
  const violationCount = postChecklistIds.length;

  // Grade calculation for Discipline (S, A+, A, B, C) - xoá cái chấm điểm D đi
  const getDisciplineGrade = (pct: number): string | null => {
    if (pct >= 95) return 'S';
    if (pct >= 85) return 'A+';
    if (pct >= 75) return 'A';
    if (pct >= 60) return 'B';
    if (pct >= 50) return 'C';
    return null; // Xoá điểm D
  };
  const disciplineGrade = getDisciplineGrade(percentage);

  const isBuy = trade.type === 'BUY';
  const isPending = trade.status === 'PENDING' || trade.ticket?.startsWith('P-');
  const isNoise = isNoiseTrade(trade);

  // Time & Duration
  const duration = formatDuration(trade.open_time, trade.close_time);
  const sessionLabel = formatSessionLabel(trade.session);

  const hasCutEarly = postChecklistIds.includes('cut_early');
  const currentPlan = plans.find(p => p.id === trade.plan_id);

  // Pre-trade image (Box 1): CHỈ hiển thị từ Kế Hoạch (Plan mapping) hoặc do người dùng chủ động dán / tải lên ô 1 (HTF)
  // Tuyệt đối giữ trống nguyên vẹn nếu chưa mapping Plan và chưa tự dán ảnh! KHÔNG ĐƯỢC LẤY ẢNH TỪ MT5!
  const manualPreImage = (
    (typeof window !== 'undefined' ? localStorage.getItem(`deal_user_pre_img_${trade.ticket}`) : null) ||
    (trade.htf_image_url && trade.htf_image_url !== trade.image_url_1 && trade.htf_image_url !== trade.image_base64 ? trade.htf_image_url : '') ||
    (cachedJournal?.htf_image_url && cachedJournal.htf_image_url !== trade.image_url_1 ? cachedJournal.htf_image_url : '') ||
    ''
  );
  const planImage = currentPlan?.image_url || '';
  const preTradeImage = normalizeImageSource(manualPreImage || planImage || '');

  // Post-trade image (Box 2): Ảnh đóng lệnh do người dùng dán hoặc từ MT5 EA (LTF / Close)
  const manualPostImage = (
    (typeof window !== 'undefined' ? localStorage.getItem(`deal_user_post_img_${trade.ticket}`) : null) ||
    trade.ltf_image_url ||
    trade.image_base64 ||
    cachedJournal?.ltf_image_url ||
    cachedJournal?.image_base64 ||
    trade.image_url_1 ||
    (trade as any).close_image ||
    (trade as any).image_close ||
    (trade as any).image_url ||
    ''
  );
  const postTradeImage = normalizeImageSource(manualPostImage);

  // Handle image upload from file picker
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, type: 'HTF' | 'LTF') => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const { blob, dataUrl } = await compressImage(file, 1280, 0.72);
        let uploadedUrl = '';
        try {
          const res = await uploadImageToSupabaseStorage(blob, `trade_${trade.ticket}_${type.toLowerCase()}`);
          if (res) uploadedUrl = res;
        } catch {}
        const finalImg = uploadedUrl || dataUrl;
        applyImage(finalImg, type);
      } catch (err) {
        console.warn('Error handling image file:', err);
      }
    }
  };

  // Handle Ctrl+V paste on image box
  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>, type: 'HTF' | 'LTF') => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const file = items[i].getAsFile();
        if (file) {
          e.preventDefault();
          try {
            const { blob, dataUrl } = await compressImage(file, 1280, 0.72);
            let uploadedUrl = '';
            try {
              const res = await uploadImageToSupabaseStorage(blob, `trade_${trade.ticket}_${type.toLowerCase()}`);
              if (res) uploadedUrl = res;
            } catch {}
            const finalImg = uploadedUrl || dataUrl;
            applyImage(finalImg, type);
          } catch (err) {
            console.warn('Error handling image paste:', err);
          }
          break;
        }
      }
    }
  };

  // 1-Click Map Plan Handler
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

    const clonedPlanChecklist = parseChecklistArray(p.checklist);
    const newPreChecklist = clonedPlanChecklist.length > 0 ? [...clonedPlanChecklist] : preChecklistIds;

    onMapPlanToTrade?.(trade.id, p.id, p);
    onUpdateTrade({
      ...trade,
      plan_id: p.id,
      plan_name: p.plan_name || p.title,
      timeframe: (p.timeframe as any) || trade.timeframe,
      setup: p.setup || trade.setup,
      setups: p.setup ? [p.setup] : trade.setups,
      notes: p.notes ? (trade.notes ? `${p.notes}\n---\n${trade.notes}` : p.notes) : trade.notes,
      pre_checklist_ids: newPreChecklist,
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
        console.warn('Error fetchPlansForTrade:', err);
      } finally {
        setIsLoadingTradePlans(false);
      }
    }
  };

  // Toggle pre-trade checklist
  const togglePreChecklist = (id: string) => {
    const current = Array.isArray(trade.pre_checklist_ids) 
      ? trade.pre_checklist_ids 
      : parseChecklistArray(trade.pre_checklist_ids);
    const exists = current.includes(id);
    const updated = exists 
      ? current.filter(i => i !== id)
      : [...current, id];
    onUpdateTrade({ ...trade, pre_checklist_ids: updated });
    triggerSaveNotification();
  };

  // Toggle post-trade mistake
  const togglePostMistake = (id: string) => {
    const current = Array.isArray(trade.post_checklist_ids) 
      ? trade.post_checklist_ids 
      : parseChecklistArray(trade.post_checklist_ids);
    const exists = current.includes(id);
    const updated = exists 
      ? current.filter(i => i !== id)
      : [...current, id];
    
    let lostProfit = trade.lost_profit;
    if (!updated.includes('cut_early')) {
      lostProfit = 0;
    } else if (trade.plan_pnl && trade.plan_pnl > (trade.net_pnl || 0)) {
      lostProfit = Number((trade.plan_pnl - (trade.net_pnl || 0)).toFixed(2));
    }

    onUpdateTrade({ 
      ...trade, 
      post_checklist_ids: updated,
      lost_profit: lostProfit
    });
    triggerSaveNotification();
  };

  // Toggle setup tag (Multi-select)
  const toggleSetup = (label: string) => {
    const current = trade.setups || [];
    const exists = current.includes(label);
    const updated = exists ? current.filter(s => s !== label) : [...current, label];
    onUpdateTrade({ 
      ...trade, 
      setup: updated[0] || undefined,
      setups: updated 
    });
    triggerSaveNotification();
  };

  const toggleTimeframe = (tf: string) => {
    const current = trade.timeframe ? trade.timeframe.split(',').map(s => s.trim()).filter(Boolean) : [];
    const exists = current.includes(tf);
    let updated: string[];
    if (exists) {
      updated = current.filter(t => t !== tf);
    } else {
      const order = availableTimeframes;
      updated = [...current, tf].sort((a, b) => {
        const idxA = order.indexOf(a);
        const idxB = order.indexOf(b);
        return (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99);
      });
    }
    onUpdateTrade({ ...trade, timeframe: updated.join(', ') as any });
    triggerSaveNotification();
  };

  // Update Plan PnL for Lost Profit calculation
  const handlePlanPnlChange = (valStr: string) => {
    const num = parseFloat(valStr) || 0;
    let lostProfit = 0;
    if (hasCutEarly && num > (trade.net_pnl || 0)) {
      lostProfit = Number((num - (trade.net_pnl || 0)).toFixed(2));
    }
    onUpdateTrade({
      ...trade,
      plan_pnl: num,
      lost_profit: lostProfit
    });
    triggerSaveNotification();
  };

  // Helper formats
  const formatEnteredTime = (dateStr?: string, offsetHours: number = 0): string => {
    if (!dateStr || dateStr === '-') return '–';
    try {
      const clean = dateStr.replace(/-/g, '/').replace(/\./g, '/');
      const d = new Date(clean);
      if (isNaN(d.getTime())) return dateStr;
      if (offsetHours !== 0) {
        d.setHours(d.getHours() + offsetHours);
      }
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'];
      const day = String(d.getDate()).padStart(2, '0');
      const month = months[d.getMonth()];
      const hours = String(d.getHours()).padStart(2, '0');
      const mins = String(d.getMinutes()).padStart(2, '0');
      return `${day} ${month}, ${hours}:${mins}`;
    } catch {
      return dateStr;
    }
  };

  const formatPriceVal = (val?: number | null, sym: string = ''): string => {
    if (val == null || isNaN(Number(val)) || Number(val) === 0) return '–';
    const num = Number(val);
    const isGold = sym.toUpperCase().includes('XAU') || sym.toUpperCase().includes('GOLD');
    const isJpy = sym.toUpperCase().includes('JPY');
    const decimals = isGold ? 2 : isJpy ? 3 : 5;
    return num.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  };

  const slDistance = (trade.open_price && trade.initial_sl && trade.initial_sl > 0)
    ? Math.abs(trade.open_price - trade.initial_sl)
    : (trade.pip_sl || 0);

  const slDistanceStr = slDistance > 0 ? (slDistance < 1 ? slDistance.toFixed(5) : slDistance.toFixed(2)) : '–';

  // Current Setups (Multi-select)
  const currentSetups = Array.isArray(trade.setups) && trade.setups.length > 0 
    ? trade.setups 
    : (trade.setup ? [trade.setup] : []);
  const setupDisplayText = currentSetups.length > 0 ? currentSetups.join(', ') : 'No setup selected';
  const tfDisplayText = currentTimeframes.length > 0 ? currentTimeframes.join(', ') : (trade.timeframe || 'M15');

  // Deal 1, Deal 2, Deal 3 for TP1, TP2, TP3
  const deal1 = positionTrades.length > 1 ? positionTrades[0] : trade;
  const deal2 = positionTrades.length > 1 ? positionTrades[1] : undefined;
  const deal3 = positionTrades.length > 1 ? positionTrades[2] : undefined;

  // Render Deal PnL & R:R for TP1, TP2, TP3
  const renderDealPnlRr = (deal?: TradeRow) => {
    if (!deal) return <span className="font-mono font-medium text-slate-500 text-sm">–</span>;
    const pnl = deal.net_pnl;
    const rr = deal.weighted_rr;
    const isPos = pnl > 0;
    const isNeg = pnl < 0;
    const colorClass = isPos ? 'text-emerald-400' : isNeg ? 'text-rose-400' : 'text-slate-300';
    const pnlStr = (pnl >= 0 ? '+' : '') + formatCurrency(pnl);
    const rrStr = rr != null && !isNaN(Number(rr)) ? (rr > 0 ? `+${rr}R` : `${rr}R`) : null;
    return (
      <div className="flex items-baseline gap-1.5 flex-wrap">
        <span className={`font-mono font-bold text-sm ${colorClass}`}>{pnlStr}</span>
        {rrStr && <span className="font-mono text-xs text-slate-400">({rrStr})</span>}
      </div>
    );
  };

  // =========================================================================
  // CARD THÔNG TIN LỆNH CHUẨN XÁC THEO HÌNH ẢNH MẪU
  // =========================================================================
  const renderSelectedTradeCard = () => (
    <div className="clay-card rounded-2xl p-5 shadow-xl border border-[var(--border-main)] flex flex-col font-sans transition-all">
      {/* HEADER: SELECTED TRADE */}
      <div className="flex items-start justify-between">
        <div>
          <span className="text-[11px] font-bold text-[var(--text-muted)] tracking-wider uppercase block mb-1">
            SELECTED TRADE
          </span>
          <div className="flex items-center gap-2.5">
            <span className="text-2xl font-black text-[var(--text-primary)] font-sans tracking-tight">
              {trade.symbol.replace('/', '')}
            </span>
            {/* BUY / SELL: KHÔNG ĐÓNG KHUNG, CHỈ HIỆN CHỮ CÓ MÀU */}
            <span className={`text-xs font-bold tracking-wider ${
              isBuy ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'
            }`}>
              {trade.type}
            </span>
          </div>
          <div className="text-xs font-mono text-[var(--text-muted)] mt-1">
            Ticket #{trade.ticket} · {sessionLabel} session
          </div>
        </div>

        {/* TOP RIGHT: STATUS */}
        <div>
          {isPending ? (
            <span className="text-amber-500 font-mono text-xs font-medium tracking-wider">
              PENDING
            </span>
          ) : isNoise ? (
            <span className="text-amber-500 font-mono text-xs font-medium tracking-wider">
              NOISE
            </span>
          ) : (
            <span className="text-[var(--text-muted)] font-mono text-xs font-medium tracking-wider">
              CLOSED
            </span>
          )}
        </div>
      </div>

      {/* THIN HORIZONTAL DIVIDER */}
      <div className="my-4 border-b border-[var(--border-main)]/60"></div>

      {/* 3x3 DATA GRID */}
      <div className="grid grid-cols-3 gap-y-4 gap-x-6">
        {/* ROW 1: ENTERED, CLOSED, HOLD TIME */}
        <div>
          <span className="text-[11px] font-semibold text-[var(--text-muted)] tracking-wider uppercase block mb-0.5">
            ENTERED
          </span>
          <span className="font-mono font-bold text-[var(--text-primary)] text-sm">
            {formatEnteredTime(trade.open_time, activeOffset)}
          </span>
        </div>

        <div>
          <span className="text-[11px] font-semibold text-[var(--text-muted)] tracking-wider uppercase block mb-0.5">
            CLOSED
          </span>
          <span className="font-mono font-bold text-[var(--text-primary)] text-sm">
            {trade.close_time && trade.close_time !== '-' ? formatEnteredTime(trade.close_time, activeOffset) : '–'}
          </span>
        </div>

        <div>
          <span className="text-[11px] font-semibold text-[var(--text-muted)] tracking-wider uppercase block mb-0.5">
            HOLD TIME
          </span>
          <span className="font-mono font-bold text-[var(--text-primary)] text-sm">
            {duration && duration !== '-' ? duration : '–'}
          </span>
        </div>

        {/* ROW 2: ENTRY, STOP LOSS, SL DISTANCE */}
        <div>
          <span className="text-[11px] font-semibold text-[var(--text-muted)] tracking-wider uppercase block mb-0.5">
            ENTRY
          </span>
          <span className="font-mono font-bold text-[var(--text-primary)] text-sm">
            {formatPriceVal(trade.open_price, trade.symbol)}
          </span>
        </div>

        <div>
          <span className="text-[11px] font-semibold text-[var(--text-muted)] tracking-wider uppercase block mb-0.5">
            STOP LOSS
          </span>
          <span className="font-mono font-bold text-[var(--text-primary)] text-sm">
            {trade.initial_sl && trade.initial_sl > 0 ? formatPriceVal(trade.initial_sl, trade.symbol) : '–'}
          </span>
        </div>

        <div>
          <span className="text-[11px] font-semibold text-[var(--text-muted)] tracking-wider uppercase block mb-0.5">
            SL DISTANCE
          </span>
          <span className="font-mono font-bold text-[var(--text-primary)] text-sm">
            {slDistanceStr}
          </span>
        </div>

        {/* ROW 3: TP1, TP2, TP3 */}
        <div>
          <span className="text-[11px] font-semibold text-[var(--text-muted)] tracking-wider uppercase block mb-0.5">
            TP1
          </span>
          {renderDealPnlRr(deal1)}
        </div>

        <div>
          <span className="text-[11px] font-semibold text-[var(--text-muted)] tracking-wider uppercase block mb-0.5">
            TP2
          </span>
          {renderDealPnlRr(deal2)}
        </div>

        <div>
          <span className="text-[11px] font-semibold text-[var(--text-muted)] tracking-wider uppercase block mb-0.5">
            TP3
          </span>
          {renderDealPnlRr(deal3)}
        </div>
      </div>

      {/* HÀNG PLAN MAPPING: MỘT NÚT DÀI TRÊN SETUP, HIỂN THỊ CẢ TÊN PLAN, K TÔ MÀU, CHỌN NHƯ SETUP */}
      <div className="mt-4 pt-3.5 border-t border-[var(--border-main)]/60 relative" ref={planDropdownRef}>
        <button
          type="button"
          onClick={handleTogglePlanDropdown}
          className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl clay-well hover:border-teal-500/40 text-xs font-semibold text-[var(--text-primary)] transition-all cursor-pointer shadow-xs"
          title="Map Trading Plan"
        >
          <div className="flex items-center gap-1.5 min-w-0 pr-2 truncate">
            <span className="text-[var(--text-muted)] font-normal shrink-0">Plan:</span>
            <span className="font-semibold text-[var(--text-primary)] truncate">
              {trade.plan_name || currentPlan?.plan_name || currentPlan?.title || 'No plan selected'}
            </span>
          </div>
          <ChevronUp className={`w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 transition-transform ${activePlanDropdown ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropup Plan bung lên trên */}
        {activePlanDropdown && (
          <div className="absolute bottom-full mb-2 left-0 w-full clay-card rounded-2xl shadow-2xl border border-[var(--border-main)] overflow-hidden z-50 text-xs flex flex-col max-h-72 font-sans animate-in fade-in slide-in-from-bottom-2 duration-150">
            <div className="px-3.5 py-2.5 border-b border-[var(--border-main)] text-xs font-bold text-[#1d1b17] flex items-center justify-between shrink-0 bg-white">
              <span>Map Plan to Trade #{trade.ticket}</span>
              {trade.plan_id && (
                <button
                  type="button"
                  onClick={() => handleSelectPlan(null)}
                  className="text-[10px] text-rose-400 hover:underline cursor-pointer"
                >
                  Unmap
                </button>
              )}
            </div>
            <div className="overflow-y-auto flex-1 p-2 space-y-1 min-h-0 bg-white">
              {plans.length === 0 ? (
                <div className="py-4 text-center text-[var(--text-muted)]">No plans available.</div>
              ) : (
                plans.map((p, idx) => {
                  const isCurrent = p.id === trade.plan_id;
                  return (
                    <React.Fragment key={p.id}>
                      <button
                        type="button"
                        onClick={() => handleSelectPlan(p.id)}
                        className={`w-full text-left p-2 rounded-xl border text-xs flex flex-col gap-0.5 transition-all cursor-pointer ${
                          isCurrent
                            ? 'border-[#1d1b17]/60 bg-[var(--bg-subtle)] text-[#1d1b17] font-normal shadow-xs'
                            : 'border-transparent bg-white text-[#4a463e] font-normal hover:bg-[var(--bg-subtle)]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-normal truncate text-[#1d1b17]">{p.plan_name || p.title}</span>
                          <span className="text-[10px] font-mono px-1 rounded bg-[var(--bg-subtle)] text-[#4a463e] border border-[var(--border-main)]">{p.timeframe}</span>
                        </div>
                        <span className="text-[10px] text-[var(--text-muted)] truncate">{p.setup || 'Standard setup'}</span>
                      </button>
                      {idx < plans.length - 1 && (
                        <div className="w-full border-b border-[var(--border-subtle)]/80 my-0.5" />
                      )}
                    </React.Fragment>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* ROW SETUP (75%) + TIMEFRAME (25%) */}
      <div className="mt-2.5 flex items-center gap-2.5">
        {/* Setup Selector (75% width, không logo, multi setup, có bánh răng sửa) */}
        <div className="w-[75%] relative" ref={setupDropdownRef}>
          <button
            type="button"
            onClick={() => setSetupDropdownOpen(!setupDropdownOpen)}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl clay-well hover:border-teal-500/40 text-xs font-semibold text-[var(--text-primary)] transition-all cursor-pointer shadow-xs"
            title="Technical Setup (multi-select)"
          >
            <div className="flex items-center gap-1.5 min-w-0 pr-2 truncate">
              <span className="text-[var(--text-muted)] font-normal shrink-0">Setup:</span>
              <span className="font-semibold text-[var(--text-primary)] truncate">{setupDisplayText}</span>
            </div>
            <ChevronUp className={`w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 transition-transform ${setupDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropup Setup */}
          {setupDropdownOpen && (
            <div className="absolute bottom-full mb-2 left-0 w-full min-w-[240px] max-w-sm clay-card rounded-2xl shadow-2xl border border-[var(--border-main)] overflow-hidden z-50 text-xs flex flex-col max-h-64 font-sans animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="px-3 py-2 text-[11px] font-bold text-[#1d1b17] border-b border-[var(--border-main)] uppercase tracking-wider flex items-center justify-between shrink-0 bg-white">
                <span>Technical Setups</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-[var(--text-muted)] font-normal">Selected: {currentSetups.length}</span>
                  {onOpenChecklistEditor && (
                    <button
                      type="button"
                      onClick={() => {
                        setSetupDropdownOpen(false);
                        onOpenChecklistEditor();
                      }}
                      className="p-1 rounded hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[#1d1b17] cursor-pointer"
                      title="Edit Setups"
                    >
                      <SettingsIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-y-auto flex-1 p-2 space-y-0.5 min-h-0 bg-white">
                {setupTags.map((st, idx) => {
                  const isSelected = currentSetups.includes(st.label);
                  return (
                    <React.Fragment key={st.id}>
                      <button
                        type="button"
                        onClick={() => toggleSetup(st.label)}
                        className={`w-full text-left p-2 rounded-xl flex items-center gap-2 text-xs transition-colors cursor-pointer border ${
                          isSelected
                            ? 'border-[#1d1b17]/60 bg-[var(--bg-subtle)] text-[#1d1b17] font-normal'
                            : 'border-transparent text-[#4a463e] font-normal hover:bg-[var(--bg-subtle)]'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-[3.5px] border flex items-center justify-center shrink-0 transition-colors bg-white ${
                          isSelected ? 'border-[#1d1b17]' : 'border-[var(--border-main)]'
                        }`}>
                          {isSelected && <Check className="w-2.5 h-2.5 text-[#1d1b17] stroke-[3]" />}
                        </div>
                        <span className="truncate leading-snug">{st.label}</span>
                      </button>
                      {idx < setupTags.length - 1 && (
                        <div className="w-full border-b border-[var(--border-subtle)]/80 my-0.5" />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Timeframe Selector (25% width, multi-select dropup, có bánh răng sửa TF) */}
        <div className="w-[25%] relative" ref={timeframeDropdownRef}>
          <button
            type="button"
            onClick={() => setTimeframeDropdownOpen(!timeframeDropdownOpen)}
            className="w-full flex items-center justify-between px-2.5 py-2 rounded-xl clay-well hover:border-teal-500/40 text-xs font-semibold text-[var(--text-primary)] transition-all cursor-pointer shadow-xs"
            title="Timeframe (multi-select)"
          >
            <div className="flex items-center gap-1 min-w-0 pr-1 truncate">
              <span className="text-[var(--text-muted)] font-normal shrink-0">TF:</span>
              <span className="font-mono font-bold text-[var(--text-primary)] truncate">{tfDisplayText}</span>
            </div>
            <ChevronUp className={`w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 transition-transform ${timeframeDropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* Dropup Timeframe */}
          {timeframeDropdownOpen && (
            <div className="absolute bottom-full mb-2 right-0 w-40 clay-card rounded-2xl shadow-2xl border border-[var(--border-main)] overflow-hidden z-50 text-xs flex flex-col max-h-64 font-sans animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="px-2.5 py-1.5 text-[10px] font-bold text-[#1d1b17] border-b border-[var(--border-main)] uppercase flex items-center justify-between shrink-0 bg-white">
                <span>Timeframes</span>
                <div className="flex items-center gap-1">
                  <span className="text-[10px] text-[var(--text-muted)] font-mono font-normal">({currentTimeframes.length})</span>
                  {onOpenChecklistEditor && (
                    <button
                      type="button"
                      onClick={() => {
                        setTimeframeDropdownOpen(false);
                        onOpenChecklistEditor();
                      }}
                      className="p-1 rounded hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[#1d1b17] cursor-pointer"
                      title="Edit Timeframe options"
                    >
                      <SettingsIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              <div className="overflow-y-auto flex-1 p-2 space-y-0.5 min-h-0 bg-white">
                {availableTimeframes.map((tf, idx) => {
                  const isSelected = currentTimeframes.includes(tf);
                  return (
                    <React.Fragment key={tf}>
                      <button
                        type="button"
                        onClick={() => toggleTimeframe(tf)}
                        className={`w-full text-left p-2 rounded-xl text-xs font-mono transition-colors cursor-pointer flex items-center gap-2 border ${
                          isSelected
                            ? 'border-[#1d1b17]/60 bg-[var(--bg-subtle)] text-[#1d1b17] font-normal'
                            : 'border-transparent text-[#4a463e] font-normal hover:bg-[var(--bg-subtle)]'
                        }`}
                      >
                        <div className={`w-3.5 h-3.5 rounded-[3.5px] border flex items-center justify-center shrink-0 transition-colors bg-white ${
                          isSelected ? 'border-[#1d1b17]' : 'border-[var(--border-main)]'
                        }`}>
                          {isSelected && <Check className="w-2.5 h-2.5 text-[#1d1b17] stroke-[3]" />}
                        </div>
                        <span className="leading-snug">{tf}</span>
                      </button>
                      {idx < availableTimeframes.length - 1 && (
                        <div className="w-full border-b border-[var(--border-subtle)]/80 my-0.5" />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ROW DISCIPLINE & PSYCHOLOGY: TIẾNG ANH, XOÁ LOGO, K TÔ NỀN, ĐIỂM TRẮNG, XOÁ ĐIỂM D */}
      <div className="mt-2.5 flex items-center gap-2.5">
        {/* Selector Discipline */}
        <div className="flex-1 relative" ref={preChecklistRef}>
          <button
            type="button"
            onClick={() => setIsPreChecklistOpen(!isPreChecklistOpen)}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl clay-well hover:border-teal-500/40 text-xs font-semibold text-[var(--text-primary)] transition-all cursor-pointer shadow-xs"
            title="Click to open Discipline Checklist"
          >
            <div className="flex items-center gap-1.5 truncate pr-1">
              <span className="text-[var(--text-muted)] font-normal shrink-0">Discipline:</span>
              <span className="font-mono font-medium text-[var(--text-primary)]">{score}/{maxScore} pts</span>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {disciplineGrade && (
                <span className="px-1.5 py-0.2 rounded font-mono font-bold text-[10px] clay-pill text-teal-300">
                  {disciplineGrade}
                </span>
              )}
              <ChevronUp className={`w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 transition-transform ${isPreChecklistOpen ? 'rotate-180' : ''}`} />
            </div>
          </button>

          {/* POPUP BUNG LÊN TRÊN */}
          {isPreChecklistOpen && (
            <div className="absolute bottom-full mb-2 left-0 w-80 sm:w-96 clay-card rounded-2xl shadow-2xl border border-[var(--border-main)] overflow-hidden z-50 text-xs flex flex-col max-h-[420px] font-sans animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="px-3.5 py-2.5 border-b border-[var(--border-main)] flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[#1d1b17]">Discipline Checklist #{trade.ticket}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold px-1.5 py-0.5 rounded clay-well text-[#1d1b17] text-[11px]">
                    {score}/{maxScore} pts ({percentage}%){disciplineGrade ? ` · Grade ${disciplineGrade}` : ''}
                  </span>
                  {onOpenChecklistEditor && (
                    <button
                      type="button"
                      onClick={onOpenChecklistEditor}
                      className="p-1 rounded hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[#1d1b17] cursor-pointer"
                      title="Edit Checklist"
                    >
                      <SettingsIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Danh sách các điều kiện */}
              <div className="overflow-y-auto flex-1 p-3 space-y-1.5 min-h-0 bg-white">
                {preChecklistItems.map((item, idx) => {
                  const isChecked = preChecklistIds.includes(item.id);
                  return (
                    <React.Fragment key={item.id}>
                      <button
                        type="button"
                        onClick={() => togglePreChecklist(item.id)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-colors text-left ${
                          isChecked
                            ? 'border-[#1d1b17]/60 bg-[var(--bg-subtle)] text-[#1d1b17] font-normal'
                            : 'border-transparent text-[#4a463e] font-normal hover:bg-[var(--bg-subtle)]'
                        }`}
                      >
                        <div className="flex items-center gap-2 pr-2 min-w-0">
                          <div className={`w-3.5 h-3.5 rounded-[3.5px] border flex items-center justify-center shrink-0 transition-colors bg-white ${
                            isChecked ? 'border-[#1d1b17]' : 'border-[var(--border-main)]'
                          }`}>
                            {isChecked && <Check className="w-2.5 h-2.5 text-[#1d1b17] stroke-[3]" />}
                          </div>
                          <span className="leading-snug truncate">{item.label}</span>
                        </div>
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-[var(--bg-card)] text-[#4a463e] border border-[var(--border-main)] shrink-0 font-normal">
                          +{item.points} pts
                        </span>
                      </button>
                      {idx < preChecklistItems.length - 1 && (
                        <div className="w-full border-b border-[var(--border-subtle)]/80 my-0.5" />
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              <div className="px-3.5 py-2 border-t border-[var(--border-main)] flex items-center justify-end text-[11px] text-[var(--text-muted)] shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => setIsPreChecklistOpen(false)}
                  className="px-3 py-1 rounded-xl border border-[var(--border-main)] text-[#1d1b17] font-medium cursor-pointer hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Selector Psychology (Không màu nền, chữ đỏ khi có lỗi, tiếng Anh) */}
        <div className="flex-1 relative" ref={postMistakesRef}>
          <button
            type="button"
            onClick={() => setIsPostMistakesOpen(!isPostMistakesOpen)}
            className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl clay-well hover:border-teal-500/40 text-xs font-semibold text-[var(--text-primary)] transition-all cursor-pointer shadow-xs"
            title="Click to open Psychology Checklist"
          >
            <div className="flex items-center gap-1.5 truncate pr-1">
              <span className="text-[var(--text-muted)] font-normal shrink-0">Psychology:</span>
              <span className={`font-mono font-bold ${violationCount > 0 ? 'text-[#1d1b17]' : 'text-[var(--text-primary)]'}`}>
                {violationCount}/{postMistakeItems.length} errors
              </span>
            </div>
            <ChevronUp className={`w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 transition-transform ${isPostMistakesOpen ? 'rotate-180' : ''}`} />
          </button>

          {/* POPUP BUNG LÊN TRÊN */}
          {isPostMistakesOpen && (
            <div className="absolute bottom-full mb-2 right-0 w-80 sm:w-96 clay-card rounded-2xl shadow-2xl border border-[var(--border-main)] overflow-hidden z-50 text-xs flex flex-col max-h-[440px] font-sans animate-in fade-in slide-in-from-bottom-2 duration-150">
              <div className="px-3.5 py-2.5 border-b border-[var(--border-main)] flex items-center justify-between shrink-0 bg-white">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-[#1d1b17]">Psychology & Mistakes #{trade.ticket}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="font-mono font-bold px-1.5 py-0.5 rounded text-[11px] border border-[var(--border-main)] bg-[var(--bg-subtle)] text-[#1d1b17]">
                    {violationCount} violations
                  </span>
                  {onOpenChecklistEditor && (
                    <button
                      type="button"
                      onClick={onOpenChecklistEditor}
                      className="p-1 rounded hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[#1d1b17] cursor-pointer"
                      title="Edit Mistakes"
                    >
                      <SettingsIcon className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Danh sách lỗi và PnL Kế Hoạch */}
              <div className="overflow-y-auto flex-1 p-3 space-y-2.5 min-h-0 bg-white">
                <div className="space-y-1.5">
                  {postMistakeItems.map((item, idx) => {
                    const isChecked = postChecklistIds.includes(item.id);
                    return (
                      <React.Fragment key={item.id}>
                        <button
                          type="button"
                          onClick={() => togglePostMistake(item.id)}
                          className={`w-full flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer transition-colors text-left ${
                            isChecked
                              ? 'border-[#1d1b17]/60 bg-[var(--bg-subtle)] text-[#1d1b17] font-normal'
                              : 'border-transparent text-[#4a463e] font-normal hover:bg-[var(--bg-subtle)]'
                          }`}
                        >
                          <div className="flex items-center gap-2 pr-2 min-w-0">
                            <div className={`w-3.5 h-3.5 rounded-[3.5px] border flex items-center justify-center shrink-0 transition-colors bg-white ${
                              isChecked ? 'border-[#1d1b17]' : 'border-[var(--border-main)]'
                            }`}>
                              {isChecked && <Check className="w-2.5 h-2.5 text-[#1d1b17] stroke-[3]" />}
                            </div>
                            <span className="leading-snug truncate">{item.label}</span>
                          </div>
                          <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-[var(--bg-card)] text-[#4a463e] border border-[var(--border-main)] shrink-0 font-normal">
                            -{item.penalty_points} pts
                          </span>
                        </button>
                        {idx < postMistakeItems.length - 1 && (
                          <div className="w-full border-b border-[var(--border-subtle)]/80 my-0.5" />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>

                {/* Nhập PnL Kế Hoạch nếu cắt non */}
                <div className="pt-2 border-t border-[var(--border-main)] space-y-1.5">
                  <div className="flex items-center justify-between text-[11px] text-[var(--text-secondary)]">
                    <span className="flex items-center gap-1">
                      <DollarSign className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                      <span>Plan PnL:</span>
                    </span>
                    <div className="flex items-center gap-1">
                      <span className="font-mono text-[var(--text-muted)]">$</span>
                      <input
                        type="number"
                        placeholder="e.g. 850"
                        value={trade.plan_pnl ?? ''}
                        onChange={(e) => handlePlanPnlChange(e.target.value)}
                        className="w-24 px-2 py-0.5 rounded-lg clay-well text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:border-teal-500"
                      />
                    </div>
                  </div>

                  {hasCutEarly && (
                    <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/30 text-[11px] text-rose-300 flex items-center justify-between">
                      <span>Lost Profit (Cut early):</span>
                      <span className="font-mono font-bold text-rose-400">
                        -${(trade.lost_profit || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="px-3.5 py-2 border-t border-[var(--border-main)] flex items-center justify-end text-[11px] text-[var(--text-muted)] shrink-0 bg-white">
                <button
                  type="button"
                  onClick={() => setIsPostMistakesOpen(false)}
                  className="px-3 py-1 rounded-xl border border-[var(--border-main)] text-[#1d1b17] font-medium cursor-pointer hover:bg-[var(--bg-subtle)] transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Ô CHỨA 2 ẢNH BIỂU ĐỒ (Tactile Clay styling)
  const renderImageBoxes = (boxClassName = "flex-1 flex flex-col gap-3.5 h-full", itemClassName = "flex-1 min-h-[160px]") => (
    <div className={boxClassName}>
      {/* Ô 1: Ảnh Plan / Pre-trade */}
      <div
        tabIndex={0}
        onPaste={(e) => handlePaste(e, 'HTF')}
        onClick={() => setActiveBox('HTF')}
        className={`group relative ${itemClassName} rounded-2xl clay-card border border-[var(--border-main)] overflow-hidden flex flex-col transition-all shadow-md cursor-pointer ${
          activeBox === 'HTF' ? 'ring-2 ring-[#1d1b17]' : 'hover:ring-1 hover:ring-[var(--border-main)]'
        }`}
      >
        <div className="px-3.5 py-2 bg-[var(--bg-card)] border-b border-[var(--border-main)] flex items-center justify-between text-xs font-semibold text-[var(--text-primary)] z-10">
          <span className="flex items-center gap-1.5 truncate text-[var(--text-primary)]">
            <ImageIcon className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            <span className="truncate">{language === 'vi' ? '1. Kế Hoạch Trước Lệnh (Plan)' : '1. Pre-Trade (Plan)'}</span>
          </span>
          <div className="flex items-center gap-1">
            {preTradeImage && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewImage(preTradeImage, `${trade.symbol} - Pre-Trade Analysis`);
                  }}
                  className="p-1 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  title="Enlarge image"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    try { localStorage.removeItem(`deal_user_pre_img_${trade.ticket}`); } catch {}
                    saveTradeJournalToLocalCache(trade.ticket, { htf_image_url: '', pre_image: '' });
                    onUpdateTrade({ ...trade, htf_image_url: '', pre_image: '' });
                    triggerSaveNotification();
                  }}
                  className="p-1 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-rose-400 cursor-pointer"
                  title="Remove image"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                htfFileInputRef.current?.click();
              }}
              className="p-1 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              title="Choose image from computer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center m-2 rounded-xl relative clay-well overflow-hidden bg-black/5 min-h-[140px]">
          {preTradeImage ? (
            <img
              src={preTradeImage}
              alt="Pre-Trade Analysis"
              className="w-full h-full object-cover rounded-xl cursor-pointer transition-transform hover:scale-[1.01]"
              onClick={() => onViewImage(preTradeImage, `${trade.symbol} - Pre-Trade Analysis`)}
            />
          ) : (
            <div className="text-center p-3 text-[var(--text-muted)]">
              <p className="text-xs text-[var(--text-secondary)] font-medium mb-0.5">Plan Chart (HTF)</p>
              <p className="text-[10px] text-[var(--text-muted)]">Click or press <strong>Ctrl + V</strong> to paste image</p>
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

      {/* Ô 2: Ảnh Post-trade */}
      <div
        tabIndex={0}
        onPaste={(e) => handlePaste(e, 'LTF')}
        onClick={() => setActiveBox('LTF')}
        className={`group relative ${itemClassName} rounded-2xl clay-card border border-[var(--border-main)] overflow-hidden flex flex-col transition-all shadow-md cursor-pointer ${
          activeBox === 'LTF' ? 'ring-2 ring-[#1d1b17]' : 'hover:ring-1 hover:ring-[var(--border-main)]'
        }`}
      >
        <div className="px-3.5 py-2 bg-[var(--bg-card)] border-b border-[var(--border-main)] flex items-center justify-between text-xs font-semibold text-[var(--text-primary)] z-10">
          <span className="flex items-center gap-1.5 truncate text-[var(--text-primary)]">
            <ImageIcon className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            <span className="truncate">{language === 'vi' ? '2. Ảnh Đóng Lệnh (Post-Trade)' : '2. Post-Trade (Close)'}</span>
          </span>
          <div className="flex items-center gap-1">
            {postTradeImage && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onViewImage(postTradeImage, `${trade.symbol} - Post-Trade Close`);
                  }}
                  className="p-1 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
                  title="Enlarge image"
                >
                  <Maximize2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    try { localStorage.removeItem(`deal_user_post_img_${trade.ticket}`); } catch {}
                    saveTradeJournalToLocalCache(trade.ticket, { image_base64: '', ltf_image_url: '', image_url_1: '' });
                    onUpdateTrade({
                      ...trade,
                      image_base64: '',
                      ltf_image_url: '',
                      close_image: '',
                      image_close: '',
                      image_url_1: ''
                    });
                    triggerSaveNotification();
                  }}
                  className="p-1 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-rose-400 cursor-pointer"
                  title="Remove image"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                ltfFileInputRef.current?.click();
              }}
              className="p-1 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
              title="Choose image from computer"
            >
              <FolderOpen className="w-3.5 h-3.5 text-[var(--text-muted)]" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex items-center justify-center m-2 rounded-xl relative clay-well overflow-hidden bg-black/5 min-h-[140px]">
          {postTradeImage ? (
            <img
              src={postTradeImage}
              alt="Post-Trade Close"
              className="w-full h-full object-cover rounded-xl cursor-pointer transition-transform hover:scale-[1.01]"
              onClick={() => onViewImage(postTradeImage, `${trade.symbol} - Post-Trade Close`)}
            />
          ) : (
            <div className="text-center p-3 text-[var(--text-muted)]">
              <p className="text-xs text-[var(--text-secondary)] font-medium mb-0.5">Close Chart (EA/LTF)</p>
              <p className="text-[10px] text-[var(--text-muted)]">Click or press <strong>Ctrl + V</strong> to paste image</p>
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
  );

  // Ô GHI CHÚ: TRADE NOTES (HỖ TRỢ GÕ TIẾNG VIỆT TELEX, KHÔNG MẤT KÝ TỰ, AUTO-SAVE DEBOUNCE)
  const renderNotes = (containerClass = "flex-1 flex flex-col rounded-2xl clay-card border border-[var(--border-main)] p-4 shadow-md min-h-[90px]") => (
    <div className={containerClass}>
      <div className="pb-1.5 mb-2 border-b border-[var(--border-main)]/60 text-xs">
        <span className="font-bold text-[var(--text-primary)]">Trade Notes</span>
      </div>
      <div className="clay-well p-3 rounded-xl flex-1 border border-[var(--border-main)]/60">
        <textarea
          value={localNotes}
          onChange={handleNotesChange}
          onCompositionStart={handleNotesCompositionStart}
          onCompositionEnd={handleNotesCompositionEnd}
          onFocus={handleNotesFocus}
          onBlur={handleNotesBlur}
          placeholder="Enter trade notes, psychology observations, exit reasons..."
          className="w-full h-full bg-transparent text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none resize-none leading-relaxed min-h-[60px]"
          rows={3}
        />
      </div>
    </div>
  );

  // RENDER CARD CHI TIẾT (BỐ CỤC CHUẨN XÁC ĐÃ CHỐT)
  return (
    <div className="flex flex-col lg:flex-row gap-4 items-stretch font-sans">
      {/* CỘT TRÁI (54%): Card Thông Tin Lệnh Chuẩn Theo Ảnh + Ô Ghi Chú Bên Dưới */}
      <div className="w-full lg:w-[54%] flex flex-col gap-3.5">
        {renderSelectedTradeCard()}
        {renderNotes("flex-1 flex flex-col rounded-2xl clay-card border border-[var(--border-main)] p-4 shadow-xl min-h-[90px]")}
      </div>

      {/* CỘT PHẢI (46%): 2 Ô Ảnh Biểu Đồ (Pre-Trade trên, Post-Trade dưới) */}
      <div className="w-full lg:w-[46%] flex flex-col gap-3.5">
        {renderImageBoxes("flex-1 flex flex-col gap-3.5 h-full", "flex-1 min-h-[170px]")}
      </div>
    </div>
  );
};
