// =====================================================================
// BIG-DEAL · MÁY CHỦ THÔNG BÁO (Supabase Edge Function "notify")
// - Báo cáo tuần / tháng / quý (Supabase tự gọi theo lịch, xem supabase/notify.sql)
// - Cảnh báo tức thì khi EA gửi lệnh mới vào / lệnh vừa đóng
// - Kết nối Telegram bằng mã 1 lần (nút trong app)
// Công thức dùng CHUNG với Tab Báo Cáo (src/utils/*), không viết lại công thức khác.
// Bí mật cần đặt trong Supabase > Edge Functions > Secrets: TELEGRAM_BOT_TOKEN, RESEND_API_KEY (tùy chọn), EMAIL_FROM (tùy chọn)
// =====================================================================
import { createClient } from 'npm:@supabase/supabase-js@2';
import { processSupabaseTrades } from '../../../src/utils/tradeCalculations.ts';
import { buildPositions } from '../../../src/utils/reportPositions.ts';
import { buildPeriodReport, buildAlerts } from '../../../src/utils/reportMessage.ts';
import { DEFAULT_PSY_SETTINGS, EMPTY_PROP_RULES } from '../../../src/utils/psychologyScore.ts';

const env = (k: string) => Deno.env.get(k) || '';
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const ADMIN_EMAILS = ['ltf.tlht@gmail.com']; // khớp src/lib/supabase.ts và hàm is_admin()

const LIGHT = 'account_id,ticket,position_id,symbol,type,volume,open_price,close_price,pnl,commission,swap,initial_balance,status,open_time,close_time,initial_sl,plan_id,timeframe,setup,checklist,mistake_tags,mae_price,mfe_price';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': '*' } });

async function sharedSecret(): Promise<string> {
  const { data } = await db.from('app_secrets').select('value').eq('name', 'notify').maybeSingle();
  return (data as any)?.value || '';
}

// ----------------------------- GỬI TIN -----------------------------

async function sendTelegram(chatId: string, html: string) {
  const token = env('TELEGRAM_BOT_TOKEN');
  if (!token || !chatId) return false;
  const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  return r.ok;
}

async function sendEmail(to: string, subject: string, html: string) {
  const key = env('RESEND_API_KEY');
  if (!key || !to) return false;
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({ from: env('EMAIL_FROM') || 'BIG-DEAL <onboarding@resend.dev>', to, subject, html: html.replace(/\n/g, '<br>') }),
  });
  return r.ok;
}

async function deliver(n: any, subject: string, html: string, viaEmail: boolean) {
  const tg = n.telegram_chat_id ? await sendTelegram(n.telegram_chat_id, html) : false;
  const em = viaEmail && n.email ? await sendEmail(n.email, subject, html) : false;
  return tg || em;
}

// ----------------------------- DỮ LIỆU -----------------------------

async function userContext(userId: string) {
  const [{ data: s }, { data: u }] = await Promise.all([
    db.from('user_settings').select('data').eq('user_id', userId).maybeSingle(),
    db.auth.admin.getUserById(userId),
  ]);
  const data: Record<string, string> = (s as any)?.data || {};
  const parse = (k: string, d: any) => { try { return data[k] ? JSON.parse(data[k]) : d; } catch { return d; } };
  const email = (u?.user?.email || '').toLowerCase();
  return {
    email,
    isAdmin: ADMIN_EMAILS.includes(email),
    offset: Number(data['trade_journal_timezone_offset'] ?? 4) || 0,
    psy: { ...DEFAULT_PSY_SETTINGS, ...parse('bd_psychology_settings', {}) },
    prop: (acc: string) => ({ ...EMPTY_PROP_RULES, ...parse(`bd_prop_rules_${acc}`, {}) }),
    accountsList: parse('deal_accounts_list', []) as any[],
  };
}

async function accountsOf(ctx: Awaited<ReturnType<typeof userContext>>): Promise<string[]> {
  if (ctx.isAdmin) {
    const { data } = await db.from('trades').select('account_id');
    return Array.from(new Set((data || []).map((r: any) => String(r.account_id)).filter(Boolean)));
  }
  const { data } = await db.from('licenses').select('allowed_accounts,status,expires_at').eq('email', ctx.email).maybeSingle();
  const l: any = data;
  if (!l || l.status !== 'ACTIVE' || (l.expires_at && new Date(l.expires_at) < new Date())) return [];
  return String(l.allowed_accounts || '').split(',').map(s => s.trim().replace(/^acc-/, '')).filter(Boolean);
}

