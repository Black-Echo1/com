-- ============================================================
-- يكمّل النظام: (1) صور الشخصيات تُحفظ مع الطلب وتظهر في صفحة المدبلج
--               (2) المدبلج يعدّل صفحته (الاسم، الدور، النبذة، الصورة، الخلفية، الرابط)
--               (3) قائد الفريق يقدّم طلب "أضيفوا هذا الأنمي لصفحة فريقنا" والأدمن يوافق
-- شغّله مرة وحدة بعد staff_system.sql. آمن لو أعدت تشغيله.
-- ============================================================

-- ---------- (1) صورة الشخصية مع طلب التأكيد ----------
alter table public.character_roles add column if not exists character_image text;
alter table public.role_claims     add column if not exists character_image text;
do $$ begin alter table public.character_roles add constraint character_roles_img_https check (character_image is null or character_image = '' or character_image ~* '^https://[^\s<>"'']+$') not valid; exception when duplicate_object then null; end $$;
do $$ begin alter table public.role_claims     add constraint role_claims_img_https     check (character_image is null or character_image = '' or character_image ~* '^https://[^\s<>"'']+$') not valid; exception when duplicate_object then null; end $$;

create or replace function public.on_claim_approved() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.character_roles (anime_id, character_name, dubber_id, character_image)
    values (new.anime_id, new.character_name, new.dubber_id, nullif(new.character_image, ''))
    on conflict (anime_id, character_name) do update
      set dubber_id = excluded.dubber_id,
          character_image = coalesce(excluded.character_image, public.character_roles.character_image);
  end if;
  return new;
end $$;

-- ---------- (2) المدبلجون: الخلفية + تعديل صفحتي ----------
alter table public.dubbers add column if not exists banner text;

do $$ begin alter table public.dubbers add constraint dubbers_name_len      check (char_length(name) between 2 and 60) not valid; exception when duplicate_object then null; end $$;
do $$ begin alter table public.dubbers add constraint dubbers_bio_len       check (bio is null or char_length(bio) <= 600) not valid; exception when duplicate_object then null; end $$;
do $$ begin alter table public.dubbers add constraint dubbers_logo_https    check (logo   is null or logo   = '' or logo   ~* '^https://[^\s<>"'']+$') not valid; exception when duplicate_object then null; end $$;
do $$ begin alter table public.dubbers add constraint dubbers_banner_https  check (banner is null or banner = '' or banner ~* '^https://[^\s<>"'']+$') not valid; exception when duplicate_object then null; end $$;
do $$ begin alter table public.dubbers add constraint dubbers_social_https  check (social_url is null or social_url = '' or social_url ~* '^https://[^\s<>"'']+$') not valid; exception when duplicate_object then null; end $$;

grant select (banner) on public.dubbers to anon, authenticated;
revoke update on public.dubbers from anon, authenticated;
grant update (name, role, logo, banner, bio, social_url) on public.dubbers to authenticated;
grant insert (id, name, role, logo, banner, bio, social_url) on public.dubbers to authenticated;

-- المدبلج يعدّل صفّه هو فقط. (ما فيه سياسة حذف للمدبلج، وجدول الشخصيات ما يقدر يلمسه: الشخصيات تثبّتها الإدارة فقط)
drop policy if exists "update own dubber" on public.dubbers;
create policy "update own dubber" on public.dubbers for update to authenticated
  using (id = public.my_dubber_id()) with check (id = public.my_dubber_id());

-- القراءة العامة تشمل الخلفية
create or replace function public.get_people() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'teams',   coalesce((select jsonb_agg(to_jsonb(t) order by t.sort_order) from (select id,name,logo,banner,description,sort_order from public.teams) t), '[]'::jsonb),
    'dubbers', coalesce((select jsonb_agg(to_jsonb(d)) from (select id,name,role,logo,banner,bio,social_url from public.dubbers order by created_at) d), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(to_jsonb(m)) from (select team_id,dubber_id,role from public.team_members) m), '[]'::jsonb)
  );
$$;
grant execute on function public.get_people() to anon, authenticated;

-- ---------- (3) ربط الأنميات بصفحات الفرق ----------
create table if not exists public.team_anime (
  team_id    text not null references public.teams(id) on update cascade on delete cascade,
  anime_id   text not null references public.anime(id) on update cascade on delete cascade,
  created_at timestamptz not null default now(),
  primary key (team_id, anime_id)
);

create table if not exists public.team_anime_requests (
  id           uuid primary key default gen_random_uuid(),
  team_id      text not null references public.teams(id) on update cascade on delete cascade,
  requested_by uuid not null references auth.users(id) on delete cascade,
  anime_id     text references public.anime(id) on update cascade on delete cascade,   -- أنمي موجود بالموقع
  new_title    text check (new_title is null or char_length(new_title) <= 120),       -- أو أنمي جديد غير موجود
  mal_url      text check (mal_url is null or mal_url = '' or mal_url ~* '^https://[^\s<>"'']+$'),
  note         text check (note is null or char_length(note) <= 400),
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note   text,
  created_at   timestamptz not null default now(),
  check (anime_id is not null or char_length(coalesce(new_title, '')) >= 2)
);
create unique index if not exists one_pending_team_anime
  on public.team_anime_requests (team_id, anime_id) where status = 'pending' and anime_id is not null;

-- عند الموافقة على أنمي موجود بالموقع ينربط بصفحة الفريق تلقائياً
create or replace function public.on_team_anime_approved() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' and new.anime_id is not null then
    insert into public.team_anime (team_id, anime_id) values (new.team_id, new.anime_id) on conflict do nothing;
  end if;
  return new;
end $$;
drop trigger if exists team_anime_approved on public.team_anime_requests;
create trigger team_anime_approved after update of status on public.team_anime_requests
  for each row execute function public.on_team_anime_approved();

alter table public.team_anime          enable row level security;
alter table public.team_anime_requests enable row level security;

-- الربط النهائي: قراءة عامة، والأدمن فقط يضيف/يشيل
revoke insert, update, delete on public.team_anime from anon, authenticated;
grant insert (team_id, anime_id) on public.team_anime to authenticated;
grant delete on public.team_anime to authenticated;
drop policy if exists "read team_anime"         on public.team_anime;
drop policy if exists "admin insert team_anime" on public.team_anime;
drop policy if exists "admin delete team_anime" on public.team_anime;
create policy "read team_anime"         on public.team_anime for select using (true);
create policy "admin insert team_anime" on public.team_anime for insert to authenticated with check (public.is_admin());
create policy "admin delete team_anime" on public.team_anime for delete to authenticated using (public.is_admin());

-- الطلبات: القائد يقدّم لفريقه ويشوف طلبات فريقه، والأدمن يشوف الكل ويوافق/يرفض
revoke insert, update, delete on public.team_anime_requests from anon, authenticated;
grant insert (team_id, requested_by, anime_id, new_title, mal_url, note) on public.team_anime_requests to authenticated;
grant update (status, admin_note) on public.team_anime_requests to authenticated;
drop policy if exists "staff insert ta request"  on public.team_anime_requests;
drop policy if exists "staff read ta requests"   on public.team_anime_requests;
drop policy if exists "admin update ta requests" on public.team_anime_requests;
create policy "staff insert ta request" on public.team_anime_requests for insert to authenticated
  with check (requested_by = auth.uid() and status = 'pending' and admin_note is null
              and (public.is_admin() or public.is_team_leader(team_id)));
create policy "staff read ta requests" on public.team_anime_requests for select to authenticated
  using (public.is_admin() or public.is_team_leader(team_id));
create policy "admin update ta requests" on public.team_anime_requests for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
