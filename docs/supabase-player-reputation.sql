-- Социальный рейтинг игроков (лайки / дизы) — MVP для isnix-reputation + кабинет isnix.ru
-- Supabase → SQL Editor → Run (после profiles и set_updated_at из supabase-schema.sql)

-- ---------------------------------------------------------------------------
-- Голоса (один голос «от → кому», можно сменить раз в N дней)
-- ---------------------------------------------------------------------------
create table if not exists public.player_reputation_votes (
	id uuid primary key default gen_random_uuid(),
	from_user_id uuid not null references public.profiles (id) on delete cascade,
	to_user_id uuid not null references public.profiles (id) on delete cascade,
	vote smallint not null check (vote in (1, -1)),
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now(),
	check (from_user_id <> to_user_id),
	unique (from_user_id, to_user_id)
);

create index if not exists player_reputation_votes_to_user_idx
	on public.player_reputation_votes (to_user_id);

create index if not exists player_reputation_votes_from_user_idx
	on public.player_reputation_votes (from_user_id);

drop trigger if exists player_reputation_votes_updated_at on public.player_reputation_votes;
create trigger player_reputation_votes_updated_at
	before update on public.player_reputation_votes
	for each row execute function public.set_updated_at();

-- Публичная сводка (для сайта и REST)
create or replace view public.player_reputation_public as
select
	p.id as user_id,
	p.minecraft_nick,
	coalesce(sum(v.vote) filter (where v.vote = 1), 0)::bigint as likes,
	coalesce(sum(v.vote) filter (where v.vote = -1), 0)::bigint as dislikes,
	coalesce(sum(v.vote), 0)::bigint as score
from public.profiles p
left join public.player_reputation_votes v on v.to_user_id = p.id
where p.minecraft_nick is not null and length(trim(p.minecraft_nick)) > 0
group by p.id, p.minecraft_nick;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.player_reputation_votes enable row level security;

drop policy if exists "rep_votes_select_own" on public.player_reputation_votes;
create policy "rep_votes_select_own"
	on public.player_reputation_votes for select
	using (auth.uid() = from_user_id or public.is_admin());

drop policy if exists "rep_votes_select_admin" on public.player_reputation_votes;
-- (own + admin покрыто выше)

grant select on public.player_reputation_public to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Внутренняя логика голосования
-- ---------------------------------------------------------------------------
create or replace function public._rep_resolve_user_id(p_nick text)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
	select id
	from public.profiles
	where minecraft_nick is not null
		and lower(trim(minecraft_nick)) = lower(trim(coalesce(p_nick, '')))
	limit 1;
$$;

