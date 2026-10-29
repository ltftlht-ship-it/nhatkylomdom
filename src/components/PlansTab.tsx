import { useLanguage } from '../context/LanguageContext';
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { TradingPlan, PreChecklistItem, PostMistakeItem, SetupTagItem } from '../types';
import { compressImage, uploadImageToSupabaseStorage, readImageFromClipboard } from '../utils/imageUtils';
import { getSavedTimeframeOptions, parseChecklistArray } from '../utils/tradeCalculations';
import { generateValidUUID } from '../lib/supabase';
import { JournalImg } from './JournalImg';
import { 
  Plus, 
  Search, 
  X, 
  Check, 
  Clock, 
  Image as ImageIcon, 
  Trash2, 
  Maximize2, 
  FolderOpen, 
  CheckSquare, 
  AlertTriangle, 
  ChevronDown,
  Pencil,
  RotateCcw
} from 'lucide-react';
import { EconomicCalendarMini } from './EconomicCalendarMini';

interface PlansTabProps {
  plans: TradingPlan[];
  trades?: any[];
  accountId?: string;
  selectedAccountId?: string;
  preChecklist: PreChecklistItem[];
  postMistakes?: PostMistakeItem[];
  setupTags: SetupTagItem[];
  onAddPlan?: (plan: TradingPlan) => Promise<void> | void;
  onReloadPlans?: () => Promise<void> | void;
  onUpdatePlanStatus?: (planId: string, status: 'PENDING' | 'EXECUTED' | 'CANCELLED') => void;
  onDeletePlan?: (planId: string) => Promise<void> | void;
  onNavigateToHistory?: () => void;
  onViewImage: (url: string, title: string) => void;
  onSelectTrade?: (trade: any) => void;
}

