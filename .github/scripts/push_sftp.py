#!/usr/bin/env python3
"""Загружает один файл на SFTP Play2GO (секреты PLAY2GO_SFTP_* в GitHub Actions)."""
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
    local = (os.environ.get("LOCAL_FILE") or "").strip()
    remote = (os.environ.get("REMOTE_PATH") or "").strip()

    if not host or not user:
        print("Задай SFTP_HOST и SFTP_USER", file=sys.stderr)
        sys.exit(1)
    if password == "":
        print("Задай SFTP_PASSWORD", file=sys.stderr)
        sys.exit(1)
    if not local or not os.path.isfile(local):
        print(f"Локальный файл не найден: {local!r}", file=sys.stderr)
        sys.exit(1)
    if not remote:
        remote = os.path.basename(local).replace("\\", "/")

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
            "AuthenticationException: неверный логин или пароль SFTP.\n"
            "Проверь секреты PLAY2GO_SFTP_* (как в sync-whitelist.yml).",
            file=sys.stderr,
        )
        sys.exit(2)
    except Exception as e:
        print(f"Ошибка подключения: {type(e).__name__}: {e}", file=sys.stderr)
        sys.exit(3)

    try:
        sftp = paramiko.SFTPClient.from_transport(transport)
        assert sftp is not None
        remote_dir = os.path.dirname(remote.replace("\\", "/"))
        if remote_dir:
            parts = remote_dir.split("/")
            acc = ""
            for part in parts:
                if not part:
                    continue
                acc = f"{acc}/{part}" if acc else part
                try:
                    sftp.listdir(acc)
                except OSError:
                    try:
                        sftp.mkdir(acc)
                    except OSError:
                        pass
        sftp.put(local, remote)
        sftp.close()
        print(f"OK upload {local} -> {remote}")
    except OSError as e:
        print(f"Не удалось загрузить {remote!r}: {e}", file=sys.stderr)
        sys.exit(5)
    finally:
        transport.close()


if __name__ == "__main__":
    main()
