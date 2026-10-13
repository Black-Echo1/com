-- AR anime: تعليقات الأنمي ومجالات التقديم.
-- شغّله مرة واحدة بعد schema.sql وpeople_system.sql وstaff_system.sql.

create table if not exists public.anime_comments (
  id bigint generated always as identity primary key,
  anime_id text not null references public.anime(id) on update cascade on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null,
  content text not null,
  created_at timestamptz not null default now(),
  constraint anime_comments_name_check check (char_length(author_name) between 1 and 100 and author_name !~ '[<>]'),
  constraint anime_comments_content_check check (char_length(content) between 2 and 1000 and content !~ '[<>]')
);
create index if not exists anime_comments_anime_idx on public.anime_comments (anime_id, created_at desc);

-- فلتر مركزي لا يمكن تجاوزه من خلال طلب API مباشر.
create or replace function public.comment_contains_blocked_word(p_content text) returns boolean
language plpgsql immutable as $$
declare word text;
  blocked constant text[] := array['اغتصاب','بز','بزاز','بظر','بيضان','تمص','ثدي','جماع','حلمة','خنثي','خول','زب','سحاق','سحاقية','سكس','شاذ','شرج','شرموطة','شهوة','طيز','عاهرة','عرص','فرج','قحبة','قضيب','كس','لبوة','لحس','لعق','لواط','لوطي','مبادل','متناك','متناكة','مص','مفلقسة','نيك','خرا','زق'];
  clean text;
begin
  clean := lower(coalesce(p_content, ''));
  clean := translate(clean, 'أإآٱىة', 'اااايه');
  clean := replace(clean, 'ـ', '');
  clean := regexp_replace(clean, '[ًٌٍَُِّْ]', '', 'g');
  foreach word in array blocked loop
    word := lower(translate(word, 'أإآٱىة', 'اااايه'));
    if position(word in clean) > 0 then return true; end if;
  end loop;
  return false;
end $$;

grant execute on function public.comment_contains_blocked_word(text) to anon, authenticated;
create or replace function public.reject_blocked_anime_comment() returns trigger
language plpgsql immutable as $$
begin
  if public.comment_contains_blocked_word(new.content) then raise exception 'COMMENT_BLOCKED_WORD'; end if;
  return new;
end $$;
drop trigger if exists anime_comments_blocked_words on public.anime_comments;
create trigger anime_comments_blocked_words before insert or update of content on public.anime_comments
for each row execute function public.reject_blocked_anime_comment();

alter table public.anime_comments enable row level security;
grant select on public.anime_comments to anon, authenticated;
grant insert (anime_id, user_id, author_name, content) on public.anime_comments to authenticated;
grant delete on public.anime_comments to authenticated;
drop policy if exists "public read anime comments" on public.anime_comments;
drop policy if exists "authenticated add anime comments" on public.anime_comments;
drop policy if exists "owner delete anime comments" on public.anime_comments;
drop policy if exists "staff delete anime comments" on public.anime_comments;
create policy "public read anime comments" on public.anime_comments for select using (true);
create policy "authenticated add anime comments" on public.anime_comments for insert to authenticated
  with check (user_id = auth.uid());
create policy "owner delete anime comments" on public.anime_comments for delete to authenticated
  using (user_id = auth.uid());
-- is_staff() تعني الأدمن أو مسؤول/قائد أحد الجروبات حسب staff_system.sql.
create policy "staff delete anime comments" on public.anime_comments for delete to authenticated
  using (public.is_staff());

-- المجالات المختارة في طلب التقديم. يبقى role محفوظاً للتوافق مع الواجهة القديمة.
alter table public.join_requests add column if not exists roles text[];
update public.join_requests set roles = case when nullif(trim(role), '') is null then array['مؤدي أصوات']::text[] else array[trim(role)]::text[] end where roles is null;
alter table public.join_requests alter column roles set default array['مؤدي أصوات']::text[];
alter table public.join_requests alter column roles set not null;
do $$ begin
  alter table public.join_requests add constraint join_requests_roles_check check (cardinality(roles) between 1 and 3 and roles <@ array['مؤدي أصوات','مترجم','معدّ الحوار','التدقيق اللغوي','المونتاج','التترات','هندسة الصوت','كتابة كلمات الشارة','الألحان والتوزيع','غناء الشارة','مخرج الدوبلاج']::text[]);
exception when duplicate_object then null;
end $$;
grant insert (roles) on public.join_requests to authenticated;
