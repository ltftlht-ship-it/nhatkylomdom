import React, { useEffect, useState } from 'react';
import { getSupabaseClient } from '../lib/supabase';

/**
 * Cài đặt thông báo: kết nối Telegram, email, bật/tắt báo cáo tuần / tháng / quý và cảnh báo tức thì.
 * Dữ liệu ở bảng notify_settings (mỗi người chỉ thấy dòng của mình); gửi tin do Edge Function "notify" làm.
 */
interface NotifyRow {
  email: string | null;
  telegram_chat_id: string | null;
  weekly: boolean;
  monthly: boolean;
  quarterly: boolean;
  alerts: boolean;
}

const TOGGLES: [keyof NotifyRow, string][] = [
  ['alerts', 'Cảnh báo tức thì'], ['weekly', 'Báo cáo tuần'], ['monthly', 'Báo cáo tháng'], ['quarterly', 'Báo cáo quý'],
];

export const NotifySettingsCard: React.FC = () => {
  const [row, setRow] = useState<NotifyRow | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string>('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    const client = getSupabaseClient();
    if (!client) return;
    const { data: { session } } = await client.auth.getSession();
    const uid = session?.user?.id || null;
    setUserId(uid);
    if (!uid) return;
    let { data } = await client.from('notify_settings').select('email,telegram_chat_id,weekly,monthly,quarterly,alerts').eq('user_id', uid).maybeSingle();
    if (!data) {
      await client.from('notify_settings').insert({ user_id: uid, email: session?.user?.email || null });
      ({ data } = await client.from('notify_settings').select('email,telegram_chat_id,weekly,monthly,quarterly,alerts').eq('user_id', uid).maybeSingle());
    }
    setRow(data as NotifyRow);
  };

  useEffect(() => { load(); }, []);

  const update = async (patch: Partial<NotifyRow>) => {
    if (!row || !userId) return;
    setRow({ ...row, ...patch });
    const { error } = await getSupabaseClient()!.from('notify_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('user_id', userId);
    if (error) setMsg(`Không lưu được: ${error.message}`);
  };

  const callFn = async (action: string) => {
    setBusy(true);
    setMsg('');
    try {
      const { data, error } = await getSupabaseClient()!.functions.invoke('notify', { body: { action } });
      if (error) throw error;
      return data;
    } catch (e: any) {
      setMsg(e?.context?.error || e?.message || 'Máy chủ thông báo chưa sẵn sàng');
      return null;
    } finally {
      setBusy(false);
    }
  };

  const linkTelegram = async () => {
    const data = await callFn('link_telegram');
    if (data?.url) {
      window.open(data.url, '_blank');
      setMsg('Bấm Start trong Telegram, rồi quay lại bấm Tải lại');
    } else if (data?.error) setMsg(data.error);
  };

  const test = async () => {
    const data = await callFn('test');
    if (data) setMsg(data.ok ? 'Đã gửi tin thử' : 'Chưa gửi được: chưa kết nối Telegram / email');
  };

  if (!userId) return null;

  const btn = 'px-3 py-1.5 rounded-full text-xs font-bold border border-[#d8d0c5] bg-white hover:text-[#2e6b4a] cursor-pointer disabled:opacity-50';
  return (
    <div className="p-5 rounded-3xl bg-[#fff8f0] border border-[#d8d0c5] space-y-4 text-[#1d1b17]">
      <h3 className="text-[15px] font-extrabold">Thông báo</h3>

      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <span className="font-semibold w-20">Telegram</span>
        <span className={`font-bold ${row?.telegram_chat_id ? 'text-[#2e6b4a]' : 'text-[#5a605a]'}`}>
          {row?.telegram_chat_id ? 'Đã kết nối' : 'Chưa kết nối'}
        </span>
        <button type="button" className={btn} disabled={busy} onClick={linkTelegram}>
          {row?.telegram_chat_id ? 'Kết nối lại' : 'Kết nối Telegram'}
        </button>
        <button type="button" className={btn} onClick={load}>Tải lại</button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <span className="font-semibold w-20">Email</span>
        <input type="email" value={row?.email || ''} onChange={e => setRow(r => (r ? { ...r, email: e.target.value } : r))}
          onBlur={e => update({ email: e.target.value.trim() || null })}
          className="px-3 py-1.5 rounded-lg border border-[#d8d0c5] bg-white text-[13px] w-64 focus:outline-none focus:border-[#2e6b4a]" />
      </div>

      <div className="flex flex-wrap gap-2">
        {TOGGLES.map(([k, label]) => (
          <label key={k} className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-[#d8d0c5] bg-white text-[13px] font-semibold cursor-pointer">
            <input type="checkbox" checked={Boolean(row?.[k])} onChange={e => update({ [k]: e.target.checked } as any)} className="accent-[#2e6b4a]" />
            {label}
          </label>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <button type="button" className={btn} disabled={busy} onClick={test}>Gửi thử</button>
        {msg && <span className="text-[13px] font-semibold text-[#5a605a]">{msg}</span>}
      </div>
    </div>
  );
};
