# Хаб и миры ISTHISNIXXXON

## Схема

| Мир | ID | Назначение |
|-----|-----|------------|
| **Хаб** | `hub/` (плоский overworld) | Спавн, два портала |
| **Модовое** | `modded` | Create, Sable, боссы, Terralith |
| **Спокойное** | `vanilla` | Vanilla+ — тот же клиент, проще выживание |

Порталы: зайди в **obsidian-рамку** (регион в `config/multiworld.yml`).

## Развёртывание

```bash
node scripts/setup_hub_worlds.mjs
# stop server in Play2Go
node scripts/setup_hub_worlds.mjs --apply-worlds   # optional backup rename
# start server
```

Первый запуск: `kubejs/server_scripts/isnix_hub_init.js`.

## Команды

```
/mw list
/mw tp modded
/mw tp vanilla
/mw spawn
```

См. [server-worlds-ru.md](server-worlds-ru.md).
