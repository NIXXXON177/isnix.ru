-- Снять afktapochek с администрации сайта (после дела ChicagoX / бочки)
-- Supabase → SQL Editor → Run
--
-- Вайтлист: убрать afktapochek и ChicagoX из whitelist.json в репо + деплой (GitHub Actions).

alter table public.profiles disable trigger profiles_protect_role;

update public.profiles
set role = 'player'
where lower(trim(email)) = 'kupryuhinsemen@gmail.com'
   or lower(trim(minecraft_nick)) in ('afktapochek', 'chicagox');

alter table public.profiles enable trigger profiles_protect_role;

-- is_admin: только оставшиеся админы (без kupryuhinsemen@gmail.com)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
	select exists (
		select 1
		from public.profiles p
		where p.id = auth.uid()
			and p.role = 'admin'
			and lower(trim(p.email)) in (
				'kudrasovn024@gmail.com',
				'1511vasilisa@gmail.com',
				'nikenerdx@gmail.com'
			)
	);
$$;

-- Уведомления админам о новых заявках (без afktapochek)
create or replace function public.notify_site_admins_new_application(
	p_nick text,
	p_application_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	admin_row record;
begin
	for admin_row in
		select p.id
		from public.profiles p
		where p.role = 'admin'
			and lower(trim(p.email)) in (
				'kudrasovn024@gmail.com',
				'1511vasilisa@gmail.com',
				'nikenerdx@gmail.com'
			)
	loop
		perform public.try_insert_user_notification(
			admin_row.id,
			'admin_new_application',
			'Новая заявка в вайтлист',
			'Ник «' || coalesce(nullif(trim(p_nick), ''), '?') ||
				'». Открой панель администрации → Заявки.',
			'/account.html#admin',
			p_application_id
		);
	end loop;
end;
$$;

-- Проверка
select email, role, minecraft_nick, login
from public.profiles
where lower(trim(email)) = 'kupryuhinsemen@gmail.com'
   or lower(trim(minecraft_nick)) in ('afktapochek', 'chicagox');

select email, role, minecraft_nick
from public.profiles
where role = 'admin'
order by email;
