# Привязка Java + Bedrock (Floodgate на Fabric)

## Если в чате «Неизвестная или неполная команда» на `/linkaccount`

Сообщения **Global Linking is enabled** при этом — норма: глобальная привязка включена, но **на нашем Fabric-сервере** команда `/linkaccount` **часто не регистрируется**, пока не поставлена **локальная база** (sqlite) + права LuckPerms.

### Вариант А — сейчас для игроков (без правок сервера)

Привязка на **отдельном сервере Geyser** (работает с Global Linking):

| | |
|--|--|
| **Java** | `link.geysermc.org` порт **25565** |
| **Bedrock** | `link.geysermc.org` порт **19132** |

1. Зайти **с ПК** на `link.geysermc.org` → `/linkaccount` → код в чате.  
2. Зайти **с телефона** на тот же сервер → `/linkaccount 123456` (свой код).  
3. После успеха зайти на **ISTHISNIXXXON** (`mc.isnix.ru` / `bedrock.isnix.ru`) — привязка сохранится.

Перед привязкой: **/login** на нашем сервере, если EasyAuth просит.

---

## Вариант Б — `/linkaccount` прямо на ISTHISNIXXXON (админ)

### 1. Локальная база (обязательно на Fabric)

1. Скачать **floodgate-sqlite-database** с CI Geyser: https://ci.opencollab.dev/job/GeyserMC/job/Floodgate/ (артефакт `floodgate-sqlite-database.jar` или аналог из последнего успешного build).  
2. Положить JAR в **`mods/`** (рядом с Floodgate-Fabric).  
3. В `config/floodgate/config.yml`:

```yaml
player-link:
  enabled: true
  enable-global-linking: true
  enable-own-linking: true
  allowed: true
  type: sqlite
```

4. **Рестарт** сервера. В логе не должно быть ошибок SqliteDatabase при старте.

### 2. LuckPerms

На **Fabric** команды Floodgate не выдаются автоматически — нужны права в **LuckPerms**.

## Консоль сервера (скопировать)

```text
lp group default permission set floodgate.command.linkaccount true
lp group default permission set floodgate.command.unlinkaccount true
lp sync
```

Проверка:

```text
lp user <ник> permission check floodgate.command.linkaccount
```

Должно быть **true**.

## Как привязать ПК и телефон (игрокам)

1. Оба аккаунта **в мире онлайн** (Java + Bedrock).
2. На **ПК (Java):** `/linkaccount` — в чат придёт **числовой код** (не команда целиком).
3. На **телефоне (Bedrock):** `/linkaccount 123456` — подставь **свой** код **через пробел**, одной строкой.
4. Успех — обычно кик с сообщением о привязке; дальше вход с Bedrock = данные Java.

**Не так:** `/linkaccount` на телефоне без кода (будет ошибка «неполная команда»).  
**Не так:** `linkaccount` без слэша `/`.

## Если на сервере всё равно не работает

**Global Linking** (раз на все серверы Geyser):

1. Зайти на **link.geysermc.org** (Java порт **25565**, Bedrock **19132**).
2. Там же: `/linkaccount` → код → `/linkaccount <код>` на втором клиенте.

Подробнее: https://geysermc.org/wiki/floodgate/linking/

## Конфиг Floodgate

`config/floodgate/config.yml`:

- `player-link.enabled: true`
- `player-link.enable-global-linking: true`
- `player-link.allowed: true`

После правок — рестарт сервера.
