# CORS / «не удалось выполнить запрос» к Supabase

В консоли браузера (Firefox):

> Запрос из постороннего источника заблокирован… supabase.co … CORS … Код состояния: (null)

Чаще всего это **не баг сайта**, а сеть или настройки проекта Supabase.

## 1. Supabase Dashboard → Authentication → URL Configuration

| Поле | Значение |
|------|----------|
| **Site URL** | `https://isnix.ru` |
| **Redirect URLs** (добавить строками) | `https://isnix.ru/**` |
| | `https://www.isnix.ru/**` |
| | `http://localhost:**` (для локальной проверки) |

Сохрани и подожди 1–2 минуты.

## 2. Проект не на паузе

Supabase → Dashboard. Если проект **Paused** — нажми **Restore project**.

## 3. Браузер и сеть

- Отключи **AdBlock / uBlock** для `isnix.ru` и `*.supabase.co`
- Попробуй без **VPN**
- Другой браузер или мобильный интернет (не Wi‑Fi)
- Открой сайт именно как **https://isnix.ru** (не `file://`, не чужой домен)

Статус **(null)** часто значит, что запрос **не дошёл** до сервера (блокировка провайдером, расширение, обрыв), а не только «неправильный CORS».

## 4. SQL-миграции

Выполни в **SQL Editor** (если ещё не делал):

- `docs/supabase-fix-connection.sql`
- `docs/supabase-site-presence.sql` (устройство на сайте)
- `docs/supabase-player-stats.sql` (статистика в игре)

Без колонок `site_last_seen_at` / `site_device` сайт всё равно работает (есть запасной запрос), но heartbeat устройства не сохранится.

## 5. Ключ API на GitHub Pages

Репозиторий → **Settings → Secrets** → `SUPABASE_ANON_KEY`:

| Тип в Supabase | Формат | Подходит? |
|----------------|--------|-----------|
| **Publishable** | `sb_publishable_...` | Да (сейчас на isnix.ru) |
| **anon (legacy)** | `eyJ...` (длинный JWT) | Да, если publishable не работает в браузере |

Скопируй ключ из **Settings → API Keys** (не `service_role` / `sb_secret_`).

Перезапусти **Actions → Deploy Pages** → дождись зелёной галочки → Ctrl+F5 на account.html.

Проверка: открой `https://isnix.ru/assets/js/auth-config.js` — в `supabaseAnonKey` не должно быть пустой строки.

## 6. Проверка

В консоли (F12) → **Сеть** → обнови страницу аккаунта. Запрос к `yfrlgeztbaebdapdnefy.supabase.co` должен быть **200**, не «заблокирован».

Быстрая проверка в новой вкладке (вставь в адресную строку, подставь свой ключ из auth-config.js):

```
https://yfrlgeztbaebdapdnefy.supabase.co/auth/v1/health
```

С заголовком `apikey` в Network не получится из адресной строки — проще открыть **account.html**, F12 → Network, найти `health` или `profiles`.

Если с одного интернета не работает, а с другого работает — проблема у провайдера или фильтра на устройстве (AdBlock, «безопасный DNS», корпоративный Wi‑Fi).

## 7. SQL (если сеть есть, но «permission denied»)

Тогда это не CORS, а права в БД — выполни `docs/supabase-fix-connection.sql` в SQL Editor.
