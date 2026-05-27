-- Статистика игрока: время на сайте (profiles.created_at) + время в Minecraft (эта таблица)
-- Supabase → SQL Editor → Run

create table if not exists public.player_stats (
	user_id uuid primary key references public.profiles (id) on delete cascade,
	minecraft_nick text,
	total_play_seconds bigint not null default 0 check (total_play_seconds >= 0),
	session_started_at timestamptz,
	updated_at timestamptz not null default now()
);

create index if not exists player_stats_minecraft_nick_idx
	on public.player_stats (lower(minecraft_nick));

drop trigger if exists player_stats_updated_at on public.player_stats;
create trigger player_stats_updated_at
	before update on public.player_stats
	for each row execute function public.set_updated_at();

alter table public.player_stats enable row level security;

drop policy if exists "player_stats_select_own" on public.player_stats;
create policy "player_stats_select_own"
	on public.player_stats for select
	using (auth.uid() = user_id);

drop policy if exists "player_stats_select_admin" on public.player_stats;
create policy "player_stats_select_admin"
	on public.player_stats for select
	using (public.is_admin());

grant select on table public.player_stats to authenticated;

-- RPC для серверного мода isnix-player-stats (service_role, не для браузера)
create or replace function public.server_record_player_join(p_nick text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user_id uuid;
	v_nick text := trim(coalesce(p_nick, ''));
begin
	if length(v_nick) < 1 then
		return;
	end if;
	select id into v_user_id
	from public.profiles
	where minecraft_nick is not null and lower(minecraft_nick) = lower(v_nick)
	limit 1;
	if v_user_id is null then
		return;
	end if;
	insert into public.player_stats (user_id, minecraft_nick, session_started_at, total_play_seconds)
	values (v_user_id, v_nick, now(), 0)
	on conflict (user_id) do update set
		minecraft_nick = excluded.minecraft_nick,
		session_started_at = now(),
		updated_at = now();
end;
$$;

create or replace function public.server_record_player_quit(p_nick text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
	v_user_id uuid;
	v_nick text := trim(coalesce(p_nick, ''));
	v_started timestamptz;
	v_add bigint;
begin
	if length(v_nick) < 1 then
		return;
	end if;
	select ps.user_id, ps.session_started_at into v_user_id, v_started
	from public.player_stats ps
	inner join public.profiles p on p.id = ps.user_id
	where lower(p.minecraft_nick) = lower(v_nick)
	limit 1;
	if v_user_id is null or v_started is null then
		return;
	end if;
	v_add := greatest(0, extract(epoch from (now() - v_started))::bigint);
	update public.player_stats
	set
		total_play_seconds = total_play_seconds + v_add,
		session_started_at = null,
		updated_at = now()
	where user_id = v_user_id;
end;
$$;

revoke all on function public.server_record_player_join(text) from public;
revoke all on function public.server_record_player_quit(text) from public;
grant execute on function public.server_record_player_join(text) to service_role;
grant execute on function public.server_record_player_quit(text) to service_role;

-- Пример для теста (подставь user_id из profiles):
-- insert into public.player_stats (user_id, minecraft_nick, total_play_seconds, session_started_at)
-- values ('00000000-0000-0000-0000-000000000000', 'ISTHISNIXXXON', 7200, now())
-- on conflict (user_id) do update set
--   total_play_seconds = excluded.total_play_seconds,
--   session_started_at = excluded.session_started_at,
--   minecraft_nick = excluded.minecraft_nick,
--   updated_at = now();
