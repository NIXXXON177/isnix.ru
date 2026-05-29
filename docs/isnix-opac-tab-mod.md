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

## Команды

- `/clantag color <имя или 0-f>`
- `/clantag bold on|off`
- `/clantag show`
- `/clantag sync`

Инструкция для игроков: [opac-tab-klany-ru.md](opac-tab-klany-ru.md)
