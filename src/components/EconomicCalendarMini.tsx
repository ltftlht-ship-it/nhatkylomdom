import React, { useState, useEffect, useMemo, useRef } from 'react';
import { RotateCw, Check, X } from 'lucide-react';
import { FALLBACK_CALENDAR_EVENTS } from '../data/calendarData';

export interface MiniCalendarEvent {
  title: string;
  country: string;
  date: string;
  impact: 'High' | 'Medium' | 'Low' | 'Holiday' | string;
  forecast: string;
  previous: string;
}

// Danh sách các đồng tiền & symbol phổ biến tương ứng
const CURRENCIES_CONFIG = [
  { code: 'USD', name: 'Đô la Mỹ (USD)' },
  { code: 'EUR', name: 'Euro (EUR)' },
  { code: 'GBP', name: 'Bảng Anh (GBP)' },
  { code: 'JPY', name: 'Yên Nhật (JPY)' },
  { code: 'AUD', name: 'Đô la Úc (AUD)' },
  { code: 'CAD', name: 'Đô la Canada (CAD)' },
  { code: 'CHF', name: 'Franc Thụy Sĩ (CHF)' },
  { code: 'NZD', name: 'Đô la New Zealand (NZD)' },
  { code: 'CNY', name: 'Nhân dân tệ (CNY)' },
];

