-- Уведомления в личном кабинете (заявка, одобрение, сообщение админа)
-- Supabase → SQL Editor → Run

create table if not exists public.user_notifications (
	id uuid primary key default gen_random_uuid(),
	user_id uuid not null references auth.users on delete cascade,
	kind text not null check (
		kind in (
			'whitelist_submitted',
			'whitelist_approved',
			'whitelist_rejected',
			'whitelist_admin_message'
		)
	),
	title text not null,
	body text not null,
	href text,
	application_id uuid references public.whitelist_applications on delete set null,
	read_at timestamptz,
	created_at timestamptz not null default now()
);

create index if not exists user_notifications_user_id_idx
	on public.user_notifications (user_id, created_at desc);

create index if not exists user_notifications_unread_idx
	on public.user_notifications (user_id)
	where read_at is null;

alter table public.user_notifications enable row level security;

drop policy if exists "notifications_select_own" on public.user_notifications;
create policy "notifications_select_own"
	on public.user_notifications for select
	using (auth.uid() = user_id);

grant select on table public.user_notifications to authenticated;

create or replace function public.insert_user_notification(
	p_user_id uuid,
	p_kind text,
	p_title text,
	p_body text,
	p_href text default '/account.html#applications',
	p_application_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	if p_user_id is null then
		return;
	end if;
	insert into public.user_notifications (user_id, kind, title, body, href, application_id)
	values (
		p_user_id,
		p_kind,
		left(trim(coalesce(p_title, '')), 200),
		left(trim(coalesce(p_body, '')), 2000),
		nullif(left(trim(coalesce(p_href, '')), 500), ''),
		p_application_id
	);
end;
$$;

create or replace function public.notify_whitelist_application_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	perform public.insert_user_notification(
		new.user_id,
		'whitelist_submitted',
		'Заявка отправлена',
		'Заявка на вайтлист для ника «' || coalesce(new.minecraft_nick, '?') ||
			'» принята. Обычно отвечаем в течение часа.',
		'/account.html#applications',
		new.id
	);
	return new;
end;
$$;

drop trigger if exists whitelist_applications_notify_insert on public.whitelist_applications;
create trigger whitelist_applications_notify_insert
	after insert on public.whitelist_applications
	for each row execute function public.notify_whitelist_application_insert();

create or replace function public.notify_whitelist_application_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	if new.status is distinct from old.status then
		if new.status = 'approved' then
			perform public.insert_user_notification(
				new.user_id,
				'whitelist_approved',
				'Вайтлист: одобрено',
				'Заявка для «' || coalesce(new.minecraft_nick, '?') ||
					'» одобрена. Добавь IP mc.isnix.ru и заходи на сервер.',
				'/account.html#whitelist',
				new.id
			);
		elsif new.status = 'rejected' then
			perform public.insert_user_notification(
				new.user_id,
				'whitelist_rejected',
				'Вайтлист: отклонено',
				coalesce(
					nullif(trim(new.admin_note), ''),
					'Заявка для «' || coalesce(new.minecraft_nick, '?') || '» отклонена.'
				),
				'/account.html#applications',
				new.id
			);
		end if;
	end if;

	if new.status = 'pending'
		and new.admin_note is distinct from old.admin_note
		and new.admin_note is not null
		and length(trim(new.admin_note)) > 0 then
		perform public.insert_user_notification(
			new.user_id,
			'whitelist_admin_message',
			'Сообщение от администрации',
			left(trim(new.admin_note), 500),
			'/account.html#applications',
			new.id
		);
	end if;

	return new;
end;
$$;

drop trigger if exists whitelist_applications_notify_update on public.whitelist_applications;
create trigger whitelist_applications_notify_update
	after update on public.whitelist_applications
	for each row execute function public.notify_whitelist_application_update();

create or replace function public.mark_notifications_read(p_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	if p_ids is null or array_length(p_ids, 1) is null then
		return;
	end if;
	update public.user_notifications
	set read_at = now()
	where user_id = auth.uid()
		and read_at is null
		and id = any(p_ids);
end;
$$;

grant execute on function public.mark_notifications_read(uuid[]) to authenticated;
