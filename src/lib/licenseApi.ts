import { getSupabaseClient } from './supabase';
import { LicenseItem, LicenseCheckResult } from '../types/license';

// Bản quyền chỉ lưu trên Supabase (bảng licenses, có RLS trong supabase/security.sql).
// Không dùng cache localStorage: người dùng có thể tự sửa cache để tự cấp bản quyền.

function requireClient() {
  const client = getSupabaseClient();
  if (!client) throw new Error('Chưa kết nối Supabase');
  return client;
}

/**
 * Nạp toàn bộ danh sách bản quyền từ Supabase (chỉ Admin đọc được nhờ RLS)
 */
export async function fetchLicenses(): Promise<LicenseItem[]> {
  const { data, error } = await requireClient()
    .from('licenses')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(`Không tải được bảng licenses: ${error.message}`);
  return (data || []).map(d => ({
    id: d.id,
    email: (d.email || '').toLowerCase().trim(),
    allowed_accounts: d.allowed_accounts || '',
    status: (d.status || 'ACTIVE').toUpperCase() as any,
    expires_at: d.expires_at || null,
    customer_name: d.customer_name || '',
    notes: d.notes || '',
    created_at: d.created_at
  }));
}

/**
 * Thêm hoặc Cập nhật Bản Quyền cho khách hàng
 */
export async function saveLicense(license: Omit<LicenseItem, 'id'> & { id?: string }): Promise<void> {
  const cleanEmail = (license.email || '').toLowerCase().trim();
  const cleanAccounts = (license.allowed_accounts || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .join(', ');

  const { error } = await requireClient().from('licenses').upsert({
    email: cleanEmail,
    allowed_accounts: cleanAccounts,
    status: license.status || 'ACTIVE',
    expires_at: license.expires_at || null,
    customer_name: license.customer_name || '',
    notes: license.notes || ''
  }, { onConflict: 'email' });
  if (error) throw new Error(`Không lưu được bản quyền: ${error.message}`);
}

/**
 * Xóa bản quyền khách hàng
 */
export async function deleteLicense(email: string): Promise<void> {
  const cleanEmail = email.toLowerCase().trim();
  const { error } = await requireClient().from('licenses').delete().eq('email', cleanEmail);
  if (error) throw new Error(`Không xóa được bản quyền: ${error.message}`);
}

/**
 * Kiểm tra bản quyền của một người dùng
 */
export async function verifyUserLicense(email: string, isAdminUser: boolean = false): Promise<LicenseCheckResult> {
  const cleanEmail = (email || '').toLowerCase().trim();

  // 1. Quản trị viên (đã xác thực qua checkIsAdmin) được miễn kiểm tra bản quyền
  if (isAdminUser) {
    return {
      isValid: true,
      isExpired: false,
      isBlocked: false,
      allowedAccountsList: [], // Rỗng nghĩa là xem toàn bộ
      message: '👑 Quyền Quản trị viên tối cao'
    };
  }

  // 2. Chỉ đọc bản quyền của chính email này trực tiếp từ Supabase.
  // Không dùng cache localStorage vì người dùng có thể tự sửa cache để tự cấp bản quyền.
  let userLic: LicenseItem | undefined;
  let fetchFailed = false;
  try {
    const client = getSupabaseClient();
    if (!client) throw new Error('Chưa kết nối Supabase');
    const { data, error } = await client
      .from('licenses')
      .select('*')
      .eq('email', cleanEmail)
      .maybeSingle();
    if (error) throw error;
    if (data) {
      userLic = {
        id: data.id,
        email: (data.email || '').toLowerCase().trim(),
        allowed_accounts: data.allowed_accounts || '',
        status: (data.status || 'ACTIVE').toUpperCase() as any,
        expires_at: data.expires_at || null,
        customer_name: data.customer_name || '',
        notes: data.notes || '',
        created_at: data.created_at
      };
    }
  } catch (err) {
    console.warn('Không thể kiểm tra bản quyền trên Supabase:', err);
    fetchFailed = true;
  }

  if (!userLic) {
    if (fetchFailed) {
      return {
        isValid: false,
        isExpired: false,
        isBlocked: false,
        allowedAccountsList: [],
        message: 'Không kết nối được máy chủ bản quyền. Vui lòng thử lại.'
      };
    }
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
