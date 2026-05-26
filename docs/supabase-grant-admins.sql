-- Выдать role = admin (триггер protect_profile_role блокирует смену роли без сессии админа)
-- SQL Editor → Run после создания пользователей в Authentication → Users

alter table public.profiles disable trigger profiles_protect_role;

update public.profiles
set role = 'admin', minecraft_nick = 'afktapochek', display_name = 'afktapochek'
where email = 'kupryuhinsemen@gmail.com';

update public.profiles
set role = 'admin', minecraft_nick = 'ISTHISNIXXXON', display_name = 'ISTHISNIXXXON'
where email = 'kudrasovn024@gmail.com';

update public.profiles
set role = 'admin', minecraft_nick = 'VaSSiLIISa', display_name = 'Vasilisa'
where email = '1511vasilisa@gmail.com';

alter table public.profiles enable trigger profiles_protect_role;

select email, role, minecraft_nick
from public.profiles
where role = 'admin';
