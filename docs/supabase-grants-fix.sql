-- Исправление: permission denied for table profiles / whitelist_applications
-- Причина: при создании проекта отключено «Automatically expose new tables»
-- SQL Editor → Run

grant usage on schema public to anon, authenticated;

grant select, update on table public.profiles to authenticated;

grant select, insert, update on table public.whitelist_applications to authenticated;

-- Проверка (должны быть строки для authenticated)
select grantee, table_name, privilege_type
from information_schema.role_table_grants
where table_schema = 'public'
  and table_name in ('profiles', 'whitelist_applications')
  and grantee in ('authenticated', 'anon')
order by table_name, grantee, privilege_type;
