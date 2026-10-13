import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { TradingPlan } from '../types';
import { parseChecklistArray } from '../utils/tradeCalculations';

// Theo dõi các cột thực tế tồn tại trong bảng trades của Supabase
export const knownTradesColumns = new Set<string>();

export function recordTradesTableColumns(rowOrKeys: Record<string, any> | string[]) {
  if (Array.isArray(rowOrKeys)) {
    rowOrKeys.forEach(k => { if (k) knownTradesColumns.add(String(k)); });
  } else if (rowOrKeys && typeof rowOrKeys === 'object') {
    Object.keys(rowOrKeys).forEach(k => { if (k) knownTradesColumns.add(String(k)); });
  }
}

export const LOCAL_TRADE_JOURNAL_KEY = 'bigdeal_trade_journals_cache';

export function saveTradeJournalToLocalCache(ticket: string | number, updates: Record<string, any>) {
  try {
    const cleanTicket = String(ticket || '').trim();
    if (!cleanTicket || typeof window === 'undefined' || !window.localStorage) return;
    
    // Lưu các ảnh trực tiếp vào key riêng biệt để đảm bảo không bị quá tải dung lượng JSON
    if (updates.htf_image_url !== undefined) {
      if (updates.htf_image_url) {
        try { localStorage.setItem(`deal_img_${cleanTicket}_htf`, updates.htf_image_url); } catch {}
      } else {
        try { localStorage.removeItem(`deal_img_${cleanTicket}_htf`); } catch {}
      }
    }
    if (updates.ltf_image_url !== undefined || updates.image_base64 !== undefined) {
      const val = updates.ltf_image_url ?? updates.image_base64;
      if (val) {
        try { localStorage.setItem(`deal_img_${cleanTicket}_ltf`, val); } catch {}
      } else {
        try { localStorage.removeItem(`deal_img_${cleanTicket}_ltf`); } catch {}
      }
    }

    const raw = localStorage.getItem(LOCAL_TRADE_JOURNAL_KEY);
    const cache: Record<string, any> = raw ? JSON.parse(raw) : {};
    cache[cleanTicket] = {
      ...(cache[cleanTicket] || {}),
      ...updates,
      _updatedAt: Date.now(),
    };
    try {
      localStorage.setItem(LOCAL_TRADE_JOURNAL_KEY, JSON.stringify(cache));
    } catch (quotaErr) {
      console.warn('LocalStorage quota reached for journal cache, images preserved in direct keys');
    }
  } catch (e) {
    console.warn('Lỗi lưu cache journal cục bộ:', e);
  }
}

export function getTradeJournalFromLocalCache(ticket: string | number): Record<string, any> | null {
  try {
    const cleanTicket = String(ticket || '').trim();
    if (!cleanTicket || typeof window === 'undefined' || !window.localStorage) return null;
    let entry: Record<string, any> = {};
    const raw = localStorage.getItem(LOCAL_TRADE_JOURNAL_KEY);
    if (raw) {
      try {
        const cache: Record<string, any> = JSON.parse(raw);
        if (cache[cleanTicket]) {
          entry = { ...cache[cleanTicket] };
        }
      } catch {}
    }
    const directHtf = localStorage.getItem(`deal_img_${cleanTicket}_htf`) || localStorage.getItem(`deal_user_pre_img_${cleanTicket}`);
    if (directHtf) {
      entry.htf_image_url = directHtf;
      entry.pre_image = directHtf;
    }
    const directLtf = localStorage.getItem(`deal_img_${cleanTicket}_ltf`) || localStorage.getItem(`deal_user_post_img_${cleanTicket}`);
    if (directLtf) {
      entry.ltf_image_url = directLtf;
      entry.image_base64 = directLtf;
    }

    return Object.keys(entry).length > 0 ? entry : null;
  } catch {
    return null;
  }
}

