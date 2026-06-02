# Supabase: CORS, NetworkError и обход блокировки `*.supabase.co`

Для **isnix.ru** (статический сайт + `supabase-js@2` из CDN).

## Что означает ошибка

| Симптом | Чаще всего |
|--------|------------|
| `Код состояния: (null)` | Запрос **не дошёл** до Supabase (провайдер, AdBlock, антивирус, DNS, РКН) |
| `NetworkError when attempting to fetch` | То же + обрыв TLS (`ERR_CONNECTION_RESET`) |
| CORS в Firefox при `(null)` | **Следствие** обрыва, а не «забыли добавить Origin в CORS» |

У Supabase REST/Auth для браузера с **anon / publishable** ключом CORS обычно **уже открыт**. Отдельного «CORS Allow List для API» в панели нет — важны **URL для Auth** (редиректы после входа).

Проверка без сайта — в новой вкладке:

```text
https://ВАШ-ПРОЕКТ.supabase.co/auth/v1/health
```

- JSON с текстом про `apikey` → сеть есть, копайте настройки Auth / ключ.
- Пусто / «сброс соединения» → нужен **прокси / другая сеть**, не правка `createClient`.

---

## Часть 1. Панель Supabase (обязательно)

### Authentication → URL Configuration

| Поле | Значение для isnix.ru |
|------|------------------------|
| **Site URL** | `https://isnix.ru` |
| **Redirect URLs** | `https://isnix.ru/**` |
| | `https://www.isnix.ru/**` |
| | `http://localhost:**` |

### Settings → API Keys

- В браузер: **Publishable** (`sb_publishable_...`) или **anon legacy** (`eyJ...`).
- **Никогда** не вставляйте `service_role` / `sb_secret_` в фронтенд.

### Settings → General

- **Project URL** — именно он в `createClient` (или ваш прокси-домен, см. ниже).
- Проект **не Paused**.

### Custom Domain (официально)

[Custom Domains](https://supabase.com/docs/guides/platform/custom-domains) — в основном **платный** план: поддомен вида `api.example.com` → ваш проект.  
После настройки в DNS и панели Supabase клиент указывает на `https://api.isnix.ru` вместо `https://xxxx.supabase.co`.

---

## Часть 2. Обход блокировки: прокси на **своём** домене

Идея: браузер ходит на `https://api.isnix.ru`, а прокси пересылает на `https://yfrlgeztbaebdapdnefy.supabase.co` с правильным заголовком `Host`.

> **GitHub Pages** сам по себе **не** может быть reverse proxy к Supabase. Нужен **Cloudflare**, **VPS + Nginx** или **Cloudflare Worker**.

### Вариант A — Cloudflare Worker (удобно, если домен на Cloudflare)

1. DNS: `api.isnix.ru` → прокси через Cloudflare (оранжевое облако).
2. Worker + маршрут: `api.isnix.ru/*`

```javascript
// worker.js — маршрут api.isnix.ru/*
const SUPABASE_HOST = 'yfrlgeztbaebdapdnefy.supabase.co'

export default {
	async fetch(request) {
		const incoming = new URL(request.url)
		const target = new URL(request.url)
		target.protocol = 'https:'
		target.hostname = SUPABASE_HOST

		const headers = new Headers(request.headers)
		headers.set('Host', SUPABASE_HOST)

		const proxied = new Request(target.toString(), {
			method: request.method,
			headers,
			body: request.method !== 'GET' && request.method !== 'HEAD' ? request.body : undefined,
			redirect: 'follow',
		})

		const response = await fetch(proxied)

		// CORS для isnix.ru (подставьте свой origin)
		const out = new Headers(response.headers)
		out.set('Access-Control-Allow-Origin', 'https://isnix.ru')
		out.set('Access-Control-Allow-Headers', 'apikey, authorization, content-type, x-client-info')
		out.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')

		if (request.method === 'OPTIONS') {
			return new Response(null, { status: 204, headers: out })
		}

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: out,
		})
	},
}
```

3. В коде сайта URL API: `https://api.isnix.ru` (без `/` в конце).

### Вариант B — Nginx на VPS

```nginx
# /etc/nginx/sites-available/api.isnix.ru.conf
server {
	listen 443 ssl http2;
	server_name api.isnix.ru;

	ssl_certificate     /path/fullchain.pem;
	ssl_certificate_key /path/privkey.pem;

	location / {
		proxy_pass https://yfrlgeztbaebdapdnefy.supabase.co;
		proxy_ssl_server_name on;
		proxy_set_header Host yfrlgeztbaebdapdnefy.supabase.co;
		proxy_set_header X-Real-IP $remote_addr;
		proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
		proxy_set_header X-Forwarded-Proto $scheme;

		# CORS (если Supabase-заголовков недостаточно)
		add_header Access-Control-Allow-Origin "https://isnix.ru" always;
		add_header Access-Control-Allow-Headers "apikey, authorization, content-type, x-client-info" always;
		add_header Access-Control-Allow-Methods "GET, POST, PUT, PATCH, DELETE, OPTIONS" always;

		if ($request_method = OPTIONS) {
			return 204;
		}
	}
}
```

### Вариант C — Next.js Rewrite (только если фронт на Next, не для чистого Pages)

```javascript
// next.config.js
module.exports = {
	async rewrites() {
		return [
			{
				source: '/api/supabase/:path*',
				destination: 'https://yfrlgeztbaebdapdnefy.supabase.co/:path*',
			},
		]
	},
}
```

Клиент: `createClient('/api/supabase', key)` — тот же origin, CORS не нужен.

---

## Часть 3. `createClient` после смены URL

### isnix.ru (текущая схема)

`assets/js/auth-config.js` (на проде генерируется в Deploy Pages):

```javascript
window.ISNIX_AUTH = {
	enabled: true,
	// Было: https://yfrlgeztbaebdapdnefy.supabase.co
	// С прокси:
	supabaseUrl: 'https://api.isnix.ru',
	supabaseAnonKey: 'sb_publishable_...', // или eyJ...
}
```

`assets/js/auth.js` уже делает:

```javascript
supabase.createClient(
	getConfig().supabaseUrl,
	getConfig().supabaseAnonKey,
	{ global: { fetch: fetchWithRetry } },
)
```

**Менять нужно только `supabaseUrl`** (и секрет деплоя, если URL в workflow захардкожен).

### Прямой пример (любой SPA)

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
// https://api.isnix.ru  ИЛИ  https://xxxx.supabase.co

const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
	auth: {
		autoRefreshToken: true,
		persistSession: true,
		detectSessionInUrl: true,
		// flowType: 'pkce', // если включили PKCE в Supabase Auth
	},
	global: {
		headers: { 'X-Client-Info': 'isnix-web' },
	},
})
```

### Важно при прокси

| Что | Куда |
|-----|------|
| `createClient` первый аргумент | База API: `https://api.isnix.ru` |
| **Site URL** в Supabase Auth | Остаётся `https://isnix.ru` (сайт, не прокси) |
| **Redirect URLs** | `https://isnix.ru/**` |
| Ссылки в письмах подтверждения | Ведут на **isnix.ru**, не на `api.isnix.ru` |

