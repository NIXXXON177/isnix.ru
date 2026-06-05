# isnix-server-messages

Серверный Fabric-мод: тексты при отказе в **вайтлисте** и при **перезапуске** (красивое предупреждение).

## Сборка

```bash
cd isnix-server-messages
./gradlew build
```

Jar: `build/libs/isnix-server-messages-1.0.1.jar` → `mods/` на Play2GO, затем **рестарт**.

## Конфиг

`config/isnix-server-messages.json` (создаётся при первом старте):

| Поле | Назначение |
|------|------------|
| `whitelist_kick_lines` | Экран при входе без вайтлиста (строки, коды `§`) |
| `server_restarting_lines` | Экран при Stop / перезапуске |
| `force_jvm_exit_on_stop` | `true` — завершить Java-процесс после stop (иначе Restart в Play2GO зависает) |
| `force_jvm_exit_delay_ms` | Пауза перед `System.exit`, мс (по умолчанию 1500) |

Текст перезапуска можно править в JSON (коды `§` для цветов). После правки — **рестарт** сервера.

## Поведение

- Подменяет стандартное сообщение вайтлиста.
- При остановке сервера отключает онлайн-игроков с текстом из `server_restarting_lines` (вместо «Server closed»).

Работает с **EasyWhitelist** и `white-list=true`.
