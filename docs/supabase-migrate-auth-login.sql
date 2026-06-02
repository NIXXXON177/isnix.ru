-- Перевести старые аккаунты (реальная почта в Auth) на вход по логину login@isnix.invalid
-- Supabase → SQL Editor → Run (один раз, от имени проекта)
--
-- После этого вход на сайте: логин kudrasovn024 + тот же пароль.
-- Пока не выполнено — можно войти, введя в поле «Логин» старый email целиком.

-- 1) Твой аккаунт (ISTHISNIXXXON)
update auth.users
set
	email = 'kudrasovn024@isnix.invalid',
	email_confirmed_at = coalesce(email_confirmed_at, now()),
	raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || '{"site_login":"kudrasovn024"}'::jsonb
where lower(email) = 'kudrasovn024@gmail.com';

update public.profiles
set login = 'kudrasovn024'
where lower(trim(email)) = 'kudrasovn024@gmail.com'
   or lower(trim(minecraft_nick)) = 'isthisnixxxon';

-- 2) Остальные пользователи: префикс почты → login@isnix.invalid (только если ещё не мигрированы)
update auth.users au
set
	email = lower(split_part(au.email, '@', 1)) || '@isnix.invalid',
	email_confirmed_at = coalesce(au.email_confirmed_at, now())
where au.email is not null
	and au.email not ilike '%@isnix.invalid'
	and split_part(au.email, '@', 1) ~ '^[a-zA-Z0-9_]{3,24}$';

update public.profiles p
set login = lower(split_part(au.email, '@', 1))
from auth.users au
where p.id = au.id
	and au.email ilike '%@isnix.invalid'
	and (p.login is null or length(trim(p.login)) = 0);

-- Проверка
select au.email, p.login, p.minecraft_nick, p.role
from auth.users au
join public.profiles p on p.id = au.id
where p.minecraft_nick ilike 'isthisnixxxon'
   or au.email ilike 'kudrasovn024%';
