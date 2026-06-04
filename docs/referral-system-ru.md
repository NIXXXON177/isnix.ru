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

Награда для игроков (в постах и Shorts): префикс **`[Реферал]`** на **14 дней** (таб и чат); по желанию админа — лайк `/rep`. **Без** предметов и OP. Выдача вручную после уведомления (обычно в течение суток).

## Ошибка `referred_by_nick does not exist`

Колонка ещё не создана в Supabase. Быстрый фикс: **[supabase-referral-column-only.sql](supabase-referral-column-only.sql)**. Для полной рефералки — **[supabase-referral-system.sql](supabase-referral-system.sql)**.

## Ошибка `user_notifications_kind_check` (23514)

В БД уже стоят типы уведомлений **обращений** (`support_*` из `supabase-support-tickets.sql`). Старый скрипт рефералки их не включал.

1. Выполни **[supabase-referral-fix-notification-kinds.sql](supabase-referral-fix-notification-kinds.sql)** → **Run**.
2. Затем в том же редакторе — **остаток** **[supabase-referral-system.sql](supabase-referral-system.sql)** с **§4** (строка `normalize_mc_nick`) до конца файла. §1–§2 можно пропустить — они уже применились.

Или заново весь обновлённый **supabase-referral-system.sql** целиком (безопасно: `if not exists`).

## Ошибка `get_my_referral_summary` → 404 в консоли

Функция RPC **ещё не создана** в Supabase (или не обновился schema cache PostgREST).

1. [Supabase Dashboard](https://supabase.com/dashboard) → проект **yfrlgeztbaebdapdnefy** → **SQL Editor**.
2. Вставить и выполнить весь файл **[supabase-referral-system.sql](supabase-referral-system.sql)** → **Run**.
3. Затем **[supabase-referral-admin-reward.sql](supabase-referral-admin-reward.sql)** (кнопка «Награда выдана» в админке).
4. **Settings → API** → внизу **Reload schema** (если есть) или подождать 1–2 мин.
5. Проверка:

```sql
select public.get_my_referral_summary();
-- или
select proname from pg_proc where proname = 'get_my_referral_summary';
```

6. Обновить **account.html** (Ctrl+F5). Если счётчик не появился — в консоли браузера: `localStorage.removeItem('isnix_referral_rpc_missing')` и перезагрузка.

После SQL в кабинете появится строка «Одобрено друзей: …»; 404 в Network исчезнет.

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
