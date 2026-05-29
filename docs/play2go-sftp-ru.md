# Подключение к файлам сервера (Play2GO SFTP)

## Быстрый старт

1. В Play2GO: **Settings → SFTP Details** — скопируйте **Username** (целиком).
2. **Смените SFTP-пароль**, если когда-либо отправляли его в чат.
3. В папке проекта `isnix.ru`:

```powershell
copy server-sftp.env.example server-sftp.env
```

4. Откройте `server-sftp.env` и вставьте **только** пароль в строку `SFTP_PASSWORD=`.
5. Установите зависимость (один раз):

```powershell
python -m pip install paramiko
```

6. Проверка:

```powershell
python scripts/play2go_sftp.py pwd
python scripts/play2go_sftp.py ls
```

Должен появиться список: `config`, `mods`, `world`, …

Если была ошибка `OSError: failure` — в `server-sftp.env` поставьте `REMOTE_BASE=.` (не `/home/container`).
Play2GO уже открывает chroot в корень сервера.

## Команды

| Команда | Пример |
|---------|--------|
| Список корня | `python scripts/play2go_sftp.py ls` |
| Список config | `python scripts/play2go_sftp.py ls config` |
| Скачать конфиг | `python scripts/play2go_sftp.py pull config/tab/groups.yml` |
| Залить мод | `python scripts/play2go_sftp.py push isnix-opac-tab\build\libs\isnix-opac-tab-1.0.0.jar mods/isnix-opac-tab-1.0.0.jar` |

Скачанные файлы лежат в **`server-remote/`** (тоже в `.gitignore`).

## Как работать со мной (Cursor)

1. Вы создаёте `server-sftp.env` с паролем **локально** (не в чат).
2. Пишете: «подключение готово, скачай OPAC и TAB».
3. Я запускаю `pull`, правлю файлы в `server-remote/`, делаю `push`.
4. Вы **перезапускаете** сервер, если меняли `openpartiesandclaims-server.toml` (только при выключенном сервере).

## FileZilla / WinSCP

- Host: `c11.play2go.cloud`
- Port: `2022`
- Protocol: SFTP
- User: из панели (например `60h38mtl1u.753fd3fb`)
- Remote directory: `/home/container`

## Безопасность

- Не коммитьте `server-sftp.env`.
- Не присылайте пароль в Discord, VK или в чат Cursor.
- Для GitHub Actions используйте Secrets: `SFTP_HOST`, `SFTP_USER`, `SFTP_PASSWORD` (см. `.github/scripts/fetch_whitelist_sftp.py`).
