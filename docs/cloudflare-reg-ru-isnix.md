# isnix.ru на reg.ru → Cloudflare (Worker api + сайт на Pages)

## Перед сменой NS — обязательно

В **reg.ru** → домен **isnix.ru** → **DNS-серверы / Ресурсные записи** — **скриншот или выписка** всех записей:

- `@` / `isnix.ru` (сайт)
- `www`
- **`mc`** (сервер Minecraft — не потерять!)
- любые `mail`, `api` и т.д.

Потом те же записи внесёшь в Cloudflare → **DNS → Records**.

---

## Шаг 1. Cloudflare — добавить сайт

1. [dash.cloudflare.com](https://dash.cloudflare.com) → **Websites** → **Add a site**
2. Домен: `isnix.ru` → **Free** → Continue
3. Cloudflare покажет **2 nameserver’а**, например:
   - `ada.ns.cloudflare.com`
   - `bob.ns.cloudflare.com`
   (у тебя будут свои — копируй **точно** из панели)

---

## Шаг 2. reg.ru — сменить NS

1. [reg.ru](https://www.reg.ru) → **Домены** → **isnix.ru**
2. **DNS-серверы** / **Делегирование** → **Свои DNS-серверы** (или «Указать серверы»)
3. Удали старые NS reg.ru, вставь **два NS от Cloudflare**
4. Сохрани. Обновление DNS: от **15 минут** до **24–48 часов**

Пока NS не обновились, Custom Domain `api.isnix.ru` в Worker может быть «ожидание».

---

## Шаг 3. Cloudflare DNS — не сломать сайт и mc

**Websites → isnix.ru → DNS → Records**

### Сайт GitHub Pages (как у GitHub)

| Тип | Имя | Содержимое | Прокси |
|-----|-----|------------|--------|
| A | `@` | `185.199.108.153` | DNS only (серое облако) |
| A | `@` | `185.199.109.153` | DNS only |
| A | `@` | `185.199.110.153` | DNS only |
| A | `@` | `185.199.111.153` | DNS only |
| CNAME | `www` | `NIXXXON177.github.io` | DNS only |

*(Если в reg.ru было иначе — **повтори как было**, не только эту таблицу.)*

GitHub → репозиторий **isnix.ru** → **Settings → Pages** → Custom domain должен быть `isnix.ru` / `www.isnix.ru`.

### Minecraft (как в reg.ru — не менять значения)

| Тип | Имя | Значение | Прокси |
|-----|-----|----------|--------|
| CNAME | `mc` | `c11.play2go.cloud` | **DNS only** |
| SRV | `_minecraft._tcp.mc` | см. ниже | **DNS only** |

**SRV** (полная копия с reg.ru):

| Поле | Значение |
|------|----------|
| Service (в reg.ru) | `_minecraft._tcp.mc` |
| Priority | `0` |
| Weight | `5` |
| Port | `20122` |
| Target | `c11.play2go.cloud` |

В Cloudflare: **Add record → SRV** → имя `_minecraft._tcp.mc`, priority `0`, weight `5`, port `20122`, target `c11.play2go.cloud`.  
Либо в поле **Content**: `0 5 20122 c11.play2go.cloud`

Без `mc` + SRV лаунчеры могут не найти порт **20122** на Play2GO.

### API Supabase (Worker)

После привязки Worker (шаг 4) Cloudflare может создать запись сам. Или вручную:

| Тип | Имя | Содержимое | Прокси |
|-----|-----|------------|--------|
| AAAA | `api` | `100::` | **Proxied** (оранжевое) |

---

## Шаг 4. Worker → api.isnix.ru

1. **Workers & Pages** → **sparkling-river-2d30**
2. **Domains & Routes** → **Add** → **Custom Domain** → `api.isnix.ru`
3. Дождись статуса **Active**

Проверка:

```text
https://api.isnix.ru/auth/v1/health
```

JSON: `No API key found in request` — ок.

---

## Шаг 5. GitHub + Supabase

| GitHub Secret | Значение |
|---------------|----------|
| `SUPABASE_URL` | `https://api.isnix.ru` |
| `SUPABASE_ANON_KEY` | без изменений |

**Actions → Deploy Pages → Run workflow**

Supabase → **Authentication → Site URL**: `https://isnix.ru` (не api).

---

## Пока NS на reg.ru не сменил

Секрет **`SUPABASE_URL`** =  
`https://sparkling-river-2d30.kudrasovn024.workers.dev`  
— сайт уже может ходить в Supabase через Worker.

---

## Частые ошибки

| Проблема | Решение |
|----------|---------|
| Сайт isnix.ru не открывается | A-записи на GitHub, прокси для `@` выключен |
| mc.isnix.ru не резолвится | Верни запись `mc` из reg.ru |
| api не работает | Оранжевое облако на `api`, Worker Custom Domain Active |
| SSL на api | Подожди 15–30 мин после Active |
