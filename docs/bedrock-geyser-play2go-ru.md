# Bedrock (телефон / консоль) — Geyser + Floodgate на Play2GO

Сервер **Java Fabric 1.21.1** остаётся на порту **20122**. Bedrock — **Geyser** на порту **20545**.

**Статус деплоя (репозиторий):** моды и конфиг заливаются скриптом `python scripts/deploy_bedrock_geyser.py` (SFTP). После заливки нужен **рестарт** в панели Play2GO.

## Распределение портов (3 allocation)

| Порт | Назначение | Протокол |
|------|------------|----------|
| **20122** | Minecraft **Java** (`mc.isnix.ru` + SRV) | TCP |
| **20545** | **Bedrock** (Geyser) | **UDP** (обязательно) |
| **20958** | Резерв (query, тест, второй сервис) | по необходимости |

В панели Play2GO → **Network** подпиши allocation, например: `20545 — Bedrock UDP (Geyser)`.

**Важно:** Bedrock без **UDP** на выделенном порту не заработает. Если у allocation только TCP — напиши в поддержку Play2GO или уточни, можно ли включить UDP на **20545**.

---

## Шаг 1. Скачать моды (Minecraft **1.21.1**, Fabric)

Положить в `mods/` на сервере (оба обязательны):

| Мод | Откуда |
|-----|--------|
| **Geyser-Fabric** | https://geysermc.org/download → Fabric → версия под **1.21.1** |
| **Floodgate-Fabric** | https://modrinth.com/mod/floodgate → файл для **1.21.x** (например `Floodgate-Fabric-2.2.4-b37.jar` для 1.21–1.21.3) |

