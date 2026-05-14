#!/usr/bin/env python3
"""Скачивает whitelist.json с SFTP Play2GO/Pterodactyl (переменные окружения из GitHub Secrets)."""
import os
import sys

try:
    import paramiko
except ImportError:
    print("Нужен пакет paramiko: pip install paramiko", file=sys.stderr)
    sys.exit(1)


def main() -> None:
    host = os.environ.get("SFTP_HOST", "").strip()
    user = os.environ.get("SFTP_USER", "").strip()
    password = os.environ.get("SFTP_PASSWORD", "")
    port_s = (os.environ.get("SFTP_PORT") or "2022").strip()
    remote = (os.environ.get("REMOTE_PATH") or "whitelist.json").strip()
    local = "whitelist.json"

    if not host or not user:
        print("Задай SFTP_HOST и SFTP_USER", file=sys.stderr)
        sys.exit(1)
    if password == "":
        print("Задай SFTP_PASSWORD (может быть пустым только если сервер так позволяет)", file=sys.stderr)
        sys.exit(1)

    try:
        port = int(port_s)
    except ValueError:
        print(f"Неверный SFTP_PORT: {port_s!r}", file=sys.stderr)
        sys.exit(1)

    transport = paramiko.Transport((host, port))
    try:
        transport.connect(username=user, password=password)
    except paramiko.AuthenticationException:
        print(
            "AuthenticationException: неверный логин или пароль для SFTP.\n"
            " — Username скопируй целиком из Settings → SFTP details этого сервера.\n"
            " — Пароль обычно совпадает с входом в панель Play2GO; пересоздай секрет без пробелов.\n"
            " — Проверь тот же логин/пароль в WinSCP (порт SFTP, не порт Minecraft).",
            file=sys.stderr,
        )
        sys.exit(2)
    except EOFError as e:
        print(f"Соединение закрыто сервером: {e}", file=sys.stderr)
        sys.exit(3)
    except Exception as e:
        print(f"Ошибка подключения: {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(3)

    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        assert sftp is not None
        sftp.get(remote, local)
        sftp.close()
    except FileNotFoundError:
        print(f"На сервере нет файла (remote): {remote!r}", file=sys.stderr)
        sys.exit(4)
    except OSError as e:
        print(f"Не удалось скачать {remote!r}: {e}", file=sys.stderr)
        sys.exit(5)
    finally:
        transport.close()


if __name__ == "__main__":
    main()
