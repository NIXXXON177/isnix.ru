-- ISTHISNIXXXON — аккаунты и заявки в вайтлист (Supabase)
-- SQL Editor → New query → Run

-- Профили (создаётся при регистрации)
create table if not exists public.profiles (
	id uuid references auth.users on delete cascade primary key,
	email text,
	minecraft_nick text,
	display_name text,
	role text not null default 'player' check (role in ('player', 'admin')),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

-- Заявки в вайтлист
create table if not exists public.whitelist_applications (
	id uuid primary key default gen_random_uuid(),
	user_id uuid references auth.users on delete cascade not null,
	applicant_email text,
	minecraft_nick text not null,
	call_name text,
	age text,
	reason text not null,
	status text not null default 'pending'
		check (status in ('pending', 'approved', 'rejected')),
	admin_note text,
	applicant_reply text,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists whitelist_applications_user_id_idx
	on public.whitelist_applications (user_id);

create index if not exists whitelist_applications_status_idx
	on public.whitelist_applications (status);

-- Автопрофиль при регистрации
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	insert into public.profiles (id, email)
	values (new.id, new.email);
	return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
	after insert on auth.users
	for each row execute function public.handle_new_user();

-- updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at
	before update on public.profiles
	for each row execute function public.set_updated_at();

drop trigger if exists whitelist_applications_updated_at on public.whitelist_applications;
create trigger whitelist_applications_updated_at
	before update on public.whitelist_applications
	for each row execute function public.set_updated_at();

-- RLS
alter table public.profiles enable row level security;
alter table public.whitelist_applications enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
	on public.profiles for select
	using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
	on public.profiles for update
	using (auth.uid() = id);

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
	on public.profiles for select
	using (public.is_admin());

drop policy if exists "applications_select_own" on public.whitelist_applications;
create policy "applications_select_own"
	on public.whitelist_applications for select
	using (auth.uid() = user_id);

drop policy if exists "applications_insert_own" on public.whitelist_applications;
create policy "applications_insert_own"
	on public.whitelist_applications for insert
	with check (auth.uid() = user_id);

-- Администрация: просмотр и модерация всех заявок
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
	select exists (
		select 1
		from public.profiles p
		where p.id = auth.uid()
			and p.role = 'admin'
	);
$$;

drop policy if exists "applications_select_admin" on public.whitelist_applications;
create policy "applications_select_admin"
	on public.whitelist_applications for select
	using (public.is_admin());

drop policy if exists "applications_update_admin" on public.whitelist_applications;
create policy "applications_update_admin"
	on public.whitelist_applications for update
	using (public.is_admin());

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

create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	if TG_OP = 'INSERT' then
		new.role := 'player';
		return new;
	end if;

	if new.role is distinct from old.role and not public.is_admin() then
		new.role := old.role;
	end if;
	return new;
end;
$$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role
	before insert or update on public.profiles
	for each row execute function public.protect_profile_role();

-- Одна активная заявка (pending) на аккаунт
create unique index if not exists whitelist_applications_one_pending
	on public.whitelist_applications (user_id)
	where (status = 'pending');

-- Права для Supabase API (anon / authenticated)
-- Нужно, если при создании проекта отключено «Automatically expose new tables»
grant usage on schema public to anon, authenticated;

grant select, update on table public.profiles to authenticated;

grant select, insert, update on table public.whitelist_applications to authenticated;
