# Автодобавление в whitelist после одобрения заявки

Когда админ нажимает **«Одобрить»** в кабинете:

1. В Supabase статус заявки → `approved`.
2. Триггер ставит ник в очередь `whitelist_deploy_queue`.
3. GitHub Actions (**Process whitelist deploy queue**, каждые 5 минут):
   - берёт UUID с Mojang API;
   - дописывает игрока в `whitelist.json` на сервере по SFTP;
   - коммитит обновлённый `whitelist.json` в репозиторий (сайт на Pages подхватывает список).

## Настройка (один раз)

### 1. Supabase

SQL Editor → выполни **[supabase-whitelist-deploy-queue.sql](supabase-whitelist-deploy-queue.sql)**.

### 2. GitHub Secrets

Репозиторий → **Settings → Secrets and variables → Actions**:

| Секрет | Откуда |
|--------|--------|
| `SUPABASE_URL` | Supabase → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → API → `service_role` (секретный ключ, не anon) |
| `PLAY2GO_SFTP_HOST` | уже есть для sync-whitelist |
| `PLAY2GO_SFTP_USER` | уже есть |
| `PLAY2GO_SFTP_PASSWORD` | уже есть |

Опционально: `PLAY2GO_SFTP_PORT`, `PLAY2GO_WHITELIST_PATH` — как в [sync-whitelist.yml](../.github/workflows/sync-whitelist.yml).

### 3. Проверка

1. Одобри тестовую заявку на сайте.
2. Supabase → Table Editor → `whitelist_deploy_queue` — строка `pending`.
3. Actions → **Process whitelist deploy queue** → **Run workflow** (или подожди до 5 минут).
4. Статус очереди → `done`, игрок в `whitelist.json` на сервере.

## Если не сработало

- **failed** в очереди — смотри `error_message` (часто: ник не найден в Mojang, неверный SFTP).
- Ручной запуск: Actions → **Add player to whitelist (manual)** → введи ник.
- Синхронизация с сервера: **Sync whitelist from Play2GO** (раз в 15 мин) подтянет актуальный файл в репо.

## Важно

- Ник должен быть **лицензионным** (Mojang API), иначе UUID не получить.
- Сервер должен быть **перезагружен** или whitelist перечитан, если панель не подхватывает файл сразу (зависит от хостинга).
