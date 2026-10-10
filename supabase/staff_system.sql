-- ============================================================
-- صلاحيات متقدمة: أدمن بصلاحية كاملة + "قائد فريق" بصلاحيات على فريقه فقط.
-- شغّله مرة وحدة بعد admin_system.sql. آمن لو أعدت تشغيله.
-- ============================================================

-- قادة الفرق (تعيّنهم أنت من لوحة الإدارة)
create table if not exists public.team_leaders (
  team_id text not null references public.teams(id) on update cascade on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  primary key (team_id, user_id)
);
alter table public.team_leaders enable row level security;
drop policy if exists "read leaders" on public.team_leaders;
create policy "read leaders" on public.team_leaders for select to authenticated
  using (public.is_admin() or user_id = auth.uid());     -- بدون insert/update/delete: التعيين عبر الدوال فقط

-- دوال مساعدة
create or replace function public.is_team_leader(tid text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_leaders where team_id = tid and user_id = auth.uid());
$$;
create or replace function public.leads_dubber(did text) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.team_members tm join public.team_leaders tl on tl.team_id = tm.team_id
                 where tm.dubber_id = did and tl.user_id = auth.uid());
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (select 1 from public.team_leaders where user_id = auth.uid());
$$;
revoke all on function public.is_team_leader(text), public.leads_dubber(text), public.is_staff() from public, anon;
grant execute on function public.is_team_leader(text), public.leads_dubber(text), public.is_staff() to authenticated;

