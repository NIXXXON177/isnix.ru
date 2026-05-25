# Аккаунты и заявки в вайтлист (Supabase)

Сайт на GitHub Pages — серверной части нет. Регистрация, вход и заявки работают через **[Supabase](https://supabase.com)** (бесплатный тариф).

## 1. Создай проект Supabase

1. [supabase.com](https://supabase.com) → New project.
2. Запомни **Project URL** и **anon public key** (Settings → API).

## 2. База данных

В **SQL Editor** выполни скрипт **[supabase-schema.sql](supabase-schema.sql)**.

## 3. Auth (письма)

Authentication → Providers → **Email** — включён.

- Site URL: `https://isnix.ru`
- Redirect URLs: `https://isnix.ru/account.html`

При необходимости отключи подтверждение email (Authentication → Providers → Email → Confirm email) для тестов.

## 4. Ключи на сайте

Проект: **ISTHISNIXXXON** (`yfrlgeztbaebdapdnefy`)

**Settings → API Keys** → скопируй **anon** / **publishable** key (`eyJ...`).

Файл **`assets/js/auth-config.js`** (URL уже подставлен):

```javascript
window.ISNIX_AUTH = {
	enabled: true,
	supabaseUrl: 'https://yfrlgeztbaebdapdnefy.supabase.co',
	supabaseAnonKey: 'eyJ...', // вставь anon key
}
```

Anon key виден в браузере — это нормально при включённом RLS.

### GitHub Pages (рекомендуется)

1. Репозиторий **NIXXXON177/isnix.ru** → **Settings → Secrets and variables → Actions** → **New repository secret**:
   - Name: `SUPABASE_ANON_KEY`
   - Value: anon key из Supabase
2. **Settings → Pages** → **Build and deployment** → Source: **GitHub Actions**
3. Push в `main` — workflow **Deploy Pages** подставит ключ и опубликует сайт.

Без секрета можно вручную вставить ключ в `auth-config.js` и пушнуть в `main`.

## 5. Проверка

1. Открой `https://isnix.ru/account.html` (или локально Live Server).
2. Регистрация → вход → форма «Заявка в вайтлист».
3. Заявки смотри в Supabase → Table Editor → `whitelist_applications`.

## 6. Администраторы сайта

Если база уже была без роли — **[supabase-admin-migration.sql](supabase-admin-migration.sql)**.

Выдать admin трём администраторам — **[supabase-grant-admins.sql](supabase-grant-admins.sql)** (отключает триггер на время update).

Или вручную:

```sql
alter table public.profiles disable trigger profiles_protect_role;
update public.profiles set role = 'admin' where email = 'you@example.com';
alter table public.profiles enable trigger profiles_protect_role;
```

Админ в кабинете видит **Панель администрации**: заявки, кнопки «Одобрить» / «Отклонить».  
В меню сайта кнопка **Админ** (красная). Обычные игроки — только свой профиль и заявки.

Роль `admin` нельзя выдать себе из браузера — только через SQL или Table Editor в Supabase.

## 7. Модерация заявок

**На сайте** (аккаунт с `role = admin`) или в **Supabase Dashboard** → `whitelist_applications`.

После одобрения добавь ник на сервер вручную (whitelist.json / панель Play2GO).

Автоматическая запись в `whitelist.json` — отдельная задача (webhook / GitHub Action).

## 8. GitHub Pages

Workflow **`.github/workflows/deploy-pages.yml`** — деплой с подстановкой `SUPABASE_ANON_KEY` из секретов репозитория.

Либо вставь anon key прямо в `assets/js/auth-config.js` и запушь в `main`.
