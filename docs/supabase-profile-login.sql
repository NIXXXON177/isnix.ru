-- Добавить логин (username) вместо реальной почты
-- Supabase → SQL Editor → Run (после supabase-schema.sql)

alter table public.profiles
	add column if not exists login text;

-- 3–24: латиница, цифры и _
alter table public.profiles
	drop constraint if exists profiles_login_format_check;
alter table public.profiles
	add constraint profiles_login_format_check
	check (login is null or login ~ '^[a-zA-Z0-9_]{3,24}$');

create unique index if not exists profiles_login_unique
	on public.profiles (lower(login))
	where login is not null and length(trim(login)) > 0;

-- Заполнить логин из "технической почты" вида login@isnix.invalid (если уже есть пользователи)
update public.profiles p
set login = lower(split_part(p.email, '@', 1))
where (p.login is null or length(trim(p.login)) = 0)
	and p.email ilike '%@isnix.invalid'
	and split_part(p.email, '@', 2) ilike 'isnix.invalid';

-- Разрешаем пользователю менять ТОЛЬКО свой логин
drop policy if exists "profiles_update_own_login" on public.profiles;
create policy "profiles_update_own_login"
	on public.profiles for update
	using (auth.uid() = id)
	with check (auth.uid() = id);

