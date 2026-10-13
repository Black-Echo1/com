-- AR anime: ملف تفعيل جاهز للتعليقات ومجالات التقديم.
-- شغّل هذا الملف وحده في Supabase SQL Editor.
-- لا تشغّل أجزاء منه منفصلة.

begin;

-- 1) التعليقات
create table if not exists public.anime_comments (
  id bigint generated always as identity primary key,
  anime_id text not null references public.anime(id) on update cascade on delete cascade,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  author_name text not null,
  content text not null,
  created_at timestamptz not null default now()
);
alter table public.anime_comments add column if not exists author_name text;
alter table public.anime_comments add column if not exists content text;
alter table public.anime_comments add column if not exists created_at timestamptz not null default now();
create index if not exists anime_comments_anime_idx on public.anime_comments (anime_id, created_at desc);

-- 2) فلتر الكلمات الممنوعة داخل قاعدة البيانات
create or replace function public.comment_contains_blocked_word(p_content text) returns boolean
language plpgsql immutable as $$
declare
  word text;
  blocked text[] := array['اغتصاب','بز','بزاز','بظر','بيضان','تمص','ثدي','جماع','حلمة','خنثي','خول','زب','سحاق','سحاقية','سكس','شاذ','شرج','شرموطة','شهوة','طيز','عاهرة','عرص','فرج','قحبة','قضيب','كس','لبوة','لحس','لعق','لواط','لوطي','مبادل','متناك','متناكة','مص','مفلقسة','نيك','خرا','زق'];
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
  if public.comment_contains_blocked_word(new.content) then
    raise exception 'COMMENT_BLOCKED_WORD';
  end if;
  return new;
end $$;
drop trigger if exists anime_comments_blocked_words on public.anime_comments;
create trigger anime_comments_blocked_words before insert or update of content on public.anime_comments
for each row execute function public.reject_blocked_anime_comment();

-- 3) صلاحيات التعليقات الأساسية
alter table public.anime_comments enable row level security;
grant select on public.anime_comments to anon, authenticated;
grant insert (anime_id, user_id, author_name, content) on public.anime_comments to authenticated;
grant delete on public.anime_comments to authenticated;
drop policy if exists "public read anime comments" on public.anime_comments;
drop policy if exists "authenticated add anime comments" on public.anime_comments;
drop policy if exists "owner delete anime comments" on public.anime_comments;
drop policy if exists "staff delete anime comments" on public.anime_comments;
create policy "public read anime comments" on public.anime_comments for select using (true);
create policy "authenticated add anime comments" on public.anime_comments for insert to authenticated with check (user_id = auth.uid());
create policy "owner delete anime comments" on public.anime_comments for delete to authenticated using (user_id = auth.uid());

-- 4) حذف المشرفين: يستخدم is_staff إن كانت staff_system.sql مطبقة.
do $policy$
begin
  if to_regprocedure('public.is_staff()') is not null then
    execute 'create policy "staff delete anime comments" on public.anime_comments for delete to authenticated using (public.is_staff())';
  elsif to_regclass('public.admins') is not null and to_regclass('public.team_leaders') is not null then
    execute 'create policy "staff delete anime comments" on public.anime_comments for delete to authenticated using (exists (select 1 from public.admins where user_id = auth.uid()) or exists (select 1 from public.team_leaders where user_id = auth.uid()))';
  else
    raise notice 'تم تفعيل حذف المالك فقط؛ شغّل staff_system.sql لاحقاً لتفعيل حذف الأدمن وقادة الجروبات.';
  end if;
end
$policy$;

-- 5) عمود المجالات. DO يمنع فشل الملف إذا كان العمود غير موجود عند بداية التشغيل.
alter table public.join_requests add column if not exists roles text[];

do $roles$
declare
  has_role boolean;
begin
  select exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'join_requests' and column_name = 'role') into has_role;
  if has_role then
    execute $$update public.join_requests set roles = case
      when nullif(trim(role), '') is null then array['مؤدي أصوات']::text[]
      when trim(role) = 'مهندس صوت' then array['هندسة الصوت']::text[]
      when trim(role) = 'مخرج دبلجة' then array['مخرج الدوبلاج']::text[]
      when trim(role) = 'كاتب نصوص' then array['معدّ الحوار']::text[]
      else array[trim(role)]::text[]
    end where roles is null$$;
  else
    execute $$update public.join_requests set roles = array['مؤدي أصوات']::text[] where roles is null$$;
  end if;
end
$roles$;
alter table public.join_requests alter column roles set default array['مؤدي أصوات']::text[];
alter table public.join_requests alter column roles set not null;

do $constraint$
begin
  alter table public.join_requests drop constraint if exists join_requests_roles_check;
  alter table public.join_requests add constraint join_requests_roles_check check (
    cardinality(roles) between 1 and 3 and roles <@ array[
      'مؤدي أصوات','مترجم','معدّ الحوار','التدقيق اللغوي','المونتاج','التترات',
      'هندسة الصوت','كتابة كلمات الشارة','الألحان والتوزيع','غناء الشارة','مخرج الدوبلاج'
    ]::text[]
  );
end
$constraint$;
grant insert (roles) on public.join_requests to authenticated;

commit;

-- تحقق اختياري بعد النجاح:
-- select column_name from information_schema.columns where table_schema='public' and table_name='join_requests' and column_name in ('role','roles');
-- select to_regclass('public.anime_comments');
