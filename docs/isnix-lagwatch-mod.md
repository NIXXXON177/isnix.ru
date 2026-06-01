# ISNIX LagWatch — детект лаг-машин

Fabric **1.21.1**, серверный мод `isnix-lagwatch`.

Считает **обновления блоков** в чанке (mixin) и **сущности** (предметы, стойки и т.д.). При превышении порога — **лог** и сообщение **OP** в чат.

## Команды (OP 4+)

| Команда | Описание |
|---------|----------|
| `/lagwatch status` | Последние подозрительные чанки |
| `/lagwatch scan [радиус]` | Скан сущностей вокруг (1–8 чанков, по умолчанию 2) |
| `/lagwatch reload` | Перечитать `config/isnix-lagwatch.json` |

## Конфиг

`config/isnix-lagwatch.json` — образец: [isnix-lagwatch.json](config-samples/isnix-lagwatch.json)

| Поле | По умолчанию | Смысл |
|------|--------------|--------|
| `blockUpdatesPerSecondThreshold` | 400 | Обновлений блоков за интервал (~1 сек) |
| `entityCountThreshold` | 250 | Сущностей в чанке (без игроков) |
| `itemEntityCountThreshold` | 120 | Предметов на земле |
| `alertCooldownSeconds` | 60 | Не спамить алерт по одному чанку |

**Ложные срабатывания:** iron farm, villager breeder — при необходимости **поднять пороги** или временно `enabled: false` при постройке.

## Установка

1. Собрать: `cd isnix-lagwatch && ./gradlew build`
2. `mods/isnix-lagwatch-1.0.0.jar`
3. **Restart** сервера
4. Проверка: `/lagwatch status`

## Связь с правилами

Подозрение ≠ автобан. Админ идёт по координатам, проверяет §4 (лагающие фермы) / §2.5 (эксплойты).

## Версии

**1.0.0** — первый релиз: счётчик блоков, entity scan, алерты, команды.
