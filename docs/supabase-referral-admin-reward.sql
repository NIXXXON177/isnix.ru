-- Кнопка «Награда выдана» в админке (по id заявки)
-- Supabase → SQL Editor → Run (после supabase-referral-system.sql)

create or replace function public.admin_mark_referral_rewarded_by_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
	if not public.is_admin() then
		raise exception 'forbidden';
	end if;

	update public.referrals
	set
		status = 'rewarded',
		rewarded_at = now(),
		updated_at = now()
	where application_id = p_application_id
		and status in ('qualified', 'pending')
		and referrer_user_id is not null;
end;
$$;

grant execute on function public.admin_mark_referral_rewarded_by_application(uuid) to authenticated;
