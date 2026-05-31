-- Уведомление админам: ник автора обращения (опционально, после deploy сайта)
-- Админы должны видеть все profiles: docs/supabase-admin-profiles-select.sql

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
	v_nick text;
	v_line text;
begin
	select coalesce(
		nullif(trim(p.minecraft_nick), ''),
		nullif(trim(p.email), ''),
		'игрок'
	)
	into v_nick
	from public.support_tickets t
	left join public.profiles p on p.id = t.user_id
	where t.id = p_ticket_id;

	v_line := coalesce(v_nick, 'игрок') || ': ' || left(trim(coalesce(p_subject, 'Обращение')), 180);

	for admin_row in
		select p.id from public.profiles p where p.role = 'admin'
	loop
		perform public.try_insert_user_notification(
			admin_row.id,
			'admin_new_support_ticket',
			'Новое обращение',
			v_line,
			'/account.html#admin-support',
			null
		);
	end loop;
end;
$$;
