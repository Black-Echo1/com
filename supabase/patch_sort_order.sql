-- شغّله مرة وحدة في SQL Editor.
-- يخلّي أي أنمي جديد تضيفه من Table Editor يظهر تلقائياً "أحدث إصدار" في الرئيسية.
create or replace function public.set_anime_sort_order() returns trigger as $$
begin
  if new.sort_order is null or new.sort_order = 0 then
    select coalesce(max(sort_order), 0) + 1 into new.sort_order from public.anime;
  end if;
  return new;
end; $$ language plpgsql;

drop trigger if exists anime_sort_order on public.anime;
create trigger anime_sort_order before insert on public.anime
for each row execute function public.set_anime_sort_order();
