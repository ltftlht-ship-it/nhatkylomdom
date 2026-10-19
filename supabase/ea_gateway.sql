-- =====================================================================
-- BIG-DEAL: BƯỚC 2 - CỔNG RIÊNG CHO EA MT5 (có mật mã EA)
-- Chạy sau security.sql. An toàn: EA V3 cũ vẫn chạy bình thường.
-- EA V4 gửi lệnh qua 2 hàm dưới đây thay vì ghi thẳng vào bảng trades,
-- nhờ đó BƯỚC 3 (lock_tables.sql) khóa được bảng mà EA không bị chặn.
-- =====================================================================

-- Mật mã EA: mỗi dòng cho phép 1 mật mã ghi lệnh vào đúng 1 số tài khoản MT5
create table if not exists public.ea_keys (
  secret     text not null,
  account_id text not null,
  label      text default '',
  created_at timestamptz not null default now(),
  primary key (secret, account_id)
);

alter table public.ea_keys enable row level security;

drop policy if exists ea_keys_admin_all on public.ea_keys;
create policy ea_keys_admin_all on public.ea_keys
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Ghi/cập nhật 1 lệnh từ EA (giống upsert theo account_id + ticket).
-- Chỉ cập nhật các cột EA gửi lên; cột nào bảng chưa có thì bỏ qua (vd candles).
create or replace function public.ea_upsert_trade(p_secret text, p_row jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cols text;
  v_updates text;
begin
  if not exists (
    select 1 from public.ea_keys
     where secret = p_secret and account_id = p_row ->> 'account_id'
  ) then
    raise exception 'EA key khong hop le cho tai khoan %', p_row ->> 'account_id';
  end if;

  select string_agg(quote_ident(k), ', '),
         string_agg(format('%1$I = excluded.%1$I', k), ', ')
                    filter (where k not in ('account_id', 'ticket'))
    into v_cols, v_updates
    from jsonb_object_keys(p_row) as k
   where k <> 'id'
     and k in (select column_name from information_schema.columns
                where table_schema = 'public' and table_name = 'trades');

  execute format(
    'insert into public.trades (%1$s) select %1$s from jsonb_populate_record(null::public.trades, $1) '
    'on conflict (account_id, ticket) do %2$s',
    v_cols,
    case when v_updates is null then 'nothing' else 'update set ' || v_updates end
  ) using p_row;
end;
$$;

-- Đổi trạng thái lệnh (OPEN / CANCELED / CLOSED) từ EA, chỉ trong đúng tài khoản của mật mã
create or replace function public.ea_update_status(p_secret text, p_account_id text, p_ticket text, p_status text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.ea_keys where secret = p_secret and account_id = p_account_id
  ) then
    raise exception 'EA key khong hop le cho tai khoan %', p_account_id;
  end if;

  update public.trades
     set status = p_status
   where account_id::text = p_account_id
     and ticket::text = p_ticket;
end;
$$;

revoke all on function public.ea_upsert_trade(text, jsonb) from public;
revoke all on function public.ea_update_status(text, text, text, text) from public;
grant execute on function public.ea_upsert_trade(text, jsonb) to anon, authenticated;
grant execute on function public.ea_update_status(text, text, text, text) to anon, authenticated;
