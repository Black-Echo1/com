-- ============================================================
-- نظام الأعضاء: فرق + مدبلجين + طلبات انضمام (بموافقتك فقط)
-- شغّله مرة وحدة في SQL Editor. آمن لو أعدت تشغيله.
-- ============================================================

-- 1) الفرق (الثلاثة الموجودين حالياً)
create table if not exists public.teams (
  id          text primary key,
  name        text not null,
  logo        text,
  banner      text,
  description text,
  sort_order  integer not null default 0
);

insert into public.teams (id, name, logo, banner, description, sort_order) values
('team_alpha','فريق BLACK ECHO','https://files.catbox.moe/qgtary.jpeg','https://files.catbox.moe/qgtary.jpeg','Black Echo فريق عربي يسعى إلى إعادة تقديم الأنمي بدبلجة عربية احترافية، مع الاهتمام بالجودة، وتطوير المواهب، وصناعة أعمال تليق بالجمهور العربي.',1),
('team_shadow','دوبلاج (اكاتسكي)','https://files.catbox.moe/bijb9i','https://i.ibb.co/nMB9Ddkh/image.png','فريق الأكنسكي هو فريق متخصص في الدوبلاج، يهدف إلى تقديم أعمال صوتية احترافية وخاصة في مجال الأنمي، مع أداء مميز يعكس مشاعر الشخصيات ويقدم تجربة ممتعة للجمهور العربي.',2),
('noor_shadow','دوبلاج (نور شادو)','https://i.ibb.co/99dTkJ6X/image.jpg','https://i.ibb.co/99dTkJ6X/image.jpg','فريق نور شادو هو فريق متخصص في الدوبلاج، يهدف إلى تقديم أعمال صوتية احترافية وخاصة في مجال الأنمي، مع أداء مميز يعكس مشاعر الشخصيات ويقدم تجربة ممتعة للجمهور العربي.',3)
on conflict (id) do nothing;

-- 2) المدبلجون المقبولون فقط (يبدأ فاضي = صفر أشخاص)
create table if not exists public.dubbers (
  id         text primary key,
  user_id    uuid unique references auth.users(id) on delete set null,
  name       text not null,
  role       text not null default 'مؤدي أصوات',
  logo       text,
  bio        text,
  social_url text,
  created_at timestamptz not null default now()
);

-- 3) عضوية الفريق
create table if not exists public.team_members (
  team_id   text not null references public.teams(id) on update cascade on delete cascade,
  dubber_id text not null references public.dubbers(id) on update cascade on delete cascade,
  role      text,
  primary key (team_id, dubber_id)
);

-- 4) طلبات الانضمام
create table if not exists public.join_requests (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 60),
  role         text not null default 'مؤدي أصوات' check (char_length(role) <= 40),
  team_id      text not null references public.teams(id) on update cascade,
  bio          text check (char_length(bio) <= 600),
  social_url   text check (social_url is null or social_url = '' or social_url ~* '^https://[^\s<>"'']+$'),
  avatar_url   text check (avatar_url is null or avatar_url = '' or avatar_url ~* '^https://[^\s<>"'']+$'),
  status       text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note   text,
  created_at   timestamptz not null default now()
);
-- طلب واحد قيد المراجعة لكل شخص
create unique index if not exists one_pending_request_per_user
  on public.join_requests (user_id) where status = 'pending';

-- 5) عند تغيير حالة الطلب إلى approved (من Table Editor) ينضاف الشخص تلقائياً
create or replace function public.on_request_approved() returns trigger
language plpgsql security definer set search_path = public as $$
declare new_id text;
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    select id into new_id from public.dubbers where user_id = new.user_id;
    if new_id is null then
      new_id := 'd_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
      insert into public.dubbers (id, user_id, name, role, logo, bio, social_url)
      values (new_id, new.user_id, new.display_name, new.role, nullif(new.avatar_url,''), new.bio, nullif(new.social_url,''));
    end if;
    insert into public.team_members (team_id, dubber_id, role)
    values (new.team_id, new_id, new.role)
    on conflict do nothing;
  end if;
  return new;
end $$;

drop trigger if exists join_request_approved on public.join_requests;
create trigger join_request_approved after update of status on public.join_requests
  for each row execute function public.on_request_approved();

-- 6) الأمان (RLS)
alter table public.teams         enable row level security;
alter table public.dubbers       enable row level security;
alter table public.team_members  enable row level security;
alter table public.join_requests enable row level security;

drop policy if exists "read teams"        on public.teams;
drop policy if exists "read dubbers"      on public.dubbers;
drop policy if exists "read team_members" on public.team_members;
create policy "read teams"        on public.teams        for select using (true);
create policy "read dubbers"      on public.dubbers      for select using (true);
create policy "read team_members" on public.team_members for select using (true);

-- نخفي عمود user_id عن القراءة العامة (الموقع يقرأ عبر get_people أو الأعمدة العامة فقط)
revoke select on public.dubbers from anon, authenticated;
grant select (id, name, role, logo, bio, social_url, created_at) on public.dubbers to anon, authenticated;

-- المسجّل يقدّم طلباً باسمه فقط وبحالة pending، ويشوف طلباته فقط. ما أحد يعدّل الحالة غيرك.
drop policy if exists "insert own request" on public.join_requests;
drop policy if exists "read own request"   on public.join_requests;
create policy "insert own request" on public.join_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and admin_note is null);
create policy "read own request"   on public.join_requests for select to authenticated
  using (user_id = auth.uid());

-- 7) دالة القراءة العامة اللي يستخدمها الموقع (بدون user_id أو أي بيانات خاصة)
create or replace function public.get_people() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'teams',   coalesce((select jsonb_agg(to_jsonb(t) order by t.sort_order) from (select id,name,logo,banner,description,sort_order from public.teams) t), '[]'::jsonb),
    'dubbers', coalesce((select jsonb_agg(to_jsonb(d)) from (select id,name,role,logo,bio,social_url from public.dubbers order by created_at) d), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(to_jsonb(m)) from (select team_id,dubber_id,role from public.team_members) m), '[]'::jsonb)
  );
$$;
grant execute on function public.get_people() to anon, authenticated;

-- ============================================================
-- تصفير كل الأشخاص في أي وقت (اختياري، لا تشغّله الحين):
--   delete from public.dubbers;   -- يمسح المدبلجين وعضوياتهم
-- ============================================================