async function positionsOf(acc: string, ctx: Awaited<ReturnType<typeof userContext>>) {
  const { data } = await db.from('trades').select(LIGHT).eq('account_id', acc).eq('status', 'CLOSED');
  const rows = (data || []) as any[];
  const listed = ctx.accountsList.find((a: any) => String(a.id).replace(/^acc-/, '') === acc);
  const init = Number(rows.find(r => Number(r.initial_balance) > 0)?.initial_balance) || Number(listed?.initial_balance) || 0;
  const mapped = rows.map(r => ({ ...r, pre_checklist_ids: r.checklist, post_checklist_ids: r.mistake_tags }));
  const trades = processSupabaseTrades(mapped, init, 100, undefined as any, ctx.offset);
  return { positions: buildPositions(trades, ctx.offset, false), init, label: listed?.name ? `${listed.name} (#${acc})` : `MT5 #${acc}` };
}

/** "Bây giờ" theo giờ hiển thị của app (giờ sàn + bù giờ = giờ Việt Nam GMT+7) */
const nowDisplay = () => new Date(Date.now() + 7 * 3600 * 1000 + new Date().getTimezoneOffset() * 60000);

// ----------------------------- XỬ LÝ -----------------------------

async function runPeriodReports(kind: 'WEEK' | 'MONTH' | 'QUARTER') {
  const col = { WEEK: 'weekly', MONTH: 'monthly', QUARTER: 'quarterly' }[kind];
  const { data: subs } = await db.from('notify_settings').select('*').eq(col, true);
  let sent = 0;
  for (const n of subs || []) {
    const ctx = await userContext(n.user_id);
    for (const acc of await accountsOf(ctx)) {
      const { positions, init, label } = await positionsOf(acc, ctx);
      const now = nowDisplay();
      const { count: plansCount } = await db.from('plans').select('id', { count: 'exact', head: true }).eq('account_id', acc);
      const msg = buildPeriodReport({ accountLabel: label, all: positions, kind, now, psy: ctx.psy, prop: ctx.prop(acc), initialBalance: init, plansCount: plansCount || 0 });
      if (!msg) continue;
      const key = `${kind}|${acc}|${now.toISOString().slice(0, 10)}`;
      const { error: dup } = await db.from('notify_log').insert({ user_id: n.user_id, key });
      if (dup) continue; // đã gửi rồi
      if (await deliver(n, `BIG-DEAL · Báo cáo ${col}`, msg, true)) sent++;
    }
  }
  return sent;
}

async function runTradeEvent(rec: any) {
  const status = String(rec?.status || '').toUpperCase();
  const event = status === 'OPEN' ? 'OPEN' : status === 'CLOSED' ? 'CLOSED' : null;
  if (!event) return 0;
  const acc = String(rec.account_id || '');
  const { data: subs } = await db.from('notify_settings').select('*').eq('alerts', true);
  // Cắt từng phần = 1 lệnh: cảnh báo đóng lệnh tính theo vị thế, không theo từng lần cắt
  const eventKey = event === 'CLOSED' ? String(rec.position_id || rec.ticket) : String(rec.ticket);
  let sent = 0;
  for (const n of subs || []) {
    const ctx = await userContext(n.user_id);
    if (!(await accountsOf(ctx)).includes(acc)) continue;
    // Bỏ qua lệnh cũ (EA đồng bộ lại lịch sử khi khởi động): chỉ cảnh báo lệnh trong 3 giờ gần nhất
    const evIso = String((event === 'CLOSED' ? rec.close_time : rec.open_time) || '').trim().replace(/[./]/g, '-').replace(' ', 'T') + 'Z';
    const evAt = new Date(new Date(evIso).getTime() + ctx.offset * 3600 * 1000);
    const nowVn = new Date(Date.now() + 7 * 3600 * 1000);
    if (isNaN(evAt.getTime()) || Math.abs(nowVn.getTime() - evAt.getTime()) > 3 * 3600 * 1000) continue;
    const { error: dup } = await db.from('notify_log').insert({ user_id: n.user_id, key: `alert|${acc}|${eventKey}|${event}` });
    if (dup) continue;
    const { positions, init, label } = await positionsOf(acc, ctx);
    const alerts = buildAlerts({ accountLabel: label, all: positions, event, trade: rec, offsetHours: ctx.offset, psy: ctx.psy, prop: ctx.prop(acc), initialBalance: init });
    if (alerts.length && await deliver(n, 'BIG-DEAL · Cảnh báo', alerts.join('\n'), false)) sent++;
  }
  return sent;
}

