# DNS: bedrock.isnix.ru

Игроки вводят только **`bedrock.isnix.ru`**.  
Сервер на Play2GO: **`c11.play2go.cloud:20545`** (UDP, Geyser).

## Ваш случай: NS на Cloudflare, reg.ru только делегирует

В reg.ru указано: *«Для управления ресурсными записями обратитесь к провайдеру DNS»* — NS `dell.ns.cloudflare.com` / `pedro.ns.cloudflare.com`.

**Все записи добавляются только в Cloudflare**, не в reg.ru.

Панель: [Cloudflare → isnix.ru → DNS → Records](https://dash.cloudflare.com/) → **Add record** (сейчас 8 записей, Bedrock ещё нет).

## Запись 1 — CNAME

| Поле Cloudflare | Значение |
|-----------------|----------|
| Type | **CNAME** |
| Name | `bedrock` |
| Target | `c11.play2go.cloud` |
| Proxy status | **DNS only** (серое облако, как у `mc`) |
| TTL | Auto |

## Запись 2 — SRV (UDP, порт Bedrock)

По аналогии с Java: `_minecraft._tcp.mc` → `5 20122 c11.play2go.cloud`.

| Поле Cloudflare | Значение |
|-----------------|----------|
| Type | **SRV** |
| Name | `_minecraft._udp.bedrock` |
| Priority | `0` |
| Weight | `5` |
| Port | **`20545`** (не 20122) |
| Target | `c11.play2go.cloud` |
| Proxy | **DNS only** |

Либо в **Content** одной строкой: `0 5 20545 c11.play2go.cloud`

После сохранения в списке должно быть **10 записей** (было 8 + 2 Bedrock). Записи **mc** и `_minecraft._tcp.mc` **не трогать**.

## Чего не делать

- **reg.ru** — зона не редактируется (только NS на Cloudflare).
- **Прокси Cloudflare** для `bedrock` и SRV — **выключен** (игра не ходит через CDN).
- Порт **20122** — только Java; Bedrock = **20545** UDP.

## Проверка (5–15 минут)

```powershell
nslookup bedrock.isnix.ru
nslookup -type=SRV _minecraft._udp.bedrock.isnix.ru
```

В Minecraft Bedrock: сервер **`bedrock.isnix.ru`**. Если порт не подставился — вручную **20545**.

## Сервер (Play2GO)

Моды Geyser + Floodgate и порт 20545 в панели — см. [bedrock-geyser-play2go-ru.md](bedrock-geyser-play2go-ru.md). После заливки конфига — **рестарт** сервера.

## Сайт

На главной и в `how-to-play.html`: **bedrock.isnix.ru** (порт 20545 в подсказке).
