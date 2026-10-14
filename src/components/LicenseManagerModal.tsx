import React, { useState, useEffect } from 'react';
import { X, Plus, Key, Shield, UserCheck, UserX, Clock, Trash2, Calendar, Check, AlertCircle, RefreshCw } from 'lucide-react';
import { LicenseItem } from '../types/license';
import { fetchLicenses, saveLicense, deleteLicense } from '../lib/licenseApi';
import { useLanguage } from '../context/LanguageContext';

interface LicenseManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const LicenseManagerModal: React.FC<LicenseManagerModalProps> = ({ isOpen, onClose }) => {
  const { language } = useLanguage();
  const [licenses, setLicenses] = useState<LicenseItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form thêm / sửa
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingEmail, setEditingEmail] = useState<string | null>(null);
  const [formEmail, setFormEmail] = useState('');
  const [formName, setFormName] = useState('');
  const [formAccounts, setFormAccounts] = useState('');
  const [formDuration, setFormDuration] = useState<'1m' | '3m' | '6m' | '1y' | 'lifetime'>('1m');
  const [formNotes, setFormNotes] = useState('');

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await fetchLicenses();
      setLicenses(data);
    } catch (e) {
      console.warn('Lỗi tải licenses:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
      setShowAddForm(false);
      setEditingEmail(null);
      setErrorMsg(null);
      setSuccessMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const calculateExpiresAt = (duration: string): string | null => {
    if (duration === 'lifetime') return null;
    const now = new Date();
    if (duration === '1m') now.setMonth(now.getMonth() + 1);
    else if (duration === '3m') now.setMonth(now.getMonth() + 3);
    else if (duration === '6m') now.setMonth(now.getMonth() + 6);
    else if (duration === '1y') now.setFullYear(now.getFullYear() + 1);
    return now.toISOString();
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    const cleanEmail = formEmail.trim().toLowerCase();
    if (!cleanEmail) {
      setErrorMsg('Vui lòng nhập Email Gmail của khách hàng.');
      return;
    }

    const cleanAccounts = formAccounts.trim();
    if (!cleanAccounts) {
      setErrorMsg('Vui lòng nhập ít nhất một số tài khoản MT5 được cấp phép.');
      return;
    }

    try {
      setLoading(true);
      const expiresAt = calculateExpiresAt(formDuration);

      await saveLicense({
        email: cleanEmail,
        customer_name: formName.trim() || undefined,
        allowed_accounts: cleanAccounts,
        status: 'ACTIVE',
        expires_at: expiresAt,
        notes: formNotes.trim() || undefined
      });

      setSuccessMsg(`Đã cấp bản quyền thành công cho khách hàng: ${cleanEmail}`);
      setShowAddForm(false);
      setEditingEmail(null);
      setFormEmail('');
      setFormName('');
      setFormAccounts('');
      setFormNotes('');
      await loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Lỗi lưu bản quyền.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleStatus = async (item: LicenseItem) => {
    const nextStatus = item.status === 'ACTIVE' ? 'BLOCKED' : 'ACTIVE';
    try {
      await saveLicense({
        ...item,
        status: nextStatus
      });
      await loadData();
    } catch (err) {
      console.warn('Lỗi đổi trạng thái license:', err);
    }
  };

  const handleExtend30Days = async (item: LicenseItem) => {
    try {
      const baseDate = item.expires_at ? new Date(item.expires_at) : new Date();
      if (baseDate.getTime() < Date.now()) {
        baseDate.setTime(Date.now());
      }
      baseDate.setDate(baseDate.getDate() + 30);

      await saveLicense({
        ...item,
        status: 'ACTIVE',
        expires_at: baseDate.toISOString()
      });
      setSuccessMsg(`Đã gia hạn thêm 30 ngày cho: ${item.email}`);
      await loadData();
    } catch (err) {
      console.warn('Lỗi gia hạn license:', err);
    }
  };

  const handleDelete = async (email: string) => {
    if (!window.confirm(`Thầy có chắc chắn muốn xóa bản quyền của khách: ${email}?`)) return;
    try {
      await deleteLicense(email);
      await loadData();
    } catch (err) {
      console.warn('Lỗi xóa license:', err);
    }
  };

  const handleStartEdit = (item: LicenseItem) => {
    setEditingEmail(item.email);
    setFormEmail(item.email);
    setFormName(item.customer_name || '');
    setFormAccounts(item.allowed_accounts || '');
    setFormNotes(item.notes || '');
    setShowAddForm(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in select-none">
      <div className="relative w-full max-w-4xl clay-card rounded-2xl shadow-2xl p-6 border border-[var(--border-main)] flex flex-col gap-4 max-h-[90vh] text-xs">
        
        {/* Header Modal */}
        <div className="flex items-center justify-between pb-3 border-b border-[var(--border-main)]">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500">
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] font-mono">
                👑 QUẢN LÝ BẢN QUYỀN THƯƠNG MẠI (ADMIN)
              </h2>
              <p className="text-[10px] text-[var(--text-muted)]">
                Khóa kép: Chỉ cấp phép truy cập Web và chạy EA trên đúng số tài khoản MT5 được duyệt
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Thông báo */}
        {errorMsg && (
          <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-500 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        {successMsg && (
          <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Thanh công cụ: Thêm mới + Tải lại */}
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => {
              setShowAddForm(!showAddForm);
              setEditingEmail(null);
              setFormEmail('');
              setFormName('');
              setFormAccounts('');
              setFormNotes('');
            }}
            className="px-3 py-1.5 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{showAddForm ? 'Đóng Form' : '+ Cấp Bản Quyền Cho Khách Mới'}</span>
          </button>

          <button
            type="button"
            onClick={loadData}
            disabled={loading}
            className="px-2.5 py-1.5 rounded-xl clay-btn-secondary text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer flex items-center gap-1.5"
            title="Tải lại danh sách"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Làm mới</span>
          </button>
        </div>

        {/* Form Thêm Mới / Chỉnh Sửa Bản Quyền */}
        {showAddForm && (
          <form onSubmit={handleSave} className="p-4 rounded-xl bg-[var(--bg-subtle)] border border-teal-500/30 flex flex-col gap-3 animate-fade-in">
            <div className="font-bold text-teal-600 dark:text-teal-400 flex items-center gap-1.5 text-xs">
              <Key className="w-3.5 h-3.5" />
              <span>{editingEmail ? `Chỉnh sửa bản quyền: ${editingEmail}` : 'Cấp bản quyền thương mại mới'}</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Gmail khách hàng *</label>
                <input
                  type="email"
                  value={formEmail}
                  onChange={(e) => setFormEmail(e.target.value)}
                  placeholder="khachhang@gmail.com"
                  required
                  disabled={!!editingEmail}
                  className="px-3 py-2 rounded-lg bg-[var(--bg-main)] border border-[var(--border-main)] text-[var(--text-primary)] font-mono text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Tên khách hàng</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="ví dụ: Anh Hùng Đà Lạt"
                  className="px-3 py-2 rounded-lg bg-[var(--bg-main)] border border-[var(--border-main)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-teal-500"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center justify-between">
                  <span>Số MT5 được phép *</span>
                  <span className="text-[10px] text-teal-500">Cách nhau bằng dấu phẩy</span>
                </label>
                <input
                  type="text"
                  value={formAccounts}
                  onChange={(e) => setFormAccounts(e.target.value)}
                  placeholder="ví dụ: 26889901, 26889902"
                  required
                  className="px-3 py-2 rounded-lg bg-[var(--bg-main)] border border-[var(--border-main)] text-[var(--text-primary)] font-mono text-xs focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Gói thời hạn</label>
                <select
                  value={formDuration}
                  onChange={(e) => setFormDuration(e.target.value as any)}
                  className="px-3 py-2 rounded-lg bg-[var(--bg-main)] border border-[var(--border-main)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-teal-500"
                >
                  <option value="1m">1 Tháng (30 ngày)</option>
                  <option value="3m">3 Tháng (90 ngày)</option>
                  <option value="6m">6 Tháng (180 ngày)</option>
                  <option value="1y">1 Năm (365 ngày)</option>
                  <option value="lifetime">Vĩnh Viễn (Lifetime)</option>
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-[11px] font-semibold text-[var(--text-secondary)]">Ghi chú (Gói cước / SĐT / Zalo)</label>
                <input
                  type="text"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Gói Pro Trader, thanh toán qua Momo"
                  className="px-3 py-2 rounded-lg bg-[var(--bg-main)] border border-[var(--border-main)] text-[var(--text-primary)] text-xs focus:outline-none focus:border-teal-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowAddForm(false)}
                className="px-3 py-1.5 rounded-lg clay-btn-secondary text-[var(--text-secondary)]"
              >
                Hủy
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-1.5 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold shadow-sm"
              >
                {editingEmail ? 'Lưu Thay Đổi' : 'Kích Hoạt Bản Quyền'}
              </button>
            </div>
          </form>
        )}

        {/* Danh sách bản quyền */}
        <div className="flex-1 overflow-y-auto border border-[var(--border-main)] rounded-xl bg-[var(--bg-card)]">
          {licenses.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-muted)] flex flex-col items-center gap-2">
              <Shield className="w-8 h-8 opacity-40" />
              <span>Chưa có khách hàng nào trong danh sách bản quyền.</span>
              <span className="text-[11px]">Bấm "+ Cấp Bản Quyền Cho Khách Mới" ở trên để thêm khách hàng đầu tiên.</span>
            </div>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[var(--border-main)] bg-[var(--bg-subtle)] text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-wider">
                  <th className="p-2.5 pl-3">Khách Hàng</th>
                  <th className="p-2.5">Số MT5 Được Phép</th>
                  <th className="p-2.5">Thời Hạn</th>
                  <th className="p-2.5">Trạng Thái</th>
                  <th className="p-2.5 pr-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-main)] text-xs">
                {licenses.map((lic) => {
                  const isExp = lic.expires_at ? new Date(lic.expires_at).getTime() < Date.now() : false;
                  return (
                    <tr key={lic.id || lic.email} className="hover:bg-[var(--bg-subtle)] transition-colors">
                      <td className="p-2.5 pl-3">
                        <div className="font-semibold text-[var(--text-primary)]">{lic.customer_name || 'Khách hàng'}</div>
                        <div className="text-[11px] font-mono text-teal-600 dark:text-teal-400">{lic.email}</div>
                        {lic.notes && <div className="text-[10px] text-[var(--text-muted)] italic">{lic.notes}</div>}
                      </td>

                      <td className="p-2.5">
                        <div className="flex flex-wrap gap-1">
                          {lic.allowed_accounts.split(',').map((acc, idx) => (
                            <span key={idx} className="px-1.5 py-0.5 rounded bg-[var(--bg-subtle)] border border-[var(--border-main)] font-mono text-[11px] font-bold text-[var(--text-primary)]">
                              #{acc.trim()}
                            </span>
                          ))}
                        </div>
                      </td>

                      <td className="p-2.5 font-mono text-[11px]">
                        {lic.expires_at ? (
                          <div className={isExp ? 'text-rose-500 font-bold' : 'text-[var(--text-primary)]'}>
                            {new Date(lic.expires_at).toLocaleDateString('vi-VN')}
                            <div className="text-[10px] text-[var(--text-muted)]">
                              {isExp ? 'Đã hết hạn' : `Còn ${Math.ceil((new Date(lic.expires_at).getTime() - Date.now()) / (1000 * 86400))} ngày`}
                            </div>
                          </div>
                        ) : (
                          <span className="text-emerald-500 font-bold">Vĩnh Viễn (Lifetime)</span>
                        )}
                      </td>

                      <td className="p-2.5">
                        {lic.status === 'BLOCKED' ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-500/10 text-rose-500 border border-rose-500/30">
                            Đã Khóa
                          </span>
                        ) : isExp ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30">
                            Hết Hạn
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/30">
                            Hoạt Động
                          </span>
                        )}
                      </td>

                      <td className="p-2.5 pr-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleToggleStatus(lic)}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${
                              lic.status === 'ACTIVE'
                                ? 'hover:bg-rose-500/10 text-[var(--text-muted)] hover:text-rose-500 border-transparent hover:border-rose-500/30'
                                : 'hover:bg-emerald-500/10 text-rose-500 hover:text-emerald-500 border-rose-500/30'
                            }`}
                            title={lic.status === 'ACTIVE' ? 'Khóa khách này' : 'Mở khóa khách này'}
                          >
                            {lic.status === 'ACTIVE' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleExtend30Days(lic)}
                            className="p-1.5 rounded-lg hover:bg-teal-500/10 text-[var(--text-muted)] hover:text-teal-500 border border-transparent hover:border-teal-500/30 transition-all cursor-pointer"
                            title="Gia hạn thêm 30 ngày (+30d)"
                          >
                            <Clock className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleStartEdit(lic)}
                            className="p-1.5 rounded-lg hover:bg-[var(--bg-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] border border-transparent hover:border-[var(--border-main)] transition-all cursor-pointer"
                            title="Sửa số tài khoản MT5"
                          >
                            <Key className="w-3.5 h-3.5" />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(lic.email)}
                            className="p-1.5 rounded-lg hover:bg-rose-500/10 text-[var(--text-muted)] hover:text-rose-500 border border-transparent hover:border-rose-500/30 transition-all cursor-pointer"
                            title="Xóa hẳn bản quyền"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-[var(--border-main)] flex items-center justify-between text-[11px] text-[var(--text-muted)]">
          <span>Tổng số khách hàng bản quyền: <strong className="text-[var(--text-primary)]">{licenses.length}</strong></span>
          <span className="font-mono text-teal-600 dark:text-teal-400">BIG-DEAL License Sentinel</span>
        </div>

      </div>
    </div>
  );
};
