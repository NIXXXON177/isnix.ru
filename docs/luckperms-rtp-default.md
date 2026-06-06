# LuckPerms: /rtp для всех игроков (FastRTP)

На сервере **Fabric 1.21.11** команда `/rtp` — из мода **FastRTP** (`config/fast-rtp.json`).

- `useCurrentWorld: true` — RTP в **текущем** измерении (Обычный мир, Незер, Край).
- `requirePermission: false` — право LP **не нужно** (все могут `/rtp`).
- `/rtpback` — возврат на последний RTP.

**Essential Commands:** `enable_rtp=false`, чтобы не дублировать `/rtp` и не блокировать Незер/Край.

## 1. Конфиг FastRTP

`config/fast-rtp.json` (образец: [fast-rtp.json](config-samples/fast-rtp.json)):

```json
{
  "requirePermission": false,
  "useCurrentWorld": true,
  "rtpBackEnabled": true,
  "cooldown": 30
}
```

После правки: `/rtp reload` (OP) или перезапуск сервера.

## 2. Essential Commands

В `config/EssentialCommands.properties`:

```properties
enable_rtp=false
```

Иначе `/rtp` из Essential Commands конфликтует с FastRTP и в Незере/Краю пишет «RTP is not enabled in this world».

## 3. Если нужно право только для VIP

Поставь `requirePermission: true` и выдай:

```text
lp group default permission set fast-rtp.command.root true
lp sync
```

Дополнительно (админ):

| Право | Зачем |
|-------|--------|
| `fast-rtp.command.advanced` | `/rtp player <ник> world …` |
| `fast-rtp.command.reload` | `/rtp reload` |
| `fast-rtp.command.back` | `/rtpback` (если `requirePermission: true`) |
