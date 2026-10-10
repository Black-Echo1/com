-- يخلّي غلاف كل حلقة = غلاف الأنمي نفسه (لكل الحلقات مرة وحدة).
-- شغّله بعد ما ينحط غلاف الأنمي (بعد 09_mal_data.sql).
update public.episodes e
set thumbnail = a.poster
from public.anime a
where a.id = e.anime_id
  and a.poster is not null
  and a.poster <> '';
