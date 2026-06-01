-- Префикс LuckPerms и роль на сервере (синхронизация с isnix-player-stats)
-- Supabase → SQL Editor → Run

alter table public.profiles
	add column if not exists minecraft_prefix text,
	add column if not exists server_is_admin boolean not null default false;

comment on column public.profiles.minecraft_prefix is
	'Префикс LuckPerms (plain), обновляется модом при входе на сервер';
comment on column public.profiles.server_is_admin is
	'Группа admin в LuckPerms на сервере';

create or replace function public.server_sync_player_meta(
	p_nick text,
	p_prefix text default null,
	p_is_admin boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	v_nick text := trim(coalesce(p_nick, ''));
	v_prefix text := nullif(trim(coalesce(p_prefix, '')), '');
begin
	if length(v_nick) < 1 then
		return;
	end if;
	update public.profiles
	set
		minecraft_prefix = v_prefix,
		server_is_admin = coalesce(p_is_admin, false),
		updated_at = now()
	where minecraft_nick is not null
		and lower(minecraft_nick) = lower(v_nick);
end;
$$;

revoke all on function public.server_sync_player_meta(text, text, boolean) from public;
grant execute on function public.server_sync_player_meta(text, text, boolean) to service_role;
