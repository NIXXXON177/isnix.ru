# Оптимизация сервера (май 2026)

Применено через SFTP на Play2GO.

## ServerCore

- `config/servercore/optimizations.yml`: `fast-biome-lookups: true`, `cancel-duplicate-fluid-ticks: true`
- `config/servercore/config.yml`: `dynamic.enabled: true`, `target-mspt: 35`

После перезапуска: `/servercore status`, при лагах — `/spark tps`.

## Удалено (модов нет / дубликаты)

- `config/c2me.toml`
- `config/modernfix-mixins.properties`
- `config/auctionhouse.json`
- `config/InertiaAntiCheat/InertiaAntiCheat.toml`
- `mods/placeholder-api-2.4.2+1.21 (1).jar`
- `mods/fabric-language-kotlin-1.13.11+kotlin.2.3.21 (1).jar`

## Не менялось

- `activation-range` — выключен (фермы)
- `packetfixer.properties` — `allSizesUnlimited=true` оставлен
- `view-distance` / `simulation-distance` в `server.properties`

## Нужен перезапуск сервера

Изменения ServerCore и удаление jar требуют **полного рестарта** в панели Play2GO.
