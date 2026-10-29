import { getSupabaseClient } from './supabase';

/**
 * ĐỒNG BỘ CẤU HÌNH NGƯỜI DÙNG LÊN SUPABASE (bảng user_settings, xem supabase/user_settings.sql)
 * Các cấu hình vẫn đọc/ghi qua localStorage như cũ; module này tự đẩy lên Supabase khi có thay đổi
 * và tự kéo về khi đăng nhập ở máy / trình duyệt khác.
 */

const SYNC_KEYS = [
  'deal_pre_checklist',            // checklist trước khi vào lệnh
  'deal_post_mistakes',            // danh sách lỗi tâm lý
  'deal_setup_tags',               // danh sách setup
  'bd_psychology_settings',        // ngưỡng Điểm Tâm Lý
  'trade_journal_timezone_offset', // bù múi giờ
  'trade_journal_timeframe_options',
  'trade_journal_noise_filter',
  'trade_journal_hide_noise_rows',
  'deal_accounts_list',            // tên và vốn gốc tài khoản Thầy sửa
  'trade_chart_custom_drawings',   // nét vẽ trên biểu đồ
  'trade_chart_candle_theme',
  'trade_journal_theme',
  'trade_journal_language',
  'deal_calendar_impacts_multi_v1',
  'deal_calendar_currencies',
  'deal_calendar_time_filter',
];
const SYNC_PREFIXES = ['bd_prop_rules_']; // luật quỹ theo từng tài khoản

export const isSyncKey = (k: string) => SYNC_KEYS.includes(k) || SYNC_PREFIXES.some(p => k.startsWith(p));

let userId: string | null = null;
let applyingRemote = false;
let pushTimer: ReturnType<typeof setTimeout> | null = null;
let patched = false;

function collectLocal(): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && isSyncKey(k)) {
      const v = localStorage.getItem(k);
      if (v !== null) out[k] = v;
    }
  }
  return out;
}

async function pushNow() {
  const client = getSupabaseClient();
  if (!client || !userId) return;
  const { error } = await client.from('user_settings').upsert({
    user_id: userId,
    data: collectLocal(),
    updated_at: new Date().toISOString(),
  });
  if (error) console.warn('Không lưu được cấu hình lên Supabase:', error.message);
}

function schedulePush() {
  if (!userId || applyingRemote) return;
  if (pushTimer) clearTimeout(pushTimer);
  pushTimer = setTimeout(pushNow, 1500);
}

/** Theo dõi mọi lần app ghi cấu hình vào localStorage để tự đẩy lên Supabase */
function patchStorage() {
  if (patched) return;
  patched = true;
  const origSet = Storage.prototype.setItem;
  const origRemove = Storage.prototype.removeItem;
  Storage.prototype.setItem = function (key: string, value: string) {
    const before = this === localStorage ? this.getItem(key) : null;
    origSet.call(this, key, value);
    if (this === localStorage && isSyncKey(key) && before !== value) schedulePush();
  };
  Storage.prototype.removeItem = function (key: string) {
    origRemove.call(this, key);
    if (this === localStorage && isSyncKey(key)) schedulePush();
  };
}

/**
 * Gọi khi đăng nhập: kéo cấu hình về (bản trên Supabase được ưu tiên).
 * Lần đầu chưa có gì trên Supabase thì đẩy cấu hình của máy này lên.
 * Trả về true nếu cấu hình trong máy đã thay đổi (app cần tải lại để dùng cấu hình mới).
 */
export async function startSettingsSync(uid: string): Promise<boolean> {
  userId = uid;
  patchStorage();
  const client = getSupabaseClient();
  if (!client) return false;

  const { data, error } = await client.from('user_settings').select('data').eq('user_id', uid).maybeSingle();
  if (error) {
    console.warn('Không tải được cấu hình từ Supabase:', error.message);
    return false;
  }
  if (!data) {
    await pushNow();
    return false;
  }

  const remote: Record<string, string> = (data as any).data || {};
  let changed = false;
  applyingRemote = true;
  try {
    Object.entries(remote).forEach(([k, v]) => {
      if (isSyncKey(k) && typeof v === 'string' && localStorage.getItem(k) !== v) {
        localStorage.setItem(k, v);
        changed = true;
      }
    });
  } finally {
    applyingRemote = false;
  }
  return changed;
}

export function stopSettingsSync() {
  userId = null;
  if (pushTimer) clearTimeout(pushTimer);
}
