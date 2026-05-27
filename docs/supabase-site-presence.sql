-- Присутствие на сайте: устройство (телефон / ПК) и время последней активности
-- Supabase → SQL Editor → Run

alter table public.profiles
	add column if not exists site_last_seen_at timestamptz,
	add column if not exists site_device text check (
		site_device is null or site_device in ('mobile', 'desktop', 'tablet')
	);

create index if not exists profiles_site_last_seen_idx
	on public.profiles (site_last_seen_at desc nulls last)
	where site_last_seen_at is not null;

create or replace function public.site_presence_heartbeat(p_device text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	v_device text := lower(trim(coalesce(p_device, '')));
begin
	if auth.uid() is null then
		return;
	end if;
	if v_device not in ('mobile', 'desktop', 'tablet') then
		v_device := 'desktop';
	end if;
	update public.profiles
	set
		site_last_seen_at = now(),
		site_device = v_device,
		updated_at = now()
	where id = auth.uid();
end;
$$;

revoke all on function public.site_presence_heartbeat(text) from public;
grant execute on function public.site_presence_heartbeat(text) to authenticated;
