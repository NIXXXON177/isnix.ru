# ISNIX ModTools — mute, голос, freeze

Fabric 1.21.1, серверный мод `isnix-modtools`.

## Кто может использовать команды

- Игроки с **OP** (уровень 4, `/op`)
- Игроки в группе LuckPerms **`admin`** (наследуемая группа)
- Консоль сервера

**Не** получают доступ: `[Мл. Админ]` без группы `admin`, модераторы без OP.

## Команды

| Команда | Описание |
|---------|----------|
| `/mute <игрок> <время> [причина]` | Запрет писать в чат (isnix-chat) |
| `/unmute <игрок>` | Снять чат-мут |
| `/mutevoice <игрок> <время> [причина]` | Запрет говорить в Simple Voice Chat |
| `/unmutevoice <игрок>` | Снять мут микрофона |
| `/freeze <игрок> [причина]` | Заморозка: нельзя ходить, телепортироваться, команды |
| `/unfreeze <игрок>` | Снять заморозку |

### Формат времени

`30s`, `15m`, `2h`, `1d`, `1w`, комбинации: `1h30m`

### Голос

Нужны **LuckPerms** и **Simple Voice Chat**. Мод выполняет:

`lp user <ник> permission settemp voicechat.speak false <время>`

При снятии: `permission unset voicechat.speak`

### Freeze

- Игрок остаётся на месте, **голова крутится**.
- Блокируются `/home`, `/rtp`, `/tpa`, `/warp` и **любые** другие команды.
- Телепорты отменяются на уровне сервера.

## Установка

1. `mods/isnix-modtools-1.0.0.jar`
2. Обновить `isnix-chat` (есть проверка мута в чате).
3. **Restart** сервера.
4. Опционально: `config/isnix-modtools.json` — см. [isnix-modtools.json](config-samples/isnix-modtools.json)

Состояние мутов/freeze: `config/isnix-modtools-state.json` (старый файл в корне переносится при старте).

**1.0.3** — `/freeze`: полная блокировка ходьбы (PlayerInput 1.21+), только поворот камеры; travel/vehicle отменены.
**1.0.2** — исправлен NPE при `stop` сервера при сохранении state.

## Сборка

```bash
cd isnix-modtools && ./gradlew build
```
