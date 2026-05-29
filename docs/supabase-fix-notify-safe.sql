-- Безопасные уведомления: сбой insert не отменяет сообщение админа / одобрение заявки
-- Supabase → SQL Editor → Run (после supabase-notifications.sql или вместо правки триггеров вручную)

create or replace function public.try_insert_user_notification(
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
	perform public.insert_user_notification(
		p_user_id,
		p_kind,
		p_title,
		p_body,
		p_href,
		p_application_id
	);
exception
	when others then
		null;
end;
$$;

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
				'kupryuhinsemen@gmail.com',
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

create or replace function public.notify_whitelist_application_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	perform public.try_insert_user_notification(
		new.user_id,
		'whitelist_submitted',
		'Заявка отправлена',
		'Заявка на вайтлист для ника «' || coalesce(new.minecraft_nick, '?') ||
			'» принята. Обычно отвечаем в течение часа.',
		'/account.html#applications',
		new.id
	);
	perform public.notify_site_admins_new_application(new.minecraft_nick, new.id);
	return new;
end;
$$;

create or replace function public.notify_whitelist_application_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	if new.status is distinct from old.status then
		if new.status = 'approved' then
			perform public.try_insert_user_notification(
				new.user_id,
				'whitelist_approved',
				'Вайтлист: одобрено',
				'Заявка для «' || coalesce(new.minecraft_nick, '?') ||
					'» одобрена. Добавь IP mc.isnix.ru и заходи на сервер.',
				'/account.html#whitelist',
				new.id
			);
		elsif new.status = 'rejected' then
			perform public.try_insert_user_notification(
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
		perform public.try_insert_user_notification(
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
