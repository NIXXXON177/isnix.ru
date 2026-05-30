# isnix-server-messages

Серверный Fabric-мод: свои тексты при отказе в **вайтлисте** и при **перезапуске** сервера.

## Сборка

```bash
cd isnix-server-messages
./gradlew build
```

Jar: `build/libs/isnix-server-messages-1.0.0.jar` → `mods/` на Play2GO, затем **рестарт**.

## Конфиг

`config/isnix-server-messages.json` (создаётся при первом старте):

| Поле | Назначение |
|------|------------|
| `whitelist_kick_lines` | Экран при входе без вайтлиста (строки, коды `§`) |
| `server_restarting_lines` | Экран при рестарте / stop в панели |

Пример ссылки в тексте: `§f§nisnix.ru/account` (подчёркнутый URL в клиенте).

После правки конфига — **рестарт** (отдельной команды reload нет).

## Поведение

- Подменяет стандартное `You are not whitelisted on this server!` / ванильный ключ `multiplayer.disconnect.not_whitelisted`.
- При остановке сервера отключает всех онлайн-игроков с текстом о перезапуске (вместо сухого «Server closed»).

Работает вместе с **EasyWhitelist** и `white-list=true` в `server.properties`.
