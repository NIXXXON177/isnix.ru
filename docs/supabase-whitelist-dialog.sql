-- Диалог по заявке вайтлиста + надёжная отправка сообщений админом
-- Supabase → SQL Editor → Run

alter table public.whitelist_applications
	add column if not exists applicant_reply text;

-- Админ = role admin (без жёсткого списка email в БД)
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
	select exists (
		select 1 from public.profiles
		where id = auth.uid() and role = 'admin'
	);
$$;

-- Сообщение админа (статус остаётся pending)
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

-- Ответ игрока на вопрос админа
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
