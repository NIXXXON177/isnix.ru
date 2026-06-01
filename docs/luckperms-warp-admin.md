# LuckPerms: варпы только для админов (Essential Commands)

На сервере **Fabric 1.21.1** варпы — мод **Essential Commands** (`/warp set`, `/warp tp`, `/warp list`).

## Конфиг мода

В `config/EssentialCommands.properties`:

```properties
use_permissions_api=true
```

Без этого LuckPerms **не влияет** на команды.

## Права в LuckPerms (консоль Play2GO)

```text
lp group default permission unset essentialcommands.warp.set
lp group default permission unset essentialcommands.warp.delete
lp group default permission set essentialcommands.warp.tp true
lp group admin permission set essentialcommands.warp.set true
lp group admin permission set essentialcommands.warp.delete true
lp sync
```

| Группа | Что может |
|--------|-----------|
| `default` | `/warp tp`, `/warp list` — **телепорт** на существующие варпы |
| `admin` | `/warp set`, `/warp delete` — **создание и удаление** |

## Сообщение игроку

Мод **isnix-modtools** (1.0.10+) перехватывает `/warp set` и `/warp delete` у не-админов и пишет в чат:

> Создавать и удалять варпы могут только админы. Попросите админа в чате или через обращение на isnix.ru.

Текст настраивается: `config/isnix-modtools.json` → `warpManageDenied`.

«Админ» = **OP 4** или группа LuckPerms **`admin`** (как у `/mute`, `/freeze`).

## Проверка

```text
lp user <ник> permission check essentialcommands.warp.set
/warp set test
```

У обычного игрока: `false` + сообщение modtools. У админа: варп создаётся.

## Создание варпа (админ)

```text
/warp set spawn
/warp set shop
/warp list
/warp delete shop
```
