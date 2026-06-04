#!/usr/bin/env python3
"""
Скачивает с сервера Play2GO критичные данные игроков (playerdata, снимки ISNIX Player Backup).

Пароль в server-sftp.env (см. scripts/play2go_sftp.py).

Примеры:
  python scripts/backup_player_data.py
  python scripts/backup_player_data.py --keep 14
  python scripts/backup_player_data.py --paths world/playerdata backups/isnix-player-backup
"""
from __future__ import annotations

import argparse
import os
import shutil
import stat
import sys
from datetime import datetime, timezone
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("Установите paramiko: python -m pip install paramiko", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / "server-sftp.env"
DEFAULT_PATHS = [
    "world/playerdata",
    "world/stats",
    "backups/isnix-player-backup",
    "config/isnix-market",
]


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
    for path in (".", "/", "/home/container"):
        try:
            sftp.listdir(path)
            return path
        except OSError:
            continue
    print("Не удалось открыть корень SFTP.", file=sys.stderr)
    sys.exit(3)


def connect():
    load_env_file(ENV_FILE)
    host = os.environ.get("SFTP_HOST", "c11.play2go.cloud").strip()
    user = os.environ.get("SFTP_USER", "").strip()
    password = os.environ.get("SFTP_PASSWORD", "")
    port = int(os.environ.get("SFTP_PORT", "2022"))
    base = os.environ.get("REMOTE_BASE", ".").strip() or "."

    if not user or not password:
        print("Задайте SFTP_USER и SFTP_PASSWORD в server-sftp.env", file=sys.stderr)
        sys.exit(1)

    transport = paramiko.Transport((host, port))
    try:
        transport.connect(username=user, password=password)
    except paramiko.AuthenticationException:
        print("Ошибка входа SFTP — проверьте server-sftp.env", file=sys.stderr)
        sys.exit(2)

    sftp = paramiko.SFTPClient.from_transport(transport)
    assert sftp is not None

    if base in (".", "auto", "detect"):
        base = detect_remote_base(sftp)
    else:
        try:
            sftp.listdir(base)
        except OSError:
            base = detect_remote_base(sftp)

    return transport, sftp, base


def remote_path(base: str, rel: str) -> str:
    rel = rel.replace("\\", "/").lstrip("/")
    if not rel:
        return base
    if base in (".", "/"):
        return rel
    return f"{base.rstrip('/')}/{rel}"


def download_tree(sftp: paramiko.SFTPClient, remote_dir: str, local_dir: Path) -> tuple[int, int]:
    files = 0
    skipped = 0
    local_dir.mkdir(parents=True, exist_ok=True)
    try:
        entries = sftp.listdir_attr(remote_dir)
    except OSError as e:
        print(f"  пропуск {remote_dir}: {e}", file=sys.stderr)
        return files, skipped + 1

    for entry in entries:
        name = entry.filename
        if name in (".", ".."):
            continue
        remote_item = f"{remote_dir.rstrip('/')}/{name}"
        local_item = local_dir / name
        if stat.S_ISDIR(entry.st_mode):
            f, s = download_tree(sftp, remote_item, local_item)
            files += f
            skipped += s
        else:
            local_item.parent.mkdir(parents=True, exist_ok=True)
            sftp.get(remote_item, str(local_item))
            files += 1
    return files, skipped


def prune_old_backups(root: Path, keep: int) -> None:
    if keep < 1:
        return
    dirs = sorted(
        [p for p in root.iterdir() if p.is_dir()],
        key=lambda p: p.name,
        reverse=True,
    )
    for old in dirs[keep:]:
        shutil.rmtree(old, ignore_errors=True)
        print(f"Удалён старый локальный бэкап: {old.name}")


def main() -> None:
    parser = argparse.ArgumentParser(description="SFTP-бэкап данных игроков ISNIX")
    parser.add_argument(
        "--paths",
        nargs="+",
        default=DEFAULT_PATHS,
        help="Папки на сервере для скачивания",
    )
    parser.add_argument(
        "--keep",
        type=int,
        default=14,
        help="Сколько последних локальных копий хранить (по умолчанию 14)",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=ROOT / "backups" / "local",
        help="Куда складывать локальные копии",
    )
    args = parser.parse_args()

    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M-%S")
    dest = args.out / stamp
    dest.mkdir(parents=True, exist_ok=True)

    transport, sftp, base = connect()
    total_files = 0
    total_skipped = 0
    try:
        print(f"Бэкап в {dest}")
        for rel in args.paths:
            remote = remote_path(base, rel)
            local = dest / rel.replace("/", os.sep)
            print(f"  {rel} ...")
            files, skipped = download_tree(sftp, remote, local)
            total_files += files
            total_skipped += skipped
            print(f"    файлов: {files}" + (f", пропущено: {skipped}" if skipped else ""))
    finally:
        sftp.close()
        transport.close()

    manifest = dest / "MANIFEST.txt"
    manifest.write_text(
        "\n".join(
            [
                f"timestamp_utc={stamp}",
                f"files={total_files}",
                f"skipped_paths={total_skipped}",
                "paths=" + ", ".join(args.paths),
            ]
        )
        + "\n",
        encoding="utf-8",
    )

    prune_old_backups(args.out, args.keep)
    print(f"Готово: {total_files} файлов → {dest}")


if __name__ == "__main__":
    main()
