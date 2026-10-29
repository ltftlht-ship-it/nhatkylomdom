import { TradeRow } from '../types';

export type PeriodKind = 'ALL' | 'WEEK' | 'MONTH' | 'QUARTER' | 'CUSTOM';

export interface PeriodRange {
  start: Date | null; // null = không giới hạn
  end: Date | null;   // mốc kết thúc (không bao gồm)
  label: string;
}

const pad = (n: number) => String(n).padStart(2, '0');
const fmt = (d: Date) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

/**
 * Đổi chuỗi giờ sàn MT5 ("YYYY.MM.DD HH:mm:ss") sang giờ hiển thị đã bù múi giờ,
 * cùng cách Tab Báo Cáo đang dùng (parse giờ máy + offset giờ).
 */
export function toDisplayDate(raw: string | undefined | null, offsetHours: number): Date | null {
  if (!raw) return null;
  const clean = raw.includes('T') ? raw : raw.replace(/[.-]/g, '/');
  const base = new Date(clean);
  if (isNaN(base.getTime())) return null;
  return new Date(base.getTime() + offsetHours * 3600 * 1000);
}

/** Khoảng thời gian của kỳ; step = 0 là kỳ hiện tại, -1 là kỳ trước... */
export function getPeriodRange(
  kind: PeriodKind,
  step: number,
  now: Date = new Date(),
  custom?: { from?: string; to?: string }
): PeriodRange {
  if (kind === 'ALL') return { start: null, end: null, label: 'Toàn bộ lịch sử' };

  if (kind === 'CUSTOM') {
    const start = custom?.from ? new Date(`${custom.from}T00:00:00`) : null;
    const endDay = custom?.to ? new Date(`${custom.to}T00:00:00`) : null;
    const end = endDay ? new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate() + 1) : null;
    const label = `${start ? fmt(start) : '…'} – ${endDay ? fmt(endDay) : '…'}`;
    return { start, end, label };
  }

  if (kind === 'WEEK') {
    // Tuần bắt đầu thứ 2
    const dow = (now.getDay() + 6) % 7;
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + step * 7);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate() - 1);
    return { start, end, label: `Tuần ${fmt(start)} – ${fmt(last)}` };
  }

  if (kind === 'MONTH') {
    const start = new Date(now.getFullYear(), now.getMonth() + step, 1);
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 1);
    return { start, end, label: `Tháng ${pad(start.getMonth() + 1)}/${start.getFullYear()}` };
  }

  // QUARTER
  const q = Math.floor(now.getMonth() / 3) + step;
  const start = new Date(now.getFullYear(), q * 3, 1);
  const end = new Date(start.getFullYear(), start.getMonth() + 3, 1);
  return { start, end, label: `Quý ${Math.floor(start.getMonth() / 3) + 1}/${start.getFullYear()}` };
}

/** Kỳ liền trước để so sánh (Tùy chọn: khoảng cùng độ dài ngay trước đó) */
export function getPreviousRange(kind: PeriodKind, step: number, current: PeriodRange): PeriodRange | null {
  if (kind === 'ALL') return null;
  if (kind === 'CUSTOM') {
    if (!current.start || !current.end) return null;
    const len = current.end.getTime() - current.start.getTime();
    const start = new Date(current.start.getTime() - len);
    const last = new Date(current.start.getTime() - 24 * 3600 * 1000);
    return { start, end: current.start, label: `${fmt(start)} – ${fmt(last)}` };
  }
  return getPeriodRange(kind, step - 1);
}

/** Lọc lệnh theo giờ đóng lệnh (đã bù múi giờ) nằm trong kỳ */
export function filterTradesByRange<T extends Pick<TradeRow, 'close_time' | 'open_time'>>(
  trades: T[],
  range: PeriodRange | null,
  offsetHours: number
): T[] {
  if (!range || (!range.start && !range.end)) return trades;
  return trades.filter(t => {
    const d = toDisplayDate(t.close_time || t.open_time, offsetHours);
    if (!d) return false;
    if (range.start && d < range.start) return false;
    if (range.end && d >= range.end) return false;
    return true;
  });
}
