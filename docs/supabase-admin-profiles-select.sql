-- Админы могут видеть список зарегистрированных аккаунтов
-- SQL Editor → Run

drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin"
	on public.profiles for select
	using (public.is_admin());
