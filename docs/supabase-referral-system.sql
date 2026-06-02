-- Реферальная система ISTHISNIXXXON
-- Supabase → SQL Editor → Run (после основной схемы и notifications)

-- 1. Поле в заявке: кто пригласил (ник Minecraft)
alter table public.whitelist_applications
	add column if not exists referred_by_nick text;

comment on column public.whitelist_applications.referred_by_nick is
	'Ник пригласившего игрока (Minecraft), необязательно';

-- 2. Таблица рефералов
create table if not exists public.referrals (
	id uuid primary key default gen_random_uuid(),
	referrer_user_id uuid references auth.users on delete set null,
	referrer_nick text not null,
	referred_user_id uuid not null references auth.users on delete cascade,
	referred_nick text not null,
	application_id uuid references public.whitelist_applications on delete set null,
	status text not null default 'pending'
		check (status in ('pending', 'qualified', 'rewarded', 'rejected')),
	admin_note text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	rewarded_at timestamptz,
	unique (referred_user_id)
);

create index if not exists referrals_referrer_user_id_idx
	on public.referrals (referrer_user_id, created_at desc);

create index if not exists referrals_status_idx
	on public.referrals (status);

-- 3. Новый тип уведомления
alter table public.user_notifications drop constraint if exists user_notifications_kind_check;

alter table public.user_notifications add constraint user_notifications_kind_check
	check (
		kind in (
			'whitelist_submitted',
			'whitelist_approved',
			'whitelist_rejected',
			'whitelist_admin_message',
			'admin_new_application',
			'referral_friend_approved'
		)
	);

-- 4. Нормализация ника
create or replace function public.normalize_mc_nick(p_nick text)
returns text
language sql
immutable
as $$
	select lower(trim(coalesce(p_nick, '')));
$$;

-- 5. Привязка реферала при подаче заявки
create or replace function public.link_referral_on_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
	ref_nick text;
	ref_uid uuid;
	ref_profile_nick text;
begin
	ref_nick := public.normalize_mc_nick(new.referred_by_nick);
	if ref_nick = '' or length(ref_nick) < 3 then
		return new;
	end if;

	if ref_nick = public.normalize_mc_nick(new.minecraft_nick) then
		return new;
	end if;

	select p.id, public.normalize_mc_nick(p.minecraft_nick)
	into ref_uid, ref_profile_nick
	from public.profiles p
	where public.normalize_mc_nick(p.minecraft_nick) = ref_nick
	limit 1;

	insert into public.referrals (
		referrer_user_id,
		referrer_nick,
		referred_user_id,
		referred_nick,
		application_id,
		status,
		admin_note
	)
	values (
		ref_uid,
		coalesce(
			(select minecraft_nick from public.profiles where id = ref_uid),
			trim(new.referred_by_nick)
		),
		new.user_id,
		new.minecraft_nick,
		new.id,
		case
			when ref_uid is null then 'rejected'
			when ref_uid = new.user_id then 'rejected'
			else 'pending'
		end,
		case
			when ref_uid is null then 'Пригласивший с таким ником не найден на сайте'
			else null
		end
	)
	on conflict (referred_user_id) do nothing;

	return new;
end;
$$;

drop trigger if exists whitelist_applications_link_referral on public.whitelist_applications;
create trigger whitelist_applications_link_referral
	after insert on public.whitelist_applications
	for each row execute function public.link_referral_on_application();

-- 6. Уведомление пригласившему при одобрении друга
create or replace function public.notify_referrer_on_approval(p_application_id uuid, p_referred_nick text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	rec public.referrals%rowtype;
begin
	update public.referrals r
	set
		status = 'qualified',
		updated_at = now()
	where r.application_id = p_application_id
		and r.status = 'pending'
		and r.referrer_user_id is not null
	returning r.* into rec;

	if not found then
		return;
	end if;

	perform public.try_insert_user_notification(
		rec.referrer_user_id,
		'referral_friend_approved',
		'Друг одобрен в вайтлист',
		'Игрок «' || coalesce(p_referred_nick, rec.referred_nick, '?') ||
			'» прошёл вайтлист. Награда — по правилам рефералки (кабинет → Пригласи друга).',
		'/account.html#referral',
		p_application_id
	);
end;
$$;

-- Обновить триггер одобрения заявки
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
			perform public.notify_referrer_on_approval(new.id, new.minecraft_nick);
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
			update public.referrals
			set status = 'rejected', updated_at = now()
			where application_id = new.id and status = 'pending';
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

-- 7. Сводка для кабинета
create or replace function public.get_my_referral_summary()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
	uid uuid := auth.uid();
	my_nick text;
	pending_n int;
	qualified_n int;
	rewarded_n int;
begin
	if uid is null then
		return json_build_object('ok', false);
	end if;

	select nullif(trim(minecraft_nick), '')
	into my_nick
	from public.profiles
	where id = uid;

	select
		count(*) filter (where status = 'pending'),
		count(*) filter (where status = 'qualified'),
		count(*) filter (where status = 'rewarded')
	into pending_n, qualified_n, rewarded_n
	from public.referrals
	where referrer_user_id = uid;

	return json_build_object(
		'ok', true,
		'minecraft_nick', my_nick,
		'pending', coalesce(pending_n, 0),
		'qualified', coalesce(qualified_n, 0),
		'rewarded', coalesce(rewarded_n, 0),
		'total', coalesce(pending_n, 0) + coalesce(qualified_n, 0) + coalesce(rewarded_n, 0)
	);
end;
$$;

grant execute on function public.get_my_referral_summary() to authenticated;

-- 8. RLS
alter table public.referrals enable row level security;

drop policy if exists "referrals_select_own" on public.referrals;
create policy "referrals_select_own"
	on public.referrals for select
	using (auth.uid() = referrer_user_id or auth.uid() = referred_user_id);

drop policy if exists "referrals_select_admin" on public.referrals;
create policy "referrals_select_admin"
	on public.referrals for select
	using (public.is_admin());

grant select on table public.referrals to authenticated;

-- Админ: отметить награду выданной
create or replace function public.admin_mark_referral_rewarded(p_referral_id uuid)
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
	where id = p_referral_id
		and status in ('qualified', 'pending');
end;
$$;

grant execute on function public.admin_mark_referral_rewarded(uuid) to authenticated;

-- Кнопка в админке по id заявки (см. также supabase-referral-admin-reward.sql)
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
