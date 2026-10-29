-- =====================================================================
-- BIG-DEAL: THÔNG BÁO TELEGRAM / EMAIL
-- Chạy SAU khi đã triển khai Edge Function "notify".
-- =====================================================================

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Mã bí mật nội bộ (sinh ngẫu nhiên trong cơ sở dữ liệu, không ai phải gõ tay):
-- dùng để hẹn giờ / kích hoạt và Telegram chứng minh với máy chủ thông báo
create table if not exists public.app_secrets (
  name  text primary key,
  value text not null
);
alter table public.app_secrets enable row level security; -- không có luật nào: chỉ máy chủ đọc được
insert into public.app_secrets (name, value)
values ('notify', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
on conflict (name) do nothing;

-- Cài đặt nhận thông báo của từng người
create table if not exists public.notify_settings (
  user_id          uuid primary key references auth.users(id) on delete cascade,
  email            text,
  telegram_chat_id text,
  link_code        text unique,
  weekly           boolean not null default true,
  monthly          boolean not null default true,
  quarterly        boolean not null default true,
  alerts           boolean not null default true,
  updated_at       timestamptz not null default now()
);
alter table public.notify_settings enable row level security;
drop policy if exists notify_settings_own on public.notify_settings;
create policy notify_settings_own on public.notify_settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Nhật ký đã gửi (chống gửi trùng)
create table if not exists public.notify_log (
  user_id uuid not null references auth.users(id) on delete cascade,
  key     text not null,
  sent_at timestamptz not null default now(),
  primary key (user_id, key)
);
alter table public.notify_log enable row level security;

-- Gọi máy chủ thông báo từ bên trong cơ sở dữ liệu
create or replace function public.call_notify(payload jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform net.http_post(
    url     := 'https://fvwcanltqxeorfgemxel.supabase.co/functions/v1/notify',
    body    := payload,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-bd-secret', (select value from public.app_secrets where name = 'notify')
    )
  );
end;
$$;
revoke all on function public.call_notify(jsonb) from public, anon, authenticated;

-- Lịch báo cáo (giờ UTC; 01:00 UTC = 08:00 sáng giờ Việt Nam)
select cron.unschedule(jobname) from cron.job where jobname in ('bd_report_week', 'bd_report_month', 'bd_report_quarter');
select cron.schedule('bd_report_week',    '0 1 * * 1',           $$select public.call_notify('{"action":"report","kind":"WEEK"}')$$);
select cron.schedule('bd_report_month',   '0 1 1 * *',           $$select public.call_notify('{"action":"report","kind":"MONTH"}')$$);
select cron.schedule('bd_report_quarter', '0 1 1 1,4,7,10 *',    $$select public.call_notify('{"action":"report","kind":"QUARTER"}')$$);

-- Cảnh báo tức thì: khi EA ghi lệnh mới vào (OPEN) hoặc lệnh đóng (CLOSED)
create or replace function public.trades_notify_trigger()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status in ('OPEN', 'CLOSED') and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    perform public.call_notify(jsonb_build_object(
      'action', 'trade_event',
      'record', to_jsonb(new) - 'candles' - 'image_url_1' - 'pre_image_url' - 'post_image_url'
    ));
  end if;
  return new;
end;
$$;

drop trigger if exists trades_notify on public.trades;
create trigger trades_notify
  after insert or update of status on public.trades
  for each row execute function public.trades_notify_trigger();
