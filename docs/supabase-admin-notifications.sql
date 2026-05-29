-- Уведомления администраторам о новой заявке в вайтлист
-- Supabase → SQL Editor → Run (после supabase-notifications.sql)

alter table public.user_notifications
	drop constraint if exists user_notifications_kind_check;

alter table public.user_notifications
	add constraint user_notifications_kind_check check (
		kind in (
			'whitelist_submitted',
			'whitelist_approved',
			'whitelist_rejected',
			'whitelist_admin_message',
			'admin_new_application'
		)
	);

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
		perform public.insert_user_notification(
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
	perform public.insert_user_notification(
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
