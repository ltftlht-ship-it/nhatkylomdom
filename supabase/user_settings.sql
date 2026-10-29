-- =====================================================================
-- BIG-DEAL: CẤU HÌNH NGƯỜI DÙNG (checklist, setup, ngưỡng tâm lý, luật quỹ, bù giờ...)
-- Mỗi người 1 dòng, chỉ đọc / ghi được dòng của chính mình.
-- =====================================================================

create table if not exists public.user_settings (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists user_settings_own on public.user_settings;
create policy user_settings_own on public.user_settings
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
