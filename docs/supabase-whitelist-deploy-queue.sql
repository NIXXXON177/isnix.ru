-- Очередь добавления ника в whitelist.json на сервере (обрабатывает GitHub Actions)
-- Supabase → SQL Editor → Run

create table if not exists public.whitelist_deploy_queue (
	id uuid primary key default gen_random_uuid(),
	minecraft_nick text not null,
	application_id uuid references public.whitelist_applications on delete set null,
	status text not null default 'pending'
		check (status in ('pending', 'processing', 'done', 'failed')),
	error_message text,
	requested_by uuid references auth.users on delete set null,
	created_at timestamptz not null default now(),
	updated_at timestamptz not null default now()
);

create index if not exists whitelist_deploy_queue_status_idx
	on public.whitelist_deploy_queue (status, created_at);

create unique index if not exists whitelist_deploy_queue_one_pending_per_nick
	on public.whitelist_deploy_queue (lower(trim(minecraft_nick)))
	where status in ('pending', 'processing');

alter table public.whitelist_deploy_queue enable row level security;

-- GitHub Actions (service_role / secret key) обходит RLS; явные права на всякий случай
grant select, update on table public.whitelist_deploy_queue to service_role;

drop policy if exists "deploy_queue_select_admin" on public.whitelist_deploy_queue;
create policy "deploy_queue_select_admin"
	on public.whitelist_deploy_queue for select
	using (public.is_admin());

create or replace function public.enqueue_whitelist_deploy(
	p_nick text,
	p_application_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
	v_nick text := left(trim(coalesce(p_nick, '')), 16);
	v_id uuid;
begin
	if length(v_nick) < 3 then
		raise exception 'invalid_nick';
	end if;

	select q.id into v_id
	from public.whitelist_deploy_queue q
	where lower(trim(q.minecraft_nick)) = lower(v_nick)
		and q.status in ('pending', 'processing')
	limit 1;

	if v_id is not null then
		return v_id;
	end if;

	insert into public.whitelist_deploy_queue (minecraft_nick, application_id, requested_by)
	values (v_nick, p_application_id, auth.uid())
	returning id into v_id;

	return v_id;
end;
$$;

grant execute on function public.enqueue_whitelist_deploy(text, uuid) to authenticated;

create or replace function public.on_whitelist_application_approved()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	if new.status = 'approved' and old.status is distinct from new.status then
		perform public.enqueue_whitelist_deploy(new.minecraft_nick, new.id);
	end if;
	return new;
end;
$$;

drop trigger if exists whitelist_applications_enqueue_deploy on public.whitelist_applications;
create trigger whitelist_applications_enqueue_deploy
	after update on public.whitelist_applications
	for each row execute function public.on_whitelist_application_approved();

drop trigger if exists whitelist_deploy_queue_updated_at on public.whitelist_deploy_queue;
create trigger whitelist_deploy_queue_updated_at
	before update on public.whitelist_deploy_queue
	for each row execute function public.set_updated_at();
