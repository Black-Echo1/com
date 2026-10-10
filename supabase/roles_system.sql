-- ============================================================
-- نظام الشخصيات: المدبلج يطلب "أنا دبلجت هذي الشخصية" وأنت تؤكد.
-- شغّله مرة وحدة بعد people_system.sql. آمن لو أعدت تشغيله.
-- ============================================================

-- الشخصيات المؤكَّدة (اللي تظهر للجمهور: الشخصية + اسم مؤديها)
create table if not exists public.character_roles (
  id             uuid primary key default gen_random_uuid(),
  anime_id       text not null references public.anime(id) on update cascade on delete cascade,
  character_name text not null check (char_length(character_name) between 1 and 120),
  dubber_id      text not null references public.dubbers(id) on update cascade on delete cascade,
  created_at     timestamptz not null default now(),
  unique (anime_id, character_name)
);

-- طلبات "دبلجت هذي الشخصية"
create table if not exists public.role_claims (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  dubber_id      text references public.dubbers(id) on delete cascade,   -- يعبّيه النظام تلقائياً
  anime_id       text not null references public.anime(id) on update cascade on delete cascade,
  character_name text not null check (char_length(character_name) between 1 and 120),
  proof_url      text check (proof_url is null or proof_url = '' or proof_url ~* '^https://[^\s<>"'']+$'),
  status         text not null default 'pending' check (status in ('pending','approved','rejected')),
  admin_note     text,
  created_at     timestamptz not null default now()
);
create unique index if not exists one_pending_claim
  on public.role_claims (user_id, anime_id, character_name) where status = 'pending';

-- من هو المدبلج المقبول لهذا المستخدم؟ (دالة آمنة، بدون كشف user_id)
create or replace function public.my_dubber_id() returns text
language sql stable security definer set search_path = public as $$
  select id from public.dubbers where user_id = auth.uid();
$$;
revoke all on function public.my_dubber_id() from public, anon;
grant execute on function public.my_dubber_id() to authenticated;

-- قبل الإدخال: نربط الطلب بالمدبلج، وإذا ما هو مقبول نرفض
create or replace function public.claim_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  new.dubber_id := public.my_dubber_id();
  if new.dubber_id is null then raise exception 'NOT_DUBBER'; end if;
  return new;
end $$;
drop trigger if exists claim_set_dubber on public.role_claims;
create trigger claim_set_dubber before insert on public.role_claims
  for each row execute function public.claim_before_insert();

-- عند قبول الطلب (status = approved من Table Editor) تتأكد الشخصية تلقائياً
create or replace function public.on_claim_approved() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'approved' and old.status is distinct from 'approved' then
    insert into public.character_roles (anime_id, character_name, dubber_id)
    values (new.anime_id, new.character_name, new.dubber_id)
    on conflict (anime_id, character_name) do update set dubber_id = excluded.dubber_id;
  end if;
  return new;
end $$;
drop trigger if exists claim_approved on public.role_claims;
create trigger claim_approved after update of status on public.role_claims
  for each row execute function public.on_claim_approved();

-- الأمان
alter table public.character_roles enable row level security;
alter table public.role_claims     enable row level security;

drop policy if exists "read roles"         on public.character_roles;
drop policy if exists "insert own claim"   on public.role_claims;
drop policy if exists "read own claim"     on public.role_claims;
create policy "read roles" on public.character_roles for select using (true);
create policy "insert own claim" on public.role_claims for insert to authenticated
  with check (user_id = auth.uid() and status = 'pending' and admin_note is null);
create policy "read own claim" on public.role_claims for select to authenticated
  using (user_id = auth.uid());
