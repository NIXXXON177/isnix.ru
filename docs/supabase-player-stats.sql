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

-- Пример для теста (подставь user_id из profiles):
-- insert into public.player_stats (user_id, minecraft_nick, total_play_seconds, session_started_at)
-- values ('00000000-0000-0000-0000-000000000000', 'ISTHISNIXXXON', 7200, now())
-- on conflict (user_id) do update set
--   total_play_seconds = excluded.total_play_seconds,
--   session_started_at = excluded.session_started_at,
--   minecraft_nick = excluded.minecraft_nick,
--   updated_at = now();
