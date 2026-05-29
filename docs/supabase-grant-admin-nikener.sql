-- Четвёртый администратор сайта: nikenerdx@gmail.com
-- Сначала пользователь должен зарегистрироваться на account.html

alter table public.profiles disable trigger profiles_protect_role;

update public.profiles
set
	role = 'admin',
	minecraft_nick = coalesce(nullif(trim(minecraft_nick), ''), 'NikenER999'),
	display_name = coalesce(nullif(trim(display_name), ''), 'NikenER')
where lower(trim(email)) = 'nikenerdx@gmail.com';

alter table public.profiles enable trigger profiles_protect_role;

select email, role, minecraft_nick, display_name
from public.profiles
where lower(trim(email)) = 'nikenerdx@gmail.com';
