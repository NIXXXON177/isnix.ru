# Кланы (OPAC) и тег в TAB — инструкция для ISTHISNIXXXON

Сервер: **Fabric 1.21.1**, моды **Open Parties and Claims 0.26.3**, **TAB 5.5.0**, **Placeholder API**, **LuckPerms**.

Цели:

1. В меню OPAC (`'`) оставить игрокам только нужное: **регионы (приваты)** и **кланы (party)**.
2. В **TAB** справа от ника показывать **тег клана** (цвет и жирность настраиваются).
3. Настройка тега — через **GUI OPAC** (название клана) + команды мода **isnix-opac-tab** (цвет и жирность).

---

## Часть 1. Админ: упростить GUI OPAC

### 1.1. Остановите сервер

Файл **`config/openpartiesandclaims-server.toml`** перезаписывается при работе сервера. Редактируйте только при **выключенном** сервере.

### 1.2. Настройки приватов для игроков

Раньше список `playerConfigurablePlayerConfigOptions` был слишком коротким (только имя клана и цвет региона) — игроки **не могли** менять защиту приватов в меню `'`.

**Сейчас восстановлен полный заводской список OPAC 0.26.3** (защита чанков, доступ party, сундуки, двери, forceload и т.д.) + **`parties.name`** для кланов (не `party.name` — в OPAC 0.26 id именно `parties.name`).

Файл-образец: `docs/config-samples/openpartiesandclaims-player-options.snippet.toml`  
Генерация списка: `python scripts/gen_opac_player_options.py`

> Редактировать `config/openpartiesandclaims-server.toml` только при **выключенном** сервере, иначе OPAC перезапишет файл.

### 1.3. Что видят обычные игроки в меню `'

| Раздел | Кто видит | Зачем |
|--------|-----------|--------|
| **My player config** | Все | Имя клана, имя/цвет регионов на карте |
| **Claims / карта** | Все | Приваты, суб-регионы |
| **Server claims / Wilderness / Expired** | Только OP | Игрокам не нужны — не трогайте без необходимости |

Управление **составом клана** (пригласить, кик, передать лидера) — команды `/openpac-parties` (см. ниже). В 0.26.x часть действий может быть в UI — если есть кнопка «Party», используйте её.

### 1.4. Перезапуск

Сохраните toml → запустите сервер → проверьте под обычным игроком: в **My player config** только 3 настройки выше.

---

## Часть 2. Мод isnix-opac-tab (тег в TAB)

OPAC **не отдаёт** готовый placeholder в TAB. Мод **`isnix-opac-tab`** читает название клана из OPAC и добавляет цвет/жирность.

### 2.1. Установка

1. Соберите jar: папка `isnix-opac-tab` → `./gradlew build` → `build/libs/isnix-opac-tab-1.0.0.jar`.
2. Положите jar в **`mods/`** на сервере (рядом с OPAC и Placeholder API).
3. Перезапустите сервер.
4. В логе должно быть: `ISNIX OPAC Tab: placeholder %isnix:clan_tag%`.

Конфиг (создаётся сам): **`config/isnix-opac-tab.json`**.

### 2.2. Placeholder для TAB

**Эталонные файлы в репозитории** (проверены под TAB 5.5 + isnix-opac-tab):

- [config-samples/tab/groups.yml](config-samples/tab/groups.yml) → `config/tab/groups.yml`
- [config-samples/tab/config.yml](config-samples/tab/config.yml) → фрагмент в `config/tab/config.yml`
- [config-samples/tab/README.md](config-samples/tab/README.md) — чеклист

Минимум в **`groups.yml`** для `_DEFAULT_`:

```yaml
tabprefix: "%luckperms:prefix%"
tabsuffix: "%luckperms:suffix% %isnix:clan_tag%"
tagprefix: "%luckperms:prefix%"
tagsuffix: "%luckperms:suffix% %isnix:clan_tag%"
```

В **`config.yml`** должны быть включены форматы с `%tabsuffix%` / `%tagsuffix%` (см. образец).

После правок: **рестарт** или **`/tab reload`** (см. [admin-commands-ru.md](admin-commands-ru.md)).

---

## Часть 3. Игроки: клан и тег

### 3.1. Создать клан (лидер)

```
/openpac-parties create
```

Пригласить:

```
/openpac-parties invite <ник>
```

Принять приглашение:

