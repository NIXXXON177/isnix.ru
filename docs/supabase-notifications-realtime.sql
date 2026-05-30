-- Realtime для уведомлений в колокольчике (без клика по нему)
-- Supabase → SQL Editor → Run после docs/supabase-notifications.sql

alter table public.user_notifications replica identity full;

do $$
begin
	alter publication supabase_realtime add table public.user_notifications;
exception
	when duplicate_object then null;
end $$;
