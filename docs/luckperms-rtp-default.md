# LuckPerms: /rtp для всех игроков (Essential Commands)

На сервере **Fabric 1.21.1** команда `/rtp` (и `/randomteleport`) — из мода **Essential Commands**.

## 1. Включить API прав на сервере

В `config/EssentialCommands.properties` (или `essentialcommands.json` — смотри актуальный файл мода):

```properties
use_permissions_api=true
```

После правки — перезапуск или reload конфига мода (если есть).

## 2. Выдать право группе default

В **консоли** сервера (не в чате игрока):

```text
lp group default permission set essentialcommands.randomteleport true
lp sync
```

Группа `admin` наследует `default` (`lp group admin parent add default`), поэтому админы тоже получат `/rtp`.

Проверка для игрока:

```text
lp user <ник> permission check essentialcommands.randomteleport
```

Если `false` — у игрока нет группы `default`: `lp user <ник> parent set default`.

## 3. Если команда всё равно «нет прав»

```text
lp verbose on
```

Игрок вводит `/rtp` — в консоли появится, какой **permission node** не хватает. Подставь его вместо `essentialcommands.randomteleport`, если мод обновился.

Дополнительно (по желанию, из wiki Essential Commands):

| Право | Зачем |
|-------|--------|
| `essentialcommands.bypass.teleport_delay` | без задержки перед телепортом |
| `essentialcommands.bypass.teleport_interrupt_on_move` | не сбрасывать RTP при движении |

Обычным игрокам для базового `/rtp` достаточно только `essentialcommands.randomteleport`.
