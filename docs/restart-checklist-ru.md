# Рестарт сервера — чек-лист (00:00)

## До Stop

- [ ] Сообщение в ВК/Discord: «Рестарт в 00:00, ~2–3 мин, оптимизация»
- [ ] Бэкап в Play2GO → **Backups** → Create
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
- [ ] TAB: `config/tab/groups.yml` — `%isnix:clan_tag%` в `tabsuffix`/`tagsuffix` (см. `docs/config-samples/tab/`)
- [ ] `/clantag help` у владельца клана — превью тега
- [ ] `isnix-server-messages` в `mods/` — тексты вайтлиста и перезапуска (`config/isnix-server-messages.json`)
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