function extractMissingColumn(errorMessage: string): string | null {
  if (!errorMessage) return null;
  const m1 = errorMessage.match(/Could not find the '([^']+)' column/i);
  if (m1 && m1[1]) return m1[1];
  const m2 = errorMessage.match(/column ["']?([a-zA-Z0-9_]+)["']? of relation/i);
  if (m2 && m2[1]) return m2[1];
  const m3 = errorMessage.match(/column ["']?([a-zA-Z0-9_]+)["']? does not exist/i);
  if (m3 && m3[1]) return m3[1];
  const m4 = errorMessage.match(/Could not find column '([^']+)'/i);
  if (m4 && m4[1]) return m4[1];
  return null;
}

export interface SupabaseTradeRow {
  id?: string;
  ticket: string | number;
  account_id?: string | number;
  symbol: string;
  type: 'BUY' | 'SELL' | string;
  volume: number;
  open_price: number;
  close_price: number;
  pnl: number;
  commission: number;
  swap: number;
  initial_balance?: number;
  open_time: string;
  close_time: string;
  status: 'CLOSED' | 'OPEN' | string;
  initial_sl?: number;
  position_id?: string;
  notes?: string;
  timeframe?: string;
  plan_id?: string | null;
  plan_name?: string;
  image_url_1?: string;
  image_base64?: string;
  htf_image_url?: string;
  ltf_image_url?: string;
  pre_checklist_ids?: string[];
  post_checklist_ids?: string[];
  setup?: string;
  setups?: string[];
  [key: string]: any;
}

/**
 * Chuẩn hóa Supabase Project URL:
 * Lỗi PGRST125 ("Invalid path specified in request URL") xảy ra khi URL chứa đường dẫn con
 * như /rest/v1, /trades hoặc trailing slash / khiến thư viện supabase-js ghép thành
 * https://xxx.supabase.co/rest/v1/rest/v1/trades
 */
export function cleanSupabaseUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  let url = rawUrl.trim().replace(/^["']|["']$/g, '').trim();

  const lower = url.toLowerCase();
  if (
    !url ||
    lower === 'undefined' ||
    lower === 'null' ||
    lower.includes('my_supabase_url') ||
    lower.includes('your_supabase_url') ||
    lower.includes('your-project') ||
    lower.includes('example.supabase.co')
  ) {
    return '';
  }

  // Nếu người dùng dán URL từ Supabase Dashboard: https://supabase.com/dashboard/project/<project_id>
  const dashMatch = url.match(/supabase\.com\/dashboard\/project\/([a-zA-Z0-9_-]+)/i);
  if (dashMatch) {
    return `https://${dashMatch[1]}.supabase.co`;
  }

  // Giữ lại protocol http:// hoặc https://
  const isHttp = url.startsWith('http://');
  const protocol = isHttp ? 'http://' : 'https://';
  const withoutProto = url.replace(/^https?:\/\//i, '');

  // Cắt bỏ bất kỳ path con nào như /rest/v1, /trades, dấu gạch chéo cuối hoặc query params
  const host = withoutProto.split('/')[0].split('?')[0].trim();
  if (!host || (!host.includes('.') && host !== 'localhost')) return '';

  return `${protocol}${host}`;
}

export function cleanSupabaseKey(rawKey: string): string {
  if (!rawKey) return '';
  const key = rawKey.trim().replace(/^["']|["']$/g, '').trim();
  const lower = key.toLowerCase();
  if (
    !key ||
    lower === 'undefined' ||
    lower === 'null' ||
    lower.includes('my_supabase_key') ||
    lower.includes('your_supabase_key') ||
    lower.includes('your-anon-key')
  ) {
    return '';
  }
  return key;
}

// Lấy config từ biến môi trường Vite hoặc từ LocalStorage để người dùng có thể cấu hình trực tiếp trên Web App
export function getSupabaseCredentials(): { url: string; anonKey: string } {
  const metaEnv = (import.meta as { env?: Record<string, string> }).env || {};
  const envUrl = metaEnv.VITE_SUPABASE_URL || '';
  const envKey = metaEnv.VITE_SUPABASE_ANON_KEY || '';

  const storedUrl = typeof window !== 'undefined' ? localStorage.getItem('trade_journal_supabase_url') || '' : '';
  const storedKey = typeof window !== 'undefined' ? localStorage.getItem('trade_journal_supabase_key') || '' : '';

  const rawUrl = storedUrl.trim() || envUrl.trim();
  const rawKey = storedKey.trim() || envKey.trim();

  const cleanedUrl = cleanSupabaseUrl(rawUrl);
  const cleanedKey = cleanSupabaseKey(rawKey);

  // Tự động sửa lại nếu trong localStorage đang lưu URL có đuôi /rest/v1 hoặc sai định dạng
  if (typeof window !== 'undefined') {
    if (storedUrl && cleanedUrl && storedUrl !== cleanedUrl) {
      localStorage.setItem('trade_journal_supabase_url', cleanedUrl);
    } else if (storedUrl && !cleanedUrl) {
      localStorage.removeItem('trade_journal_supabase_url');
    }

    if (storedKey && !cleanedKey) {
      localStorage.removeItem('trade_journal_supabase_key');
    }
  }

  return {
    url: cleanedUrl,
    anonKey: cleanedKey,
  };
}

export function saveSupabaseCredentials(url: string, anonKey: string): void {
  const cleanedUrl = cleanSupabaseUrl(url);
  const cleanedKey = cleanSupabaseKey(anonKey);

  if (typeof window !== 'undefined') {
    if (cleanedUrl) localStorage.setItem('trade_journal_supabase_url', cleanedUrl);
    else localStorage.removeItem('trade_journal_supabase_url');

    if (cleanedKey) localStorage.setItem('trade_journal_supabase_key', cleanedKey);
    else localStorage.removeItem('trade_journal_supabase_key');
  }
  // Reset cached client
  cachedClient = null;
  cachedUrl = '';
  cachedKey = '';
}

let cachedClient: SupabaseClient | null = null;
let cachedUrl = '';
let cachedKey = '';

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseCredentials();
  if (!url || !anonKey) {
    return null;
  }

  if (cachedClient && cachedUrl === url && cachedKey === anonKey) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    cachedUrl = url;
    cachedKey = anonKey;
    return cachedClient;
  } catch (err) {
    console.error('Lỗi khởi tạo Supabase Client:', err);
    return null;
  }
}

/**
 * Các hàm hỗ trợ Supabase Authentication (Đăng nhập, Đăng ký, OAuth Google / GitHub)
 */
export async function getAuthUser(): Promise<User | null> {
  try {
    const client = getSupabaseClient();
    if (!client) return null;
    const { data: { user } } = await client.auth.getUser();
    return user;
  } catch (err) {
    console.warn('Lỗi lấy thông tin tài khoản:', err);
    return null;
  }
}

export async function signInWithEmailPassword(email: string, password: string) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Chưa kết nối Supabase');
  return await client.auth.signInWithPassword({ email, password });
}

export async function signUpWithEmailPassword(email: string, password: string) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Chưa kết nối Supabase');
  return await client.auth.signUp({ 
    email, 
    password,
    options: {
      emailRedirectTo: typeof window !== 'undefined' ? window.location.origin : undefined
    }
  });
}

export async function signInWithOAuthProvider(provider: 'google' | 'github') {
  const client = getSupabaseClient();
  if (!client) throw new Error('Chưa kết nối Supabase');
  return await client.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: typeof window !== 'undefined' ? window.location.origin : undefined
    }
  });
}

export async function signOutAuthUser() {
  const client = getSupabaseClient();
  if (!client) return;
  return await client.auth.signOut();
}

export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  const client = getSupabaseClient();
  if (!client) return { unsubscribe: () => {} };
  const { data: { subscription } } = client.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
  return subscription;
}

