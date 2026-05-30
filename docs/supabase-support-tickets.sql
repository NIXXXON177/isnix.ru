-- Личные обращения (жалобы, баги) — диалог игрок ↔ админ в кабинете
-- Supabase → SQL Editor → Run (после profiles, is_admin(), try_insert_user_notification)

-- Расширить типы уведомлений
alter table public.user_notifications drop constraint if exists user_notifications_kind_check;
alter table public.user_notifications
	add constraint user_notifications_kind_check check (
		kind in (
			'whitelist_submitted',
			'whitelist_approved',
			'whitelist_rejected',
			'whitelist_admin_message',
			'admin_new_application',
			'support_ticket_created',
			'support_admin_reply',
			'support_user_reply',
			'admin_new_support_ticket'
		)
	);

alter table public.user_notifications
	add column if not exists support_ticket_id uuid;

create table if not exists public.support_tickets (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users on delete cascade,
	category text not null check (
		category in ('player_report', 'bug', 'account', 'other')
	),
	subject text not null,
	offender_nick text,
	evidence_url text,
	status text not null default 'open' check (
		status in ('open', 'waiting_user', 'waiting_admin', 'closed')
	),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists support_tickets_user_id_idx
	on public.support_tickets (user_id, updated_at desc);

create index if not exists support_tickets_status_idx
	on public.support_tickets (status, updated_at desc);

create table if not exists public.support_messages (
	id uuid primary key default gen_random_uuid(),
	ticket_id uuid not null references public.support_tickets on delete cascade,
	author_id uuid not null references auth.users on delete cascade,
	body text not null,
	is_staff boolean not null default false,
	created_at timestamptz not null default now()
);

create index if not exists support_messages_ticket_id_idx
	on public.support_messages (ticket_id, created_at asc);

alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;

drop policy if exists "support_tickets_select_own" on public.support_tickets;
create policy "support_tickets_select_own"
	on public.support_tickets for select
	using (auth.uid() = user_id or public.is_admin());

drop policy if exists "support_messages_select" on public.support_messages;
create policy "support_messages_select"
	on public.support_messages for select
	using (
		exists (
			select 1 from public.support_tickets t
			where t.id = ticket_id
				and (t.user_id = auth.uid() or public.is_admin())
		)
	);

grant select on table public.support_tickets to authenticated;
grant select on table public.support_messages to authenticated;

create or replace function public.touch_support_ticket_updated()
returns trigger
language plpgsql
as $$
begin
	update public.support_tickets
	set updated_at = now()
	where id = new.ticket_id;
	return new;
end;
$$;

drop trigger if exists support_messages_touch_ticket on public.support_messages;
create trigger support_messages_touch_ticket
	after insert on public.support_messages
	for each row execute function public.touch_support_ticket_updated();

create or replace function public.notify_site_admins_new_support_ticket(
	p_ticket_id uuid,
	p_subject text
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
		select p.id from public.profiles p where p.role = 'admin'
	loop
		perform public.try_insert_user_notification(
			admin_row.id,
			'admin_new_support_ticket',
			'Новое обращение',
			left(trim(coalesce(p_subject, 'Обращение')), 200),
			'/account.html#admin-support',
			null
		);
	end loop;
end;
$$;

create or replace function public.create_support_ticket(
	p_category text,
	p_subject text,
	p_body text,
	p_offender_nick text default null,
	p_evidence_url text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
	tid uuid;
	uid uuid := auth.uid();
	subj text;
	msg text;
begin
	if uid is null then
		raise exception 'not_authenticated';
	end if;

	if p_category not in ('player_report', 'bug', 'account', 'other') then
		raise exception 'invalid_category';
	end if;

	subj := left(trim(coalesce(p_subject, '')), 200);
	msg := left(trim(coalesce(p_body, '')), 4000);

	if length(subj) < 3 then
		raise exception 'subject_too_short';
	end if;
	if length(msg) < 10 then
		raise exception 'body_too_short';
	end if;

	insert into public.support_tickets (
		user_id,
		category,
		subject,
		offender_nick,
		evidence_url,
		status
	)
	values (
		uid,
		p_category,
		subj,
		nullif(left(trim(coalesce(p_offender_nick, '')), 16), ''),
		nullif(left(trim(coalesce(p_evidence_url, '')), 500), ''),
		'open'
	)
	returning id into tid;

	insert into public.support_messages (ticket_id, author_id, body, is_staff)
	values (tid, uid, msg, false);

	perform public.notify_site_admins_new_support_ticket(tid, subj);

	return tid;
end;
$$;

create or replace function public.add_support_message(
	p_ticket_id uuid,
	p_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	t public.support_tickets%rowtype;
	uid uuid := auth.uid();
	msg text;
begin
	if uid is null then
		raise exception 'not_authenticated';
	end if;

	select * into t from public.support_tickets where id = p_ticket_id;
	if not found then
		raise exception 'ticket_not_found';
	end if;

	if t.user_id <> uid then
		raise exception 'forbidden';
	end if;

	if t.status = 'closed' then
		raise exception 'ticket_closed';
	end if;

	if t.status not in ('waiting_user', 'open') then
		raise exception 'wait_for_admin';
	end if;

	msg := left(trim(coalesce(p_body, '')), 4000);
	if length(msg) < 3 then
		raise exception 'body_too_short';
	end if;

	insert into public.support_messages (ticket_id, author_id, body, is_staff)
	values (p_ticket_id, uid, msg, false);

	update public.support_tickets
	set status = 'waiting_admin', updated_at = now()
	where id = p_ticket_id;

	perform public.notify_site_admins_new_support_ticket(p_ticket_id, 'Ответ игрока: ' || t.subject);
end;
$$;

create or replace function public.admin_reply_support_ticket(
	p_ticket_id uuid,
	p_body text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	t public.support_tickets%rowtype;
	msg text;
begin
	if not public.is_admin() then
		raise exception 'forbidden';
	end if;

	select * into t from public.support_tickets where id = p_ticket_id;
	if not found then
		raise exception 'ticket_not_found';
	end if;

	if t.status = 'closed' then
		raise exception 'ticket_closed';
	end if;

	msg := left(trim(coalesce(p_body, '')), 4000);
	if length(msg) < 3 then
		raise exception 'body_too_short';
	end if;

	insert into public.support_messages (ticket_id, author_id, body, is_staff)
	values (p_ticket_id, auth.uid(), msg, true);

	update public.support_tickets
	set status = 'waiting_user', updated_at = now()
	where id = p_ticket_id;

	perform public.try_insert_user_notification(
		t.user_id,
		'support_admin_reply',
		'Ответ по обращению',
		left(msg, 300),
		'/account.html#support',
		null
	);
end;
$$;

create or replace function public.close_support_ticket(p_ticket_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	t public.support_tickets%rowtype;
begin
	if not public.is_admin() then
		raise exception 'forbidden';
	end if;

	select * into t from public.support_tickets where id = p_ticket_id;
	if not found then
		raise exception 'ticket_not_found';
	end if;

	update public.support_tickets
	set status = 'closed', updated_at = now()
	where id = p_ticket_id;

	perform public.try_insert_user_notification(
		t.user_id,
		'support_admin_reply',
		'Обращение закрыто',
		left('Тема: ' || t.subject, 300),
		'/account.html#support',
		null
	);
end;
$$;

grant execute on function public.create_support_ticket(text, text, text, text, text) to authenticated;
grant execute on function public.add_support_message(uuid, text) to authenticated;
grant execute on function public.admin_reply_support_ticket(uuid, text) to authenticated;
grant execute on function public.close_support_ticket(uuid) to authenticated;
