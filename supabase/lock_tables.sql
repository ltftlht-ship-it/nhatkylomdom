-- =====================================================================
-- BIG-DEAL: BƯỚC 3 - KHÓA BẢNG trades VÀ plans
-- CHỈ CHẠY SAU KHI cả 2 terminal MT5 đã chạy EA V4 và lệnh mới vẫn lên web.
-- Sau bước này: người lạ không đọc/sửa được lệnh; Admin thấy tất cả;
-- khách chỉ thấy đúng số tài khoản MT5 ghi trong bản quyền của họ.
-- EA V3 cũ sẽ KHÔNG ghi được nữa.
-- =====================================================================

alter table public.trades enable row level security;

drop policy if exists trades_admin_all on public.trades;
create policy trades_admin_all on public.trades
  for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- Khách có bản quyền: xem và ghi nhật ký (setup, ghi chú, checklist...) cho tài khoản được cấp
drop policy if exists trades_licensed_read on public.trades;
create policy trades_licensed_read on public.trades
  for select to authenticated
  using (account_id::text = any(public.licensed_accounts()));

drop policy if exists trades_licensed_update on public.trades;
create policy trades_licensed_update on public.trades
  for update to authenticated
  using (account_id::text = any(public.licensed_accounts()))
  with check (account_id::text = any(public.licensed_accounts()));

alter table public.plans enable row level security;

drop policy if exists plans_access on public.plans;
create policy plans_access on public.plans
  for all to authenticated
  using (public.is_admin() or account_id::text = any(public.licensed_accounts()))
  with check (public.is_admin() or account_id::text = any(public.licensed_accounts()));

-- Nếu cần quay lại như cũ (mở bảng) thì chạy 2 dòng sau:
-- alter table public.trades disable row level security;
-- alter table public.plans disable row level security;