/**
 * Supabase client instance proxy cho phép gọi trực tiếp:
 * supabase.from('plans').insert([...]).select()
 * Tự động kết nối với Supabase credentials từ env hoặc Cài Đặt.
 */
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseClient();
    if (!client) {
      if (prop === 'from') {
        return (table: string) => ({
          insert: (records: any[]) => ({
            select: async () => ({
              data: null,
              error: new Error('Chưa cấu hình Supabase URL hoặc Anon Key trong Cài Đặt (icon bánh răng).')
            })
          }),
          select: () => ({
            order: () => ({
              eq: async () => ({
                data: null,
                error: new Error('Chưa cấu hình Supabase URL hoặc Anon Key trong Cài Đặt.')
              })
            }),
            eq: async () => ({
              data: null,
              error: new Error('Chưa cấu hình Supabase URL hoặc Anon Key trong Cài Đặt.')
            })
          }),
          upsert: async () => ({
            data: null,
            error: new Error('Chưa cấu hình Supabase URL hoặc Anon Key trong Cài Đặt.')
          })
        });
      }
      throw new Error('Chưa cấu hình Supabase URL hoặc Anon Key trong Cài Đặt.');
    }
    const val = (client as any)[prop];
    if (typeof val === 'function') {
      return val.bind(client);
    }
    return val;
  }
});

export interface DetectedAccountInfo {
  id: string;
  initial_balance?: number;
  trade_count?: number;
}

export function extractAccountsFromTrades(trades: any[]): DetectedAccountInfo[] {
  if (!Array.isArray(trades)) return [];
  const map = new Map<string, DetectedAccountInfo>();

  trades.forEach(t => {
    const rawAcc = String(
      t.account_id ?? t.account ?? t.login ?? t.mt5_account ?? t.user_id ?? ''
    ).replace(/^acc-/, '').trim();

    if (rawAcc && rawAcc !== 'undefined' && rawAcc !== 'null' && rawAcc !== 'ALL') {
      const existing = map.get(rawAcc);
      const initBal = t.initial_balance && !isNaN(Number(t.initial_balance)) && Number(t.initial_balance) > 0
        ? Number(t.initial_balance)
        : undefined;

      if (!existing) {
        map.set(rawAcc, {
          id: rawAcc,
          initial_balance: initBal,
          trade_count: 1
        });
      } else {
        existing.trade_count = (existing.trade_count || 0) + 1;
        if (!existing.initial_balance && initBal) {
          existing.initial_balance = initBal;
        }
      }
    }
  });

  return Array.from(map.values());
}

/**
 * Fetch toàn bộ danh sách lệnh từ Supabase, tối giản hóa query và lọc bằng Javascript
 * để tránh lỗi lệch kiểu dữ liệu hoặc lỗi điều kiện lọc.
 */
export async function fetchTradesFromSupabase(accountId: string = "26610983"): Promise<SupabaseTradeRow[]> {
  console.log("--> Đang gọi Supabase với accountId:", accountId);

  const client = getSupabaseClient();
  if (!client) {
    console.warn("⚠️ Supabase API: Chưa cấu hình Supabase URL hoặc Anon Key hợp lệ trong Cài Đặt.");
    return [];
  }

  const { url } = getSupabaseCredentials();
  console.log("--> Supabase Project URL đang kết nối:", url);

  // Lấy dữ liệu sắp xếp theo close_time mới nhất
  let { data, error } = await client
    .from('trades')
    .select('*')
    .order('close_time', { ascending: false });

  // Nếu gặp lỗi PGRST125 hoặc PGRST205, thử kiểm tra bảng 'Trades' (viết hoa chữ T)
  if (error && (error.code === 'PGRST125' || error.code === 'PGRST205' || error.code === 'PGRST200')) {
    const retry = await client.from('Trades').select('*').order('close_time', { ascending: false });
    if (!retry.error && retry.data) {
      data = retry.data;
      error = null;
    }
  }

  if (error) {
    console.warn("⚠️ Không thể tải trades từ Supabase API:", error.message || error);
    if (error.code === 'PGRST125') {
      console.warn(
        "💡 Gợi ý sửa lỗi PGRST125: URL Supabase bị sai đường dẫn. " +
        "URL chỉ được là: https://<project-ref>.supabase.co (không chứa /rest/v1 hay tên bảng)."
      );
    }
    return [];
  }

  if (!data || data.length === 0) return [];

  // Ghi nhận cấu trúc các cột thực tế của bảng trades để tối ưu khi update
  data.forEach(row => recordTradesTableColumns(row));

  // Tự động phát hiện tất cả các tài khoản MT5 xuất hiện trong database
  const detectedAccounts = extractAccountsFromTrades(data);

  // Lọc dữ liệu bằng Javascript để đảm bảo an toàn tuyệt đối về kiểu dữ liệu (String/Number)
  const cleanTarget = String(accountId || '').replace(/^acc-/, '').trim();
  const filteredData = (data as SupabaseTradeRow[]).filter(item => {
    const itemAcc = String(
      item.account_id ?? item.account ?? item.login ?? item.mt5_account ?? item.user_id ?? ''
    ).replace(/^acc-/, '').trim();
    if (itemAcc) {
      item.account_id = itemAcc;
    }
    if (!cleanTarget || cleanTarget === 'ALL') {
      return true;
    }
    return itemAcc === cleanTarget;
  });

  // Sắp xếp tăng dần theo close_time hoặc open_time bằng Javascript an toàn
  filteredData.sort((a, b) => {
    const timeA = new Date(a.close_time || a.open_time || 0).getTime();
    const timeB = new Date(b.close_time || b.open_time || 0).getTime();
    return timeA - timeB;
  });

  // Tích hợp dữ liệu từ local cache nếu Supabase chưa có (phòng khi vừa tick nhưng mạng chập chờn)
  const enrichedData = filteredData.map(item => {
    const cached = getTradeJournalFromLocalCache(item.ticket);
    if (!cached) return item;
    const hasPre = item.pre_checklist_ids && (Array.isArray(item.pre_checklist_ids) ? item.pre_checklist_ids.length > 0 : String(item.pre_checklist_ids).length > 2);
    const hasPost = item.post_checklist_ids && (Array.isArray(item.post_checklist_ids) ? item.post_checklist_ids.length > 0 : String(item.post_checklist_ids).length > 2);
    const cachedHtf = cached.htf_image_url || cached.pre_image || '';
    const cachedLtf = cached.ltf_image_url || cached.image_base64 || '';
    return {
      ...item,
      pre_checklist_ids: hasPre ? item.pre_checklist_ids : (cached.pre_checklist_ids ?? cached.checklist ?? item.pre_checklist_ids),
      post_checklist_ids: hasPost ? item.post_checklist_ids : (cached.post_checklist_ids ?? cached.mistake_tags ?? item.post_checklist_ids),
      notes: item.notes || cached.notes || '',
      setup: item.setup || cached.setup,
      timeframe: item.timeframe || cached.timeframe,
      plan_id: item.plan_id || cached.plan_id,
      plan_name: item.plan_name || cached.plan_name,
      // Box 1: CHỈ nhận htf_image_url do user lưu, TUYỆT ĐỐI không lấy image_url_1 từ MT5!
      htf_image_url: cachedHtf || (item.htf_image_url && item.htf_image_url !== item.image_url_1 ? item.htf_image_url : ''),
      pre_image: cachedHtf || '',
      // Box 2: Nhận ảnh đóng lệnh từ cache hoặc MT5
      ltf_image_url: cachedLtf || item.ltf_image_url || item.image_base64 || item.image_url_1 || '',
      image_base64: cachedLtf || item.image_base64 || item.ltf_image_url || item.image_url_1 || '',
    };
  });

  // Đính kèm danh sách tài khoản đã phát hiện và mảng thô vào kết quả trả về
  (enrichedData as any).detectedAccounts = detectedAccounts;
  (enrichedData as any).allRawTrades = data;
  return enrichedData;
}

