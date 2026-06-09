# AutoModpack — авто-обновление модов у игроков

Чтобы игрокам **не нужно было каждый раз качать новую сборку**: ставится
[AutoModpack](https://modrinth.com/mod/automodpack) 4.0.5 на сервер и в клиентскую
сборку. При заходе на сервер клиент сам сравнивает моды с сервером, докачивает
изменённые и просит короткий перезапуск. Дальше любое обновление модов = просто
обновить набор на сервере, игроки получают его автоматически.

## Как устроено

- **Сеть:** `bindPort: -1` (по умолчанию) — раздача идёт **через игровой порт**
  (20122), отдельный порт Play2GO не нужен.
- **Что отдаётся клиентам:** ровно содержимое `automodpack/host-modpack/mods/` на
  сервере — это наш клиентский набор (64 мода). Серверные моды (LuckPerms, TAB,
  EasyAuth, GrimAC, isnix-market и т.п.) клиентам **не уходят**, потому что
  `syncedFiles: []` (папка `/mods/` сервера не синкается).
- **Дубликаты:** если у игрока моды уже лежат в обычной папке `mods/`, AutoModpack
  сам убирает дубликаты в пользу своей папки — краша «duplicate mod» не будет.
- `forceCopyFilesToStandardLocation` оставлен пустым (иначе ломается бесшовное
  обновление).

## Файлы

| Где | Что |
|-----|-----|
| Клиент (сборка) | `mods/automodpack-mc1.21.11-fabric-4.0.5.jar` — кладётся в `downloads/ISTHISNIXXXONmods.zip` сборщиком |
| Сервер | `mods/automodpack-mc1.21.11-fabric-4.0.5.jar` — сам мод |
| Сервер | `automodpack/host-modpack/mods/*.jar` — 64 клиентских мода (то, что получают игроки) |
| Сервер | `automodpack/automodpack-server.json` — конфиг (см. [config-samples/automodpack-server.json](config-samples/automodpack-server.json)) |

## Первичная установка (go-live)

Серверный jar залит **выключенным** (`...jar.disabled`), чтобы случайный/ночной
рестарт хостинга не активировал мод раньше времени. Порядок:

1. Включить мод: `python scripts/deploy_automodpack.py --activate`
2. **Перезапустить сервер** (Play2GO → Restart). AutoModpack создаст дефолтный
   `automodpack/automodpack-server.json`.
3. Привести конфиг к нужным значениям (главное — `syncedFiles: []`,
   `requireAutoModpackOnClient: false`, `modpackName: ISTHISNIXXXON`), см. образец.
4. **Перезапустить ещё раз.** В логах должно быть, что AutoModpack хостит модпак и
   собрал его из host-modpack (64 файла).
5. Проверить клиентом: зайти на сервор со сборкой — AutoModpack предложит докачать/
   подтвердить отпечаток и перезапуститься.

## Обновление модов в будущем

1. Обновить локальный клиентский набор (пересобрать `downloads/ISTHISNIXXXONmods.zip`
   через `scripts/build_client_modpack_12111.py`).
2. Залить новый набор в host-modpack: `python scripts/deploy_automodpack.py`
   (грузит только изменённые jar).
3. В игре: `/automodpack generate` (или рестарт) — сервер пересоберёт модпак.
4. Игроки получат изменения при следующем заходе. **Качать сборку заново не нужно.**

> Сам сайт-сборка `downloads/ISTHISNIXXXONmods.zip` нужна только новым игрокам
> (и тем, у кого ещё нет AutoModpack) — как разовый стартовый набор.

## Деактивация / откат

`python scripts/deploy_automodpack.py --deactivate` + рестарт — вернёт `.disabled`,
сервер заработает как раньше (моды у игроков останутся в их папке `mods/`).