```
/openpac-parties join <ник_лидера>
```

Чат клана: **`/opm <сообщение>`** или **`/openpac-parties chat`**.

### 3.2. Текст тега — в GUI OPAC

1. Клавиша **`'`** (апостроф, рядом с Enter) — меню OPAC.
2. **My player config** → опция **Party name** (название клана).
3. Введите текст тега **в квадратных скобках**, например: `[Wolves]` или `Wolves` (мод сам обернёт в `[...]` при показе в TAB).

Это имя видят все участники клана в TAB (через placeholder).

### 3.3. Оформление тега — команды (только владелец клана)

| Команда | Пример | Эффект |
|---------|--------|--------|
| `/clantag help` | — | Список команд |
| `/clantag name <текст>` | `/clantag name GKSAS` | Текст тега (Party name OPAC) |
| `/clantag color <цвет>` | `/clantag color gold` | Цвет |
| `/clantag bold on` / `off` | — | Жирный |
| `/clantag italic on` / `off` | — | Курсив |
| `/clantag underline on` / `off` | — | Подчёркивание |
| `/clantag strike on` / `off` | — | Зачёркнутый |
| `/clantag reset` | — | Сброс стиля (текст клана не трогает) |
| `/clantag preview` | — | Превью как в TAB |
| `/clantag show` | — | Настройки (видят все в клане) |
| `/clantag sync` | — | Обновить из Party name |

Цвета: `black`, `dark_blue`, `dark_green`, `dark_aqua`, `dark_red`, `dark_purple`, `gold`, `gray`, `dark_gray`, `blue`, `green`, `aqua`, `red`, `light_purple`, `yellow`, `white` или код `0`–`f`, `&6`.

Стили сохраняются в **`config/isnix-opac-tab.json`** по UUID владельца клана (образец: [config-samples/isnix-opac-tab.json](config-samples/isnix-opac-tab.json)).

**Альтернатива:** в **Party name** сразу `&6&l[GKSAS]` — тогда команды цвета/жирности не нужны (коды в имени важнее).

### 3.4. Регионы (приваты)

- Захват: UI OPAC или карта Xaero (если мод на клиенте).
- **Claims name** — подпись региона на карте.
- **Claims color** — цвет на карте (hex), **не** цвет в TAB.

---

## Часть 4. Проверка

1. Игрок A создаёт клан, ставит Party name `[Test]`, `/clantag color aqua`, `/clantag bold on`.
2. Игрок B вступает в клан.
3. Оба в TAB справа видят цветной жирный `[Test]`.
4. Игрок без клана — суффикс пустой.
5. `/tab reload` после любых правок TAB.

---

## Часть 5. Частые проблемы

| Проблема | Решение |
|----------|---------|
| В TAB нет тега | Установлен ли `isnix-opac-tab`? Есть ли `%isnix:clan_tag%` в groups.yml? `/tab reload` |
| В пати только `[Клан] Ник`, без `[Админ]` и тега после ника | Обновите `isnix-opac-tab` **1.0.4+**, рестарт; в `groups.yml`: `tabsuffix: "%luckperms:suffix% %isnix:clan_tag%"` |
| `ConcurrentModificationException` + TAB в логе | Тот же **1.0.4** (кэш тега, без OPAC из Netty) |
| `%isnix:clan_tag%` или `%synced:isnix:clan_tag%` виден текстом | В `groups.yml` должно быть **`%isnix:clan_tag%`**, не `%sync:...%`. Мод не загрузился — `latest.log` |
| В GUI OPAC снова куча опций | Сервер правили при **включённом** сервере — toml перезаписался; правьте снова **офлайн** |
| «Нет прав» на `/clantag` | Команды только **владельцу** клана OPAC |
| Тег не обновился | `/clantag sync` или перезайти; OPAC Party name должен быть у **лидера** |

---

## Краткая шпаргалка для Discord/VK

```
Клан: /openpac-parties create → invite → join
Тег в TAB: ' → My player config → Party name → [Имя]
Цвет/жирность: /clantag color green  и  /clantag bold on
Чат клана: /opm текст
Приваты: ' → карта/claims
```

---

Связанные файлы в репозитории:

- `docs/config-samples/openpartiesandclaims-player-options.snippet.toml`
- `docs/config-samples/tab-groups-clan.snippet.yml`
- `docs/isnix-opac-tab-mod.md` — сборка мода
