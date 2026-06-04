# Эталонные конфиги сервера ISNIX (Play2GO)

## Bedrock (Geyser)

| Файл | Куда на сервере |
|------|-----------------|
| [geyser/config.yml](geyser/config.yml) | `config/Geyser-Fabric/config.yml` |

Полная установка: [bedrock-geyser-play2go-ru.md](../bedrock-geyser-play2go-ru.md).

Скопируйте на сервер через SFTP или `python scripts/deploy_server_configs.py` (нужен `server-sftp.env`).

| Файл в репозитории | Путь на сервере | Когда применять |
|--------------------|-----------------|-----------------|
| [tab/groups.yml](tab/groups.yml) | `config/tab/groups.yml` | `/tab reload` или рестарт |
| [tab/users.yml](tab/users.yml) | `config/tab/users.yml` | то же |
| [tab/config.yml](tab/config.yml) | слить в `config/tab/config.yml` | рестарт |
| [openpartiesandclaims-server.snippet.toml](openpartiesandclaims-server.snippet.toml) | слить в `config/openpartiesandclaims-server.toml` | **только при выключенном сервере** |
| [openpartiesandclaims-player-options.snippet.toml](openpartiesandclaims-player-options.snippet.toml) | блок `playerConfigurablePlayerConfigOptions` | сервер **выключен** |
| [isnix-opac-tab.json](isnix-opac-tab.json) | `config/isnix-opac-tab.json` | рестарт (стили дополняет `/clantag`) |
| [isnix-chat.json](isnix-chat.json) | `config/isnix-chat.json` | рестарт |
| [isnix-server-messages.json](isnix-server-messages.json) | `config/isnix-server-messages.json` | рестарт |
| [isnix-market.json](isnix-market.json) | `config/isnix-market/isnix-market.json` | рестарт |
| [styled-chat.json](styled-chat.json) | `config/styled-chat.json` | `/styledchat reload` |
| [isnix-player-stats.example.json](isnix-player-stats.example.json) | `config/isnix-player-stats.json` | рестарт; **ключ только на сервере** |

## Критичные правила

1. **TAB:** префиксы — `%luckperms:prefix%` (с `:`). Не дублировать `[Админ]` в `users.yml`.
2. **OPAC:** `permissionSystem = "luck_perms"` (не `prometheus`).
3. **OPAC toml** — править только при **Stop** сервера.
4. **isnix-player-stats** — `service_role_key` из Supabase → Dashboard → API → service_role. **Не коммитить в git.**

## После заливки

```text
/tab reload
/styledchat reload
```

Полный рестарт — если меняли OPAC toml, isnix-* json или моды.

Подробнее: [opac-tab-klany-ru.md](../opac-tab-klany-ru.md), [restart-checklist-ru.md](../restart-checklist-ru.md).
