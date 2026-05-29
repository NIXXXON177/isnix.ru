-- Если на isnix.ru «нет связи с базой» или не грузятся заявки — выполни целиком в Supabase → SQL Editor

-- 1) Права на таблицы
grant usage on schema public to anon, authenticated;

grant select, update on table public.profiles to authenticated;

grant select, insert, update on table public.whitelist_applications to authenticated;

-- 2) Диалог по заявкам + is_admin по role
alter table public.whitelist_applications
	add column if not exists applicant_reply text;

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
				'kupryuhinsemen@gmail.com',
				'kudrasovn024@gmail.com',
				'1511vasilisa@gmail.com',
				'nikenerdx@gmail.com'
			)
	);
$$;

-- Защита роли при регистрации: новые пользователи всегда player
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	if TG_OP = 'INSERT' then
		new.role := 'player';
		return new;
	end if;

	if new.role is distinct from old.role and not public.is_admin() then
		new.role := old.role;
	end if;
	return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
	before insert or update on public.profiles
	for each row execute function public.protect_profile_role();

-- Сбросить admin у всех, кроме четырёх администраторов сайта
alter table public.profiles disable trigger profiles_protect_role;

update public.profiles
set role = 'player'
where email is null
	or lower(trim(email)) not in (
		'kupryuhinsemen@gmail.com',
		'kudrasovn024@gmail.com',
		'1511vasilisa@gmail.com',
		'nikenerdx@gmail.com'
	);

alter table public.profiles enable trigger profiles_protect_role;

create or replace function public.send_whitelist_admin_message(
	p_application_id uuid,
	p_message text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	if not public.is_admin() then
		raise exception 'forbidden';
	end if;

	update public.whitelist_applications
	set
		admin_note = nullif(left(trim(coalesce(p_message, '')), 4000), ''),
		updated_at = now()
	where id = p_application_id
		and status = 'pending';

	if not found then
		raise exception 'application_not_found_or_not_pending';
	end if;
end;
$$;

create or replace function public.submit_whitelist_applicant_reply(
	p_application_id uuid,
	p_reply text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	app public.whitelist_applications%rowtype;
begin
	select * into app
	from public.whitelist_applications
	where id = p_application_id;

	if not found then
		raise exception 'application_not_found';
	end if;

	if app.user_id is distinct from auth.uid() then
		raise exception 'forbidden';
	end if;

	if app.status <> 'pending' then
		raise exception 'application_closed';
	end if;

	if app.admin_note is null or length(trim(app.admin_note)) = 0 then
		raise exception 'no_admin_message_yet';
	end if;

	if length(trim(coalesce(p_reply, ''))) < 3 then
		raise exception 'reply_too_short';
	end if;

	update public.whitelist_applications
	set
		applicant_reply = left(trim(p_reply), 2000),
		updated_at = now()
	where id = p_application_id;
end;
$$;

grant execute on function public.send_whitelist_admin_message(uuid, text) to authenticated;
grant execute on function public.submit_whitelist_applicant_reply(uuid, text) to authenticated;
