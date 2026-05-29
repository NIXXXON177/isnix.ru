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

В **`config/tab/groups.yml`** у группы **`_DEFAULT_`** (или у каждой группы) добавьте к суффиксу:

```yaml
_DEFAULT_:
  tabprefix: "%luckperms:prefix%"
  tabsuffix: "%luckperms:suffix% %isnix:clan_tag%"
```

Если префикс/суффикс LuckPerms уже заданы в `config.yml` в `tablist-name-formatting`, можно там:

```yaml
tablist-name-formatting:
  enabled: true
  format: "%luckperms:prefix%%player%%luckperms:suffix% %isnix:clan_tag%"
```

После правок: **`/tab reload`**.

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

### 3.3. Цвет и жирность — команды (только владелец клана)

| Команда | Пример | Эффект в TAB |
|---------|--------|----------------|
| `/clantag color <цвет>` | `/clantag color green` | Зелёный тег |
| `/clantag color <0-9,a-f>` | `/clantag color 2` | Код цвета Minecraft |
| `/clantag bold on` | — | Жирный тег |
| `/clantag bold off` | — | Обычный |
| `/clantag show` | — | Показать текущие настройки |
| `/clantag sync` | — | Взять текст из Party name в OPAC |

Цвета по имени: `black`, `dark_blue`, `dark_green`, `dark_aqua`, `dark_red`, `dark_purple`, `gold`, `gray`, `dark_gray`, `blue`, `green`, `aqua`, `red`, `light_purple`, `yellow`, `white`.

**Альтернатива без команд:** в поле **Party name** можно сразу писать коды: `&2&l[Wolves]` — тогда цвет/жирность из OPAC; команды `/clantag` не обязательны.

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
| `%isnix:clan_tag%` виден текстом | Нет Placeholder API или мод не загрузился — смотрите `latest.log` |
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
