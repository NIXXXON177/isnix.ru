-- Добавить роль администратора (если база уже создана по старому supabase-schema.sql)
-- SQL Editor → Run

alter table public.profiles
	add column if not exists role text not null default 'player';

alter table public.profiles
	drop constraint if exists profiles_role_check;

alter table public.profiles
	add constraint profiles_role_check check (role in ('player', 'admin'));

alter table public.whitelist_applications
	add column if not exists applicant_email text;

-- Email заявителя при отправке
create or replace function public.sync_application_applicant()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	select email into new.applicant_email
	from public.profiles
	where id = new.user_id;
	return new;
end;
$$;

drop trigger if exists whitelist_applications_set_applicant on public.whitelist_applications;
create trigger whitelist_applications_set_applicant
	before insert on public.whitelist_applications
	for each row execute function public.sync_application_applicant();

-- Проверка админа для RLS
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

-- Нельзя самому выдать role = admin
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	if new.role is distinct from old.role and not public.is_admin() then
		new.role := old.role;
	end if;
	return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
	before update on public.profiles
	for each row execute function public.protect_profile_role();

-- RLS: админы видят и модерируют все заявки
drop policy if exists "applications_select_admin" on public.whitelist_applications;
create policy "applications_select_admin"
	on public.whitelist_applications for select
	using (public.is_admin());

drop policy if exists "applications_update_admin" on public.whitelist_applications;
create policy "applications_update_admin"
	on public.whitelist_applications for update
	using (public.is_admin());

-- Выдать админа (подставь email):
-- update public.profiles set role = 'admin' where email = 'you@example.com';
