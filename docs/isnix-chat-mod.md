# ISNIX Chat — локальный и глобальный чат (Fabric 1.21.1)

> С **isnix-modtools**: замьюченный игрок не пишет в чат (`/mute`). См. [isnix-modtools-mod.md](isnix-modtools-mod.md).

Серверный мод: обычное сообщение видят только игроки **рядом**, с префиксом **`!`** — **все** на сервере.

| Как писать | Кто видит | Пример в чате |
|------------|-----------|----------------|
| `привет` | игроки в радиусе (по умолчанию 80 блоков, тот же мир) | `[рядом] Ник » привет` |
| `!привет` | все онлайн | `[все] Ник » привет` + короткий звук опыта |

Команды (`/tp`, `/msg` и т.д.) не трогаются.

## Скачать готовый jar

Мод **не лежит на isnix.ru** — он собирается на GitHub при каждом обновлении.

1. Открой: [Actions → Build ISNIX Chat mod](https://github.com/NIXXXON177/isnix.ru/actions/workflows/build-isnix-chat.yml)
2. Кликни **последний зелёный** запуск (галочка ✓).
3. Внизу страницы блок **Artifacts** → скачай **isnix-chat-jar** (внутри `isnix-chat-1.0.0.jar`).

Нужен вход в GitHub (репозиторий публичный, артефакты отдаются через Actions).

Прямая ссылка на последнюю успешную сборку:  
https://github.com/NIXXXON177/isnix.ru/actions/runs/26491388136

## Сборка самому

Нужны **JDK 21** и интернет.

```bash
cd isnix-chat
./gradlew build
```

Готовый jar: `isnix-chat/build/libs/isnix-chat-1.0.0.jar`

На Windows (PowerShell):

```powershell
cd isnix-chat
.\gradlew.bat build
```

## Установка на сервер

1. Скопируй `isnix-chat-1.0.0.jar` в папку `mods` сервера (рядом с Fabric API).
2. Перезапусти сервер.
3. При первом запуске появится `config/isnix-chat.json`:

```json
{
  "local_radius": 80,
  "global_prefix": "!",
  "local_tag": "[рядом]",
  "global_tag": "[все]",
  "global_sound": true,
  "global_sound_volume": 0.35,
  "global_sound_pitch": 1.25
}
```

`global_sound` — звук подбора опыта при каждом сообщении с `!` (слышат все, кто получил глобальный чат).

4. Положи тот же jar в **клиентскую сборку** на сайте (`ISTHISNIXXXONmods.zip`), чтобы игроки не получали «missing mod» при входе. Мод **server-only** в `fabric.mod.json`, но для единого modpack jar всё равно кладут в `mods`.

## Styled Chat

На сервере стоит **Styled Chat** — он форматирует ванильный чат. ISNIX Chat **перехватывает** обычные сообщения до рассылки, поэтому:

- префиксы LuckPerms в **display_name** (над головой, таб) работают как раньше;
- строка в чате идёт в формате мода: `[рядом]` / `[все]` + ник + сообщение.

Если нужен только жирный ник у админов — оставь `styled-chat.json` как в [styled-chat.json](styled-chat.json); конфликтов с join/leave обычно нет.

## Игрокам (кратко)

- Пишешь как обычно — слышат рядом.
- Нужно всем — в начале **`!`**: `!кто на спавне?`
