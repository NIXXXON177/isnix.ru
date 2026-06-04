# ISNIX Guide — путеводитель в игре (Fabric 1.21.11)

Серверный мод: вкладка **ISTHISNIXXXON** в достижениях (Esc), книга при первом входе, автовыдача шагов за OPAC и рынок.

## Установка

1. Собрать: `python scripts/build_isnix_mods_12111.py` (или `cd isnix-guide && gradlew.bat build`).
2. Jar в `mods/` на сервере: **`isnix-guide-1.0.0.jar`**.
3. Пересобрать **`isnix-market`** (хуки на `/sell`) и залить обновлённый jar.
4. Рестарт сервера.

Конфиг: `config/isnix-guide.json`  
Прогресс игроков: `world/isnix-guide-progress.json`

## Достижения (вкладка isnix)

| ID | Как получить |
|----|----------------|
| `isnix:root` | Автоматически (открывает вкладку) |
| `isnix:welcome` | Первый вход + книга |
| `isnix:opac_claim` | Поставлен claim OPAC |
| `isnix:market_seller` | Первый лот через `/sell` |
| `isnix:market_buyer` | Первая покупка на рынке |
| `isnix:create_andesite` | Андезитовый сплав в инвентаре (Create) |

Ветка **Create** — отдельно из мода Create-Fly.

## Сайт

Полный текст: [guide.html](../guide.html) на isnix.ru.
