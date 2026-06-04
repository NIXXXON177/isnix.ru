# Автосохранение данных игроков (инвентарь и playerdata)

Два уровня защиты от потери вещей при сбое:

1. **Мод ISNIX Player Backup** — читаемые JSON-снимки инвентаря на диске сервера.
2. **Скрипт `scripts/backup_player_data.py`** — копия `world/playerdata` и снимков на ваш ПК по SFTP.

Дополнительно: включите **автобэкапы Play2GO** в панели хостинга (полный снимок мира).

---

## 1. Мод ISNIX Player Backup

### Что делает

- Каждые **15 минут** (настраивается) сохраняет инвентарь, броню, offhand, эндер-сундук, опыт и координаты **онлайн-игроков**.
- При **выходе** с сервера — ещё один снимок.
- Файлы в `backups/isnix-player-backup/`:
  - `snapshots/{uuid}/` — история по игроку;
  - `latest/{uuid}.json` — последний снимок по UUID;
  - `latest-by-nick/{ник}.json` — быстрый поиск по нику.

Пример фрагмента снимка:

```json
{
  "nick": "Steve",
  "uuid": "...",
  "timestamp": "2026-06-02T12:00:00Z",
  "reason": "quit",
  "inventory": [
    { "group": "main", "slot": 0, "id": "minecraft:diamond_sword", "count": 1 }
  ]
}
```

### Установка

1. Соберите JAR (GitHub Actions → **Build ISNIX Player Backup** или локально):

   ```bash
   cd isnix-player-backup
   ../isnix-graveguard/gradlew build
   ```

2. Загрузите `isnix-player-backup-1.0.0.jar` в `mods/` на сервере.

3. Скопируйте конфиг (при первом запуске мод создаст его сам):

   ```bash
   python scripts/play2go_sftp.py push config-samples/isnix-player-backup.json config/isnix-player-backup.json
   ```

4. Перезапустите сервер.

### Команды (только `/op` или консоль)

| Команда | Описание |
|---------|----------|
| `/playerbackup status` | Статус, интервал, число файлов |
| `/playerbackup snapshot` | Снимок своего инвентаря |
| `/playerbackup snapshot <игрок>` | Снимок указанного игрока |
| `/playerbackup snapshotall` | Снимок всех онлайн |
| `/playerbackup prune` | Удалить снимки старше `keepDays` |

### Конфиг `config/isnix-player-backup.json`

| Поле | По умолчанию | Описание |
|------|--------------|----------|
| `enabled` | `true` | Включить мод |
| `intervalMinutes` | `15` | Период для онлайн-игроков |
| `keepDays` | `14` | Срок хранения на сервере |
| `snapshotOnQuit` | `true` | Снимок при выходе |
| `includeEnderChest` | `true` | Эндер-сундук |
| `includePosition` | `true` | Координаты и измерение |
| `includeExperience` | `true` | Уровень и XP |

### Восстановление после сбоя

1. Найдите снимок: `backups/isnix-player-backup/latest-by-nick/НИК.json`.
2. По списку предметов вручную выдайте вещи через `/give` или восстановите из `world/playerdata/{uuid}.dat` (если есть бэкап playerdata).
3. Для офлайн-игроков смотрите последний `.dat` в бэкапе `world/playerdata/` (скрипт ниже).

---

## 2. Локальный SFTP-бэкап (ПК админа)

Скрипт скачивает с сервера:

- `world/playerdata/` — полные NBT-данные игроков (инвентарь на диске);
- `world/stats/` — статистика;
- `backups/isnix-player-backup/` — JSON-снимки мода;
- `config/isnix-market/` — данные рынка (опционально).

### Разовый запуск

```bash
python scripts/backup_player_data.py
```

Копии: `backups/local/YYYY-MM-DD_HH-MM-SS/`. Хранится **14** последних копий (флаг `--keep`).

### Автозапуск по расписанию (Windows)

1. **Планировщик заданий** → Создать задачу.
2. Триггер: ежедневно, например 04:00.
3. Действие:

   ```
   python C:\Users\...\isnix.ru\scripts\backup_player_data.py
   ```

   Рабочая папка: корень репозитория. В `server-sftp.env` должны быть `SFTP_USER` и `SFTP_PASSWORD`.

### Linux / cron

```cron
0 4 * * * cd /path/to/isnix.ru && python3 scripts/backup_player_data.py >> backups/local/cron.log 2>&1
```

---

## 3. Play2GO и vanilla save

- **Play2GO → Backups** — включите расписание (ежедневно), если ещё не включено.
- В `server.properties` параметр `max-auto-save` (тики) — vanilla периодически пишет мир на диск; не отключайте.

---

## 4. Ledger (если установлен)

Мод **Ledger** логирует действия с блоками и предметами — полезен для расследования, но **не заменяет** бэкап инвентаря. Используйте вместе с Player Backup.

---

## Чек-лист после установки

- [ ] JAR в `mods/`, сервер перезапущен
- [ ] `/playerbackup status` показывает «включён»
- [ ] После выхода тестового аккаунта появился JSON в `backups/isnix-player-backup/latest-by-nick/`
- [ ] `python scripts/backup_player_data.py` успешно скачивает файлы
- [ ] Play2GO autobackup включён
- [ ] Планировщик/cron настроен на ежедневный локальный бэкап
