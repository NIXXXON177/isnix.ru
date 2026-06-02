-- Минимум для ошибки: column whitelist_applications.referred_by_nick does not exist
-- Supabase → SQL Editor → Run
-- Полная рефералка (таблица referrals, триггеры, RPC): docs/supabase-referral-system.sql

alter table public.whitelist_applications
	add column if not exists referred_by_nick text;

comment on column public.whitelist_applications.referred_by_nick is
	'Ник пригласившего игрока (Minecraft), необязательно';
