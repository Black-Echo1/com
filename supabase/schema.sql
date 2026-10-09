-- الخطوة 1: انسخ هذا الملف كاملاً والصقه في Supabase → SQL Editor → Run

create table if not exists public.anime (
  id               text primary key,          -- نفس المعرّف المستخدم في الموقع (مثل "wind breaker")
  title            text,
  mal_id           integer,
  is_hero          boolean not null default false,
  in_catalog       boolean not null default true,  -- يظهر بالصفحة الرئيسية والكتالوج
  dubbing_team     text,
  dubbed_characters jsonb not null default '{}'::jsonb,  -- { "اسم الشخصية": "اسم المؤدي" }
  poster           text,
  cover_banner     text,
  story            text,
  sort_order       integer not null default 0,     -- الأكبر = أحدث إضافة
  created_at       timestamptz not null default now()
);

create table if not exists public.episodes (
  id            bigint generated always as identity primary key,
  anime_id      text not null references public.anime(id) on update cascade on delete cascade,
  number        numeric not null,
  title         text,
  thumbnail     text,
  duration      text,
  release_date  text,
  dubbing_team  text,
  servers       jsonb not null default '[]'::jsonb,  -- [{ name, url, ouo_url }]
  created_at    timestamptz not null default now()
);

create index if not exists episodes_anime_idx on public.episodes (anime_id, number);

-- أمان: الجميع يقرأ، وما أحد يكتب إلا من لوحة Supabase (أنت)
alter table public.anime    enable row level security;
alter table public.episodes enable row level security;

drop policy if exists "public read anime"    on public.anime;
drop policy if exists "public read episodes" on public.episodes;
create policy "public read anime"    on public.anime    for select using (true);
create policy "public read episodes" on public.episodes for select using (true);
