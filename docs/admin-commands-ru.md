# Команды и действия для администраторов ISTHISNIXXXON

Краткая шпаргалка: **сайт** (заявки, диалог) + **консоль сервера** (игра, LuckPerms).

---

## 1. Сайт isnix.ru (главное)

| Действие | Где |
|----------|-----|
| Вход | https://isnix.ru/account.html |
| Панель заявок | https://isnix.ru/account.html#admin → вкладка **Заявки** |
| Техподдержка игрокам | https://isnix.ru/support.html — направляй на [appeals.html](https://isnix.ru/appeals.html), **не в ВК/TG** |
| Жалобы / баги | https://isnix.ru/appeals.html — ответы админов в [кабинете → Обращения](https://isnix.ru/account.html#admin-support) |

### Заявки в вайтлист

1. Фильтр **«Ждут ответа»** — есть вопрос, игрок ещё не ответил.
2. **«Отправить сообщение»** — вопрос игроку (заявка остаётся `pending`).
3. **«Одобрить»** — ник в очередь на сервер (~5 мин, GitHub Actions).
4. **«Отклонить»** — можно с текстом причины.

**Не пиши** игрокам по заявкам в ВК, Telegram, TikTok — только **диалог на сайте** и уведомления в колокольчике.

### Если одобрили, но не пускает

- Ник в лаунчере = ник в заявке (**регистр букв** важен).
- Подожди до **5 минут** после одобрения.
- GitHub → Actions → **Process whitelist deploy queue** → Run workflow.
- Иногда нужен **restart** сервера на Play2GO.

Подробно: [auto-whitelist-deploy-ru.md](auto-whitelist-deploy-ru.md)

### Админы на сайте (email)

| Email | Ник (профиль) |
|-------|----------------|
| kudrasovn024@gmail.com | ISTHISNIXXXON |
| 1511vasilisa@gmail.com | VaSSiLIISa |
| nikenerdx@gmail.com | NikenER999 |

Снят с админки (июнь 2026): **afktapochek** / альт **ChicagoX** — см. [revoke-afktapochek-chicagox-ru.md](revoke-afktapochek-chicagox-ru.md).

Права в Supabase: `docs/supabase-grant-admins.sql`

---

## 2. Консоль Play2GO / в игре (OP)

Выполняй от **консоли сервера** или в игре с OP. После правок LP:

```text
lp sync
```

### LuckPerms — админы на сервере

```text
lp user ISTHISNIXXXON parent set admin
lp user NikenER999 parent set admin
lp user daydonik parent set admin

lp user ISTHISNIXXXON meta clear prefix
lp user NikenER999 meta clear prefix
lp user daydonik meta clear prefix
```

OP (если нужно):

```text
op ISTHISNIXXXON
op NikenER999
op daydonik
```

### LuckPerms — farmila52: [Мл. Админ] (priority 250)

Только префикс, **без** группы `admin` и прав админа. Красный жирный префикс, ник обычный:

```text
lp user farmila52 parent set default
lp user farmila52 meta clear prefix
lp user farmila52 meta setprefix 250 "&c&l[Мл. Админ] &r"
lp user farmila52 permission unset isthis.boldnick
lp sync
```

Файл: [luckperms-farmila52-ml-admin.txt](luckperms-farmila52-ml-admin.txt)

### LuckPerms — донат / особый префикс (priority 50)

Игрок **должен хотя бы раз зайти** после установки LP, иначе — по UUID из whitelist.

```text
lp user <ник> parent set default
lp user <ник> meta clear prefix
lp user <ник> meta setprefix 50 "&4&l[DEMON] &r"
```

Примеры префиксов: `&c&l[YouTube]`, `&5[Twitch]`, `&6&l[Легенда]`, `&c&l[ПВП]`

Полная лестница: [luckperms-prefix-priorities.md](luckperms-prefix-priorities.md)

### LuckPerms — сброс игрока в обычный [Игрок]

```text
lp user <ник> parent set default
lp user <ник> meta clear prefix
```

Массово: [luckperms-bulk-default.txt](luckperms-bulk-default.txt)

### TAB

После правки `config/tab/*.yml` достаточно **рестарта** сервера. Reload:

```text
/tab reload
```

Только из **консоли панели** или у **OP (уровень 4)**. Если в чате «Unknown command» на `reload` — выдай право:

```text
lp group admin permission set tab.admin true
lp sync
```

В игре без OP: `/tab reload` не сработает (Fabric + LuckPerms).