function generateAutoPlanName(sym: string): string {
  const cleanSym = (sym || 'XAUUSD').replace('/', '').trim().toUpperCase();
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  return `${cleanSym} - ${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

const COMMON_SYMBOLS = [
  'XAUUSD',
  'EURUSD',
  'GBPUSD',
  'BTCUSD',
  'ETHUSD',
  'USDJPY',
  'US30',
  'NAS100',
  'AUDUSD',
  'USDCAD',
  'USDCHF',
  'NZDUSD'
];

export const PlansTab: React.FC<PlansTabProps> = ({
  plans = [],
  trades = [],
  accountId = '',
  selectedAccountId,
  preChecklist = [],
  postMistakes = [],
  setupTags = [],
  onAddPlan,
  onReloadPlans,
  onUpdatePlanStatus,
  onDeletePlan,
  onViewImage,
  onSelectTrade,
  onNavigateToHistory
}) => {
  const { language } = useLanguage();

  // Đang chọn plan nào để xem/sửa (null = đang tạo mới)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);

  // Bộ lọc danh sách bên trái
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'PENDING' | 'EXECUTED'>(() => {
    return (localStorage.getItem('deal_plan_filter') as any) || 'ALL';
  });
  const [searchQuery, setSearchQuery] = useState('');

  // Timeframes
  const [availableTimeframes, setAvailableTimeframes] = useState<string[]>(() => getSavedTimeframeOptions());

  useEffect(() => {
    const handleFilterChange = (e: any) => {
      if (e?.detail) {
        setActiveFilter(e.detail);
        localStorage.setItem('deal_plan_filter', e.detail);
      }
    };
    window.addEventListener('deal_plan_filter_changed', handleFilterChange);
    return () => window.removeEventListener('deal_plan_filter_changed', handleFilterChange);
  }, []);

  useEffect(() => {
    const handleTfUpdate = () => {
      setAvailableTimeframes(getSavedTimeframeOptions());
    };
    window.addEventListener('timeframe_options_updated', handleTfUpdate);
    return () => window.removeEventListener('timeframe_options_updated', handleTfUpdate);
  }, []);

  const cleanAccountId = String(accountId || '').replace(/^acc-/, '').trim();

  // 1. CHECKLIST TÂM LÝ & CẢM XÚC TRƯỚC PHIÊN (TRÊN CÙNG ĐẦU TIÊN CỦA KHUNG LÀM VIỆC)
  const PRE_SESSION_MINDSET_ITEMS = useMemo(() => [
    { id: 'mind_1', title: 'Thân thể & Tỉnh táo (Ngủ đủ giấc, không mệt mỏi)' },
    { id: 'mind_2', title: 'Chấp nhận tính xác suất (Mọi điều đều có thể xảy ra)' },
    { id: 'mind_3', title: 'Tâm lý trung tính (Không cay cú gỡ lệnh, không hưng phấn)' },
    { id: 'mind_4', title: 'Chấp nhận rủi ro 100% (Sẵn sàng mất 1R theo kế hoạch)' },
    { id: 'mind_5', title: 'Kiên nhẫn rình mồi (Chỉ vào lệnh khi đúng setup)' },
  ], []);

  const [checkedMindsetIds, setCheckedMindsetIds] = useState<string[]>([]);
  const [isMindsetUnlocked, setIsMindsetUnlocked] = useState<boolean>(false);
  const isMindsetCompleted = checkedMindsetIds.length >= 4;

  // 2. THÔNG TIN PLAN FORM
  const [symbol, setSymbol] = useState('XAUUSD');
  const [planName, setPlanName] = useState(() => generateAutoPlanName('XAUUSD'));
  const [isNameManuallyEdited, setIsNameManuallyEdited] = useState(false);

  // Setup multi-select
  const [selectedSetups, setSelectedSetups] = useState<string[]>(() => 
    setupTags[0]?.label ? [setupTags[0].label] : ['POI sau IDM']
  );
  const [isSetupDropdownOpen, setIsSetupDropdownOpen] = useState(false);
  const setupDropdownRef = useRef<HTMLDivElement | null>(null);

  // Timeframe multi-select
  const [selectedTimeframes, setSelectedTimeframes] = useState<string[]>(['M15']);
  const [isTfDropdownOpen, setIsTfDropdownOpen] = useState(false);
  const tfDropdownRef = useRef<HTMLDivElement | null>(null);

  // Checklist
  const [selectedDisciplineIds, setSelectedDisciplineIds] = useState<string[]>(() => preChecklist.slice(0, 4).map(c => c.id));
  const [selectedPsychologyIds, setSelectedPsychologyIds] = useState<string[]>([]);

  // Image & Notes
  const [planImage, setPlanImage] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Refs
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageBoxRef = useRef<HTMLDivElement | null>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (setupDropdownRef.current && !setupDropdownRef.current.contains(e.target as Node)) {
        setIsSetupDropdownOpen(false);
      }
      if (tfDropdownRef.current && !tfDropdownRef.current.contains(e.target as Node)) {
        setIsTfDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lắng nghe sự kiện Paste (Ctrl + V) toàn cục
  useEffect(() => {
    const handleWindowPaste = async (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          e.preventDefault();
          const file = items[i].getAsFile();
          if (file) {
            try {
              const { dataUrl } = await compressImage(file, 1600, 0.8);
              setPlanImage(dataUrl);
            } catch (err) {
              console.warn('Lỗi dán ảnh:', err);
            }
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, []);

  const handleSymbolChange = (newSym: string) => {
    const clean = newSym.toUpperCase().replace('/', '').trim();
    setSymbol(clean);
    if (!isNameManuallyEdited && !selectedPlanId) {
      setPlanName(generateAutoPlanName(clean));
    }
  };

  const handleResetToNewPlan = () => {
    setSelectedPlanId(null);
    setIsMindsetUnlocked(false);
    setSymbol('XAUUSD');
    setPlanName(generateAutoPlanName('XAUUSD'));
    setIsNameManuallyEdited(false);
    setSelectedSetups(setupTags[0]?.label ? [setupTags[0].label] : ['POI sau IDM']);
    setSelectedTimeframes(['M15']);
    setSelectedDisciplineIds(preChecklist.slice(0, 4).map(c => c.id));
    setSelectedPsychologyIds([]);
    setCheckedMindsetIds([]);
    setPlanImage('');
    setNotes('');
  };

  // Click vào 1 plan trong danh sách để xem/sửa
  const handleSelectPlan = (plan: TradingPlan) => {
    setSelectedPlanId(plan.id);
    setIsMindsetUnlocked(true);
    const cleanSym = (plan.symbol || 'XAUUSD').replace('/', '').trim().toUpperCase();
    setSymbol(cleanSym);
    setPlanName(plan.plan_name || plan.title || generateAutoPlanName(cleanSym));
    setIsNameManuallyEdited(true);

    if (plan.setup) {
      const parsed = plan.setup.split(',').map(s => s.trim()).filter(Boolean);
      setSelectedSetups(parsed.length > 0 ? parsed : ['POI sau IDM']);
    } else {
      setSelectedSetups([]);
    }

    if (plan.timeframe) {
      const parsed = plan.timeframe.split(',').map(s => s.trim()).filter(Boolean);
      setSelectedTimeframes(parsed.length > 0 ? parsed : ['M15']);
    } else {
      setSelectedTimeframes(['M15']);
    }

    setSelectedDisciplineIds(parseChecklistArray(plan.checklist));
    setSelectedPsychologyIds(parseChecklistArray(plan.post_checklist));
    setPlanImage(plan.image_url || '');
    setNotes(plan.notes || '');
  };

  const toggleMindsetItem = (id: string) => {
    setCheckedMindsetIds(prev =>
      prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]
    );
  };

  const toggleSetup = (label: string) => {
    setSelectedSetups(prev => 
      prev.includes(label) ? prev.filter(s => s !== label) : [...prev, label]
    );
  };

  const toggleTimeframe = (tf: string) => {
    setSelectedTimeframes(prev => {
      if (prev.includes(tf)) {
        return prev.filter(t => t !== tf);
      } else {
        const order = availableTimeframes;
        return [...prev, tf].sort((a, b) => {
          const idxA = order.indexOf(a);
          const idxB = order.indexOf(b);
          return (idxA >= 0 ? idxA : 99) - (idxB >= 0 ? idxB : 99);
        });
      }
    });
  };

  const toggleDiscipline = (id: string) => {
    setSelectedDisciplineIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const togglePsychology = (id: string) => {
    setSelectedPsychologyIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handlePasteFromClipboard = async () => {
    try {
      const dataUrl = await readImageFromClipboard();
      if (dataUrl) {
        setPlanImage(dataUrl);
      } else {
        alert('Không tìm thấy ảnh trong bộ nhớ tạm. Thầy hãy bấm nút Máy ảnh trên biểu đồ -> Sao chép ảnh, rồi bấm lại nhé!');
      }
    } catch (err) {
      console.warn('Lỗi clipboard:', err);
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        const { dataUrl } = await compressImage(file, 1600, 0.8);
        setPlanImage(dataUrl);
      } catch (err) {
        console.warn('Lỗi đọc ảnh:', err);
      }
    }
  };

  const handleSubmitPlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!symbol.trim() || !planName.trim()) return;

    setIsSubmitting(true);
    const finalName = planName.trim() || generateAutoPlanName(symbol);
    const currentAccountId = String(selectedAccountId || accountId || '').replace(/^acc-/, '').trim();
    const setupStr = selectedSetups.join(', ') || 'Standard setup';
    const tfStr = selectedTimeframes.join(', ') || 'M15';

    const existingPlan = plans.find(p => p.id === selectedPlanId);

    const planToSave: TradingPlan = existingPlan 
      ? {
          ...existingPlan,
          account_id: existingPlan.account_id ? String(existingPlan.account_id).replace(/^acc-/, '').trim() : currentAccountId,
          symbol: symbol.toUpperCase().trim(),
          plan_name: finalName,
          timeframe: tfStr,
          setup: setupStr,
          notes: notes.trim(),
          checklist: selectedDisciplineIds,
          post_checklist: selectedPsychologyIds,
          image_url: planImage || '',
        }
      : {
          id: generateValidUUID(),
          account_id: currentAccountId || '',
          symbol: symbol.toUpperCase().trim(),
          plan_name: finalName,
          timeframe: tfStr,
          setup: setupStr,
          notes: notes.trim(),
          checklist: selectedDisciplineIds,
          post_checklist: selectedPsychologyIds,
          image_url: planImage || '',
          status: 'PENDING',
          created_at: new Date().toISOString(),
        };

    try {
      if (onAddPlan) {
        await onAddPlan(planToSave);
      }
      handleResetToNewPlan();
      if (onReloadPlans) {
        await onReloadPlans();
      }
    } catch (err) {
      console.error('Lỗi lưu kế hoạch:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (planId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm('Xóa kế hoạch này?')) {
      if (onDeletePlan) {
        await onDeletePlan(planId);
      }
      if (selectedPlanId === planId) {
        handleResetToNewPlan();
      }
      if (onReloadPlans) {
        await onReloadPlans();
      }
    }
  };

  const handleToggleStatus = async (plan: TradingPlan, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const nextStatus = (plan.status === 'EXECUTED' || plan.status === 'TRIGGERED') ? 'PENDING' : 'EXECUTED';
    if (onUpdatePlanStatus) {
      onUpdatePlanStatus(plan.id, nextStatus);
    }
    if (onReloadPlans) {
      await onReloadPlans();
    }
  };

  // Filter plans: Luôn hiển thị danh sách đầy đủ tất cả kế hoạch đã tạo của Thầy
  const filteredPlans = useMemo(() => {
    return plans.filter(p => {
      if (activeFilter === 'PENDING' && !(p.status === 'PENDING' || p.status === 'READY')) return false;
      if (activeFilter === 'EXECUTED' && !(p.status === 'EXECUTED' || p.status === 'TRIGGERED')) return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchSym = (p.symbol || '').toLowerCase().includes(q);
        const matchName = (p.plan_name || p.title || '').toLowerCase().includes(q);
        const matchSetup = (p.setup || '').toLowerCase().includes(q);
        const matchAcc = (p.account_id || '').toLowerCase().includes(q);
        if (!matchSym && !matchName && !matchSetup && !matchAcc) return false;
      }
      return true;
    });
  }, [plans, activeFilter, searchQuery]);

  return (
    <div className="flex flex-col min-h-full py-5 px-4 sm:px-6 lg:px-[6%] xl:px-[8%] space-y-4 max-w-[1700px] mx-auto w-full transition-all font-sans text-[#1d1b17]">
      {/* BỐ CỤC 2 CỘT SONG SONG: CỘT TRÁI (TẠO/SỬA PLAN) vs CỘT PHẢI (BẢNG DANH SÁCH KẾ HOẠCH LỆNH) */}
      <div className="flex flex-col lg:flex-row gap-4 w-full items-stretch">
        
        {/* CỘT BÊN TRÁI: KHUNG TẠO / SỬA PLAN */}
        <div className="flex-1 w-full flex flex-col min-w-0 order-1">
          {/* KHUNG LÀM VIỆC TẠO / SỬA KẾ HOẠCH GIAO DỊCH */}
          <div className="clay-card p-5 rounded-2xl shadow-xl border border-[var(--border-main)] bg-[var(--bg-card)] flex flex-col h-full space-y-4">
            
            {/* HEADER KHUNG LÀM VIỆC */}
            <div className="flex items-center justify-between pb-3 border-b border-[var(--border-main)]">
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#1d1b17] text-xs uppercase tracking-wider">
                  {selectedPlanId ? 'CHỈNH SỬA KẾ HOẠCH GIAO DỊCH' : 'TẠO KẾ HOẠCH GIAO DỊCH MỚI'}
                </span>
                {selectedPlanId && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-[var(--bg-subtle)] text-[#1d1b17] border border-[var(--border-main)]">
                    #{symbol}
                  </span>
                )}
              </div>

              {(selectedPlanId || isMindsetUnlocked) && (
                <button
                  type="button"
                  onClick={handleResetToNewPlan}
                  className="px-3 py-1 rounded-xl bg-white hover:bg-[var(--bg-subtle)] border border-[var(--border-main)] text-xs font-semibold text-[#1d1b17] transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
                >
                  <RotateCcw className="w-3 h-3 text-[var(--text-muted)]" />
                  <span>Tạo Kế Hoạch Mới</span>
                </button>
              )}
            </div>

            {/* CHECKLIST TÂM LÝ & CẢM XÚC TRƯỚC GIAO DỊCH (LUÔN XUẤT HIỆN Ở ĐẦU) */}
            <div className="p-3.5 bg-[var(--bg-subtle)]/70 rounded-xl border border-[var(--border-main)] shadow-xs flex flex-col space-y-2.5">
              <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border-main)]">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-[#1d1b17] text-xs uppercase tracking-wider">
                    CHECKLIST TÂM LÝ & CẢM XÚC TRƯỚC GIAO DỊCH
                  </span>
                  <span className="text-[10px] font-mono font-bold text-[#1d1b17] px-2 py-0.5 rounded bg-white border border-[var(--border-main)]">
                    {checkedMindsetIds.length}/{PRE_SESSION_MINDSET_ITEMS.length}
                  </span>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (checkedMindsetIds.length === PRE_SESSION_MINDSET_ITEMS.length) {
                      setCheckedMindsetIds([]);
                    } else {
                      setCheckedMindsetIds(PRE_SESSION_MINDSET_ITEMS.map(m => m.id));
                    }
                  }}
                  className="text-[11px] text-[#1d1b17] hover:text-[var(--text-secondary)] font-semibold cursor-pointer underline"
                >
                  {checkedMindsetIds.length === PRE_SESSION_MINDSET_ITEMS.length ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
              </div>

              {/* 5 MỤC TÂM LÝ: Ô TICK VUÔNG NỀN TRẮNG, TICK ĐEN, KHÔNG TÔ ĐEN Ô */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {PRE_SESSION_MINDSET_ITEMS.map((item, idx) => {
                  const isChecked = checkedMindsetIds.includes(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => toggleMindsetItem(item.id)}
                      className={`flex items-center gap-2.5 p-2 rounded-xl border text-xs cursor-pointer transition-all text-left ${
                        isChecked
                          ? 'bg-white border-[#1d1b17]/60 text-[#1d1b17] font-semibold shadow-xs'
                          : 'bg-white/70 border-[var(--border-main)] text-[var(--text-secondary)] hover:bg-white'
                      }`}
                    >
                      <div className={`w-3.5 h-3.5 rounded-[3.5px] border flex items-center justify-center shrink-0 transition-colors bg-white ${
                        isChecked ? 'border-[#1d1b17]' : 'border-[var(--border-main)]'
                      }`}>
                        {isChecked && <Check className="w-2.5 h-2.5 text-[#1d1b17] stroke-[3]" />}
                      </div>
                      <span className="leading-snug">
                        {idx + 1}. {item.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* BƯỚC MỞ KHÓA: NÚT TẠO LỆNH XUẤT HIỆN, TICK ĐỦ MỚI BẤM ĐƯỢC ĐỂ HIỆN PHẦN KẾ TIẾP */}
            {!isMindsetUnlocked && !selectedPlanId && (
              <div className="pt-1">
                {!isMindsetCompleted ? (
                  <button
                    type="button"
                    disabled
                    className="w-full py-3 px-4 rounded-xl border border-[var(--border-main)] bg-[var(--bg-subtle)] text-[var(--text-muted)] font-semibold text-xs flex items-center justify-center gap-2 cursor-not-allowed opacity-60 shadow-xs"
                  >
                    <span>Cần đạt tối thiểu 4/5 checklist tâm lý ({checkedMindsetIds.length}/5) để tạo lệnh</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsMindsetUnlocked(true)}
                    className="w-full py-3 px-4 rounded-xl border border-[#1d1b17] bg-[#1d1b17] text-white hover:bg-[#2b2721] font-bold text-xs flex items-center justify-center gap-2 cursor-pointer shadow-md transition-all active:scale-[0.99]"
                  >
                    <Check className="w-4 h-4 text-emerald-400 stroke-[3]" />
                    <span>Tâm lý đã sẵn sàng ({checkedMindsetIds.length}/5) · Bấm vào đây để tạo kế hoạch lệnh #{symbol}</span>
                  </button>
                )}
              </div>
            )}

            {/* KHI ĐÃ QUA ẢI TÂM LÝ HOẶC ĐANG CHỈNH SỬA PLAN: HIỆN RA CẤU HÌNH, CHECKLIST KỶ LUẬT, ẢNH & GHI CHÚ */}
            {(isMindsetUnlocked || selectedPlanId) && (
              <form onSubmit={handleSubmitPlan} className="space-y-4 pt-1 animate-in fade-in duration-200">
                {/* 1. CẤU HÌNH PLAN: SYMBOL + TÊN PLAN + SETUP + TIMEFRAME */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                  {/* SYMBOL */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      Symbol
                    </label>
                    <div className="relative">
                      <select
                        value={symbol}
                        onChange={(e) => handleSymbolChange(e.target.value)}
                        className="w-full appearance-none px-3 py-2 rounded-xl bg-white border border-[var(--border-main)] text-xs font-bold text-[#1d1b17] focus:outline-none focus:border-[#1d1b17] cursor-pointer pr-8 font-sans shadow-xs"
                      >
                        {COMMON_SYMBOLS.map((sym) => (
                          <option key={sym} value={sym} className="bg-white text-[#1d1b17]">
                            {sym}
                          </option>
                        ))}
                        {!COMMON_SYMBOLS.includes(symbol) && (
                          <option value={symbol} className="bg-white text-[#1d1b17]">
                            {symbol}
                          </option>
                        )}
                      </select>
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  {/* TÊN KẾ HOẠCH */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      Tên Kế Hoạch
                    </label>
                    <input
                      type="text"
                      value={planName}
                      onChange={(e) => {
                        setPlanName(e.target.value);
                        setIsNameManuallyEdited(true);
                      }}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--border-main)] text-xs text-[#1d1b17] font-semibold focus:outline-none focus:border-[#1d1b17] font-sans shadow-xs"
                    />
                  </div>

                  {/* SETUP (MULTI-SELECT) */}
                  <div className="flex flex-col gap-1 relative" ref={setupDropdownRef}>
                    <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      Setup ({selectedSetups.length})
                    </label>
                    <div
                      onClick={() => setIsSetupDropdownOpen(!isSetupDropdownOpen)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--border-main)] text-xs text-[#1d1b17] font-semibold focus:outline-none focus:border-[#1d1b17] cursor-pointer flex items-center justify-between shadow-xs"
                    >
                      <span className="truncate">
                        {selectedSetups.length > 0 ? selectedSetups.join(', ') : 'Chọn Setup...'}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 ml-1" />
                    </div>

                    {isSetupDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[var(--border-main)] rounded-xl shadow-2xl z-30 p-2 max-h-48 overflow-y-auto space-y-1">
                        {setupTags.map((tag) => {
                          const isChecked = selectedSetups.includes(tag.label);
                          return (
                            <button
                              key={tag.id}
                              type="button"
                              onClick={() => toggleSetup(tag.label)}
                              className={`w-full flex items-center gap-2 p-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors text-left border ${
                                isChecked ? 'border-[#1d1b17]/60 bg-[var(--bg-subtle)] text-[#1d1b17] font-normal' : 'border-transparent text-[#4a463e] hover:bg-[var(--bg-subtle)]'
                              }`}
                            >
                              <div className={`w-3.5 h-3.5 rounded-[3.5px] border flex items-center justify-center shrink-0 transition-colors bg-white ${
                                isChecked ? 'border-[#1d1b17]' : 'border-[var(--border-main)]'
                              }`}>
                                {isChecked && <Check className="w-2.5 h-2.5 text-[#1d1b17] stroke-[3]" />}
                              </div>
                              <span className="truncate">{tag.label}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* TIMEFRAME (MULTI-SELECT) */}
                  <div className="flex flex-col gap-1 relative" ref={tfDropdownRef}>
                    <label className="text-[11px] font-semibold text-[var(--text-muted)] uppercase tracking-wider">
                      Timeframe ({selectedTimeframes.length})
                    </label>
                    <div
                      onClick={() => setIsTfDropdownOpen(!isTfDropdownOpen)}
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[var(--border-main)] text-xs text-[#1d1b17] font-mono font-bold focus:outline-none focus:border-[#1d1b17] cursor-pointer flex items-center justify-between shadow-xs"
                    >
                      <span className="truncate">
                        {selectedTimeframes.length > 0 ? selectedTimeframes.join(', ') : 'Chọn TF...'}
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 ml-1" />
                    </div>

                    {isTfDropdownOpen && (
                      <div className="absolute top-full left-0 mt-1 w-full bg-white border border-[var(--border-main)] rounded-xl shadow-2xl z-30 p-2 max-h-48 overflow-y-auto space-y-1">
                        {availableTimeframes.map((tf) => {
                          const isChecked = selectedTimeframes.includes(tf);
                          return (
                            <button
                              key={tf}
                              type="button"
                              onClick={() => toggleTimeframe(tf)}
                              className={`w-full flex items-center gap-2 p-1.5 rounded-lg text-xs font-mono cursor-pointer select-none transition-colors text-left border ${
                                isChecked ? 'border-[#1d1b17]/60 bg-[var(--bg-subtle)] text-[#1d1b17] font-normal' : 'border-transparent text-[#4a463e] hover:bg-[var(--bg-subtle)]'
                              }`}
                            >
                              <div className={`w-3.5 h-3.5 rounded-[3.5px] border flex items-center justify-center shrink-0 transition-colors bg-white ${
                                isChecked ? 'border-[#1d1b17]' : 'border-[var(--border-main)]'
                              }`}>
                                {isChecked && <Check className="w-2.5 h-2.5 text-[#1d1b17] stroke-[3]" />}
                              </div>
                              <span>{tf}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. 2 CHECKLIST: KỶ LUẬT & LỖI TÂM LÝ */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* CHECKLIST KỶ LUẬT */}
                  <div className="bg-white rounded-xl border border-[var(--border-main)] p-3.5 shadow-xs flex flex-col gap-2">
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--border-main)] text-xs">
                      <span className="font-bold text-[#1d1b17] uppercase tracking-wider">
                        CHECKLIST KỶ LUẬT
                      </span>
                      <span className="font-mono text-[11px] font-bold text-[#1d1b17] px-2 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-main)]">
                        {selectedDisciplineIds.length}/{preChecklist.length}
                      </span>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {preChecklist.map((item) => {
                        const isChecked = selectedDisciplineIds.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => toggleDiscipline(item.id)}
                            className={`w-full flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer select-none transition-colors text-left ${
                              isChecked ? 'border-[#1d1b17]/60 bg-[var(--bg-subtle)] text-[#1d1b17] font-normal' : 'border-transparent text-[#4a463e] hover:bg-[var(--bg-subtle)]'
                            }`}
                          >
                            <div className="flex items-center gap-2 pr-2 min-w-0">
                              <div className={`w-3.5 h-3.5 rounded-[3.5px] border flex items-center justify-center shrink-0 transition-colors bg-white ${
                                isChecked ? 'border-[#1d1b17]' : 'border-[var(--border-main)]'
                              }`}>
                                {isChecked && <Check className="w-2.5 h-2.5 text-[#1d1b17] stroke-[3]" />}
                              </div>
                              <span className="truncate leading-snug">{item.label}</span>
                            </div>
                            <span className="font-mono text-[10px] text-[#4a463e] px-1.5 py-0.2 rounded bg-[var(--bg-card)] border border-[var(--border-main)] shrink-0">
                              +{item.points} pts
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* CHECKLIST LỖI TÂM LÝ */}
                  <div className="bg-white rounded-xl border border-[var(--border-main)] p-3.5 shadow-xs flex flex-col gap-2">
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--border-main)] text-xs">
                      <span className="font-bold text-[var(--text-primary)] uppercase tracking-wider">
                        LỖI TÂM LÝ & SAI LẦM
                      </span>
                      <span className="font-mono text-[11px] font-medium text-[var(--text-primary)] px-2 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-main)]">
                        {selectedPsychologyIds.length} lỗi
                      </span>
                    </div>
                    <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
                      {postMistakes.map((item) => {
                        const isChecked = selectedPsychologyIds.includes(item.id);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => togglePsychology(item.id)}
                            className={`w-full flex items-center justify-between p-2 rounded-xl border text-xs cursor-pointer select-none transition-colors text-left ${
                              isChecked ? 'border-[#1d1b17]/60 bg-[var(--bg-subtle)] text-[#1d1b17] font-normal' : 'border-transparent text-[#4a463e] hover:bg-[var(--bg-subtle)]'
                            }`}
                          >
                            <div className="flex items-center gap-2 pr-2 min-w-0">
                              <div className={`w-3.5 h-3.5 rounded-[3.5px] border flex items-center justify-center shrink-0 transition-colors bg-white ${
                                isChecked ? 'border-[#1d1b17]' : 'border-[var(--border-main)]'
                              }`}>
                                {isChecked && <Check className="w-2.5 h-2.5 text-[#1d1b17] stroke-[3]" />}
                              </div>
                              <span className="truncate leading-snug">{item.label}</span>
                            </div>
                            <span className="font-mono text-[10px] text-[var(--text-muted)] px-1.5 py-0.2 rounded bg-[var(--bg-card)] border border-[var(--border-main)] shrink-0">
                              -{item.penalty_points} pts
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 3. Ô HÌNH ẢNH BIỂU ĐỒ & GHI CHÚ */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {/* Ô HÌNH ẢNH (HỖ TRỢ CTRL+V & DÁN CLIPBOARD) */}
                  <div
                    ref={imageBoxRef}
                    tabIndex={0}
                    className="rounded-xl bg-white border border-[var(--border-main)] hover:border-[#1d1b17]/40 focus:border-[#1d1b17] focus:outline-none flex flex-col overflow-hidden shadow-xs min-h-[160px]"
                  >
                    <div className="px-3.5 py-2 bg-[var(--bg-panel)] border-b border-[var(--border-main)] flex items-center justify-between text-xs text-[#1d1b17]">
                      <span className="font-bold">ẢNH BIỂU ĐỒ (PRE-TRADE)</span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={handlePasteFromClipboard}
                          className="px-2.5 py-0.5 rounded-lg bg-white hover:bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[10px] font-semibold text-[#1d1b17] transition-colors cursor-pointer"
                        >
                          Dán Clipboard
                        </button>
                        {planImage && (
                          <>
                            <button
                              type="button"
                              onClick={() => onViewImage(planImage, `Plan Chart - ${symbol}`)}
                              className="p-1 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[#1d1b17] cursor-pointer"
                            >
                              <Maximize2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setPlanImage('')}
                              className="p-1 rounded-lg hover:bg-rose-50 text-[var(--text-muted)] hover:text-rose-500 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="p-1 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[#1d1b17] cursor-pointer"
                          title="Chọn ảnh từ máy"
                        >
                          <FolderOpen className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div 
                      className="flex-1 flex items-center justify-center p-3 relative bg-[var(--bg-subtle)]/20 min-h-[130px] cursor-text"
                      onClick={() => imageBoxRef.current?.focus()}
                    >
                      {planImage ? (
                        <JournalImg
                          src={planImage}
                          alt="Plan Chart Preview"
                          className="max-h-56 w-auto object-contain rounded-lg cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewImage(planImage, `Plan Chart - ${symbol}`);
                          }}
                        />
                      ) : (
                        <div className="text-center p-3 text-[var(--text-muted)] select-none">
                          <p className="text-xs text-[#1d1b17] font-semibold mb-1">
                            Nhấn <kbd className="px-2 py-0.5 rounded bg-white text-[#1d1b17] font-mono font-bold border border-[var(--border-main)] shadow-xs">Ctrl + V</kbd> để dán ảnh
                          </p>
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImageFileChange}
                    />
                  </div>

                  {/* GHI CHÚ KẾ HOẠCH */}
                  <div className="flex flex-col rounded-xl bg-white border border-[var(--border-main)] p-3.5 shadow-xs min-h-[160px]">
                    <div className="pb-2 mb-2 border-b border-[var(--border-main)] text-xs font-bold text-[#1d1b17]">
                      GHI CHÚ KẾ HOẠCH
                    </div>
                    <textarea
                      rows={4}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Ghi chú cấu trúc thị trường, vùng POI, kịch bản vào lệnh..."
                      className="w-full flex-1 bg-transparent text-xs text-[#1d1b17] placeholder-[var(--text-muted)] focus:outline-none resize-none leading-relaxed min-h-[90px]"
                    />
                  </div>
                </div>

                {/* 4. NÚT SUBMIT LƯU KẾ HOẠCH */}
                <div className="pt-2 border-t border-[var(--border-main)] flex items-center justify-end gap-2.5">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="px-6 py-2.5 rounded-xl bg-[#1d1b17] hover:bg-[#2b2721] text-white font-bold text-xs flex items-center gap-2 transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Check className="w-4 h-4 text-white stroke-[2.5]" />
                    <span>
                      {isSubmitting ? 'Đang Lưu...' : selectedPlanId ? 'CẬP NHẬT KẾ HOẠCH' : 'LƯU KẾ HOẠCH GIAO DỊCH'}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>

        {/* CỘT BÊN PHẢI: LỊCH KINH TẾ (TRÊN ĐẦU DANH SÁCH) + BẢNG DANH SÁCH KẾ HOẠCH LỆNH (DƯỚI) */}
        <div className="w-full lg:w-[450px] xl:w-[480px] shrink-0 flex flex-col order-2 space-y-3.5">
          {/* 1. LỊCH KINH TẾ NẰM TRÊN ĐẦU DANH SÁCH */}
          <div className="shrink-0">
            <EconomicCalendarMini />
          </div>

          {/* 2. BẢNG DANH SÁCH KẾ HOẠCH LỆNH (TỰ ĐỘNG GIÃN DÀI CHIẾM TRỌN PHẦN CÒN LẠI ĐỂ DÀI BẰNG VÀ NGANG ĐÁY VỚI Ô BÊN TRÁI KHI THẢ XUỐNG) */}
          <div className="clay-card rounded-2xl shadow-xl border border-[var(--border-main)] bg-[var(--bg-card)] flex-1 flex flex-col min-h-[300px] overflow-hidden">
            {/* HEADER DANH SÁCH + TÌM KIẾM + LỌC */}
            <div className="p-3.5 border-b border-[var(--border-main)] flex flex-col space-y-2.5 bg-white/50 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-[var(--text-primary)] text-xs uppercase tracking-wider">
                  DANH SÁCH KẾ HOẠCH LỆNH ({filteredPlans.length})
                </span>
                <div className="flex items-center clay-well p-0.5 rounded-full border border-[var(--border-main)]/50">
                  {(['ALL', 'PENDING', 'EXECUTED'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setActiveFilter(tab)}
                      className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold transition-all cursor-pointer ${
                        activeFilter === tab ? 'clay-pill text-[#1d1b17] font-bold bg-white shadow-xs' : 'text-[var(--text-muted)] hover:text-[#1d1b17]'
                      }`}
                    >
                      {tab === 'ALL' ? 'All' : tab === 'PENDING' ? 'Pending' : 'Done'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Tìm symbol / kế hoạch..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full px-3 py-1.5 rounded-xl clay-well text-xs text-[#1d1b17] placeholder-[var(--text-muted)] focus:outline-none focus:border-[#1d1b17] font-mono transition-colors border border-[var(--border-main)]"
                />
              </div>
            </div>

            {/* DANH SÁCH CÁC KẾ HOẠCH: CUỘN MƯỢT MÀ BÊN TRONG, KÉO DÀI THEO CHIỀU CAO Ô BÊN TRÁI */}
            <div className="p-3 space-y-2 flex-1 overflow-y-auto min-h-0">
              {filteredPlans.length === 0 ? (
                <div className="p-8 text-center text-[var(--text-muted)] text-xs clay-card rounded-2xl border border-[var(--border-main)] bg-[var(--bg-card)]">
                  Chưa có kế hoạch nào trong danh sách.
                </div>
              ) : (
                filteredPlans.map((plan) => {
                  const isSelected = selectedPlanId === plan.id;
                  const isExecuted = plan.status === 'EXECUTED' || plan.status === 'TRIGGERED';

                  return (
                    <div
                      key={plan.id}
                      onClick={() => handleSelectPlan(plan)}
                      className={`p-3 rounded-xl border transition-all cursor-pointer bg-white group ${
                        isSelected
                          ? 'border-[#1d1b17] bg-[var(--bg-subtle)] text-[#1d1b17] shadow-sm'
                          : 'border-[var(--border-main)] hover:border-[#1d1b17]/50 hover:bg-[#faf7f2]'
                      }`}
                    >
                      {/* Dòng 1: Symbol + Timeframe + Status + Nút thao tác */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono font-bold text-xs text-[#1d1b17] bg-[var(--bg-subtle)] px-2 py-0.5 rounded border border-[var(--border-main)]">
                            {plan.symbol}
                          </span>
                          <span className="text-[10px] font-mono font-semibold text-[var(--text-muted)] px-1.5 py-0.5 rounded bg-white border border-[var(--border-main)]">
                            {plan.timeframe || 'M15'}
                          </span>
                          {plan.account_id && (
                            <span className="text-[10px] font-mono font-semibold text-[#1d1b17] px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-main)]">
                              #{plan.account_id}
                            </span>
                          )}
                          <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-medium uppercase border ${
                            isExecuted
                              ? 'border-[#4a6152]/40 bg-[#4a6152]/10 text-[var(--text-primary)]'
                              : 'border-[var(--border-main)] bg-[var(--bg-subtle)] text-[var(--text-muted)]'
                          }`}>
                            {isExecuted ? 'EXECUTED' : 'PENDING'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={(e) => handleToggleStatus(plan, e)}
                            className="px-2 py-0.5 rounded text-[10px] font-mono bg-white hover:bg-[var(--bg-subtle)] text-[#1d1b17] border border-[var(--border-main)] transition-colors cursor-pointer"
                            title={isExecuted ? 'Đánh dấu Chưa Thực Hiện' : 'Đánh dấu Đã Khớp/Thực Hiện'}
                          >
                            {isExecuted ? 'Pending' : 'Done'}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(plan.id, e)}
                            className="p-1 rounded hover:bg-rose-50 text-[var(--text-muted)] hover:text-rose-500 transition-colors cursor-pointer"
                            title="Xóa kế hoạch"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Dòng 2: Tên kế hoạch */}
                      <div className="text-xs font-bold text-[#1d1b17] mt-1.5 line-clamp-1 group-hover:text-[#4a6152] transition-colors">
                        {plan.plan_name || plan.title}
                      </div>

                      {/* Dòng 3: Setup tag & Số tiêu chí kỷ luật */}
                      <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] mt-1.5 font-sans flex-wrap gap-1">
                        <span className="truncate max-w-[220px]">
                          Setup: <span className="font-semibold text-[#1d1b17]">{plan.setup || 'Standard'}</span>
                        </span>
                        {plan.checklist && plan.checklist.length > 0 && (
                          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] text-[#1d1b17] border border-[var(--border-main)]">
                            {plan.checklist.length} tiêu chí
                          </span>
                        )}
                      </div>

                      {/* Ảnh Thumbnail nhỏ (nếu có) */}
                      {plan.image_url && (
                        <div className="mt-2 flex items-center gap-2 p-1.5 rounded-lg bg-[var(--bg-subtle)]/50 border border-[var(--border-main)]">
                          <div 
                            className="w-12 h-9 rounded overflow-hidden border border-[var(--border-main)] shrink-0 bg-white cursor-pointer hover:opacity-85"
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewImage(plan.image_url!, plan.plan_name || plan.symbol);
                            }}
                          >
                            <JournalImg src={plan.image_url} alt="Chart" className="w-full h-full object-cover" />
                          </div>
                          <span 
                            onClick={(e) => {
                              e.stopPropagation();
                              onViewImage(plan.image_url!, plan.plan_name || plan.symbol);
                            }}
                            className="text-[11px] text-[var(--text-muted)] hover:text-[#1d1b17] cursor-pointer truncate"
                          >
                            Xem ảnh biểu đồ pre-trade ↗
                          </span>
                        </div>
                      )}

                      {/* Ghi chú ngắn gọn (nếu có) */}
                      {plan.notes && (
                        <div className="text-[11px] text-[var(--text-muted)] mt-1 line-clamp-1 italic">
                          "{plan.notes}"
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
