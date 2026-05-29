# Подготовка до рестарта (29.05.2026)

Выполнено автоматически через SFTP.

## Критично: восстановлены jar

При удалении дубликатов `(1)` на сервере не осталось единственных копий:

| Файл | Статус |
|------|--------|
| `fabric-language-kotlin-1.13.11+kotlin.2.3.21.jar` | Залит обратно |
| `placeholder-api-2.4.2+1.21.jar` | Залит обратно |

**Без них после рестарта не загрузятся** Essential Commands, TAB/LuckPerms hook, isnix-opac-tab.

## Оптимизация (вступит в силу при Start)

См. `docs/server-optimization-2026-05.md`

## Сборка для игроков

`downloads/ISTHISNIXXXONmods.zip` дополнен серверными QoL-модами:

- FallingTree, trade, doubledoors, rightclickharvest, fsit, FastRTP
- ItemFrament, Female-Gender, collective, jamlib

После деплоя сайта игроки могут перекачать ZIP.

## Документация

- `docs/restart-checklist-ru.md` — шаги на 00:00
- `docs/feedback.md` — предложения из ВК

## Лог (кратко)

- Периодические `Can't keep up` / MSPT — ожидаемо до ServerCore dynamic
- GrimAC / moved too quickly — норма
- isnix-player-stats: редкие Supabase timeout — не блокирует сервер

## Вам вручную

1. Бэкап Play2GO
2. Объявление о рестарте
3. В 00:00: Stop → Start → чек-лист
4. `/tab reload` после старта