### Styled Chat (если дубли префикса в чате)

```text
/styledchat reload
```

Конфиг: [styled-chat.json](styled-chat.json), [bold-nick-server.md](bold-nick-server.md)

---

## 3. Рынок `/sell` (Fabric-мод isnix-market)

| Команда | Действие |
|---------|----------|
| `/sell` | Открыть рынок |
| `/sell list` | Выставить лот |
| `/sell help` | Подсказка в чат |
| `/sell cancel <uuid>` | Снять свой лот |
| `/sell buy <uuid>` | Купить по ID |

В GUI: **Shift+ПКМ** по своему лоту — снять. Подробно: [isnix-market-mod.md](isnix-market-mod.md)

## 4. Модерация (мод isnix-modtools)

Требуется **restart** после установки jar. Подробно: [isnix-modtools-mod.md](isnix-modtools-mod.md)

| Команда | Назначение |
|---------|------------|
| `/mute <ник> <время> [причина]` | Мут чата (`30m`, `2h`, `1d`…) |
| `/unmute <ник>` | Снять мут чата |
| `/mutevoice <ник> <время> [причина]` | Мут микрофона (Simple Voice Chat + LP) |
| `/unmutevoice <ник>` | Снять мут микрофона |
| `/freeze <ник> [причина]` | Заморозка: не ходит, не ТП, команды заблокированы |
| `/unfreeze <ник>` | Снять заморозку |

Команды только у **OP** (`/op`, уровень 4) и группы LuckPerms **`admin`**. Мл. админы без группы `admin` — нет. Настройка: `config/isnix-modtools.json` (`opPermissionLevel`, `luckpermsAdminGroup`).

## 4.1. Могилы (мод isnix-graveguard)

Защита от PvP при луте **Vanilla Tweaks Graves**. Подробно: [isnix-graveguard-mod.md](isnix-graveguard-mod.md)

| Команда | Назначение |
|---------|------------|
| `/graveguard status` | Статус мода |
| `/graveguard reload` | Перечитать `config/isnix-graveguard.json` |

---

## 5. Полезные команды модов (Fabric)

Зависит от установленных модов на сервере.

| Команда | Назначение |
|---------|------------|
| `/rtp` | Случайный телепорт (право: `essentialcommands.randomteleport`) |
| `/warp tp <имя>` | Телепорт на варп (все игроки) |
| `/warp list` | Список варпов |
| `/warp set <имя>` | **Только админ** — создать варп |
| `/warp delete <имя>` | **Только админ** — удалить варп |
| `/sell` | Рынок isnix-market (если мод стоит) |

Права `/rtp` для всех: [luckperms-rtp-default.md](luckperms-rtp-default.md)

Права варпов (создание только admin): [luckperms-warp-admin.md](luckperms-warp-admin.md)

```text
lp group default permission set essentialcommands.randomteleport true
```

---

## 6. Whitelist вручную (если сайт/очередь не сработали)

1. GitHub → Actions → **Add player to whitelist (manual)** → ник.
2. Или правка `whitelist.json` на сервере + restart (см. Play2GO SFTP).

UUID для пиратского клиента: режим **offline** — [auto-whitelist-deploy-ru.md](auto-whitelist-deploy-ru.md)

---

## 7. Supabase (редко, для настройки)

| SQL-файл | Зачем |
|----------|--------|
| [supabase-whitelist-dialog.sql](supabase-whitelist-dialog.sql) | Диалог админ ↔ игрок |
| [supabase-fix-notify-safe.sql](supabase-fix-notify-safe.sql) | Сообщения не падают из‑за уведомлений |
| [supabase-fix-connection.sql](supabase-fix-connection.sql) | Права на таблицы |
| [supabase-whitelist-deploy-queue.sql](supabase-whitelist-deploy-queue.sql) | Автовайтлист после одобрения |

---

## 8. Чего не делать

- Не одобрять/отклонять заявки **только в ВК** — только сайт.
- Не ставить админу личный `meta setprefix` вместе с группой `admin` (будет два `[Админ]`).
- Не путать **ник в заявке** и ник в Discord/соцсетях.

---

## Быстрый чеклист нового админа

1. Аккаунт на isnix.ru + email в `supabase-grant-admins.sql` (если новый человек).
2. В игре: `lp user <ник> parent set admin` + `meta clear prefix`.
3. Открыть https://isnix.ru/account.html#admin и проверить заявки.
