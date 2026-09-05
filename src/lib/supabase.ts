import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { TradingPlan } from '../types';

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
  if (!host) return '';

  return `${protocol}${host}`;
}

export function cleanSupabaseKey(rawKey: string): string {
  if (!rawKey) return '';
  return rawKey.trim().replace(/^["']|["']$/g, '').trim();
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
  if (typeof window !== 'undefined' && storedUrl && cleanedUrl && storedUrl !== cleanedUrl) {
    localStorage.setItem('trade_journal_supabase_url', cleanedUrl);
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
        persistSession: false,
        autoRefreshToken: false,
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

/**
 * Fetch toàn bộ danh sách lệnh từ Supabase, tối giản hóa query và lọc bằng Javascript
 * để tránh lỗi lệch kiểu dữ liệu hoặc lỗi điều kiện lọc.
 */
export async function fetchTradesFromSupabase(accountId: string = "26325348"): Promise<SupabaseTradeRow[]> {
  console.log("--> Đang gọi Supabase với accountId:", accountId);

  const client = getSupabaseClient();
  if (!client) {
    console.error("❌ Lỗi Supabase API: Chưa cấu hình Supabase URL hoặc Anon Key trong Cài Đặt.");
    return [];
  }

  const { url } = getSupabaseCredentials();
  console.log("--> Supabase Project URL đang kết nối:", url);

  // Bỏ bớt các điều kiện lọc phức tạp để test kết nối trước
  let { data, error } = await client
    .from('trades')
    .select('*');

  // Nếu gặp lỗi PGRST125 hoặc PGRST205, thử kiểm tra bảng 'Trades' (viết hoa chữ T)
  if (error && (error.code === 'PGRST125' || error.code === 'PGRST205' || error.code === 'PGRST200')) {
    console.warn("Thử kiểm tra bảng Trades (viết hoa)...");
    const retry = await client.from('Trades').select('*');
    if (!retry.error && retry.data) {
      data = retry.data;
      error = null;
    }
  }

  if (error) {
    console.error("❌ Lỗi Supabase API:", error);
    if (error.code === 'PGRST125') {
      console.error(
        "💡 Gợi ý sửa lỗi PGRST125: URL Supabase bị sai đường dẫn. " +
        "URL chỉ được là: https://<project-ref>.supabase.co (không chứa /rest/v1 hay tên bảng)."
      );
    }
    return [];
  }

  console.log("✅ Dữ liệu thô Supabase trả về:", data);

  if (!data || data.length === 0) return [];

  // Lọc dữ liệu bằng Javascript để đảm bảo an toàn tuyệt đối về kiểu dữ liệu (String/Number)
  const cleanTarget = String(accountId || '').replace(/^acc-/, '').trim();
  const filteredData = (data as SupabaseTradeRow[]).filter(item => {
    const itemAcc = String(item.account_id ?? '').replace(/^acc-/, '').trim();
    const matchAccount = !accountId || accountId === 'ALL' || itemAcc === cleanTarget || String(item.account_id) === String(accountId);
    return matchAccount;
  });

  // Sắp xếp tăng dần theo close_time hoặc open_time bằng Javascript an toàn
  filteredData.sort((a, b) => {
    const timeA = new Date(a.close_time || a.open_time || 0).getTime();
    const timeB = new Date(b.close_time || b.open_time || 0).getTime();
    return timeA - timeB;
  });

  console.log("📊 Dữ liệu sau khi filter Javascript:", filteredData);
  return filteredData;
}

// Alias for compatibility
export const fetchClosedTradesFromSupabase = fetchTradesFromSupabase;

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

  try {
    const client = getSupabaseClient();
    if (!client) {
      console.warn('Supabase Client chưa được khởi tạo. Vui lòng kiểm tra Cài Đặt.');
      return [];
    }

    let query = client
      .from('plans')
      .select('*')
      .order('created_at', { ascending: false });

    if (cleanAccountId && cleanAccountId !== 'ALL') {
      query = query.eq('account_id', cleanAccountId);
    }

    let { data, error } = await query;

    // Trường hợp bảng được đặt tên hoa 'Plans'
    if (error && (error.code === 'PGRST125' || error.code === 'PGRST205' || error.code === 'PGRST200')) {
      let retry = client.from('Plans').select('*').order('created_at', { ascending: false });
      if (cleanAccountId && cleanAccountId !== 'ALL') {
        retry = retry.eq('account_id', cleanAccountId);
      }
      const res = await retry;
      if (!res.error && res.data) {
        data = res.data;
        error = null;
      }
    }

    if (error) {
      console.error("Lỗi khi tải danh sách Plans từ Supabase:", error);
      return [];
    }

    if (data) {
      console.log(`[fetchPlansFromSupabase] Đã nạp ${data.length} plans từ Supabase cho account: ${cleanAccountId || 'ALL'}`);
      const plansList: TradingPlan[] = data.map((item: any) => ({
        id: String(item.id),
        account_id: item.account_id ? String(item.account_id) : (cleanAccountId || undefined),
        plan_name: item.plan_name || item.title || `${item.symbol || 'PLAN'} - ${item.created_at?.slice(0, 16) || ''}`,
        symbol: item.symbol || 'XAUUSD',
        timeframe: item.timeframe || 'M15',
        setup: item.setup || '',
        notes: item.notes || '',
        checklist: Array.isArray(item.checklist) ? item.checklist : (item.checklist ? (typeof item.checklist === 'string' ? JSON.parse(item.checklist) : []) : []),
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

      // Cache đồng bộ để sử dụng offline nếu cần
      try {
        localStorage.setItem(LOCAL_PLANS_KEY, JSON.stringify(plansList));
      } catch {}

      return plansList;
    }
  } catch (err) {
    console.error('Không thể tải plans từ Supabase:', err);
  }

  return [];
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
          checklist: Array.isArray(item.checklist) ? item.checklist : (item.checklist ? JSON.parse(item.checklist) : []),
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
        const matchAcc = !cleanAccountId || cleanAccountId === 'ALL' || !pAcc || pAcc === cleanAccountId;
        const pSym = (p.symbol || '').replace('/', '').toUpperCase();
        const matchSym = !noSlashSymbol || pSym === noSlashSymbol;
        return matchAcc && matchSym;
      });
    }
  } catch {}

  return [];
}

/**
 * Lưu / Thêm mới Plan lên Supabase & LocalStorage (status mặc định 'PENDING')
 */
export async function savePlanToSupabase(plan: TradingPlan): Promise<{ success: boolean; error?: string }> {
  // 1. Luôn lưu vào LocalStorage ngay lập tức
  try {
    const saved = localStorage.getItem(LOCAL_PLANS_KEY);
    let list: TradingPlan[] = saved ? JSON.parse(saved) : [];
    const existingIndex = list.findIndex(p => p.id === plan.id);
    if (existingIndex >= 0) {
      list[existingIndex] = plan;
    } else {
      list.unshift(plan);
    }
    localStorage.setItem(LOCAL_PLANS_KEY, JSON.stringify(list));
  } catch (err) {
    console.warn('Lỗi lưu LocalStorage cho Plan:', err);
  }

  // 2. Đẩy lên Supabase bảng 'plans'
  try {
    const client = getSupabaseClient();
    if (client) {
      const payload = {
        id: plan.id,
        account_id: plan.account_id ? String(plan.account_id).replace(/^acc-/, '').trim() : null,
        plan_name: plan.plan_name,
        symbol: plan.symbol,
        timeframe: plan.timeframe,
        setup: plan.setup || null,
        notes: plan.notes || null,
        checklist: plan.checklist || [],
        image_url: plan.image_url || null,
        status: plan.status || 'PENDING',
        created_at: plan.created_at || new Date().toISOString(),
      };

      const { error } = await client.from('plans').upsert(payload);
      if (error) {
        console.warn('Lỗi upsert bảng plans trên Supabase (có thể bảng chưa được tạo):', error.message);
        return { success: true, error: error.message }; // Vẫn coi là thành công vì đã lưu LocalStorage an toàn
      }
    }
    return { success: true };
  } catch (err: any) {
    console.warn('Lỗi gửi plan lên Supabase:', err);
    return { success: true, error: err.message };
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
  }
): Promise<boolean> {
  try {
    const client = getSupabaseClient();

    // 1. Cập nhật status Plan = 'EXECUTED' trên bảng plans nếu có plan_id
    if (mapping.plan_id) {
      await updatePlanStatusOnSupabase(mapping.plan_id, 'EXECUTED');
    }

    if (!client) return true;

    const checklistData = mapping.checklist || mapping.pre_checklist_ids || [];
    const payload: Record<string, any> = {
      plan_id: mapping.plan_id,
    };

    if (mapping.plan_name) payload.plan_name = mapping.plan_name;
    if (mapping.timeframe) payload.timeframe = mapping.timeframe;
    if (mapping.notes !== undefined) payload.notes = mapping.notes;
    if (mapping.setup) {
      payload.setup = mapping.setup;
      payload.setups = [mapping.setup];
    }
    if (checklistData.length > 0) {
      payload.pre_checklist_ids = checklistData;
      payload.checklist = checklistData;
    }
    if (mapping.image_url_1 !== undefined) {
      payload.image_url_1 = mapping.image_url_1;
      payload.htf_image_url = mapping.image_url_1;
    }

    // Thử update theo Ticket hoặc ID
    let query = client.from('trades').update(payload);
    if (ticket && String(ticket) !== '0' && String(ticket) !== '000000') {
      query = query.eq('ticket', ticket);
    } else if (tradeId && !tradeId.startsWith('trade-') && !tradeId.startsWith('sb-')) {
      query = query.eq('id', tradeId);
    } else {
      query = query.eq('ticket', ticket);
    }

    const { error } = await query;
    if (error) {
      console.warn('Lỗi Supabase khi map Plan cho Trade:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn('Lỗi gọi Supabase khi map trade:', err);
    return false;
  }
}

