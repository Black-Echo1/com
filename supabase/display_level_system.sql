-- ============================================================
-- AR anime: مستوى العرض اليدوي لكل عضوية فريق.
-- شغّله مرة واحدة بعد people_system.sql و staff_system.sql و profile_system.sql.
-- آمن لإعادة التشغيل: لا يحذف بيانات، ويملأ مستوى العرض فقط للعضويات غير المحددة.
-- ============================================================

alter table public.team_members
  add column if not exists display_level text;

-- احتفظ بالمستوى الصريح إن كان محفوظاً كصفة للفريق؛ وإلا ابدأ من متوسط كما يظهر حالياً.
update public.team_members tm
set display_level = case
  when tm.role in ('مدبلج مبتدئ', 'مدبلج متوسط', 'مدبلج محترف') then tm.role
  when d.role in ('مدبلج مبتدئ', 'مدبلج متوسط', 'مدبلج محترف') then d.role
  else 'مدبلج متوسط'
end
from public.dubbers d
where d.id = tm.dubber_id and tm.display_level is null;

-- المستوى المتوسط يظل الافتراضي للعضويات التي تُضاف مستقبلاً، ويمكن تغييره.
alter table public.team_members
  alter column display_level set default 'مدبلج متوسط';

do $$ begin
  alter table public.team_members
    add constraint team_members_display_level_valid
    check (display_level is null or display_level in (
      'مدبلج مبتدئ', 'مدبلج متوسط', 'مدبلج محترف'
    )) not valid;
exception when duplicate_object then null;
end $$;

-- القراءة عامة لأن المستوى يظهر في الملف العام. صلاحيات الكتابة تمر عبر
-- سياسات staff update/insert members الموجودة: الأدمن أو قائد الفريق المعني فقط.
grant select (display_level) on public.team_members to anon, authenticated;
grant insert (display_level) on public.team_members to authenticated;
grant update (display_level) on public.team_members to authenticated;

-- يضيف المستوى إلى الـ RPC العام الذي يستخدمه الموقع، من دون كشف بيانات خاصة.
create or replace function public.get_people() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'teams', coalesce((
      select jsonb_agg(to_jsonb(t) order by t.sort_order)
      from (select id, name, logo, banner, description, sort_order from public.teams) t
    ), '[]'::jsonb),
    'dubbers', coalesce((
      select jsonb_agg(to_jsonb(d))
      from (select id, name, role, logo, banner, bio, social_url from public.dubbers order by created_at) d
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(to_jsonb(m))
      from (select team_id, dubber_id, role, display_level from public.team_members) m
    ), '[]'::jsonb)
  );
$$;
grant execute on function public.get_people() to anon, authenticated;

notify pgrst, 'reload schema';
