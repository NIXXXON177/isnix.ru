# LuckPerms: /enderchest для всех игроков (Essential Commands)

На сервере **Fabric 1.21.1** команда `/enderchest` (и алиасы, если есть) — мод **Essential Commands**.

## Почему «не у всех работает»

Если в конфиге мода включено **`use_permissions_api=true`**, команды без явного права в LuckPerms **запрещены**. У админов может быть OP или лишние права — у обычных игроков в группе `default` узла нет → «нет доступа».

## 1. Конфиг Essential Commands

На сервере: `config/EssentialCommands.properties` (или `essentialcommands.json` — смотри актуальный файл):

```properties
use_permissions_api=true
```

Если `false` — права LP не нужны, но тогда **нельзя** ограничивать `/warp set` только админам. На ISTHISNIXXXON оставляем **`true`**.

## 2. Выдать право группе default (консоль сервера)

```text
lp group default permission set essentialcommands.enderchest true
lp sync
```

Группа `admin` наследует `default` (`lp group admin parent add default`), админы тоже получат команду.

## 3. Проверка

```text
lp user <ник> permission check essentialcommands.enderchest
```

Должно быть **`true`**. Если **`false`**:

```text
lp user <ник> parent set default
lp sync
```

Игрок снова вводит `/enderchest`.

## 4. Если всё равно ошибка

```text
lp verbose on
```

Игрок вводит `/enderchest` — в консоли видно, какой **permission node** не хватает (подставь его вместо `essentialcommands.enderchest`, если мод обновился).

Другие причины:

| Симптом | Что проверить |
|---------|----------------|
| «Нет прав» | LP, см. выше |
| Ничего не происходит / мут | `/freeze`, мод isnix-modtools |
| Команда не найдена | Мод Essential Commands в `mods/` на сервере |

## Связанные права (по желанию)

Тот же мод, тот же принцип:

| Команда | Permission node |
|---------|-----------------|
| `/anvil` | `essentialcommands.anvil` |
| `/workbench` | `essentialcommands.workbench` |
| `/stonecutter` | `essentialcommands.stonecutter` |
| `/grindstone` | `essentialcommands.grindstone` |
| `/wastebin` | `essentialcommands.wastebin` |

Для всех «кухонных» команд разом (осторожно — шире, чем только эндер-сундук):

```text
lp group default permission set essentialcommands.anvil true
lp group default permission set essentialcommands.workbench true
lp group default permission set essentialcommands.stonecutter true
lp group default permission set essentialcommands.grindstone true
lp group default permission set essentialcommands.wastebin true
lp sync
```

См. также: [luckperms-rtp-default.md](luckperms-rtp-default.md), [luckperms-warp-admin.md](luckperms-warp-admin.md).
