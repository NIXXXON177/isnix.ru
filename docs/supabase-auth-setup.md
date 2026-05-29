# Аккаунты и заявки в вайтлист (Supabase)

Сайт на GitHub Pages — серверной части нет. Регистрация, вход и заявки работают через **[Supabase](https://supabase.com)** (бесплатный тариф).

## 1. Создай проект Supabase

1. [supabase.com](https://supabase.com) → New project.
2. Запомни **Project URL** и **anon public key** (Settings → API).

## 2. База данных

В **SQL Editor** выполни скрипт **[supabase-schema.sql](supabase-schema.sql)**.

Если ошибка `permission denied for table profiles` — **[supabase-grants-fix.sql](supabase-grants-fix.sql)**.

Если у всех в таблице `profiles` роль **admin** или игроки видят панель админа — выполни **[supabase-fix-admin-escalation.sql](supabase-fix-admin-escalation.sql)** (или полный **[supabase-fix-connection.sql](supabase-fix-connection.sql)** — там сброс ролей и `is_admin` только для четырёх email).

## 3. Auth (письма)

Authentication → Providers → **Email** — включён.

- Site URL: `https://isnix.ru`
- Redirect URLs: `https://isnix.ru/account.html`

При необходимости отключи подтверждение email (Authentication → Providers → Email → Confirm email) для тестов.

## 4. Ключи на сайте

Проект: **ISTHISNIXXXON** (`yfrlgeztbaebdapdnefy`)

**Settings → API Keys** → скопируй **publishable** key (`sb_publishable_...`).

### GitHub Pages (рекомендуется)

1. Репозиторий **NIXXXON177/isnix.ru** → **Settings → Secrets and variables → Actions** → **New repository secret**:
   - Name: `SUPABASE_ANON_KEY`
   - Value: publishable key из Supabase
2. **Settings → Pages** → **Build and deployment** → Source: **GitHub Actions**
3. **Actions → Deploy Pages → Run workflow** (или push в `main`)

Workflow подставит ключ в `auth-config.js` при деплое. В репозитории ключ не хранится.

Файл **`assets/js/auth-config.js`** в git — заглушка для локальной разработки (вставь ключ вручную при тесте offline).

## 5. Проверка

1. Открой `https://isnix.ru/account.html` (или локально Live Server).
2. Регистрация → вход → форма «Заявка в вайтлист».
3. Заявки смотри в Supabase → Table Editor → `whitelist_applications`.
4. Диалог админ ↔ игрок по заявке: выполни **[supabase-whitelist-dialog.sql](supabase-whitelist-dialog.sql)**.
5. Статистика игрока в кабинете: **[supabase-player-stats.sql](supabase-player-stats.sql)** (таблица `player_stats`).
6. Устройство на сайте (телефон / ПК): **[supabase-site-presence.sql](supabase-site-presence.sql)**.

**На сайте** сразу видно «На сайте» (дата регистрации из `profiles.created_at`). Поля «Всего в игре» и точная «Текущая сессия» заполняются с **игрового сервера** (пока нет — в кабинете «—», сессия приблизительно, пока открыта страница и ник в онлайне API).

Запись в `player_stats` — мод **[isnix-player-stats-mod.md](isnix-player-stats-mod.md)** на сервере Fabric: `config/isnix-player-stats.json` с ключом **service_role** (не в браузере и не в git).

## 6. Администраторы сайта

Если база уже была без роли — **[supabase-admin-migration.sql](supabase-admin-migration.sql)**.

Выдать admin четырём администраторам — **[supabase-grant-admins.sql](supabase-grant-admins.sql)** (включая `nikenerdx@gmail.com`; отключает триггер на время update). Только для Niken — **[supabase-grant-admin-nikener.sql](supabase-grant-admin-nikener.sql)**.

Расширенная заявка (возраст 12+, правила, сборка) — **[supabase-whitelist-form-v2.sql](supabase-whitelist-form-v2.sql)**.

Уведомления в кабинете (заявка, одобрение, сообщение админа) — **[supabase-notifications.sql](supabase-notifications.sql)**.

Или вручную:

```sql
alter table public.profiles disable trigger profiles_protect_role;
update public.profiles set role = 'admin' where email = 'you@example.com';
alter table public.profiles enable trigger profiles_protect_role;
```

Админ в кабинете видит **Панель администрации**:

- **Заявки** — одобрение / отклонение вайтлиста
- **На сервере** — кто сейчас на `mc.isnix.ru` (API mcsrvstat, обновление раз в минуту)
- **Аккаунты** — все зарегистрированные профили (нужна политика ниже)

В меню сайта кнопка **Админ** (красная). Обычные игроки — профиль со статистикой (время на сайте, в игре, текущая сессия), статусом вайтлиста и онлайна на сервере, смена пароля и свои заявки.

Чтобы вкладка **Аккаунты** работала, один раз выполни в SQL Editor:

**[supabase-admin-profiles-select.sql](supabase-admin-profiles-select.sql)** (или полный **[supabase-schema.sql](supabase-schema.sql)** для новой установки).

Роль `admin` нельзя выдать себе из браузера — только через SQL или Table Editor в Supabase.

## 7. Модерация заявок

**На сайте** (аккаунт с `role = admin`) или в **Supabase Dashboard** → `whitelist_applications`.

После одобрения добавь ник на сервер вручную (whitelist.json / панель Play2GO).

Автоматическая запись в `whitelist.json` — отдельная задача (webhook / GitHub Action).

## 8. GitHub Pages

Workflow **`.github/workflows/deploy-pages.yml`** — деплой с подстановкой `SUPABASE_ANON_KEY` из секретов репозитория.

Либо вставь anon key прямо в `assets/js/auth-config.js` и запушь в `main`.
