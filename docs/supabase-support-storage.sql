-- Вложения к обращениям: фото/видео в Supabase Storage
-- Supabase → SQL Editor → Run после docs/supabase-support-tickets.sql

create table if not exists public.support_attachments (
	id uuid primary key default gen_random_uuid(),
	ticket_id uuid not null references public.support_tickets on delete cascade,
	user_id uuid not null references auth.users on delete cascade,
	storage_path text not null,
	file_name text not null,
	mime_type text,
	size_bytes integer,
	created_at timestamptz not null default now()
);

create index if not exists support_attachments_ticket_id_idx
	on public.support_attachments (ticket_id, created_at asc);

alter table public.support_attachments enable row level security;

drop policy if exists "support_attachments_select" on public.support_attachments;
create policy "support_attachments_select"
	on public.support_attachments for select
	using (
		user_id = auth.uid()
		or public.is_admin()
		or exists (
			select 1 from public.support_tickets t
			where t.id = ticket_id and t.user_id = auth.uid()
		)
	);

grant select on table public.support_attachments to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
	'support-evidence',
	'support-evidence',
	false,
	26214400,
	array[
		'image/jpeg',
		'image/png',
		'image/webp',
		'image/gif',
		'video/mp4',
		'video/webm',
		'video/quicktime'
	]
)
on conflict (id) do update set
	file_size_limit = excluded.file_size_limit,
	allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "support_evidence_insert" on storage.objects;
create policy "support_evidence_insert"
	on storage.objects for insert
	to authenticated
	with check (
		bucket_id = 'support-evidence'
		and (storage.foldername(name))[1] = auth.uid()::text
	);

drop policy if exists "support_evidence_select" on storage.objects;
create policy "support_evidence_select"
	on storage.objects for select
	to authenticated
	using (
		bucket_id = 'support-evidence'
		and (
			(storage.foldername(name))[1] = auth.uid()::text
			or public.is_admin()
		)
	);

create or replace function public.register_support_attachment(
	p_ticket_id uuid,
	p_storage_path text,
	p_file_name text,
	p_mime_type text default null,
	p_size_bytes integer default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
	t public.support_tickets%rowtype;
	aid uuid;
begin
	if auth.uid() is null then
		raise exception 'not_authenticated';
	end if;

	select * into t from public.support_tickets where id = p_ticket_id;
	if not found then
		raise exception 'ticket_not_found';
	end if;

	if t.user_id <> auth.uid() then
		raise exception 'forbidden';
	end if;

	if split_part(p_storage_path, '/', 1) <> auth.uid()::text then
		raise exception 'invalid_storage_path';
	end if;

	insert into public.support_attachments (
		ticket_id,
		user_id,
		storage_path,
		file_name,
		mime_type,
		size_bytes
	)
	values (
		p_ticket_id,
		auth.uid(),
		p_storage_path,
		left(trim(coalesce(p_file_name, 'file')), 200),
		nullif(trim(coalesce(p_mime_type, '')), ''),
		p_size_bytes
	)
	returning id into aid;

	return aid;
end;
$$;

grant execute on function public.register_support_attachment(uuid, text, text, text, integer) to authenticated;
