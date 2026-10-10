-- شغّله مرة وحدة في SQL Editor (آمن لو شغّلته أكثر من مرة).
-- 1) عمود لعدد الحلقات الأصلي للأنمي (يظهر على بطاقة الكتالوج)
alter table public.anime add column if not exists mal_episodes integer;

-- 2) خريطة "مجاني / بإعلانات" لكل أنمي، تُحسب تلقائياً من سيرفرات الحلقات
--    (فلتر مجاني/إعلانات بصفحة التصفح يشتغل بدون تحميل كل الحلقات)
create or replace view public.anime_access as
select e.anime_id as id,
       bool_or(exists (
         select 1 from jsonb_array_elements(e.servers) s
         where coalesce(s->>'direct_url','') <> ''
            or (s->>'url') ~* '\.(mp4|webm|ogg)([?#]|$)'
            or (s->>'url') ~* 'archive\.org/download/'
       )) as is_free
from public.episodes e
group by e.anime_id;

grant select on public.anime_access to anon, authenticated;