Прокси: **REST + Auth** (`/auth/v1`, `/rest/v1`) и **Realtime WebSocket** (`/realtime/v1/websocket`).

> Worker в `cloudflare-worker/src/index.js` должен проксировать **Upgrade: websocket**.  
> Без этого в консоли Firefox: `NS_ERROR_WEBSOCKET_CONNECTION_REFUSED` на `wss://api.isnix.ru/realtime/...` — уведомления всё равно подтягиваются **опросом** раз в ~20 с, но спам в консоли исчезнет после **Deploy** обновлённого Worker.

### Деплой isnix.ru с другим URL

В репозитории уже поддерживается секрет **`SUPABASE_URL`** в workflow **Deploy Pages**:

1. Настройте Worker: `cloudflare-worker/supabase-proxy.example.js`
2. GitHub → **Settings → Secrets → Actions** → `SUPABASE_URL` = `https://api.isnix.ru`
3. **Actions → Deploy Pages → Run workflow**

Без секрета `SUPABASE_URL` остаётся `https://yfrlgeztbaebdapdnefy.supabase.co`.

---

## Часть 4. Пошаговый план (кратко)

1. **Проверка:** `health` на `*.supabase.co` с проблемной сети.
2. **Панель:** Site URL, Redirect URLs, ключ publishable/anon, проект не на паузе.
3. **Клиент:** AdBlock, DNS 1.1.1.1, антивирус — см. `docs/supabase-cors-troubleshooting.md`.
4. Если `health` не открывается у игроков в РФ → **Custom Domain** или **Worker/Nginx** на `api.isnix.ru`.
5. Поменять `supabaseUrl` в `auth-config.js` / секретах → redeploy Pages → Ctrl+F5.
6. В консоли F12 → Network: запросы на `api.isnix.ru` со статусом **200**, не `(null)`.

---

## Чего не поможет

- Добавить в код «отключить CORS» — в браузере нельзя.
- Поставить в `createClient` URL `https://supabase.co` без ID проекта — будет ошибка.
- SQL-миграции в Supabase — не лечат сетевой блок.

---

## Связанные файлы в репозитории

- `docs/supabase-cors-troubleshooting.md` — быстрый чеклист
- `assets/js/auth-config.js` — URL и ключ
- `assets/js/auth.js` — `createClient` и повтор запросов
- `.github/workflows/deploy-pages.yml` — подстановка ключа на Pages
