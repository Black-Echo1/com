-- ============================================================
-- AR anime: إدارة مكتبة الأنمي والحلقات من لوحة الأدمن العام.
-- شغّله مرة واحدة بعد schema.sql و admin_system.sql.
-- هذا الملف يغيّر المخطط والصلاحيات فقط؛ لا يحذف أو يعدّل بيانات موجودة.
-- ============================================================

-- وصف الحلقة غير موجود في المخطط الأساسي، لذا نضيفه لتخزين وعرض الوصف.
alter table public.episodes
  add column if not exists description text;

do $$ begin
  alter table public.episodes
    add constraint episodes_description_len
    check (description is null or char_length(description) <= 1200) not valid;
exception when duplicate_object then null;
end $$;

-- لا نمنح أي كتابة للزوار. المستخدمون المسجلون يمرّون أيضاً عبر سياسات الأدمن أدناه.
revoke insert, update, delete on public.anime from anon, authenticated;
revoke insert, update, delete on public.episodes from anon, authenticated;
grant insert, update, delete on public.anime to authenticated;
grant insert, update, delete on public.episodes to authenticated;

-- إذا كان id في episodes عمود هوية، اسمح باستخدام تسلسله للمستخدمين المسجلين؛
-- وسياسات RLS أدناه تظل الحاجز الذي يقصر الإدخال على الأدمن العام.
do $$
declare seq_name text;
begin
  seq_name := pg_get_serial_sequence('public.episodes', 'id');
  if seq_name is not null then
    execute format('grant usage, select on sequence %s to authenticated', seq_name);
  end if;
end $$;

alter table public.anime enable row level security;
alter table public.episodes enable row level security;

drop policy if exists "admin insert anime content" on public.anime;
drop policy if exists "admin update anime content" on public.anime;
drop policy if exists "admin delete anime content" on public.anime;
create policy "admin insert anime content" on public.anime
  for insert to authenticated with check (public.is_admin());
create policy "admin update anime content" on public.anime
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete anime content" on public.anime
  for delete to authenticated using (public.is_admin());

drop policy if exists "admin insert episode content" on public.episodes;
drop policy if exists "admin update episode content" on public.episodes;
drop policy if exists "admin delete episode content" on public.episodes;
create policy "admin insert episode content" on public.episodes
  for insert to authenticated with check (public.is_admin());
create policy "admin update episode content" on public.episodes
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete episode content" on public.episodes
  for delete to authenticated using (public.is_admin());

-- سياسات القراءة العامة الموجودة في schema.sql لا تتغير.
-- حذف الأنمي نهائياً يتبع قيود ON DELETE CASCADE الموجودة للحلقات والارتباطات.
