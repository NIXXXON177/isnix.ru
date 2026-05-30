# Cloudflare Worker — прокси Supabase для isnix.ru

## Почему «Upload and deploy» не работает

Сообщение *«use wrangler deploy»* значит: **нельзя** залить один `.js` через drag-and-drop как статику.  
Worker — это **код**, его нужно создать через **редактор** в панели или через **Wrangler** (CLI).

---

## Способ 1 — через панель (без командной строки)

### Шаг 1. Создать Worker правильно

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Workers & Pages**
2. **Create** → **Create Worker** (не «Upload and deploy» и не Pages)
3. Имя, например: `isnix-supabase-proxy`
4. **Deploy** (с шаблоном Hello World — не страшно)

### Шаг 2. Вставить код

1. Открой созданный Worker → **Edit code** (или Quick edit)
2. **Удали всё** в редакторе
3. Скопируй целиком файл **`src/index.js`** из этого репозитория
4. **Save and Deploy** / **Deploy**

### Шаг 3. Поддомен api.isnix.ru

Домен **isnix.ru** должен быть на Cloudflare (NS делегированы).

**DNS** (в зоне isnix.ru):

| Тип | Имя | Содержимое | Прокси |
|-----|-----|------------|--------|
| AAAA | `api` | `100::` (прокси-заглушка) | Включён (оранжевое облако) |

Или CNAME `api` → `isnix.ru` с прокси — главное, чтобы запись была **proxied**.

**Привязка Worker к api:**

1. Worker **isnix-supabase-proxy** → **Settings** → **Domains & Routes**
2. **Add** → **Custom Domain** → `api.isnix.ru` → Save  
   *(или **Add route**: `api.isnix.ru/*`)*

### Шаг 4. Проверка

В браузере:

```text
https://api.isnix.ru/auth/v1/health
```

Должен быть JSON (как на `*.supabase.co`), не 404 от GitHub Pages.

### Шаг 5. GitHub

**Settings → Secrets → Actions:**

- `SUPABASE_URL` = `https://api.isnix.ru`
- `SUPABASE_ANON_KEY` — без изменений

**Actions → Deploy Pages → Run workflow**

На `account.html` в Network запросы идут на `api.isnix.ru`.

**В Supabase** Site URL остаётся `https://isnix.ru` (не api).

---

## Способ 2 — Wrangler (CLI)

На ПК с Node.js:

```bash
cd cloudflare-worker
npm install -g wrangler
wrangler login
wrangler deploy
```

Потом в панели привяжи **Custom Domain** `api.isnix.ru` к Worker (как в шаге 3 выше).

---

## Частые ошибки

| Ошибка | Решение |
|--------|---------|
| Upload .js file | Используй **Edit code**, не Upload |
| api.isnix.ru открывает сайт Pages | DNS `api` должен идти на **Worker**, не на GitHub Pages |
| CORS всё ещё | В `src/index.js` есть `ALLOWED_ORIGINS` — добавь свой origin при необходимости |
| 403 от Supabase | Ключ `SUPABASE_ANON_KEY` в GitHub Secrets, не service_role |
