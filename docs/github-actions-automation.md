# Автоматизация GitHub Actions

## Уже работает по расписанию

| Workflow | Что делает |
|----------|------------|
| `sync-whitelist.yml` | Каждые 15 мин — `whitelist.json` с сервера → коммит в репо (для сайта) |
| `process-whitelist-queue.yml` | Каждые 5 мин — одобренные заявки Supabase → whitelist на сервере |
| `deploy-pages.yml` | Пуш в `main` — публикация сайта на GitHub Pages |

## Моды ISNIX — сборка и заливка на сервер

При **push в `main`** (если менялся код мода):

| Workflow | JAR на сервере |
|----------|----------------|
| `build-isnix-market.yml` | `mods/isnix-market-<версия>.jar` |
| `build-isnix-chat.yml` | `mods/isnix-chat-<версия>.jar` |
| `build-isnix-player-stats.yml` | `mods/isnix-player-stats-<версия>.jar` |
| `build-isnix-opac-tab.yml` | `mods/isnix-opac-tab-<версия>.jar` |

Секреты (те же, что для whitelist):

- `PLAY2GO_SFTP_HOST`
- `PLAY2GO_SFTP_USER`
- `PLAY2GO_SFTP_PASSWORD`
- опционально `PLAY2GO_SFTP_PORT` (по умолчанию `2022`)

После заливки jar **перезапустите сервер** в панели Play2GO — Fabric не подхватывает замену файла без рестарта.

Ручной запуск: Actions → нужный workflow → **Run workflow**.

## Supabase (один раз вручную)

SQL из `docs/` выполняется в консоли Supabase, не через Actions:

- `supabase-fix-notify-safe.sql`
- `supabase-whitelist-dialog.sql`
- `supabase-whitelist-deploy-queue.sql` (для очереди whitelist)

## Локально (без CI)

`server-sftp.env` + `python scripts/play2go_sftp.py push … mods/…jar` — как запасной вариант.
