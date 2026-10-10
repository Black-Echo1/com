-- شغّله مرة وحدة في SQL Editor (قبل ملف 09_mal_data.sql)
-- يضيف أعمدة لحفظ الصورة والنوع والحالة والتقييم، عشان الرئيسية ما تحتاج تسأل Jikan كل مرة.
alter table public.anime add column if not exists mal_type   text;
alter table public.anime add column if not exists mal_status text;
alter table public.anime add column if not exists mal_score  numeric;