-- تعيين/إزالة/عرض القادة (للأدمن فقط)
create or replace function public.admin_set_team_leader(p_team text, p_dubber text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid;
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  select user_id into uid from public.dubbers where id = p_dubber;
  if uid is null then raise exception 'NO_ACCOUNT'; end if;
  insert into public.team_leaders (team_id, user_id) values (p_team, uid) on conflict do nothing;
  insert into public.team_members (team_id, dubber_id, role) values (p_team, p_dubber, 'قائد الفريق') on conflict do nothing;
end $$;
create or replace function public.admin_remove_team_leader(p_team text, p_dubber text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'NOT_ADMIN'; end if;
  delete from public.team_leaders where team_id = p_team
    and user_id = (select user_id from public.dubbers where id = p_dubber);
end $$;
create or replace function public.admin_list_leaders() returns table (team_id text, dubber_id text, name text)
language sql stable security definer set search_path = public as $$
  select tl.team_id, d.id, d.name from public.team_leaders tl join public.dubbers d on d.user_id = tl.user_id
  where public.is_admin();
$$;
revoke all on function public.admin_set_team_leader(text,text), public.admin_remove_team_leader(text,text), public.admin_list_leaders() from public, anon;
grant execute on function public.admin_set_team_leader(text,text), public.admin_remove_team_leader(text,text), public.admin_list_leaders() to authenticated;

-- لو انشال عضو/مدبلج، تنشال قيادته تلقائياً
create or replace function public.cleanup_leader_member() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  delete from public.team_leaders where team_id = old.team_id
    and user_id = (select user_id from public.dubbers where id = old.dubber_id);
  return old;
end $$;
drop trigger if exists leader_cleanup_member on public.team_members;
create trigger leader_cleanup_member after delete on public.team_members for each row execute function public.cleanup_leader_member();

create or replace function public.cleanup_leader_dubber() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.user_id is not null then delete from public.team_leaders where user_id = old.user_id; end if;
  return old;
end $$;
drop trigger if exists leader_cleanup_dubber on public.dubbers;
create trigger leader_cleanup_dubber after delete on public.dubbers for each row execute function public.cleanup_leader_dubber();

-- ---------- الفرق: الأدمن يضيف/يحذف/يعدّل، والقائد يعدّل فريقه فقط ----------
revoke insert, update, delete on public.teams from anon, authenticated;
grant insert (id, name, logo, banner, description, sort_order) on public.teams to authenticated;
grant update (name, logo, banner, description, sort_order)     on public.teams to authenticated;
grant delete on public.teams to authenticated;
drop policy if exists "admin insert teams" on public.teams;
drop policy if exists "staff update teams" on public.teams;
drop policy if exists "admin delete teams" on public.teams;
create policy "admin insert teams" on public.teams for insert to authenticated with check (public.is_admin());
create policy "staff update teams" on public.teams for update to authenticated
  using (public.is_admin() or public.is_team_leader(id)) with check (public.is_admin() or public.is_team_leader(id));
create policy "admin delete teams" on public.teams for delete to authenticated using (public.is_admin());

-- القائد ما يقدر يغيّر ترتيب الفرق (للأدمن فقط)
create or replace function public.teams_guard() returns trigger language plpgsql as $$
begin
  if auth.uid() is not null and not public.is_admin() and new.sort_order is distinct from old.sort_order then
    raise exception 'ADMIN_ONLY';
  end if;
  return new;
end $$;
drop trigger if exists teams_guard_trg on public.teams;
create trigger teams_guard_trg before update on public.teams for each row execute function public.teams_guard();

-- ---------- أعضاء الفريق: الأدمن أو قائد الفريق ----------
revoke insert, update, delete on public.team_members from anon, authenticated;
grant insert (team_id, dubber_id, role) on public.team_members to authenticated;
grant update (role) on public.team_members to authenticated;
grant delete on public.team_members to authenticated;
drop policy if exists "staff insert members" on public.team_members;
drop policy if exists "staff update members" on public.team_members;
drop policy if exists "staff delete members" on public.team_members;
create policy "staff insert members" on public.team_members for insert to authenticated
  with check (public.is_admin() or public.is_team_leader(team_id));
create policy "staff update members" on public.team_members for update to authenticated
  using (public.is_admin() or public.is_team_leader(team_id)) with check (public.is_admin() or public.is_team_leader(team_id));
create policy "staff delete members" on public.team_members for delete to authenticated
  using (public.is_admin() or public.is_team_leader(team_id));

-- ---------- المدبلجون: الأدمن فقط يضيف/يعدّل/يحذف ----------
revoke insert, update, delete on public.dubbers from anon, authenticated;
grant insert (id, name, role, logo, bio, social_url) on public.dubbers to authenticated;
grant update (name, role, logo, bio, social_url)     on public.dubbers to authenticated;
grant delete on public.dubbers to authenticated;
drop policy if exists "admin insert dubbers" on public.dubbers;
drop policy if exists "admin update dubbers" on public.dubbers;
drop policy if exists "admin delete dubbers" on public.dubbers;
create policy "admin insert dubbers" on public.dubbers for insert to authenticated with check (public.is_admin());
create policy "admin update dubbers" on public.dubbers for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "admin delete dubbers" on public.dubbers for delete to authenticated using (public.is_admin());

-- ---------- الطلبات: الأدمن يشوف الكل، والقائد يشوف طلبات فريقه فقط ----------
drop policy if exists "admin read all requests" on public.join_requests;
drop policy if exists "admin update requests"   on public.join_requests;
drop policy if exists "staff read requests"     on public.join_requests;
drop policy if exists "staff update requests"   on public.join_requests;
create policy "staff read requests" on public.join_requests for select to authenticated
  using (public.is_admin() or public.is_team_leader(team_id));
create policy "staff update requests" on public.join_requests for update to authenticated
  using (public.is_admin() or public.is_team_leader(team_id)) with check (public.is_admin() or public.is_team_leader(team_id));

drop policy if exists "admin read all claims" on public.role_claims;
drop policy if exists "admin update claims"   on public.role_claims;
drop policy if exists "staff read claims"     on public.role_claims;
drop policy if exists "staff update claims"   on public.role_claims;
create policy "staff read claims" on public.role_claims for select to authenticated
  using (public.is_admin() or public.leads_dubber(dubber_id));
create policy "staff update claims" on public.role_claims for update to authenticated
  using (public.is_admin() or public.leads_dubber(dubber_id)) with check (public.is_admin() or public.leads_dubber(dubber_id));
