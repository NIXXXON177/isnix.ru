-- Публичные заявки в вайтлист без регистрации на сайте.
-- SQL Editor → New query → Run (после docs/supabase-schema.sql и остальных миграций).

-- user_id необязателен для заявок «только ник»
alter table public.whitelist_applications
	alter column user_id drop not null;

-- Одна pending-заявка на аккаунт (если user_id есть)
drop index if exists whitelist_applications_one_pending;
create unique index if not exists whitelist_applications_one_pending_user
	on public.whitelist_applications (user_id)
	where (status = 'pending' and user_id is not null);

-- Одна pending-заявка на ник (без привязки к аккаунту)
create unique index if not exists whitelist_applications_one_pending_nick
	on public.whitelist_applications (lower(minecraft_nick))
	where (status = 'pending');

-- Триггер: email заявителя только если есть user_id
create or replace function public.sync_application_applicant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	if new.user_id is not null then
		select email into new.applicant_email
		from public.profiles
		where id = new.user_id;
	end if;
	return new;
end;
$$;

-- Публичная отправка заявки (anon key, без входа)
create or replace function public.submit_public_whitelist_application(
	p_minecraft_nick text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
	v_nick text;
	v_id uuid;
begin
	v_nick := trim(p_minecraft_nick);
	if v_nick is null or v_nick !~ '^[a-zA-Z0-9_]{3,16}$' then
		raise exception 'invalid_nick'
			using hint = 'Ник: 3–16 символов, латиница, цифры и _';
	end if;

	if exists (
		select 1
		from public.whitelist_applications
		where lower(minecraft_nick) = lower(v_nick)
			and status = 'pending'
	) then
		raise exception 'already_pending'
			using hint = 'Заявка с этим ником уже на рассмотрении';
	end if;

	insert into public.whitelist_applications (
		user_id,
		minecraft_nick,
		reason,
		read_rules,
		status
	) values (
		null,
		v_nick,
		'Заявка через форму на сайте',
		true,
		'pending'
	)
	returning id into v_id;

	return v_id;
end;
$$;

revoke all on function public.submit_public_whitelist_application(text) from public;
grant execute on function public.submit_public_whitelist_application(text) to anon, authenticated;
