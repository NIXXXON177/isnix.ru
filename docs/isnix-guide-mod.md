# ISNIX Guide — путеводитель в игре (Fabric 1.21.11)

Серверный мод: вкладка **ISTHISNIXXXON** в достижениях (Esc), книга при первом входе, автовыдача шагов за OPAC и рынок.

## Установка

1. Собрать: `python scripts/build_isnix_mods_12111.py isnix-guide` (или полная сборка модов).
2. Jar в `mods/` на сервере: **`isnix-guide-1.0.6.jar`**.
3. Рестарт сервера.

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
| `isnix:create_andesite` | Андезитовый сплав в инвентаре |
| `isnix:create_brass` | Латунь |
| `isnix:create_water_wheel` | Водяное колесо |
| `isnix:create_press` | Механический пресс |
| `isnix:create_belt` | Belt connector (конвейер) |

## Команда

| Команда | Действие |
|---------|----------|
| `/guidebook` | Книга-путеводитель (первый вход или повторно) |

Отдельная большая ветка **Create** — из мода Create-Fly (дополнительные достижения мода).

## Сайт

Полный текст: [guide.html](../guide.html) на isnix.ru.