async function telegramUpdate(update: any) {
  const msg = update?.message;
  const text = String(msg?.text || '');
  const chatId = String(msg?.chat?.id || '');
  const m = text.match(/^\/start\s+([A-Za-z0-9_-]{16,})/);
  if (!m || !chatId) {
    if (chatId) await sendTelegram(chatId, 'Mở app BIG-DEAL, vào Cài đặt và bấm <b>Kết nối Telegram</b> để nhận báo cáo.');
    return;
  }
  const { data: row } = await db.from('notify_settings').select('user_id').eq('link_code', m[1]).maybeSingle();
  if (!row) { await sendTelegram(chatId, 'Mã kết nối không hợp lệ hoặc đã dùng. Bấm lại nút Kết nối Telegram trong app.'); return; }
  await db.from('notify_settings').update({ telegram_chat_id: chatId, link_code: null }).eq('user_id', (row as any).user_id);
  await sendTelegram(chatId, 'Đã kết nối BIG-DEAL. Thầy sẽ nhận báo cáo tuần / tháng / quý và cảnh báo tâm lý tại đây.');
}

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return json({ ok: true });
  const secret = await sharedSecret();

  // Telegram gọi về (webhook có mã bí mật)
  if (req.headers.get('x-telegram-bot-api-secret-token')) {
    if (req.headers.get('x-telegram-bot-api-secret-token') !== secret) return json({ error: 'forbidden' }, 403);
    await telegramUpdate(await req.json());
    return json({ ok: true });
  }

  const body = await req.json().catch(() => ({}));

  // Lịch hẹn giờ / kích hoạt khi có lệnh (gọi từ bên trong cơ sở dữ liệu, có mã bí mật)
  if (req.headers.get('x-bd-secret')) {
    if (!secret || req.headers.get('x-bd-secret') !== secret) return json({ error: 'forbidden' }, 403);
    if (body.action === 'report') return json({ sent: await runPeriodReports(body.kind) });
    if (body.action === 'trade_event') return json({ sent: await runTradeEvent(body.record) });
    return json({ error: 'unknown action' }, 400);
  }

  // Gọi từ app: phải đăng nhập
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: auth } = await db.auth.getUser(jwt);
  const user = auth?.user;
  if (!user) return json({ error: 'unauthorized' }, 401);
  await db.from('notify_settings').upsert({ user_id: user.id, email: user.email }, { onConflict: 'user_id', ignoreDuplicates: true });

  if (body.action === 'link_telegram') {
    const token = env('TELEGRAM_BOT_TOKEN');
    if (!token) return json({ error: 'Chưa đặt TELEGRAM_BOT_TOKEN trên Supabase' }, 400);
    const self = `${env('SUPABASE_URL')}/functions/v1/notify`;
    await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: self, secret_token: secret, allowed_updates: ['message'] }),
    });
    const me = await (await fetch(`https://api.telegram.org/bot${token}/getMe`)).json();
    const code = crypto.randomUUID().replace(/-/g, '');
    await db.from('notify_settings').update({ link_code: code }).eq('user_id', user.id);
    return json({ url: `https://t.me/${me?.result?.username}?start=${code}` });
  }

  if (body.action === 'test') {
    const { data: n } = await db.from('notify_settings').select('*').eq('user_id', user.id).single();
    const ok = await deliver(n, 'BIG-DEAL · Thử thông báo', '<b>BIG-DEAL</b>\nThông báo thử: kết nối hoạt động.', true);
    return json({ ok });
  }

  return json({ error: 'unknown action' }, 400);
});
