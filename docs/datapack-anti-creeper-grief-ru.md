# Anti Creeper Grief — не работает на 1.21.1

## Причина

В `world/datapacks` лежала версия **«MC 26.1»** с `pack_format: 101`.  
Сервер **Minecraft 1.21.1** принимает датапаки с форматом **48** (как у «fast leaf decay (MC 1.21-1.21.11)»).

Несовместимый пак **не загружается** — криперы взрываются как обычно.

## Исправление

1. Удалить папку `anti creeper grief v1.1.16 (MC 26.1)`.
2. Поставить сборку для 1.21.1 из репозитория: `server-datapacks/anti-creeper-grief-1.21.1/`.
3. Или скачать заново с [vanillatweaks.net](https://www.vanillatweaks.net/picker/datapacks/) — версия **1.21**, не **26.1**.
4. В игре или консоли: `reload` или перезапуск сервера.
5. Проверка: `/datapack list` — пак должен быть в **enabled**.

## Как работает

Каждую секунду криперам без тега `acg_tagged` выставляется `ExplosionRadius: 0` (блоки не ломаются; урон игрокам может остаться — особенность Vanilla Tweaks).
