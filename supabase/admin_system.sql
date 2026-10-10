-- ============================================================
-- لوحة الإدارة: أنت (والأدمنية اللي تضيفهم) تقبلون الطلبات من الموقع نفسه.
-- شغّله مرة وحدة بعد people_system.sql و roles_system.sql.
-- ============================================================

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade
);
alter table public.admins enable row level security;   -- بدون policies = ما أحد يقرأه من الموقع

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- الأدمن يقرأ كل الطلبات ويغيّر حالتها فقط (status + admin_note) — الباقي مقفول
drop policy if exists "admin read all requests"  on public.join_requests;
drop policy if exists "admin update requests"    on public.join_requests;
create policy "admin read all requests" on public.join_requests for select to authenticated using (public.is_admin());
create policy "admin update requests"   on public.join_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke update on public.join_requests from anon, authenticated;
grant  update (status, admin_note) on public.join_requests to authenticated;

drop policy if exists "admin read all claims"  on public.role_claims;
drop policy if exists "admin update claims"    on public.role_claims;
create policy "admin read all claims" on public.role_claims for select to authenticated using (public.is_admin());
create policy "admin update claims"   on public.role_claims for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke update on public.role_claims from anon, authenticated;
grant  update (status, admin_note) on public.role_claims to authenticated;

-- ============================================================
-- خطوة أخيرة: سجّل دخولك في الموقع مرة (بإيميلك أو Google)، ثم شغّل هذا السطر
-- بعد ما تبدّل الإيميل بإيميلك الحقيقي، عشان تصير أدمن:
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'ايميلك@gmail.com';
-- ============================================================
