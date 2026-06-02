# ISNIX Player Stats — время в игре в кабинете (Fabric 1.21.1)

Серверный мод: при **входе** и **выходе** игрока обновляет таблицу `player_stats` в Supabase. На сайте в кабинете отображаются «Всего в игре» и «Текущая сессия».

Учитываются только игроки, у которых в **`profiles`** на сайте указан тот же **Minecraft-ник**.

## 1. Supabase (один раз)

1. Выполни **[supabase-player-stats.sql](supabase-player-stats.sql)** (таблица + RPC `server_record_player_join` / `server_record_player_quit`).
2. Выполни **[supabase-profile-prefix.sql](supabase-profile-prefix.sql)** — префикс LuckPerms и роль `admin` на сервере в `profiles` (для кабинета на сайте).
3. Если таблица уже была — выполни **только блок RPC** в конце того же файла (с `create or replace function`).

## 2. Скачать jar

1. [Actions → Build ISNIX Player Stats mod](https://github.com/NIXXXON177/isnix.ru/actions/workflows/build-isnix-player-stats.yml)
2. Последний зелёный запуск → **Artifacts** → `isnix-player-stats-jar`.

Или локально:

```powershell
cd isnix-player-stats
.\gradlew.bat build
```

Jar: `isnix-player-stats/build/libs/isnix-player-stats-1.0.2.jar`

## 3. Установка на Play2GO

1. В **`mods`** должен быть **только один** jar этого мода — **`isnix-player-stats-1.0.2.jar`**.  
   Удали старые **`isnix-player-stats-1.0.0.jar`** / **`1.0.1.jar`** (два файла с одним `id` ломают запуск Fabric).
2. Перезапусти сервер.
3. Открой **`config/isnix-player-stats.json`** (создаётся при первом запуске):

```json
{
  "enabled": true,
  "supabase_url": "https://yfrlgeztbaebdapdnefy.supabase.co",
  "service_role_key": "сюда_ключ_service_role_из_Supabase"
}
```

| Поле | Описание |
|------|----------|
| `enabled` | `true` — отправка в Supabase |
| `supabase_url` | Project URL из Supabase → Settings → API |
| `service_role_key` | **Service role** (секретный), **не** anon и не publishable |
| `flush_interval_ticks` | Как часто сохранять время в БД (6000 ≈ 5 мин). Пока играешь, в таблице `total_play_seconds` растёт после каждого такого сохранения |

**Важно:** пока сессия открыта, в Supabase `total_play_seconds` может быть **0** — это нормально. Время «висит» в `session_started_at`. После выхода или автосохранения (раз в ~5 мин) секунды попадают в `total_play_seconds`. На сайте в кабинете показывается сумма (сохранённое + текущая сессия).

Ключ бери в Supabase → **Settings → API → service_role**. **Не** публикуй в GitHub, Discord и чаты. Если ключ утёк — **Reset** в Supabase и вставь новый в конфиг.

4. Снова перезапусти сервер (или `/reload` не подхватит конфиг мода — нужен рестарт).

В логе при старте: `ISNIX Player Stats: Supabase включён`.

## 4. Проверка

1. На сайте в профиле указан ник, совпадающий с игровым.
2. Зайди на сервер → выйди.
3. В кабинете **isnix.ru/account** — «Всего в игре» и сессия (если снова онлайн).

В Supabase → **Table Editor → player_stats** должна появиться строка с твоим `user_id`.

## 5. Ошибки

| Симптом | Что сделать |
|---------|-------------|
| В логе «укажи service_role_key» | `enabled: true` и ключ в конфиге |
| HTTP 404 на rpc | Выполни SQL с функциями из `supabase-player-stats.sql` |
| Статистики нет на сайте | Ник в `profiles.minecraft_nick` = ник в Minecraft |
| HTTP 401 | Неверный или отозванный service_role — сгенерируй новый |

## Безопасность

- Мод **только на сервере** (`environment: server` в fabric.mod.json).
- В клиентскую сборку для игроков jar **не обязателен** (в отличие от isnix-chat).
- `service_role` храни только в `config/isnix-player-stats.json` на Play2GO.
