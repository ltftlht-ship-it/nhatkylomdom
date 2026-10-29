-- =====================================================================
-- BIG-DEAL: KHO ẢNH NHẬT KÝ RIÊNG TƯ + CỘT CÒN THIẾU
-- Ảnh plan / ảnh trước lệnh / ảnh sau lệnh lưu ở bucket 'journal' (không công khai).
-- Mỗi người chỉ đọc / ghi ảnh trong thư mục mang id của chính mình.
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('journal', 'journal', false)
on conflict (id) do update set public = false;

drop policy if exists journal_own_select on storage.objects;
create policy journal_own_select on storage.objects
  for select to authenticated
  using (bucket_id = 'journal' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists journal_own_insert on storage.objects;
create policy journal_own_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'journal' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists journal_own_update on storage.objects;
create policy journal_own_update on storage.objects
  for update to authenticated
  using (bucket_id = 'journal' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists journal_own_delete on storage.objects;
create policy journal_own_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'journal' and (storage.foldername(name))[1] = auth.uid()::text);

-- Bảng plans thiếu cột lỗi tâm lý dự kiến -> app lưu plan bị Supabase từ chối
alter table public.plans add column if not exists post_checklist jsonb not null default '[]'::jsonb;

-- Ảnh Thầy tự thêm cho lệnh, tách riêng khỏi ảnh chụp tự động của EA (image_url_1)
alter table public.trades add column if not exists pre_image_url text;   -- ảnh phân tích trước lệnh / ảnh plan
alter table public.trades add column if not exists post_image_url text;  -- ảnh tổng kết sau lệnh