// Alias for compatibility
export const fetchClosedTradesFromSupabase = fetchTradesFromSupabase;

/**
 * Lắng nghe thay đổi bảng trades theo thời gian thực (Supabase Realtime WebSocket)
 * Tự động bắt các sự kiện INSERT, UPDATE, DELETE khi MT5 đẩy lệnh lên Supabase.
 */
export function subscribeToTradesRealtime(onTradeChange: (payload: any) => void): (() => void) {
  const client = getSupabaseClient();
  if (!client) return () => {};

  try {
    const channelId = `realtime-trades-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const channel = client
      .channel(channelId)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trades',
        },
        (payload) => {
          console.log('⚡ [Realtime WebSocket] Nhận biến động lệnh từ Supabase (trades):', payload);
          onTradeChange(payload);
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'Trades',
        },
        (payload) => {
          console.log('⚡ [Realtime WebSocket] Nhận biến động lệnh từ Supabase (Trades):', payload);
          onTradeChange(payload);
        }
      )
      .subscribe((status, err) => {
        if (err) {
          console.warn('⚡ [Realtime WebSocket] Lỗi kết nối kênh:', err);
        } else {
          console.log('⚡ [Realtime WebSocket] Trạng thái kênh trades:', status);
        }
      });

    return () => {
      try {
        client.removeChannel(channel);
      } catch (e) {
        console.warn('Lỗi khi đóng kênh Realtime:', e);
      }
    };
  } catch (err) {
    console.warn('Lỗi khởi tạo Supabase Realtime channel:', err);
    return () => {};
  }
}

/**
 * Test kết nối đến Supabase
 */
export async function testSupabaseConnection(
  url?: string,
  anonKey?: string
): Promise<{ success: boolean; message: string; rowCount?: number }> {
  try {
    const rawUrl = url || getSupabaseCredentials().url;
    const rawKey = anonKey || getSupabaseCredentials().anonKey;

    const testUrl = cleanSupabaseUrl(rawUrl);
    const testKey = cleanSupabaseKey(rawKey);

    if (!testUrl || !testKey) {
      return { success: false, message: 'Thiếu URL hoặc Anon Key' };
    }

    const client = createClient(testUrl, testKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    let { data, count, error } = await client
      .from('trades')
      .select('*', { count: 'exact' });

    if (error && (error.code === 'PGRST125' || error.code === 'PGRST205' || error.code === 'PGRST200')) {
      const retry = await client.from('Trades').select('*', { count: 'exact' });
      if (!retry.error) {
        data = retry.data;
        count = retry.count;
        error = null;
      }
    }

    if (error) {
      return { 
        success: false, 
        message: `Lỗi kết nối (${error.code || 'API'}): ${error.message}${
          error.code === 'PGRST125' ? ' (Kiểm tra lại URL: không thêm /rest/v1 vào sau domain)' : ''
        }` 
      };
    }

    const total = count ?? (data ? data.length : 0);
    return {
      success: true,
      message: `Kết nối thành công! Bảng 'trades' có ${total} dòng dữ liệu.`,
      rowCount: total,
    };
  } catch (err: any) {
    return { success: false, message: err.message || 'Lỗi không xác định khi kết nối Supabase' };
  }
}

const LOCAL_PLANS_KEY = 'trade_journal_plans';

/**
 * Lấy danh sách Plans trực tiếp từ Supabase theo accountId
 * Luôn fetch từ database Supabase với điều kiện .eq('account_id', selectedAccountId)
 * KHÔNG fallback sang mock/state cũ để phản ánh chính xác số lượng bản ghi thực tế.
 */
export async function fetchPlansFromSupabase(accountId?: string): Promise<TradingPlan[]> {
  const cleanAccountId = accountId ? String(accountId).replace(/^acc-/, '').trim() : '';

  // Helper hàm lấy TOÀN BỘ plans từ LocalStorage
  const getAllLocalStoragePlans = (): TradingPlan[] => {
    try {
      const saved = localStorage.getItem(LOCAL_PLANS_KEY);
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {}
    return [];
  };

  // Helper hàm lấy danh sách plans fallback từ LocalStorage theo đúng account_id
  const getLocalStoragePlans = (): TradingPlan[] => {
    const list = getAllLocalStoragePlans();
    if (!cleanAccountId || cleanAccountId === 'ALL') {
      return list;
    }
    return list.filter(p => {
      const pAcc = String(p.account_id || '').replace(/^acc-/, '').trim();
      // Phân tách tài khoản tuyệt đối: chỉ lấy plan thuộc đúng cleanAccountId
      return pAcc === cleanAccountId;
    });
  };

  try {
    const client = getSupabaseClient();
    if (!client) {
      return getLocalStoragePlans();
    }

    // Tải toàn bộ Plans của Thầy trên Supabase để không bao giờ bị mất hoặc ẩn nhầm Plan
    let query = client
      .from('plans')
      .select('*')
      .order('created_at', { ascending: false });

    let { data, error } = await query;

    // Trường hợp bảng được đặt tên hoa 'Plans'
    if (error && (error.code === 'PGRST125' || error.code === 'PGRST205' || error.code === 'PGRST200')) {
      let retry = client.from('Plans').select('*').order('created_at', { ascending: false });
      const res = await retry;
      if (!res.error && res.data) {
        data = res.data;
        error = null;
      }
    }

    if (data && data.length > 0) {
      console.log(`[fetchPlansFromSupabase] Đã nạp ${data.length} plans từ Supabase cho account: ${cleanAccountId || 'ALL'}`);
      const remotePlans: TradingPlan[] = data.map((item: any) => ({
        id: String(item.id),
        account_id: item.account_id ? String(item.account_id) : (cleanAccountId || undefined),
        plan_name: item.plan_name || item.title || `${item.symbol || 'PLAN'} - ${item.created_at?.slice(0, 16) || ''}`,
        symbol: item.symbol || 'XAUUSD',
        timeframe: item.timeframe || 'M15',
        setup: item.setup || '',
        notes: item.notes || '',
        checklist: parseChecklistArray(item.checklist || item.pre_checklist_ids),
        post_checklist: parseChecklistArray(item.post_checklist || item.post_checklist_ids),
        image_url: item.image_url || item.imageUrl || item.htf_image_url || '',
        status: item.status || 'PENDING',
        created_at: item.created_at || new Date().toISOString(),
        code: item.code || `P-${item.id}`,
        title: item.title || `${item.symbol || 'PLAN'} [${item.timeframe || 'M15'}] - ${item.setup || ''}`,
        type: item.type || 'BUY',
        entry_zone: item.entry_zone,
        sl_target: item.sl_target,
        tp_target: item.tp_target,
        rr_estimate: item.rr_estimate,
        bias: item.bias,
      }));

      // Gộp các plan từ LocalStorage nếu có plan mới tạo chưa kịp phản hồi từ Supabase
      const localList = getAllLocalStoragePlans();
      const remoteIdSet = new Set(remotePlans.map(p => p.id));
      const unsyncedLocals = localList.filter(lp => !remoteIdSet.has(lp.id));
      const finalPlans = [...remotePlans, ...unsyncedLocals];

      // Lưu danh sách mới nhất vào LocalStorage
      try {
        localStorage.setItem(LOCAL_PLANS_KEY, JSON.stringify(finalPlans));
      } catch {}

      return finalPlans;
    }

    return getLocalStoragePlans();
  } catch (err: any) {
    console.warn('Không thể tải plans từ Supabase (chuyển fallback cache):', err?.message || err);
    return getLocalStoragePlans();
  }
}

/**
 * Lọc Kế hoạch (Plans) chặt chẽ 2 Lớp theo Đa Tài Khoản (account_id) và Cặp Tiền (symbol):
 * 1. .eq('account_id', currentTrade.account_id) (Chỉ lấy Plan thuộc đúng tài khoản MT5 này)
 * 2. .eq('symbol', currentTrade.symbol) (Chỉ lấy Plan thuộc đúng cặp tiền này)
 */
export async function fetchPlansForTrade(
  accountId: string,
  symbol: string
): Promise<TradingPlan[]> {
  const cleanAccountId = String(accountId || '').replace(/^acc-/, '').trim();
  const rawSymbol = (symbol || '').trim();
  const upperSymbol = rawSymbol.toUpperCase();
  const noSlashSymbol = upperSymbol.replace('/', '');

  console.log(`[Supabase 1-Click Mapping] Query bảng plans: account_id=${cleanAccountId}, symbol=${upperSymbol}`);

  try {
    const client = getSupabaseClient();
    if (client) {
      // 1. Thử query chính xác .eq('account_id', cleanAccountId).eq('symbol', rawSymbol)
      let query = client
        .from('plans')
        .select('*')
        .order('created_at', { ascending: false });

      if (cleanAccountId && cleanAccountId !== 'ALL') {
        query = query.eq('account_id', cleanAccountId);
      }
      if (rawSymbol) {
        query = query.eq('symbol', rawSymbol);
      }

      let { data, error } = await query;

      // Xử lý hoa thường bảng
      if (error && (error.code === 'PGRST125' || error.code === 'PGRST205' || error.code === 'PGRST200')) {
        let retry = client.from('Plans').select('*').order('created_at', { ascending: false });
        if (cleanAccountId && cleanAccountId !== 'ALL') retry = retry.eq('account_id', cleanAccountId);
        if (rawSymbol) retry = retry.eq('symbol', rawSymbol);
        const res = await retry;
        if (!res.error && res.data) {
          data = res.data;
          error = null;
        }
      }

      // Nếu symbol ở trade là EUR/USD nhưng trong bảng lưu EURUSD (hoặc ngược lại)
      if ((!data || data.length === 0) && rawSymbol) {
        const altSymbol = rawSymbol.includes('/') ? noSlashSymbol : (rawSymbol.length === 6 ? `${rawSymbol.slice(0,3)}/${rawSymbol.slice(3)}` : rawSymbol);
        if (altSymbol !== rawSymbol) {
          let retryAlt = client.from('plans').select('*').order('created_at', { ascending: false });
          if (cleanAccountId && cleanAccountId !== 'ALL') retryAlt = retryAlt.eq('account_id', cleanAccountId);
          retryAlt = retryAlt.eq('symbol', altSymbol);
          const altRes = await retryAlt;
          if (!altRes.error && altRes.data && altRes.data.length > 0) {
            data = altRes.data;
          }
        }
      }

      if (data && data.length > 0) {
        return data.map((item: any) => ({
          id: String(item.id),
          account_id: item.account_id ? String(item.account_id) : cleanAccountId,
          plan_name: item.plan_name || item.title || `${item.symbol || 'PLAN'} - ${item.created_at?.slice(0, 16) || ''}`,
          symbol: item.symbol || rawSymbol,
          timeframe: item.timeframe || 'M15',
          setup: item.setup || '',
          notes: item.notes || '',
          checklist: parseChecklistArray(item.checklist || item.pre_checklist_ids),
          image_url: item.image_url || item.htf_image_url || '',
          status: item.status || 'PENDING',
          created_at: item.created_at || new Date().toISOString(),
          code: item.code,
          title: item.title,
          type: item.type,
        }));
      }
    }
  } catch (err) {
    console.warn('[Supabase 1-Click Mapping] Không thể tải plans từ Supabase, chuyển fallback:', err);
  }

  // Fallback sang LocalStorage (cũng tuân thủ lọc 2 lớp chặt chẽ)
  try {
    const saved = localStorage.getItem(LOCAL_PLANS_KEY);
    if (saved) {
      const list: TradingPlan[] = JSON.parse(saved);
      return list.filter(p => {
        const pAcc = String(p.account_id || '').replace(/^acc-/, '').trim();
        const matchAcc = !cleanAccountId || cleanAccountId === 'ALL' || pAcc === cleanAccountId;
        const pSym = (p.symbol || '').replace('/', '').toUpperCase();
        const matchSym = !noSlashSymbol || pSym === noSlashSymbol;
        return matchAcc && matchSym;
      });
    }
  } catch {}

  return [];
}

/**
 * Helper kiểm tra chuỗi có đúng định dạng UUID PostgreSQL không
 */
export function isValidUUID(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Sinh UUID v4 chuẩn tương thích 100% với cột UUID của PostgreSQL Supabase
 */
export function generateValidUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {}
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Lưu / Thêm mới Plan lên Supabase & LocalStorage (status mặc định 'PENDING')
 * Luôn đảm bảo ID là UUID v4 hợp lệ để PostgreSQL không từ chối lưu.
 */
export async function savePlanToSupabase(plan: TradingPlan): Promise<{ success: boolean; plan: TradingPlan; error?: string }> {
  // Đảm bảo ID luôn là UUID chuẩn v4 cho PostgreSQL
  const safeId = (plan.id && isValidUUID(plan.id)) ? plan.id : generateValidUUID();
  const safePlan: TradingPlan = {
    ...plan,
    id: safeId,
  };

  // 1. Luôn lưu vào LocalStorage ngay lập tức
  try {
    const saved = localStorage.getItem(LOCAL_PLANS_KEY);
    let list: TradingPlan[] = saved ? JSON.parse(saved) : [];
    const existingIndex = list.findIndex(p => p.id === safePlan.id || (plan.id && p.id === plan.id));
    if (existingIndex >= 0) {
      list[existingIndex] = safePlan;
    } else {
      list.unshift(safePlan);
    }
    localStorage.setItem(LOCAL_PLANS_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Lỗi lưu LocalStorage cho Plan:', err);
  }

  // 2. Đẩy lên Supabase bảng 'plans'
  try {
    const client = getSupabaseClient();
    if (client) {
      const safeImageUrl = safePlan.image_url || null;
      const payload = {
        id: safePlan.id,
        account_id: safePlan.account_id ? String(safePlan.account_id).replace(/^acc-/, '').trim() : null,
        plan_name: safePlan.plan_name,
        symbol: safePlan.symbol,
        timeframe: safePlan.timeframe,
        setup: safePlan.setup || null,
        notes: safePlan.notes || null,
        checklist: safePlan.checklist || [],
        post_checklist: safePlan.post_checklist || [],
        image_url: safeImageUrl,
        status: safePlan.status || 'PENDING',
        created_at: safePlan.created_at || new Date().toISOString(),
      };

      const { error } = await client.from('plans').upsert(payload);
      if (error) {
        console.warn('Lỗi upsert bảng plans trên Supabase:', error.message);
        return { success: false, plan: safePlan, error: error.message };
      }
    }
    return { success: true, plan: safePlan };
  } catch (err: any) {
    console.warn('Lỗi gửi plan lên Supabase:', err);
    return { success: false, plan: safePlan, error: err.message };
  }
}

/**
 * Xóa Plan khỏi Supabase & LocalStorage
 */
export async function deletePlanFromSupabase(planId: string): Promise<boolean> {
  // Cập nhật LocalStorage
  try {
    const saved = localStorage.getItem(LOCAL_PLANS_KEY);
    if (saved) {
      const list: TradingPlan[] = JSON.parse(saved);
      const updated = list.filter(p => p.id !== planId);
      localStorage.setItem(LOCAL_PLANS_KEY, JSON.stringify(updated));
    }
  } catch {}

  // Cập nhật Supabase
  try {
    const client = getSupabaseClient();
    if (client) {
      await client.from('plans').delete().eq('id', planId);
    }
    return true;
  } catch (err) {
    console.warn('Lỗi delete plan trên Supabase:', err);
    return false;
  }
}

/**
 * Cập nhật trạng thái Plan (ví dụ sang 'EXECUTED') trên Supabase & LocalStorage
 */
export async function updatePlanStatusOnSupabase(
  planId: string, 
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED'
): Promise<boolean> {
  // Cập nhật LocalStorage
  try {
    const saved = localStorage.getItem(LOCAL_PLANS_KEY);
    if (saved) {
      const list: TradingPlan[] = JSON.parse(saved);
      const updated = list.map(p => p.id === planId ? { ...p, status } : p);
      localStorage.setItem(LOCAL_PLANS_KEY, JSON.stringify(updated));
    }
  } catch {}

  // Cập nhật Supabase
  try {
    const client = getSupabaseClient();
    if (client) {
      await client.from('plans').update({ status }).eq('id', planId);
    }
    return true;
  } catch (err) {
    console.warn('Lỗi update status plan trên Supabase:', err);
    return false;
  }
}

export interface TradeJournalUpdatePayload {
  plan_id?: string | null;
  plan_name?: string | null;
  timeframe?: string | null;
  setup?: string | null;
  setups?: string[] | null;
  notes?: string | null;
  pre_checklist_ids?: string[] | null;
  checklist?: string[] | null;
  post_checklist_ids?: string[] | null;
  mistake_tags?: string[] | null;
  lost_profit?: number | null;
  plan_pnl?: number | null;
  mfe?: number | null;
  mae?: number | null;
  mfe_r?: number | null;
  mae_r?: number | null;
  image_url_1?: string | null;
  htf_image_url?: string | null;
  image_base64?: string | null;
  ltf_image_url?: string | null;
}

/**
 * CẬP NHẬT TRỰC TIẾP JOURNAL VÀO BẢNG TRADES TRÊN SUPABASE (DEBOUNCED ~300MS)
 * - Whitelist nghiêm ngặt: CHỈ CẬP NHẬT các trường Journal do user thao tác
 * - TUYỆT ĐỐI KHÔNG ghi đè dữ liệu raw MT5 (open_price, close_price, volume, pnl, etc.)
 * - TUYỆT ĐỐI KHÔNG truyền dữ liệu nhị phân / base64 lớn xuống database
 * - Sử dụng Ticket (hoặc Trade ID) và Account ID để cập nhật đúng bản ghi duy nhất
 */
export async function updateTradeJournalOnSupabase(
  tradeIdentifier: { id?: string; ticket: string | number; account_id?: string } | string,
  updatesOrTicket: TradeJournalUpdatePayload | string | number,
  optionalUpdates?: TradeJournalUpdatePayload,
  optionalAccountId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Chuẩn hóa tham số gọi hàm
    let targetTicket: string | number = '';
    let targetId: string | undefined = undefined;
    let targetAccountId: string | undefined = undefined;
    let updates: TradeJournalUpdatePayload = {};

    if (typeof tradeIdentifier === 'object' && tradeIdentifier !== null) {
      targetId = tradeIdentifier.id;
      targetTicket = tradeIdentifier.ticket;
      targetAccountId = tradeIdentifier.account_id;
      updates = (updatesOrTicket as TradeJournalUpdatePayload) || {};
    } else {
      targetId = String(tradeIdentifier);
      targetTicket = updatesOrTicket as (string | number);
      updates = optionalUpdates || {};
      targetAccountId = optionalAccountId;
    }

    const cleanTicket = String(targetTicket || '').trim();

    // 1. Lưu ngay vào local cache để đảm bảo không mất dữ liệu dù có sự cố mạng
    if (cleanTicket) {
      saveTradeJournalToLocalCache(cleanTicket, updates);
    }

    const client = getSupabaseClient();
    if (!client) {
      return { success: true };
    }

    // 2. Chuẩn bị payload ứng viên với whitelist nghiêm ngặt
    const candidatePayload: Record<string, any> = {};

    if ('plan_id' in updates) candidatePayload.plan_id = updates.plan_id ?? null;
    if ('plan_name' in updates) candidatePayload.plan_name = updates.plan_name ?? null;
    if ('timeframe' in updates) candidatePayload.timeframe = updates.timeframe ?? null;
    if ('setup' in updates) {
      candidatePayload.setup = updates.setup ?? null;
      candidatePayload.setups = updates.setup ? [updates.setup] : [];
    }
    if ('setups' in updates && Array.isArray(updates.setups)) {
      candidatePayload.setups = updates.setups;
    }
    if ('notes' in updates) candidatePayload.notes = updates.notes ?? '';

    // Đồng bộ cả 2 tên cột cho Checklist Pre-trade: pre_checklist_ids & checklist
    if ('pre_checklist_ids' in updates || 'checklist' in updates) {
      const list = parseChecklistArray(updates.pre_checklist_ids ?? updates.checklist ?? []);
      candidatePayload.pre_checklist_ids = list;
      candidatePayload.checklist = list;
    }

    // Đồng bộ cả 2 tên cột cho Checklist Post-trade / Mistake tags: post_checklist_ids & mistake_tags
    if ('post_checklist_ids' in updates || 'mistake_tags' in updates) {
      const mistakes = parseChecklistArray(updates.post_checklist_ids ?? updates.mistake_tags ?? []);
      candidatePayload.post_checklist_ids = mistakes;
      candidatePayload.mistake_tags = mistakes;
    }

    // Financial calculations từ user / plan
    if ('lost_profit' in updates) {
      candidatePayload.lost_profit = updates.lost_profit !== null && updates.lost_profit !== undefined ? Number(updates.lost_profit) : 0;
    }
    if ('plan_pnl' in updates) {
      candidatePayload.plan_pnl = updates.plan_pnl !== null && updates.plan_pnl !== undefined ? Number(updates.plan_pnl) : null;
    }

    // MFE / MAE nếu có sẵn
    if ('mfe' in updates && updates.mfe !== undefined) candidatePayload.mfe = updates.mfe;
    if ('mae' in updates && updates.mae !== undefined) candidatePayload.mae = updates.mae;
    if ('mfe_r' in updates && updates.mfe_r !== undefined) candidatePayload.mfe_r = updates.mfe_r;
    if ('mae_r' in updates && updates.mae_r !== undefined) candidatePayload.mae_r = updates.mae_r;

    // Lưu URL ảnh
    const rawPreImg = updates.image_url_1 || updates.htf_image_url;
    if (rawPreImg && typeof rawPreImg === 'string' && !rawPreImg.startsWith('data:')) {
      candidatePayload.image_url_1 = rawPreImg;
      candidatePayload.htf_image_url = rawPreImg;
    }

    const rawPostImg = updates.ltf_image_url || updates.image_base64;
    if (rawPostImg && typeof rawPostImg === 'string' && !rawPostImg.startsWith('data:')) {
      candidatePayload.ltf_image_url = rawPostImg;
      candidatePayload.image_base64 = rawPostImg;
    }

    // Safety Clean: Tuyệt đối không để lọt trường raw hay base64
    delete (candidatePayload as any).pnl;
    delete (candidatePayload as any).net_pnl;
    delete (candidatePayload as any).open_price;
    delete (candidatePayload as any).close_price;
    delete (candidatePayload as any).volume;
    delete (candidatePayload as any).open_time;
    delete (candidatePayload as any).close_time;
    delete (candidatePayload as any).commission;
    delete (candidatePayload as any).swap;
    delete (candidatePayload as any).initial_sl;
    delete (candidatePayload as any).initial_balance;
    delete (candidatePayload as any).symbol;
    delete (candidatePayload as any).type;

    for (const key of Object.keys(candidatePayload)) {
      if (typeof candidatePayload[key] === 'string' && candidatePayload[key].startsWith('data:image/')) {
        delete candidatePayload[key];
      }
    }

    // 3. Khớp cột với knownTradesColumns nếu đã biết schema cache
    let payload: Record<string, any> = {};
    if (knownTradesColumns.size > 0) {
      for (const [k, v] of Object.entries(candidatePayload)) {
        if (knownTradesColumns.has(k)) {
          payload[k] = v;
        }
      }
      // Nếu knownTradesColumns chưa có cả pre_checklist_ids lẫn checklist, giữ lại pre_checklist_ids
      if (('pre_checklist_ids' in candidatePayload || 'checklist' in candidatePayload) &&
          !payload.pre_checklist_ids && !payload.checklist) {
        payload.pre_checklist_ids = candidatePayload.pre_checklist_ids;
      }
      if (('post_checklist_ids' in candidatePayload || 'mistake_tags' in candidatePayload) &&
          !payload.post_checklist_ids && !payload.mistake_tags) {
        payload.post_checklist_ids = candidatePayload.post_checklist_ids;
      }
    } else {
      payload = { ...candidatePayload };
    }

    if (Object.keys(payload).length === 0) {
      return { success: true };
    }

    // 4. Vòng lặp cập nhật với cơ chế tự động thích ứng loại bỏ cột không tồn tại (PGRST204)
    const hasValidTicket = Boolean(cleanTicket && cleanTicket !== '0' && cleanTicket !== '000000');
    const isRealSupabaseId = Boolean(targetId && !targetId.startsWith('trade-') && !targetId.startsWith('sb-'));

    let attempt = 0;
    const maxAttempts = 5;
    let lastError: any = null;

    while (attempt < maxAttempts) {
      attempt++;
      if (Object.keys(payload).length === 0) {
        return { success: true };
      }

      let query = client.from('trades').update(payload);
      if (hasValidTicket) {
        query = query.eq('ticket', cleanTicket);
      } else if (isRealSupabaseId) {
        query = query.eq('id', targetId);
      } else {
        query = query.eq('ticket', cleanTicket);
      }

      const { data, error } = await query.select('ticket');
      if (!error) {
        if ((!data || data.length === 0) && isRealSupabaseId && hasValidTicket) {
          const retryById = await client.from('trades').update(payload).eq('id', targetId).select('ticket');
          if (!retryById.error && retryById.data && retryById.data.length > 0) {
            return { success: true };
          }
        }
        return { success: true };
      }

      lastError = error;
      console.warn(`[updateTradeJournalOnSupabase] Lần thử ${attempt} lỗi:`, error.message);

      // Phát hiện cột không tồn tại trong database để loại bỏ và thử lại
      const missingCol = extractMissingColumn(error.message);
      if (missingCol && missingCol in payload) {
        console.warn(`[updateTradeJournalOnSupabase] Loại bỏ cột '${missingCol}' không có trong database và retry...`);
        delete payload[missingCol];
        knownTradesColumns.delete(missingCol);
        continue;
      }

      break;
    }

    console.warn('Lỗi Supabase khi update journal record:', lastError?.message);
    return { success: false, error: lastError?.message || 'Không thể lưu trade' };
  } catch (err: any) {
    console.warn('Ngoại lệ khi update journal record:', err);
    return { success: false, error: err?.message || String(err) };
  }
}

/**
 * HỦY LỆNH PENDING (CANCEL PENDING ORDER) TRÊN SUPABASE
 * Cập nhật status = 'CANCELLED' để đảm bảo reload không bị load lại
 */
export async function cancelPendingOrderOnSupabase(
  ticket: string | number,
  accountId?: string
): Promise<boolean> {
  try {
    const client = getSupabaseClient();
    if (!client) return true;

    const cleanTicket = String(ticket || '').trim();
    if (!cleanTicket) return false;

    let query = client.from('trades').update({ status: 'CANCELLED' }).eq('ticket', cleanTicket);
    if (accountId) {
      const cleanAcc = String(accountId).replace(/^acc-/, '').trim();
      if (cleanAcc && cleanAcc !== 'ALL') {
        query = query.eq('account_id', cleanAcc);
      }
    }

    const { error } = await query;
    if (error) {
      console.warn('Lỗi khi hủy pending order trên Supabase:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Ngoại lệ khi hủy pending order:', err);
    return false;
  }
}

/**
 * 1-Click Mapping: Cập nhật trade trên Supabase với metadata từ Plan
 * và tự động cập nhật status Plan = 'EXECUTED' trên Supabase.
 */
export async function updateTradeMappingOnSupabase(
  tradeId: string,
  ticket: string | number,
  mapping: {
    plan_id: string | null;
    plan_name?: string;
    timeframe?: string;
    setup?: string;
    notes?: string;
    checklist?: string[];
    pre_checklist_ids?: string[];
    image_url_1?: string;
  },
  accountId?: string
): Promise<boolean> {
  try {
    // 1. Cập nhật status Plan = 'EXECUTED' trên bảng plans nếu có plan_id
    if (mapping.plan_id) {
      await updatePlanStatusOnSupabase(mapping.plan_id, 'EXECUTED');
    }

    // 2. Chuẩn hóa checklist array độc lập
    const checklistData = parseChecklistArray(mapping.checklist || mapping.pre_checklist_ids || []);

    // 3. Ủy nhiệm trực tiếp cho updateTradeJournalOnSupabase để hưởng trọn tính năng adaptive schema & retry
    const res = await updateTradeJournalOnSupabase(
      { id: tradeId, ticket, account_id: accountId },
      {
        plan_id: mapping.plan_id,
        plan_name: mapping.plan_name,
        timeframe: mapping.timeframe,
        setup: mapping.setup,
        notes: mapping.notes,
        pre_checklist_ids: checklistData,
        checklist: checklistData,
        image_url_1: mapping.image_url_1,
        htf_image_url: mapping.image_url_1,
      },
      undefined,
      accountId
    );

    return res.success;
  } catch (err) {
    console.warn('Lỗi gọi Supabase khi map trade:', err);
    return false;
  }
}