Порядок: сначала **Floodgate**, потом **Geyser** (как в [wiki Geyser](https://wiki.geysermc.org/geyser/setup/)).

После заливки — **полный рестарт** сервера в Play2GO.

---

## Шаг 2. Конфиг Geyser

Файл на сервере: `config/Geyser-Fabric/config.yml`  
Образец: [config-samples/geyser/config.yml](../config-samples/geyser/config.yml)

Главное:

```yaml
bedrock:
  port: 20545
  address: 0.0.0.0

remote:
  address: 127.0.0.1
  port: 20122
  auth-type: floodgate
```

- `remote.port` = **тот же порт, что Java-сервер** (у вас **20122**, не 25565).
- `bedrock.port` = **20545** (второй allocation).

После правки: `/geyser reload` или рестарт.

---

## Шаг 3. Floodgate (ключ для offline + вайтлист)

Файл: `config/floodgate/config.yml` — после первого запуска.  
Ключ `key.pem` генерируется сам; **не удалять** и бэкапить.

На сервере **`online-mode=false`** + **EasyAuth** + **EasyWhitelist** — Floodgate нужен, чтобы Bedrock-игроки входили без лицензии Java.

EasyAuth **поддерживает Floodgate** (регистрация `/reg`, вход `/login` для Bedrock-ника).

### Один аккаунт: ПК (Java) и телефон (Bedrock)

Без привязки Java и Bedrock — **два разных персонажа** (разные ники/UUID, отдельные `/reg`, разный инвентарь).

**Решение:** Floodgate **player-link** + команда **`/linkaccount`** ([wiki](https://geysermc.org/wiki/floodgate/linking/)).

**На сервере (админ):** в `config/floodgate/config.yml` секция `player-link` как в [config-samples/floodgate/config.yml](../config-samples/floodgate/config.yml) (`enabled: true`, `enable-global-linking: true`). После правки — рестарт. Скрипт деплоя кладёт образец в `config/floodgate/player-link-snippet.yml` на SFTP.

**Игрокам (кратко):**

1. Сначала играй на **ПК (Java)** — создай персонажа, `/reg`, построй базу (это будет «главный» аккаунт).
2. Зайди с **Bedrock** (`bedrock.isnix.ru`), тот же вайтлист-ник по смыслу (Bedrock-ник может быть с точкой `.` в логе — см. шаг 5).
3. На **Java** введи `/linkaccount` → в чат придёт **код**.
4. На **Bedrock** (тот же мир, онлайн): `/linkaccount <код>`.
5. После успеха оба входа используют **данные Java** (инвентарь, координаты, EasyAuth). Вещи с Bedrock-«клона» до привязки **не переносятся** — переложи в сундук на Java до `/linkaccount` или отвяжи и перенеси (`/unlinkaccount`, если доступно).

**Важно:** привязка ≠ второй ник в вайтлисте (§9.2). Один человек — лучше **link**, а не два ника в WL без уведомления админам.

**Права (обязательно на Fabric):** в консоли LuckPerms — см. [luckperms-floodgate-linkaccount.md](luckperms-floodgate-linkaccount.md). Без `floodgate.command.linkaccount` игрок видит «Неизвестная или неполная команда».

**Если код не срабатывает:** оба клиента в мире онлайн; на Bedrock код вводится как `/linkaccount 123456` (пробел + цифры); код ~5 мин. Альтернатива: `link.geysermc.org` (Java 25565, Bedrock 19132).

---

## Шаг 4. DNS (Cloudflare / reg.ru)

Java уже настроен: `mc` → `c11.play2go.cloud`, SRV `_minecraft._tcp.mc` → порт **20122**.

Для Bedrock (удобно отдельное имя):

| Тип | Имя | Значение | Прокси |
|-----|-----|----------|--------|
| CNAME | `bedrock` | `c11.play2go.cloud` | **DNS only** |
| SRV | `_minecraft._udp.bedrock` | `0 5 20545 c11.play2go.cloud` | **DNS only** |

В Cloudflare: **Add record → SRV**  
Service: `_minecraft._udp.bedrock`, Priority `0`, Weight `5`, Port **20545**, Target `c11.play2go.cloud`.

Игрокам показываем только **`bedrock.isnix.ru`** (порт **20545** вручную, если SRV не сработал).  
DNS: **[dns-bedrock-isnix-ru.md](dns-bedrock-isnix-ru.md)** — CNAME `bedrock` → `c11.play2go.cloud` + SRV UDP **20545**.

---

## Шаг 5. Вайтлист для Bedrock-игроков

Заявка на сайте — по **нику, с которым заходят в Bedrock** (часто Xbox gamertag).

Floodgate на сервере даёт ник с **точкой в начале**: `.ИмяИгрока` (не всегда, смотри лог при первом входе).

### Вариант A — после первого захода (проще)

1. Временно снять вайтлист: `/whitelist off` (только если доверяешь окружению).
2. Игрок заходит с Bedrock → в консоли виден точный ник.
3. Добавить: `/fwhitelist add <ник_из_лога>` (команда Floodgate).
4. Снова: `/whitelist on`.

### Вариант B — вручную в `whitelist.json`

Добавить запись с **именем как в логе** (часто `.Ник`) и UUID из Floodgate / offline.  
После одобрения заявки с сайта для **чисто Bedrock**-ника GitHub Actions может поставить Java-offline UUID — если не пускает, используй **вариант A** или `/fwhitelist add`.

### Заявка на isnix.ru

В заявке указать **тот ник, что будет в Bedrock** (латиница, без пробелов). В комментарии админу: «только Bedrock» — после одобрения проверить ник в логе Geyser.

---

## Шаг 6. Проверка

1. Консоль после старта: Geyser слушает **UDP 20545**, подключение к **127.0.0.1:20122**.
2. Bedrock-клиент: сервер **`bedrock.isnix.ru`** (порт **20545**, если нужно).
3. Игрок в вайтлисте → `/reg` / `/login` (EasyAuth).
4. В игре: таб, чат, `/sell` — как у Java (часть модов Bedrock не видит блоки/скины — это норма Geyser).

Команды:

```text
/geyser help
/fwhitelist list
```

---

## Частые проблемы

| Симптом | Решение |
|---------|---------|
| Bedrock «не может подключиться» | UDP **20545** открыт в Play2GO; firewall; верный порт в `config.yml` |
| Java работает, Bedrock нет | `remote.port: 20122`; Floodgate установлен; рестарт |
| «Not whitelisted» | Ник с точкой `.` — `/fwhitelist add` или правка whitelist |
| Застрял без движения | `/login` после EasyAuth |
| Два порта на одном IP | Java **20122** TCP, Bedrock **20545** UDP — не путать |

---

## Сайт и описания (после запуска)

На сайте и в постах: только **`bedrock.isnix.ru`** (не play2go). DNS — [dns-bedrock-isnix-ru.md](dns-bedrock-isnix-ru.md).

Связанные доки: [cloudflare-reg-ru-isnix.md](cloudflare-reg-ru-isnix.md), [auto-whitelist-deploy-ru.md](auto-whitelist-deploy-ru.md), [restart-checklist-ru.md](restart-checklist-ru.md).
