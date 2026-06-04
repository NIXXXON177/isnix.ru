# Рестарт сервера — чек-лист (00:00)

## До Stop

- [ ] Сообщение в ВК/Discord: «Рестарт в 00:00, ~2–3 мин»
- [ ] Бэкап в Play2GO → **Backups** → Create (или автобэкап по расписанию)
- [ ] Локально (раз в сутки): `python scripts/backup_player_data.py` — см. [player-backup-ru.md](player-backup-ru.md)
- [ ] В игре (по желанию): `/tab reload`

## Stop → Start

1. **Stop** — дождаться полной остановки (консоль не пишет тики).
2. **Start**.
3. В консоли после загрузки:
   ```
   /servercore status
   /spark tps
   /tab reload
   ```
4. В логе: нет красных ERROR при старте; есть строка `ISNIX OPAC Tab`.

## Проверка в игре (5 мин)

- [ ] Вход (EasyAuth)
- [ ] DNS: `bedrock.isnix.ru` → CNAME + SRV (см. [dns-bedrock-isnix-ru.md](dns-bedrock-isnix-ru.md))
- [ ] Bedrock: `bedrock.isnix.ru` (порт 20545 при необходимости), `/login`
- [ ] TAB: `%luckperms:prefix%` и `%isnix:clan_tag%` в `groups.yml`, `users.yml` пустой (см. `docs/config-samples/`)
- [ ] OPAC: в логе нет `prometheus isn't registered` — `permissionSystem = "luck_perms"`
- [ ] `/clantag help` у владельца клана — превью тега
- [ ] `isnix-server-messages` в `mods/` — текст перезапуска (`config/isnix-server-messages.json`)
- [ ] `'` → My player config — только party name, claims name/color
- [ ] `/sell`, `/trade`
- [ ] Голосовой чат (Voice Chat)

## Если проблемы

| Симптом | Действие |
|---------|----------|
| Не стартует / ошибка Kotlin | Проверить `mods/fabric-language-kotlin*.jar` |
| TAB без тега клана | `mods/isnix-opac-tab`, `placeholder-api`, `/tab reload` |
| TPS низкий | `/spark tps`; при необходимости отключить `dynamic` в ServerCore |
| Supabase stats timeout | Не критично для сервера; проверить RPC в Supabase |

## Уже применено (май 2026)

См. `docs/server-optimization-2026-05.md`
