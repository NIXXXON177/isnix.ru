# isnix-opac-tab

Серверный Fabric-мод: placeholder **`%isnix:clan_tag%`** для TAB из клана OPAC.

## Сборка

```bash
cd isnix-opac-tab
./gradlew build
```

Jar: `isnix-opac-tab/build/libs/isnix-opac-tab-1.0.0.jar`

## Зависимости на сервере

- Fabric 1.21.1 + Fabric API
- Open Parties and Claims
- Placeholder API (уже стоит)
- TAB

## Конфиг

`config/isnix-opac-tab.json` — стили по UUID владельца клана (`color`, `bold`).

## Команды (владелец клана)

`/clantag help` — полный список. Кратко: `name`, `color`, `bold`, `italic`, `underline`, `strike`, `reset`, `preview`, `show`, `sync`.

## TAB на сервере

См. [config-samples/tab/README.md](config-samples/tab/README.md).

## Версии

- **1.0.6** — `/clantag name` сохраняет текст в `isnix-opac-tab.json` (OPAC опционально); владелец одного клана тоже может настроить тег.
- **1.0.5** — `/clantag` italic, underline, strike, reset, preview; эталонные конфиги TAB в `docs/config-samples/tab/`.
- **1.0.4** — кэш `%isnix:clan_tag%`; сообщения пати с префиксом LP и тегом после ника.

Инструкция для игроков: [opac-tab-klany-ru.md](opac-tab-klany-ru.md)