create or replace function public._rep_cast_vote_internal(
	p_from_user_id uuid,
	p_target_nick text,
	p_vote smallint,
	p_cooldown_days int default 7
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_target_id uuid;
	v_existing public.player_reputation_votes%rowtype;
	v_cooldown interval := make_interval(days => greatest(p_cooldown_days, 1));
begin
	if p_from_user_id is null then
		return jsonb_build_object('ok', false, 'error', 'not_authenticated');
	end if;

	if p_vote is null or p_vote not in (1, -1) then
		return jsonb_build_object('ok', false, 'error', 'invalid_vote');
	end if;

	v_target_id := public._rep_resolve_user_id(p_target_nick);
	if v_target_id is null then
		return jsonb_build_object('ok', false, 'error', 'target_not_found');
	end if;

	if v_target_id = p_from_user_id then
		return jsonb_build_object('ok', false, 'error', 'self_vote');
	end if;

	select * into v_existing
	from public.player_reputation_votes
	where from_user_id = p_from_user_id and to_user_id = v_target_id;

	if found then
		if v_existing.vote = p_vote then
			return jsonb_build_object('ok', false, 'error', 'already_voted');
		end if;
		if v_existing.updated_at > now() - v_cooldown then
			return jsonb_build_object(
				'ok', false,
				'error', 'cooldown',
				'retry_after', v_existing.updated_at + v_cooldown
			);
		end if;
		update public.player_reputation_votes
		set vote = p_vote, updated_at = now()
		where id = v_existing.id;
	else
		insert into public.player_reputation_votes (from_user_id, to_user_id, vote)
		values (p_from_user_id, v_target_id, p_vote);
	end if;

	return jsonb_build_object('ok', true, 'target_nick', trim(p_target_nick), 'vote', p_vote);
end;
$$;

-- Сайт: авторизованный пользователь (auth.uid())
create or replace function public.rep_cast_vote(p_target_nick text, p_vote smallint)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
	return public._rep_cast_vote_internal(auth.uid(), p_target_nick, p_vote, 7);
end;
$$;

revoke all on function public.rep_cast_vote(text, smallint) from public;
grant execute on function public.rep_cast_vote(text, smallint) to authenticated;

-- Сервер (мод): оба ника должны быть в profiles
create or replace function public.server_rep_vote(
	p_voter_nick text,
	p_target_nick text,
	p_vote smallint
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
	v_voter_id uuid;
begin
	v_voter_id := public._rep_resolve_user_id(p_voter_nick);
	if v_voter_id is null then
		return jsonb_build_object(
			'ok', false,
			'error', 'voter_not_linked',
			'message', 'Привяжите Minecraft-ник в кабинете isnix.ru'
		);
	end if;
	return public._rep_cast_vote_internal(v_voter_id, p_target_nick, p_vote, 7);
end;
$$;

revoke all on function public.server_rep_vote(text, text, smallint) from public;
grant execute on function public.server_rep_vote(text, text, smallint) to service_role;

-- Один ник → сводка (мод / сайт)
create or replace function public.server_get_reputation(p_nick text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
	v_row record;
begin
	select likes, dislikes, score, minecraft_nick
	into v_row
	from public.player_reputation_public
	where lower(minecraft_nick) = lower(trim(coalesce(p_nick, '')))
	limit 1;

	if not found then
		return jsonb_build_object(
			'ok', true,
			'nick', trim(p_nick),
			'likes', 0,
			'dislikes', 0,
			'score', 0
		);
	end if;

	return jsonb_build_object(
		'ok', true,
		'nick', v_row.minecraft_nick,
		'likes', v_row.likes,
		'dislikes', v_row.dislikes,
		'score', v_row.score
	);
end;
$$;

revoke all on function public.server_get_reputation(text) from public;
grant execute on function public.server_get_reputation(text) to service_role, authenticated, anon;

-- Пакетное чтение для онлайна (мод)
create or replace function public.server_get_reputations(p_nicks text[])
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
	v_result jsonb := '[]'::jsonb;
	v_nick text;
	v_row record;
begin
	if p_nicks is null then
		return jsonb_build_object('ok', true, 'players', v_result);
	end if;

	foreach v_nick in array p_nicks loop
		select likes, dislikes, score, minecraft_nick
		into v_row
		from public.player_reputation_public
		where lower(minecraft_nick) = lower(trim(v_nick))
		limit 1;

		if found then
			v_result := v_result || jsonb_build_array(jsonb_build_object(
				'nick', v_row.minecraft_nick,
				'likes', v_row.likes,
				'dislikes', v_row.dislikes,
				'score', v_row.score
			));
		else
			v_result := v_result || jsonb_build_array(jsonb_build_object(
				'nick', trim(v_nick),
				'likes', 0,
				'dislikes', 0,
				'score', 0
			));
		end if;
	end loop;

	return jsonb_build_object('ok', true, 'players', v_result);
end;
$$;

revoke all on function public.server_get_reputations(text[]) from public;
grant execute on function public.server_get_reputations(text[]) to service_role;

-- ---------------------------------------------------------------------------
-- Примеры
-- ---------------------------------------------------------------------------
-- select public.server_get_reputation('NikenER999');
-- select public.rep_cast_vote('SomeNick', 1);  -- из браузера под auth
-- select public.server_rep_vote('VoterNick', 'TargetNick', 1);  -- service_role
