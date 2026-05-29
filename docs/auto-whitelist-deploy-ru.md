# Автодобавление в whitelist после одобрения заявки

Когда админ нажимает **«Одобрить»** в кабинете:

1. В Supabase статус заявки → `approved`.
2. Триггер ставит ник в очередь `whitelist_deploy_queue`.
3. GitHub Actions (**Process whitelist deploy queue**, каждые 5 минут):
   - считает UUID для ника;
   - дописывает игрока в `whitelist.json` на сервере по SFTP;
   - коммитит обновлённый `whitelist.json` в репозиторий.

## Пиратские / нелицензионные ники (у нас так почти все)

На сервере **`online-mode=false`** — игроки заходят без лицензии Mojang.  
Для whitelist нужен **offline UUID** (тот же, что Minecraft даёт по нику при пиратском клиенте).

Скрипт по умолчанию (`WHITELIST_UUID_MODE=auto`):

1. Пробует Mojang API (если ник когда-то был куплен — возьмёт «настоящий» UUID).
2. Если в Mojang нет (404) — ставит **offline UUID** по нику. **Это нормально для вашего сервера.**

Чтобы **всегда** только offline (быстрее, без запросов к Mojang), в GitHub Secrets или в workflow:

```text
WHITELIST_UUID_MODE=offline
```

Режим `mojang` — только лицензия; для ISTHISNIXXXON не подходит.

## Настройка (один раз)

### 1. Supabase

SQL Editor → **[supabase-whitelist-deploy-queue.sql](supabase-whitelist-deploy-queue.sql)**.

### 2. GitHub Secrets

| Секрет | Откуда |
|--------|--------|
| `SUPABASE_URL` | **Settings → General → Project URL** — обязательно с `https://`, например `https://yfrlgeztbaebdapdnefy.supabase.co` (не API-ключ `sb_...`!) |
| `SUPABASE_SERVICE_ROLE_KEY` | **API Keys → Secret keys → default** (`sb_secret_...`) или legacy **service_role** |
| `PLAY2GO_SFTP_*` | как в sync-whitelist |

Опционально: `WHITELIST_UUID_MODE` = `auto` (по умолчанию) или `offline`.

### 3. Проверка

1. Одобри заявку → `whitelist_deploy_queue` → `pending`.
2. Actions → **Process whitelist deploy queue** → Run workflow.
3. В логе: `добавлен Nick (UUID: offline)` — для пиратского ника это ожидаемо.

## Если не сработало

- **failed** в очереди — смотри `error_message` (SFTP, опечатка в нике).
- Ручной запуск: **Add player to whitelist (manual)**.
- Игрок должен заходить **тем же ником**, что в заявке (регистр букв важен для offline UUID).

## Важно

- Ник в заявке = ник в лаунчере при входе (латиница, 3–16 символов).
- После добавления в whitelist иногда нужен **restart** сервера на Play2GO.
