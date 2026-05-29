#!/usr/bin/env python3
"""
SFTP к файлам сервера Play2GO (Pterodactyl /home/container).

Пароль только в server-sftp.env (в .gitignore) или в переменных окружения.
Не коммитьте server-sftp.env.

Примеры:
  python scripts/play2go_sftp.py ls
  python scripts/play2go_sftp.py ls config
  python scripts/play2go_sftp.py pull config/openpartiesandclaims-server.toml
  python scripts/play2go_sftp.py pull config/tab/groups.yml
  python scripts/play2go_sftp.py push isnix-opac-tab/build/libs/isnix-opac-tab-1.0.0.jar mods/isnix-opac-tab-1.0.0.jar
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("Установите paramiko: python -m pip install paramiko", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / "server-sftp.env"
LOCAL_MIRROR = ROOT / "server-remote"


def load_env_file(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        if "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def detect_remote_base(sftp: paramiko.SFTPClient) -> str:
    """Play2GO/Pterodactyl SFTP обычно chroot в корень сервера — не /home/container."""
    candidates = [".", "/", "/home/container"]
    for path in candidates:
        try:
            sftp.listdir(path)
            return path
        except OSError:
            continue
    print(
        "Не удалось открыть корневую папку SFTP (пробовали ., /, /home/container).",
        file=sys.stderr,
    )
    sys.exit(3)


def connect():
    load_env_file(ENV_FILE)
    host = os.environ.get("SFTP_HOST", "c11.play2go.cloud").strip()
    user = os.environ.get("SFTP_USER", "").strip()
    password = os.environ.get("SFTP_PASSWORD", "")
    port = int(os.environ.get("SFTP_PORT", "2022"))
    base = os.environ.get("REMOTE_BASE", ".").strip() or "."

    if not user:
        print(
            "Задайте SFTP_USER в server-sftp.env (скопируйте из Play2GO → Settings → SFTP).",
            file=sys.stderr,
        )
        sys.exit(1)
    if not password:
        print(
            "Задайте SFTP_PASSWORD в server-sftp.env (файл не попадает в git).\n"
            f"Скопируйте шаблон: copy server-sftp.env.example server-sftp.env",
            file=sys.stderr,
        )
        sys.exit(1)

    transport = paramiko.Transport((host, port))
    try:
        transport.connect(username=user, password=password)
    except paramiko.AuthenticationException:
        print(
            "Ошибка входа SFTP: неверный логин или пароль. Смените пароль в Play2GO и обновите server-sftp.env.",
            file=sys.stderr,
        )
        sys.exit(2)
    sftp = paramiko.SFTPClient.from_transport(transport)
    assert sftp is not None

    if base in (".", "auto", "detect"):
        base = detect_remote_base(sftp)
    else:
        try:
            sftp.listdir(base)
        except OSError:
            detected = detect_remote_base(sftp)
            print(
                f"REMOTE_BASE={base!r} недоступен, используем {detected!r}. "
                f"Обновите server-sftp.env: REMOTE_BASE={detected}",
                file=sys.stderr,
            )
            base = detected

    return transport, sftp, base


def remote_path(base: str, rel: str) -> str:
    rel = rel.replace("\\", "/").lstrip("/")
    if not rel:
        return base
    if base in (".", "/"):
        return rel
    return f"{base.rstrip('/')}/{rel}"


def local_path(rel: str) -> Path:
    rel = rel.replace("\\", "/").lstrip("/")
    return LOCAL_MIRROR / rel if rel else LOCAL_MIRROR


def cmd_ls(sftp, base: str, subpath: str) -> None:
    path = remote_path(base, subpath)
    try:
        names = sftp.listdir(path)
    except OSError as e:
        print(f"Ошибка listdir({path!r}): {e}", file=sys.stderr)
        sys.exit(5)
    print(f"# {path}")
    for name in sorted(names):
        print(name)


def cmd_pwd(sftp, base: str) -> None:
    print(f"REMOTE_BASE={base}")
    try:
        cwd = sftp.normalize(".")
        print(f"normalize('.')={cwd}")
    except OSError:
        pass
    cmd_ls(sftp, base, "")


def cmd_pull(sftp, base: str, remote_rel: str) -> None:
    src = remote_path(base, remote_rel)
    dst = local_path(remote_rel)
    dst.parent.mkdir(parents=True, exist_ok=True)
    sftp.get(src, str(dst))
    print(f"OK pull {src} -> {dst}")


def cmd_push(sftp, base: str, local_rel: str, remote_rel: str | None) -> None:
    local_file = Path(local_rel)
    if not local_file.is_file():
        local_file = ROOT / local_rel
    if not local_file.is_file():
        print(f"Локальный файл не найден: {local_rel}", file=sys.stderr)
        sys.exit(4)
    remote_rel = remote_rel or local_rel.replace("\\", "/")
    dst = remote_path(base, remote_rel)
    sftp.put(str(local_file), dst)
    print(f"OK push {local_file} -> {dst}")


def main() -> None:
    parser = argparse.ArgumentParser(description="Play2GO SFTP")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("pwd", help="Показать рабочий корень SFTP и список файлов")

    p_ls = sub.add_parser("ls", help="Список файлов на сервере")
    p_ls.add_argument("path", nargs="?", default="", help="Подпапка относительно корня сервера")

    p_pull = sub.add_parser("pull", help="Скачать файл в server-remote/")
    p_pull.add_argument("remote", help="Путь на сервере, напр. config/tab/groups.yml")

    p_push = sub.add_parser("push", help="Загрузить файл на сервер")
    p_push.add_argument("local", help="Локальный путь")
    p_push.add_argument("remote", nargs="?", help="Путь на сервере (если не указан — как local)")

    p_rm = sub.add_parser("rm", help="Удалить файл на сервере")
    p_rm.add_argument("remote", help="Путь на сервере, напр. config/c2me.toml")

    args = parser.parse_args()
    transport, sftp, base = connect()
    try:
        if args.command == "pwd":
            cmd_pwd(sftp, base)
        elif args.command == "ls":
            cmd_ls(sftp, base, args.path)
        elif args.command == "pull":
            cmd_pull(sftp, base, args.remote)
        elif args.command == "push":
            cmd_push(sftp, base, args.local, args.remote)
        elif args.command == "rm":
            path = remote_path(base, args.remote)
            sftp.remove(path)
            print(f"OK rm {path}")
    finally:
        sftp.close()
        transport.close()


if __name__ == "__main__":
    main()
