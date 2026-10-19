-- =====================================================================
-- BIG-DEAL: BƯỚC 1 - BẢNG BẢN QUYỀN (licenses) + KHÓA BẢO MẬT RLS
-- Chạy 1 lần trong Supabase Dashboard -> SQL Editor -> New query -> Run.
-- An toàn: chỉ tạo mới, không đụng tới bảng trades / plans / EA MT5.
-- =====================================================================

-- Admin = đúng email này (phải khớp ADMIN_EMAILS trong src/lib/supabase.ts)
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select lower(coalesce(auth.jwt() ->> 'email', '')) in ('ltf.tlht@gmail.com');
$$;

create table if not exists public.licenses (
  id               uuid primary key default gen_random_uuid(),
  email            text not null unique,
  allowed_accounts text not null default '',
  status           text not null default 'ACTIVE' check (status in ('ACTIVE', 'BLOCKED')),
  expires_at       timestamptz,
  customer_name    text default '',
  notes            text default '',
  created_at       timestamptz not null default now()
);

alter table public.licenses enable row level security;

-- Admin: toàn quyền xem / cấp / sửa / xóa bản quyền
drop policy if exists licenses_admin_all on public.licenses;
create policy licenses_admin_all on public.licenses
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Khách: chỉ được XEM đúng bản quyền của email mình, không được sửa
drop policy if exists licenses_owner_read on public.licenses;
create policy licenses_owner_read on public.licenses
  for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- Danh sách số tài khoản MT5 mà người đang đăng nhập được phép xem
-- (dùng cho BƯỚC 2 khi khóa bảng trades / plans)
create or replace function public.licensed_accounts()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select array_agg(trim(regexp_replace(a, '^acc-', '')))
       from public.licenses l,
            unnest(string_to_array(l.allowed_accounts, ',')) as a
      where lower(l.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
        and l.status = 'ACTIVE'
        and (l.expires_at is null or l.expires_at > now())
        and trim(a) <> ''),
    '{}'::text[]);
$$;

-- =====================================================================
-- BƯỚC 2 (CHƯA LÀM): khóa bảng trades và plans.
-- Hiện 2 bảng này ai có link app cũng đọc được không cần đăng nhập.
-- Phải xem EA MT5 ghi dữ liệu lên Supabase thế nào trước khi khóa,
-- nếu không EA sẽ bị chặn và ngừng đồng bộ lệnh.
-- =====================================================================
