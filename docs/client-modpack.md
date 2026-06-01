# Клиентская сборка ISTHISNIXXXONmods.zip

Сборка **только для игроков** — моды в папке `mods` клиента Fabric 1.21.1.

## Что внутри

| Категория | Примеры |
|-----------|---------|
| Обязательно (версия = сервер) | Fabric API, Voice Chat, OPAC, styled-chat, isnix-chat, Female Gender + зависимости |
| Клиентский UX | Sodium, Iris, Lithium, Xaero Map/Minimap, Jade, EMI, Mod Menu, IPN, звук и HUD |

## Чего нет (и не нужно ставить)

- Админ и инфраструктура: EasyAuth, LuckPerms, TAB, GrimAC, isnix-modtools, WorldEdit…
- Серверный QoL: **FallingTree**, **trade** (`environment: server`), FastRTP, doubledoors, fsit, ItemFrament — работают на сервере
- isnix-market (`/sell`), isnix-graveguard, isnix-reputation и т.п.

## Пересборка

```bash
python scripts/build_client_modpack.py
```

Нужен `server-sftp.env` (SFTP Play2GO) для jar с точной версией сервера.

Манифест: [client-modpack-manifest.json](client-modpack-manifest.json)
