-- Продолжение после ошибки 23514 на user_notifications_kind_check
-- (в БД уже есть kind из supabase-support-tickets.sql)
-- Supabase → SQL Editor → Run — затем выполни остаток supabase-referral-system.sql с §4

alter table public.user_notifications drop constraint if exists user_notifications_kind_check;

alter table public.user_notifications add constraint user_notifications_kind_check
	check (
		kind in (
			'whitelist_submitted',
			'whitelist_approved',
			'whitelist_rejected',
			'whitelist_admin_message',
			'admin_new_application',
			'support_ticket_created',
			'support_admin_reply',
			'support_user_reply',
			'admin_new_support_ticket',
			'referral_friend_approved'
		)
	);
