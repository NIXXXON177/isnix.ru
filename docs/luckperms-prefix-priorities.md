# LuckPerms: префикс [Игрок] и порядок приоритетов

LuckPerms показывает **один** префикс — с **наибольшим** числом `priority`.  
Чем **больше** число, тем «главнее» префикс.

## Лестница (как настроить)

| Priority | Кому | Префикс |
|----------|------|---------|
| **10** | все в группе `default` | `[Игрок]` |
| **50** | донат / особый (meta на игроке) | `[DEMON]`, `[YouTube]`, `[Twitch]`, … |
| **200** | группа `admin` | `[Админ]` |
| **250** | личный meta (без группы admin) | `[Мл. Админ]` для farmila52 — [luckperms-farmila52-ml-admin.txt](luckperms-farmila52-ml-admin.txt) |

Итог: у обычного игрока — `[Игрок]`, у донатера — свой префикс, у админа — `[Админ]` (перекрывает всё).

---

## Шаг 1 — один раз в консоли (группы)

```text
lp creategroup default
lp creategroup admin

lp group default setweight 1
lp group admin setweight 100
lp group admin parent add default

lp group default meta setprefix 10 "&7[Игрок] &r"
lp group admin meta setprefix 200 "&c&l[Админ] &r"
lp group admin permission set isthis.boldnick true
lp group default permission set essentialcommands.randomteleport true
```

Команда `/rtp` для всех в `default`: **[luckperms-rtp-default.md](luckperms-rtp-default.md)** (нужен `use_permissions_api=true` в Essential Commands).

---

## Шаг 2 — админы (только группа, без личного prefix)

Личный `meta setprefix` у админа даёт путаницу и дубли — **очисти**:

```text
lp user afktapochek parent set admin
lp user daydonik parent set admin
lp user ISTHISNIXXXON parent set admin
lp user NikenER999 parent set admin

lp user afktapochek meta clear prefix
lp user daydonik meta clear prefix
lp user ISTHISNIXXXON meta clear prefix
lp user NikenER999 meta clear prefix
```

---

## Шаг 3 — особые префиксы (priority 50)

Родитель `default`, префикс только через meta **50**.

**Важно:** `lp user redan997` / `Y8shikage` не сработает, пока игрок **ни разу не заходил** после установки LP — тогда создай по UUID из whitelist:

```text
lp user 432b5fac-dc4e-32c5-b74b-d2e8e72f0aa7 parent set default
lp user 432b5fac-dc4e-32c5-b74b-d2e8e72f0aa7 meta setprefix 50 "&c[ПВП] &r"

lp user ff34b72e-7e58-3625-aeb0-984a8bde0bfd parent set default
lp user ff34b72e-7e58-3625-aeb0-984a8bde0bfd meta setprefix 50 "&6&l[Легенда] &r"
```

Или дождись их входа на сервер и выполни команды по нику.

```text
lp user SK_Joker parent set default
lp user SK_Joker meta clear prefix
lp user SK_Joker meta setprefix 50 "&4&l[DEMON] &r"

lp user kimshanin121112 parent set default
lp user kimshanin121112 meta clear prefix
lp user kimshanin121112 meta setprefix 50 "&c&l[YouTube] &r"

# [Twitch] — фиолетовый + жирный (подставь ник стримера)
lp user <ник> parent set default
lp user <ник> meta clear prefix
lp user <ник> meta setprefix 50 "&5&l[Twitch] &r"

lp user VITALISDI parent set default
lp user VITALISDI meta clear prefix
lp user VITALISDI meta setprefix 50 "&6&l[Адвокат] &r"

lp user Void parent set default
lp user Void meta clear prefix
lp user Void meta setprefix 50 "&b[Механик] &r"

lp user redan997 parent set default
lp user redan997 meta clear prefix
lp user redan997 meta setprefix 50 "&c[ПВП] &r"

lp user Y8shikage parent set default
lp user Y8shikage meta clear prefix
lp user Y8shikage meta setprefix 50 "&6&l[Легенда] &r"
```

---

## Шаг 4 — остальные 126 игроков

Файл **[luckperms-bulk-default.txt](luckperms-bulk-default.txt)** — по два command на ник: сброс meta и `parent set default`.

Вставляй в консоль **порциями** (по 20–30 строк), чтобы не лагнуло.

Или вручную одному «сломанному»:

```text
lp user <ник> meta clear prefix
lp user <ник> parent set default
```

---

## Шаг 5 — сохранить и проверить

```text
lp sync
lp user daydonik info
lp user gfvoise info
lp user SK_Joker info
```

Ожидание:

- `gfvoise` → `[Игрок] gfvoise`
- `SK_Joker` → `[DEMON] SK_Joker`
- `daydonik` → `[Админ] daydonik` (жирный, если `isthis.boldnick`)

---

## Styled Chat

В `styled-chat.json` префикс **только** в `display_name`:

```json
"display_name": "%luckperms:prefix%${default}"
```

В `chat` / join / leave **нет** `%luckperms:prefix%` — см. [styled-chat.json](styled-chat.json).

```text
/styledchat reload
```

---

## Справочник: цвета префиксов (meta priority 50)

| Префикс | Команда `meta setprefix 50` |
|---------|------------------------------|
| **[Адвокат]** | `"&6&l[Адвокат] &r"` — оранжевый, жирный |
| [Легенда] | `"&6&l[Легенда] &r"` |
| [DEMON] | `"&4&l[DEMON] &r"` |
| **[YouTube]** | `"&c&l[YouTube] &r"` — красный, жирный |
| **[Twitch]** | `"&5&l[Twitch] &r"` — фиолетовый, жирный |
| [ПВП] | `"&c[ПВП] &r"` |
| [Механик] | `"&b[Механик] &r"` |
| **[Мл. Админ]** (farmila52) | `"&c&l[Мл. Админ] &r"` — красный, жирный **только** префикс; `priority 250` |

`&6` — золотой/оранжевый, `&c` — красный, `&l` — жирный, `&r` — сброс форматирования для ника.

Пример для **VITALISDI** или после покупки:

```text
lp user <ник> parent set default
lp user <ник> meta clear prefix
lp user <ник> meta setprefix 50 "&6&l[Адвокат] &r"
lp sync
```

---

## Частые ошибки

| Проблема | Решение |
|----------|---------|
| Нет `[Игрок]` | `lp group default meta setprefix 10 ...` |
| Два `[Админ]` | `meta clear prefix` у админа + убрать `%luckperms:prefix%` из join/chat |
| Админ видит `[DEMON]` | У админа не должно быть meta prefix 50, только группа `admin` |
| «Не по порядку» | Проверь **priority**: 10 &lt; 50 &lt; 200, не путай с weight |
| Два `[Админ]` при **входе** | На сервере старый `styled-chat.json` с `%luckperms:prefix%` в join — залей [styled-chat.json](styled-chat.json) и `/styledchat reload` |
| **VaSSiLIISa** два `[Админ]` | `lp user VaSSiLIISa info` — если лишний meta: `meta clear prefix`; если не админ: `parent set default` |
