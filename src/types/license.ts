export interface LicenseItem {
  id: string;
  email: string;
  allowed_accounts: string; // Các số tài khoản MT5 cách nhau bởi dấu phẩy, ví dụ "26889901, 26889902"
  status: 'ACTIVE' | 'BLOCKED' | 'EXPIRED';
  expires_at: string | null; // null = Vĩnh viễn (Lifetime), ISO string = Ngày hết hạn
  customer_name?: string;
  notes?: string;
  created_at?: string;
}

export interface LicenseCheckResult {
  isValid: boolean;
  isExpired: boolean;
  isBlocked: boolean;
  license?: LicenseItem;
  allowedAccountsList: string[];
  message: string;
}