export const EconomicCalendarMini: React.FC = () => {
  const [events, setEvents] = useState<MiniCalendarEvent[]>(() => {
    try {
      const saved = localStorage.getItem('deal_calendar_events_cache_v2');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return FALLBACK_CALENDAR_EVENTS || [];
  });
  const [isLoading, setIsLoading] = useState(false);

  // MẶC ĐỊNH AUTO HIỆN CẢ TUẦN
  const [timeFilter, setTimeFilter] = useState<'WEEK' | 'TODAY'>(() => {
    return (localStorage.getItem('deal_calendar_time_filter') as 'WEEK' | 'TODAY') || 'WEEK';
  });

  // TÙY CHỌN NHIỀU KIỂU TIN (MULTI-SELECT: RED, ORANGE, GRAY)
  const [selectedImpacts, setSelectedImpacts] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('deal_calendar_impacts_multi_v1');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return ['RED'];
  });

  // TÙY CHỌN DANH SÁCH ĐỒNG TIỀN / SYMBOL (Lưu LocalStorage)
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('deal_calendar_currencies');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'CNY'];
  });

  // State mở popover modal Settings
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const settingsModalRef = useRef<HTMLDivElement | null>(null);

  // Đóng modal khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsModalRef.current && !settingsModalRef.current.contains(e.target as Node)) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isSettingsOpen]);

  const handleToggleImpact = (impactKey: string) => {
    setSelectedImpacts((prev) => {
      let next: string[];
      if (impactKey === 'ALL') {
        next = ['RED', 'ORANGE', 'GRAY'];
      } else {
        if (prev.includes(impactKey)) {
          next = prev.filter((k) => k !== impactKey);
        } else {
          next = [...prev, impactKey];
        }
      }
      localStorage.setItem('deal_calendar_impacts_multi_v1', JSON.stringify(next));
      return next;
    });
  };

  const handleToggleTimeFilter = (val: 'WEEK' | 'TODAY') => {
    setTimeFilter(val);
    localStorage.setItem('deal_calendar_time_filter', val);
  };

  const handleToggleCurrency = (code: string) => {
    setSelectedCurrencies((prev) => {
      let next: string[];
      if (prev.includes(code)) {
        next = prev.filter((c) => c !== code);
      } else {
        next = [...prev, code];
      }
      localStorage.setItem('deal_calendar_currencies', JSON.stringify(next));
      return next;
    });
  };

  const handleSelectAllCurrencies = () => {
    const all = CURRENCIES_CONFIG.map((c) => c.code);
    setSelectedCurrencies(all);
    localStorage.setItem('deal_calendar_currencies', JSON.stringify(all));
  };

  const handleDeselectAllCurrencies = () => {
    setSelectedCurrencies([]);
    localStorage.setItem('deal_calendar_currencies', JSON.stringify([]));
  };

  const getWeekRangeForTV = () => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1) - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday - 1);
    monday.setHours(0, 0, 0, 0);

    const nextSunday = new Date(monday);
    nextSunday.setDate(monday.getDate() + 8);
    nextSunday.setHours(23, 59, 59, 999);

    return {
      from: monday.toISOString(),
      to: nextSunday.toISOString()
    };
  };

  const fetchCalendar = async () => {
    setIsLoading(true);
    let loadedEvents: MiniCalendarEvent[] | null = null;

    // NGUỒN 1: File dữ liệu tuần này nội bộ (Tốc độ 0ms, không phụ thuộc mạng ngoài, 100% thành công)
    try {
      const staticRes = await fetch('/economic_calendar_thisweek.json');
      if (staticRes.ok) {
        const staticData = await staticRes.json();
        if (Array.isArray(staticData) && staticData.length > 0) {
          loadedEvents = staticData;
          setEvents(staticData);
          try {
            localStorage.setItem('deal_calendar_events_cache_v2', JSON.stringify(staticData));
          } catch {}
        }
      }
    } catch (err) {
      console.warn('Lỗi nạp file static lịch kinh tế:', err);
    }

    // NGUỒN 2: TradingView Official Economic Calendar (Cập nhật thời gian thực mới nhất)
    try {
      const { from, to } = getWeekRangeForTV();
      const tvUrl = `/api/tradingview-calendar/events?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
      const res = await fetch(tvUrl);
      if (res.ok) {
        const json = await res.json();
        const rawList = Array.isArray(json?.result) ? json.result : (Array.isArray(json) ? json : []);
        if (rawList.length > 0) {
          const mappedTV: MiniCalendarEvent[] = rawList.map((item: any) => {
            let impact: 'High' | 'Medium' | 'Low' | 'Holiday' = 'Low';
            const cat = String(item.category || '').toLowerCase();
            const titleLower = String(item.title || item.indicator || '').toLowerCase();
            if (cat === 'hol' || titleLower.includes('holiday') || titleLower.includes('nghỉ lễ')) {
              impact = 'Holiday';
            } else if (item.importance === 1) {
              impact = 'High';
            } else if (item.importance === 0) {
              impact = 'Medium';
            }

            return {
              title: item.title || item.indicator || 'Sự kiện kinh tế',
              country: (item.currency || item.country || 'USD').toUpperCase().trim(),
              date: item.date,
              impact: impact,
              forecast: item.forecast != null ? `${item.forecast}${item.unit || ''}` : '',
              previous: item.previous != null ? `${item.previous}${item.unit || ''}` : '',
            };
          });

          loadedEvents = mappedTV;
          setEvents(mappedTV);
          try {
            localStorage.setItem('deal_calendar_events_cache_v2', JSON.stringify(mappedTV));
          } catch {}
        }
      }
    } catch (err) {
      console.warn('Lỗi tải từ TradingView Economic Calendar:', err);
    }

    // NGUỒN 3: ForexFactory (dự phòng)
    if (!loadedEvents || loadedEvents.length === 0) {
      try {
        const ffRes = await fetch('/api/forexfactory/ff_calendar_thisweek.json');
        if (ffRes.ok) {
          const data = await ffRes.json();
          if (Array.isArray(data) && data.length > 0) {
            loadedEvents = data;
            setEvents(data);
            try {
              localStorage.setItem('deal_calendar_events_cache_v2', JSON.stringify(data));
            } catch {}
          }
        }
      } catch (err) {
        console.warn('Lỗi tải từ ForexFactory:', err);
      }
    }

    setIsLoading(false);
  };

  useEffect(() => {
    fetchCalendar();
    const timer = setInterval(fetchCalendar, 15 * 60 * 1000);
    return () => clearInterval(timer);
  }, []);

  const formatVNDate = (isoDateStr: string) => {
    try {
      const d = new Date(isoDateStr);
      if (isNaN(d.getTime())) return { dateStr: isoDateStr, timeStr: '', dayOfWeek: '' };
      const pad = (n: number) => String(n).padStart(2, '0');
      const day = pad(d.getDate());
      const month = pad(d.getMonth() + 1);
      const hours = pad(d.getHours());
      const mins = pad(d.getMinutes());
      const days = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
      const dayOfWeek = days[d.getDay()] || '';
      return {
        dateStr: `${dayOfWeek} ${day}/${month}`,
        timeStr: `${hours}:${mins}`,
        dayOfWeek,
      };
    } catch {
      return { dateStr: isoDateStr, timeStr: '', dayOfWeek: '' };
    }
  };

  const getMinutesUntil = (isoDateStr: string) => {
    try {
      return Math.round((new Date(isoDateStr).getTime() - Date.now()) / 60000);
    } catch {
      return 99999;
    }
  };

  const isHolidayEvent = (ev: MiniCalendarEvent) => {
    return ev.impact === 'Holiday' || (ev.title && ev.title.toLowerCase().includes('holiday'));
  };

  const filteredEvents = useMemo(() => {
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // Bảo vệ bộ lọc: nếu người dùng vô tình bỏ chọn hết thì fallback về mức an toàn thay vì làm trống bảng
    const activeImpacts = selectedImpacts.length > 0 ? selectedImpacts : ['RED', 'ORANGE'];
    const activeCurrencies = selectedCurrencies.length > 0 
      ? selectedCurrencies 
      : ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'CHF', 'NZD', 'CNY'];

    let filtered = events.filter((ev) => {
      // 1. Lọc theo Mức độ Impact (Hỗ trợ multi-select: RED, ORANGE, GRAY)
      const isRed = ev.impact === 'High';
      const isOrange = ev.impact === 'Medium';
      const isGray = isHolidayEvent(ev);

      let matchesImpact = false;
      if (activeImpacts.includes('RED') && isRed) matchesImpact = true;
      if (activeImpacts.includes('ORANGE') && isOrange) matchesImpact = true;
      if (activeImpacts.includes('GRAY') && isGray) matchesImpact = true;

      if (!matchesImpact) return false;

      // 2. Lọc theo Đồng tiền / Symbol
      const cur = (ev.country || '').trim().toUpperCase();
      if (cur !== 'ALL' && !activeCurrencies.includes(cur)) return false;

      // 3. Lọc theo Thời gian (Hôm nay hay Cả tuần)
      if (timeFilter === 'TODAY') {
        try {
          const evDate = new Date(ev.date);
          const evDateStr = `${evDate.getFullYear()}-${String(evDate.getMonth() + 1).padStart(2, '0')}-${String(evDate.getDate()).padStart(2, '0')}`;
          if (evDateStr !== todayStr) return false;
        } catch {
          // pass
        }
      }
      return true;
    });

    // Nếu lọc Hôm Nay mà hôm nay không còn tin nào (hoặc đã qua hết), tự động nạp các tin trong tuần để không bị trống rỗng!
    if (filtered.length === 0 && timeFilter === 'TODAY') {
      filtered = events.filter((ev) => {
        const isRed = ev.impact === 'High';
        const isOrange = ev.impact === 'Medium';
        const isGray = isHolidayEvent(ev);
        let matchesImpact = false;
        if (activeImpacts.includes('RED') && isRed) matchesImpact = true;
        if (activeImpacts.includes('ORANGE') && isOrange) matchesImpact = true;
        if (activeImpacts.includes('GRAY') && isGray) matchesImpact = true;
        if (!matchesImpact) return false;
        const cur = (ev.country || '').trim().toUpperCase();
        if (cur !== 'ALL' && !activeCurrencies.includes(cur)) return false;
        return true;
      });
    }

    return filtered.sort((a, b) => {
      const timeA = new Date(a.date).getTime() || 0;
      const timeB = new Date(b.date).getTime() || 0;
      return timeA - timeB;
    });
  }, [events, selectedImpacts, timeFilter, selectedCurrencies]);

  return (
    <div className="w-full rounded-2xl border border-[var(--border-main)] clay-card shadow-sm transition-all font-sans bg-[var(--bg-card)]">
      {/* HEADER BẢNG TIN TỨC: BO TRÒN ĐỒNG BỘ 4 GÓC */}
      <div className="px-3 py-2 bg-[var(--bg-card)] border-b border-[var(--border-main)] rounded-t-2xl flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          {/* LỊCH KINH TẾ MÀU ĐEN CHUẨN TERMINAL */}
          <span className="font-bold text-[var(--text-primary)] text-xs uppercase tracking-wider">
            LỊCH KINH TẾ
          </span>
        </div>

        <div className="flex items-center gap-1.5 relative z-30">

          {/* BỘ NÚT TÙY CHỌN & TẢI LẠI THEO CHUẨN CLAY-PILL */}
          <div className="flex items-center clay-well p-0.5 rounded-full border border-[var(--border-main)]/50">
            <button
              type="button"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-all cursor-pointer ${
                isSettingsOpen
                  ? 'clay-pill text-[var(--text-primary)] font-bold bg-white'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              Tùy Chọn
            </button>
            <button
              type="button"
              onClick={fetchCalendar}
              disabled={isLoading}
              className="p-1 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/80 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center"
              title="Tải lại lịch kinh tế"
            >
              <RotateCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {/* POPOVER SETTINGS MODAL: NỔI LÊN TRÊN (z-50, shadow-2xl), KHÔNG BỊ KHUNG LÀM VIỆC CHE */}
          {isSettingsOpen && (
            <div
              ref={settingsModalRef}
              className="absolute right-0 top-full mt-2 w-[320px] sm:w-[350px] bg-white border border-[var(--border-main)] rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.18)] z-50 p-3 space-y-3 animate-in fade-in zoom-in-95 duration-150 text-[#1d1b17]"
            >
              {/* Header popover */}
              <div className="flex items-center justify-between pb-1.5 border-b border-[var(--border-main)]">
                <span className="text-xs font-bold uppercase tracking-wider text-[#1d1b17]">
                  CÀI ĐẶT BỘ LỌC TIN TỨC
                </span>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1 rounded-lg hover:bg-[var(--bg-subtle)] text-[#1d1b17] transition-colors cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* 1. Tùy chọn Mức độ tin: HỖ TRỢ TICK NHIỀU KIỂU TIN (ĐỎ, CAM, XÁM) */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-[#1d1b17] uppercase tracking-wider block">
                  1. Mức Độ Tác Động (Chọn nhiều)
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleImpact('RED')}
                    className={`flex items-center justify-between p-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                      selectedImpacts.includes('RED')
                        ? 'border-[#1d1b17] bg-[var(--bg-subtle)] text-[#1d1b17] shadow-xs'
                        : 'border-[var(--border-main)] bg-white text-[#1d1b17] hover:bg-[var(--bg-subtle)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className={`w-3.5 h-3.5 rounded-[3.5px] border flex items-center justify-center shrink-0 bg-white ${
                        selectedImpacts.includes('RED') ? 'border-[#1d1b17]' : 'border-[var(--border-main)]'
                      }`}>
                        {selectedImpacts.includes('RED') && <Check className="w-2.5 h-2.5 text-[#1d1b17] stroke-[3]" />}
                      </div>
                      <span>Tin Đỏ</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleImpact('ORANGE')}
                    className={`flex items-center justify-between p-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                      selectedImpacts.includes('ORANGE')
                        ? 'border-[#1d1b17] bg-[var(--bg-subtle)] text-[#1d1b17] shadow-xs'
                        : 'border-[var(--border-main)] bg-white text-[#1d1b17] hover:bg-[var(--bg-subtle)]'
                    }`}
                  >
                    <div className="flex items-center gap-1.5">
                      <div className={`w-3.5 h-3.5 rounded-[3.5px] border flex items-center justify-center shrink-0 bg-white ${
                        selectedImpacts.includes('ORANGE') ? 'border-[#1d1b17]' : 'border-[var(--border-main)]'
                      }`}>
                        {selectedImpacts.includes('ORANGE') && <Check className="w-2.5 h-2.5 text-[#1d1b17] stroke-[3]" />}
                      </div>
                      <span>Tin Cam</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleImpact('GRAY')}
                    className={`flex items-center justify-between p-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                      selectedImpacts.includes('GRAY')
                        ? 'border-[#1d1b17] bg-[var(--bg-subtle)] text-[#1d1b17] shadow-xs'
                        : 'border-[var(--border-main)] bg-white text-[#1d1b17] hover:bg-[var(--bg-subtle)]'
                    }`}
                    title="Chỉ hiển thị ngày nghỉ lễ ngân hàng (Bank Holiday)"
                  >
                    <div className="flex items-center gap-1.5">
                      <div className={`w-3.5 h-3.5 rounded-[3.5px] border flex items-center justify-center shrink-0 bg-white ${
                        selectedImpacts.includes('GRAY') ? 'border-[#1d1b17]' : 'border-[var(--border-main)]'
                      }`}>
                        {selectedImpacts.includes('GRAY') && <Check className="w-2.5 h-2.5 text-[#1d1b17] stroke-[3]" />}
                      </div>
                      <span>Tin Xám (Nghỉ Lễ)</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleImpact('ALL')}
                    className="flex items-center justify-center p-1.5 rounded-xl border border-[var(--border-main)] bg-white text-[#1d1b17] hover:bg-[var(--bg-subtle)] text-xs font-semibold cursor-pointer transition-all"
                  >
                    <span>Chọn Tất Cả</span>
                  </button>
                </div>
              </div>

              {/* 2. Tùy chọn Khung thời gian: Cả Tuần vs Hôm Nay */}
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-[#1d1b17] uppercase tracking-wider block">
                  2. Khung Thời Gian
                </span>
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleToggleTimeFilter('WEEK')}
                    className={`flex items-center justify-between p-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                      timeFilter === 'WEEK'
                        ? 'border-[#1d1b17] bg-[var(--bg-subtle)] text-[#1d1b17] shadow-xs'
                        : 'border-[var(--border-main)] bg-white text-[#1d1b17] hover:bg-[var(--bg-subtle)]'
                    }`}
                  >
                    <span>Cả Tuần</span>
                    {timeFilter === 'WEEK' && (
                      <Check className="w-3 h-3 text-[#1d1b17] stroke-[3]" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleTimeFilter('TODAY')}
                    className={`flex items-center justify-between p-1.5 rounded-xl border text-xs font-semibold cursor-pointer transition-all ${
                      timeFilter === 'TODAY'
                        ? 'border-[#1d1b17] bg-[var(--bg-subtle)] text-[#1d1b17] shadow-xs'
                        : 'border-[var(--border-main)] bg-white text-[#1d1b17] hover:bg-[var(--bg-subtle)]'
                    }`}
                  >
                    <span>Hôm Nay</span>
                    {timeFilter === 'TODAY' && (
                      <Check className="w-3 h-3 text-[#1d1b17] stroke-[3]" />
                    )}
                  </button>
                </div>
              </div>

              {/* 3. Tùy chọn Đồng tiền */}
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#1d1b17] uppercase tracking-wider">
                    3. Lọc Đồng Tiền ({selectedCurrencies.length}/{CURRENCIES_CONFIG.length})
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleSelectAllCurrencies}
                      className="text-[10px] text-[#1d1b17] hover:underline font-semibold cursor-pointer"
                    >
                      Chọn hết
                    </button>
                    <span className="text-[10px] text-[#1d1b17]">·</span>
                    <button
                      type="button"
                      onClick={handleDeselectAllCurrencies}
                      className="text-[10px] text-[#1d1b17] hover:underline font-semibold cursor-pointer"
                    >
                      Bỏ chọn
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-1 max-h-36 overflow-y-auto p-1 bg-[var(--bg-subtle)]/50 rounded-xl border border-[var(--border-main)]">
                  {CURRENCIES_CONFIG.map((c) => {
                    const isChecked = selectedCurrencies.includes(c.code);
                    return (
                      <button
                        key={c.code}
                        type="button"
                        onClick={() => handleToggleCurrency(c.code)}
                        className={`flex items-center gap-1.5 p-1 rounded-lg border text-xs cursor-pointer select-none transition-all text-left ${
                          isChecked
                            ? 'bg-white border-[#1d1b17] text-[#1d1b17] font-bold shadow-xs'
                            : 'bg-transparent border-transparent text-[#1d1b17] hover:bg-white/60 font-normal'
                        }`}
                      >
                        <div
                          className={`w-3.5 h-3.5 rounded-[3.5px] border flex items-center justify-center shrink-0 transition-colors bg-white ${
                            isChecked ? 'border-[#1d1b17]' : 'border-[var(--border-main)]'
                          }`}
                        >
                          {isChecked && <Check className="w-2.5 h-2.5 text-[#1d1b17] stroke-[3]" />}
                        </div>
                        <span className="font-mono text-[11px] text-[#1d1b17]">{c.code}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Nút đóng */}
              <div className="pt-1 border-t border-[var(--border-main)] flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="px-3.5 py-1 rounded-xl bg-[#1d1b17] text-white hover:bg-[#2b2721] text-xs font-bold transition-all cursor-pointer shadow-xs"
                >
                  Áp Dụng
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* DANH SÁCH BẢNG TIN TỨC: CỐ ĐỊNH CHUẨN XÁC 3 TIN, KHÔNG BỊ CẮT LỬNG LƠ TIN THỨ 4 */}
      <div className="h-[164px] max-h-[164px] overflow-y-auto overflow-x-hidden p-0 rounded-b-2xl">
        <table className="w-full table-fixed border-collapse text-left text-xs font-sans">
          {/* HEADER MENU: CHUẨN NHƯ BẢNG LỊCH SỬ (text-[var(--text-muted)] font-medium uppercase text-[11px]) */}
          <thead>
            <tr className="h-[32px] border-b border-[var(--border-main)] text-[11px] font-mono font-medium text-[var(--text-muted)] uppercase select-none sticky top-0 z-10 bg-white">
              <th className="py-1.5 pl-3 pr-1 w-[26%] font-medium">Thời Gian</th>
              <th className="py-1.5 px-1 w-[16%] text-center font-medium">Đồng</th>
              <th className="py-1.5 px-2 w-[38%] font-medium">Sự Kiện</th>
              <th className="py-1.5 pr-3 pl-1 w-[20%] text-right font-medium">Đếm Ngược</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-subtle)]/70 text-xs">
            {isLoading && (
              <tr className="h-[132px]">
                <td colSpan={4} className="py-4 text-center text-[var(--text-muted)] text-xs font-mono">
                  Đang tải dữ liệu lịch kinh tế...
                </td>
              </tr>
            )}

            {!isLoading && filteredEvents.length === 0 && (
              <tr className="h-[132px]">
                <td colSpan={4} className="py-4 text-center text-[var(--text-muted)] text-xs">
                  <div className="flex flex-col items-center justify-center gap-1.5">
                    <span>Không có tin tức nào phù hợp bộ lọc hiện tại.</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedImpacts(['RED', 'ORANGE', 'GRAY']);
                        setTimeFilter('WEEK');
                        handleSelectAllCurrencies();
                        try {
                          localStorage.removeItem('deal_calendar_impacts_multi_v1');
                          localStorage.removeItem('deal_calendar_time_filter');
                          localStorage.removeItem('deal_calendar_currencies');
                        } catch {}
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[var(--bg-subtle)] border border-[var(--border-main)] text-[11px] font-medium text-[var(--text-primary)] hover:bg-white transition-all cursor-pointer shadow-xs"
                    >
                      Bấm vào đây để hiện toàn bộ tin tuần này ({events.length} tin)
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {!isLoading &&
              filteredEvents.map((ev, idx) => {
                const { dateStr, timeStr } = formatVNDate(ev.date);
                const mins = getMinutesUntil(ev.date);
                const isPast = mins < -30;
                const isHoliday = isHolidayEvent(ev);

                // Xác định viền màu theo mức độ tác động của tin - chuẩn tab History (chữ luôn là text-primary)
                let currencyBorderClass = 'border border-[var(--border-main)] text-[var(--text-primary)] bg-[var(--bg-subtle)]/50';
                if (ev.impact === 'High') {
                  currencyBorderClass = 'border border-rose-300/70 text-[var(--text-primary)] bg-rose-50/25';
                } else if (ev.impact === 'Medium') {
                  currencyBorderClass = 'border border-amber-300/70 text-[var(--text-primary)] bg-amber-50/25';
                }

                return (
                  <tr
                    key={`${ev.date}-${ev.country}-${ev.title}-${idx}`}
                    className="h-[44px] transition-colors select-none text-[var(--text-primary)] hover:bg-[var(--table-row-hover)] hover:text-emerald-700 cursor-pointer"
                  >
                    {/* THỜI GIAN: GIỜ PHÚT Ở TRÊN (text-primary), THỨ NGÀY Ở DƯỚI (text-muted) */}
                    <td className="py-1.5 pl-3 pr-1 font-mono text-[11px] whitespace-nowrap">
                      <div className="flex flex-col leading-tight">
                        <span className="font-medium text-[var(--text-primary)] text-xs">{isHoliday ? 'Cả ngày' : timeStr}</span>
                        <span className="text-[10px] text-[var(--text-muted)] font-mono mt-0.5">{dateStr}</span>
                      </div>
                    </td>

                    {/* ĐỒNG: GỌN GÀNG, VIỀN MÀU THEO MỨC ĐỘ TIN */}
                    <td className="py-1.5 px-1 text-center whitespace-nowrap">
                      <span className={`px-1.5 py-0.5 rounded font-mono text-[11px] inline-block text-center min-w-[36px] ${currencyBorderClass}`}>
                        {ev.country}
                      </span>
                    </td>

                    {/* SỰ KIỆN: FONT MEDIUM CHUẨN text-[var(--text-primary)] */}
                    <td className="py-1.5 px-2 font-medium text-[var(--text-primary)] text-xs truncate">
                      {ev.title}
                    </td>

                    {/* ĐẾM NGƯỢC: CHUẨN MÀU PHỤ text-[var(--text-muted)] */}
                    <td className="py-1.5 pr-3 pl-1 text-right font-mono text-[11px] text-[var(--text-muted)] whitespace-nowrap">
                      {isHoliday ? (
                        <span>Nghỉ lễ</span>
                      ) : isPast ? (
                        <span>Đã ra</span>
                      ) : mins >= 0 && mins <= 60 ? (
                        <span className="font-medium text-[var(--text-primary)] border border-rose-300/80 px-1.5 py-0.5 rounded text-[10px] bg-rose-50/25">
                          Còn {mins}p
                        </span>
                      ) : mins > 60 && mins < 1440 ? (
                        <span className="font-medium text-[var(--text-primary)]">
                          {Math.floor(mins / 60)}h{mins % 60}p
                        </span>
                      ) : (
                        <span>Chưa ra</span>
                      )}
                    </td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
