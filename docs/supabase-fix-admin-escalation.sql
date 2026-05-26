-- Исправление: обычный игрок не должен получать admin при регистрации
-- SQL Editor → Run

-- 1. При создании профиля — всегда player (admin только через SQL с отключённым триггером)
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

-- 2. is_admin — только три разрешённых email
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
			and p.email in (
				'kupryuhinsemen@gmail.com',
				'kudrasovn024@gmail.com',
				'1511vasilisa@gmail.com'
			)
	);
$$;

-- 3. Забрать admin у всех остальных
alter table public.profiles disable trigger profiles_protect_role;

update public.profiles
set role = 'player'
where email is null
   or email not in (
		'kupryuhinsemen@gmail.com',
		'kudrasovn024@gmail.com',
		'1511vasilisa@gmail.com'
	);

alter table public.profiles enable trigger profiles_protect_role;

-- 4. Проверка
select email, role, created_at
from public.profiles
order by created_at;

select email, role
from public.profiles
where role = 'admin';
