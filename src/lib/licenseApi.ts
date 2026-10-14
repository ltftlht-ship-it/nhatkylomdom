import { getSupabaseClient } from './supabase';
import { LicenseItem, LicenseCheckResult } from '../types/license';

const LOCAL_LICENSES_CACHE_KEY = 'bigdeal_commercial_licenses_cache';

/**
 * Lấy danh sách bản quyền từ Local Cache
 */
export function getLocalLicenses(): LicenseItem[] {
  try {
    const raw = localStorage.getItem(LOCAL_LICENSES_CACHE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.warn('Lỗi đọc cache licenses:', e);
  }
  return [];
}

/**
 * Lưu danh sách bản quyền vào Local Cache
 */
export function saveLocalLicenses(licenses: LicenseItem[]) {
  try {
    localStorage.setItem(LOCAL_LICENSES_CACHE_KEY, JSON.stringify(licenses));
  } catch (e) {
    console.warn('Lỗi ghi cache licenses:', e);
  }
}

/**
 * Nạp toàn bộ danh sách bản quyền từ Supabase (dành cho Admin Thầy Tài)
 */
export async function fetchLicenses(): Promise<LicenseItem[]> {
  try {
    const client = getSupabaseClient();
    if (client) {
      const { data, error } = await client
        .from('licenses')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const cleaned: LicenseItem[] = data.map(d => ({
          id: d.id || String(Date.now()),
          email: (d.email || '').toLowerCase().trim(),
          allowed_accounts: d.allowed_accounts || '',
          status: (d.status || 'ACTIVE').toUpperCase() as any,
          expires_at: d.expires_at || null,
          customer_name: d.customer_name || '',
          notes: d.notes || '',
          created_at: d.created_at || new Date().toISOString()
        }));
        saveLocalLicenses(cleaned);
        return cleaned;
      }
    }
  } catch (err) {
    console.warn('Không thể kết nối Supabase licenses table:', err);
  }

  // Fallback đọc từ LocalStorage
  return getLocalLicenses();
}

/**
 * Thêm hoặc Cập nhật Bản Quyền cho khách hàng
 */
export async function saveLicense(license: Omit<LicenseItem, 'id'> & { id?: string }): Promise<LicenseItem> {
  const cleanEmail = (license.email || '').toLowerCase().trim();
  const cleanAccounts = (license.allowed_accounts || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .join(', ');

  const itemToSave: LicenseItem = {
    id: license.id || 'lic_' + btoa(cleanEmail).replace(/[^a-zA-Z0-9]/g, '').substring(0, 12),
    email: cleanEmail,
    allowed_accounts: cleanAccounts,
    status: license.status || 'ACTIVE',
    expires_at: license.expires_at || null,
    customer_name: license.customer_name || '',
    notes: license.notes || '',
    created_at: (license as any).created_at || new Date().toISOString()
  };

  // Cập nhật Local Cache ngay lập tức
  const current = getLocalLicenses();
  const index = current.findIndex(l => l.email === cleanEmail);
  if (index >= 0) {
    current[index] = { ...current[index], ...itemToSave };
  } else {
    current.unshift(itemToSave);
  }
  saveLocalLicenses(current);

  // Đồng bộ lên Supabase nếu có bảng licenses
  try {
    const client = getSupabaseClient();
    if (client) {
      await client.from('licenses').upsert({
        email: itemToSave.email,
        allowed_accounts: itemToSave.allowed_accounts,
        status: itemToSave.status,
        expires_at: itemToSave.expires_at,
        customer_name: itemToSave.customer_name,
        notes: itemToSave.notes
      }, { onConflict: 'email' });
    }
  } catch (err) {
    console.warn('Supabase licenses remote upsert warning:', err);
  }

  return itemToSave;
}

/**
 * Xóa bản quyền khách hàng
 */
export async function deleteLicense(email: string): Promise<boolean> {
  const cleanEmail = email.toLowerCase().trim();
  const current = getLocalLicenses().filter(l => l.email !== cleanEmail);
  saveLocalLicenses(current);

  try {
    const client = getSupabaseClient();
    if (client) {
      await client.from('licenses').delete().eq('email', cleanEmail);
    }
  } catch (err) {
    console.warn('Lỗi xóa license trên Supabase:', err);
  }
  return true;
}

/**
 * Kiểm tra bản quyền của một người dùng
 */
export async function verifyUserLicense(email: string, isAdminUser: boolean = false): Promise<LicenseCheckResult> {
  const cleanEmail = (email || '').toLowerCase().trim();

  // 1. Quản trị viên tối cao (Thầy Tài) luôn được miễn kiểm tra bản quyền
  if (isAdminUser || cleanEmail === 'ltf.tlht@gmail.com' || cleanEmail.includes('nhatkylomdom')) {
    return {
      isValid: true,
      isExpired: false,
      isBlocked: false,
      allowedAccountsList: [], // Rỗng nghĩa là xem toàn bộ
      message: '👑 Quyền Quản trị viên tối cao'
    };
  }

  // 2. Nạp danh sách licenses
  const licenses = await fetchLicenses();
  const userLic = licenses.find(l => l.email === cleanEmail);

  if (!userLic) {
    return {
      isValid: false,
      isExpired: false,
      isBlocked: false,
      allowedAccountsList: [],
      message: 'Tài khoản chưa được kích hoạt bản quyền thương mại.'
    };
  }

  if (userLic.status === 'BLOCKED') {
    return {
      isValid: false,
      isExpired: false,
      isBlocked: true,
      license: userLic,
      allowedAccountsList: [],
      message: 'Bản quyền tài khoản của bạn đang tạm thời bị khóa.'
    };
  }

  // 3. Kiểm tra ngày hết hạn
  if (userLic.expires_at) {
    const expireTime = new Date(userLic.expires_at).getTime();
    if (Date.now() > expireTime) {
      return {
        isValid: false,
        isExpired: true,
        isBlocked: false,
        license: userLic,
        allowedAccountsList: [],
        message: 'Gói bản quyền của bạn đã hết hạn. Vui lòng liên hệ Admin để gia hạn.'
      };
    }
  }

  // 4. Trích xuất danh sách các số tài khoản MT5 được cấp phép
  const accountsList = (userLic.allowed_accounts || '')
    .split(',')
    .map(s => s.trim().replace(/^acc-/, ''))
    .filter(Boolean);

  return {
    isValid: true,
    isExpired: false,
    isBlocked: false,
    license: userLic,
    allowedAccountsList: accountsList,
    message: 'Bản quyền đang hoạt động hợp lệ'
  };
}
