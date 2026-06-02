# Реферальная система ISTHISNIXXXON

Приведи друга на сервер — получи отметку в кабинете и уведомление, когда его **одобрят в вайтлист**.

## Для игроков

1. В кабинете **isnix.ru** → блок **«Пригласи друга»** — ссылка вида `isnix.ru/account.html?ref=ТвойНик`.
2. Друг подаёт заявку и указывает **твой ник Minecraft** (или ссылка подставит сама).
3. После **одобрения** заявки тебе приходит уведомление в колокольчик.
4. Награда (префикс, репутация) — **вручную** админом по правилам ниже.

Поле **«Откуда узнали»** — отдельно (YouTube, ВК). Реферал — только **ник пригласившего**.

## Правила

- Нельзя указать **свой** ник.
- Пригласивший должен быть **зарегистрирован на сайте** с тем же ником в профиле.
- Один аккаунт = один реферал (повторная заявка с другого аккаунта не засчитывается).
- Накрутка альтами → отклонение реферала, возможен бан.

## Награды (вручную, админ)

| Событие | Действие админа |
|---------|------------------|
| Друг одобрен | Уведомление пригласившему автоматически |
| Награда выдана | В админке → Заявки → **«Награда выдана»** (после SQL `supabase-referral-admin-reward.sql`) |

Рекомендуемые награды: косметический префикс на 14–30 дней, лайк `/rep` — **без** предметов и OP.

## Ошибка `referred_by_nick does not exist`

Колонка ещё не создана в Supabase. Быстрый фикс: **[supabase-referral-column-only.sql](supabase-referral-column-only.sql)**. Для полной рефералки — **[supabase-referral-system.sql](supabase-referral-system.sql)**.

## Установка (один раз)

1. Supabase → SQL Editor → выполнить **[supabase-referral-system.sql](supabase-referral-system.sql)** (или только column-only, если нужна лишь колонка).
2. Затем **[supabase-referral-admin-reward.sql](supabase-referral-admin-reward.sql)** (кнопка в админке).
3. Deploy Pages (сайт с полем и блоком рефералки).
3. В админке при модерации смотреть строку **«пригласил: Ник»**.

## Проверка

```sql
select * from public.referrals order by created_at desc limit 10;
select referred_by_nick, minecraft_nick, status from public.whitelist_applications order by created_at desc limit 5;
```

## Связанные файлы

- [supabase-referral-system.sql](supabase-referral-system.sql)
- [supabase-referral-column-only.sql](supabase-referral-column-only.sql)
- `account.html` — форма и блок «Пригласи друга»
- `assets/js/auth.js` — отправка заявки, `get_my_referral_summary`
