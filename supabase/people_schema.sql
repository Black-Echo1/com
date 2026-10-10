-- نظام الأعضاء والطلبات والفرق. شغّله مرة وحدة في SQL Editor (New query ثم Run).
-- النتيجة: ما فيه أي مدبلج بالموقع. أي شخص لازم يسجّل حساب ويقدّم طلب على فريق، وأنتم توافقون عليه.

-- ===== الفرق (قراءة عامة، التعديل منكم من Table Editor) =====
create table if not exists public.teams (
  id          text primary key,
  name        text not null,
  logo        text,
  banner      text,
  description text,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- ===== المدبلجون المقبولون فقط (ما أحد يضيف نفسه مباشرة) =====
create table if not exists public.dubbers (
  id         text primary key,
  name       text not null,
  role       text,
  logo       text,
  bio        text,
  social_url text,
  created_at timestamptz not null default now()
);

-- ربط حساب الدخول بالمدبلج (خاص، ما يظهر للعامة)
create table if not exists public.dubber_accounts (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  dubber_id text not null unique references public.dubbers(id) on delete cascade
);

-- عضوية المدبلج بالفريق
create table if not exists public.team_members (
  team_id    text not null references public.teams(id)   on delete cascade,
  dubber_id  text not null references public.dubbers(id) on delete cascade,
  role       text,
  sort_order integer not null default 0,   -- الأصغر يظهر أول (خلّ القائد 0)
  primary key (team_id, dubber_id)
);

-- ===== طلبات الانضمام =====
create table if not exists public.join_requests (
  id          bigint generated always as identity primary key,
  user_id     uuid not null default auth.uid() references auth.users(id) on delete cascade,
  team_id     text not null references public.teams(id) on delete cascade,
  name        text not null,
  role        text,
  logo        text,
  bio         text,
  social_url  text,
  contact     text not null,                -- خاص: ديسكورد/واتساب للتواصل (يشوفه الأدمن فقط)
  status      text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note  text,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint jr_name    check (char_length(name) between 2 and 60 and name !~ '[<>]'),
  constraint jr_role    check (role is null or (char_length(role) <= 60 and role !~ '[<>]')),
  constraint jr_logo    check (logo is null or (logo ~* '^https://' and char_length(logo) <= 500 and logo !~ '[<>"''[:space:]]')),
  constraint jr_social  check (social_url is null or (social_url ~* '^https://' and char_length(social_url) <= 500 and social_url !~ '[<>"''[:space:]]')),
  constraint jr_bio     check (bio is null or (char_length(bio) <= 500 and bio !~ '[<>]')),
  constraint jr_contact check (char_length(contact) between 3 and 100 and contact !~ '[<>]')
);
-- طلب واحد قيد المراجعة لكل شخص لكل فريق (يمنع السبام)
create unique index if not exists jr_one_pending on public.join_requests (user_id, team_id) where status = 'pending';

-- ===== عند قبول الطلب: ينضاف المدبلج للموقع تلقائياً =====
create or replace function public.handle_join_request() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_dubber text;
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    select dubber_id into v_dubber from public.dubber_accounts where user_id = new.user_id;
    if v_dubber is null then
      v_dubber := 'd_' || substr(md5(random()::text || clock_timestamp()::text), 1, 10);
      insert into public.dubbers (id, name, role, logo, bio, social_url)
        values (v_dubber, new.name, new.role, new.logo, new.bio, new.social_url);
      insert into public.dubber_accounts (user_id, dubber_id) values (new.user_id, v_dubber);
    end if;
    insert into public.team_members (team_id, dubber_id, role)
      values (new.team_id, v_dubber, new.role) on conflict do nothing;
    new.reviewed_at := now();
  elsif new.status = 'rejected' and (tg_op = 'INSERT' or old.status is distinct from 'rejected') then
    new.reviewed_at := now();
  end if;
  return new;
end $$;

drop trigger if exists join_request_review on public.join_requests;
create trigger join_request_review before insert or update on public.join_requests
for each row execute function public.handle_join_request();

-- ===== جلب كل شي بطلب واحد للموقع =====
create or replace function public.get_people() returns jsonb language sql stable as $$
  select jsonb_build_object(
    'teams',   coalesce((select jsonb_agg(to_jsonb(t) order by t.sort_order, t.created_at) from public.teams t), '[]'::jsonb),
    'dubbers', coalesce((select jsonb_agg(to_jsonb(d)) from public.dubbers d), '[]'::jsonb),
    'members', coalesce((select jsonb_agg(to_jsonb(m) order by m.sort_order) from public.team_members m), '[]'::jsonb)
  );
$$;

-- ===== الأمان (RLS) =====
alter table public.teams           enable row level security;
alter table public.dubbers         enable row level security;
alter table public.dubber_accounts enable row level security;
alter table public.team_members    enable row level security;
alter table public.join_requests   enable row level security;

drop policy if exists "public read teams"   on public.teams;
drop policy if exists "public read dubbers" on public.dubbers;
drop policy if exists "public read members" on public.team_members;
drop policy if exists "own account link"    on public.dubber_accounts;
drop policy if exists "send own request"    on public.join_requests;
drop policy if exists "read own requests"   on public.join_requests;

create policy "public read teams"   on public.teams        for select using (true);
create policy "public read dubbers" on public.dubbers      for select using (true);
create policy "public read members" on public.team_members for select using (true);
create policy "own account link"    on public.dubber_accounts for select to authenticated using (user_id = auth.uid());
-- المسجَّل يرسل طلبه بحالة "قيد المراجعة" فقط، ويشوف طلباته هو فقط
create policy "send own request"  on public.join_requests for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending');
create policy "read own requests" on public.join_requests for select to authenticated
  using (user_id = auth.uid());
-- ما فيه سياسة تعديل/حذف: الموافقة والرفض منكم فقط من Table Editor.
