-- Расширенная заявка в вайтлист (возраст 12+, правила, сборка, «о себе»)
-- Supabase → SQL Editor → Run (после основной схемы)

alter table public.whitelist_applications
	add column if not exists read_rules boolean not null default false,
	add column if not exists downloaded_modpack boolean not null default false,
	add column if not exists referral_source text;

comment on column public.whitelist_applications.reason is 'О себе (обязательно при подаче)';
comment on column public.whitelist_applications.age is 'Возраст (число, от 12)';
comment on column public.whitelist_applications.referral_source is 'Откуда узнали о сервере (необязательно)';
