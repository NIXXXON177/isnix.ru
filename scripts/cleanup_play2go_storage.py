#!/usr/bin/env python3
"""
Очистка Play2GO по SFTP. Папку world/ не удаляем.

  python scripts/cleanup_play2go_storage.py scan
  python scripts/cleanup_play2go_storage.py clean --dry-run
  python scripts/cleanup_play2go_storage.py clean
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("pip install paramiko", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / "server-sftp.env"
sys.path.insert(0, str(ROOT / "scripts"))
from play2go_sftp import connect, load_env_file, remote_path  # noqa: E402


def fmt_size(n: int) -> str:
    if n < 1024:
        return f"{n} B"
    n = float(n)
    for unit in ("KiB", "MiB", "GiB"):
        n /= 1024
        if n < 1024:
            return f"{n:.2f} {unit}"
    return f"{n:.2f} TiB"


def sum_tree(sftp: paramiko.SFTPClient, base: str, rel: str, max_depth: int = 2) -> tuple[int, int]:
    total = 0
    count = 0
    remote = remote_path(base, rel)

    def walk(path: str, depth: int) -> None:
        nonlocal total, count
        if depth > max_depth:
            return
        try:
            entries = sftp.listdir_attr(path)
        except OSError:
            return
        for ent in entries:
            if ent.filename in (".", ".."):
                continue
            child = f"{path.rstrip('/')}/{ent.filename}"
            if ent.st_mode and (ent.st_mode & 0o40000):
                if depth < max_depth:
                    walk(child, depth + 1)
            else:
                total += ent.st_size or 0
                count += 1

    walk(remote, 0)
    return total, count


def top_level_sizes(sftp: paramiko.SFTPClient, base: str) -> list[tuple[str, int]]:
    out: list[tuple[str, int]] = []
    for name in sftp.listdir(base):
        if name in (".", ".."):
            continue
        rel = name
        try:
            st = sftp.stat(remote_path(base, rel))
            if st.st_mode and (st.st_mode & 0o40000):
                size, _ = sum_tree(sftp, base, rel, max_depth=2)
            else:
                size = st.st_size or 0
        except OSError:
            size = 0
        out.append((name, size))
    return sorted(out, key=lambda x: -x[1])


def _rmtree(sftp: paramiko.SFTPClient, remote: str) -> None:
    for ent in sftp.listdir_attr(remote):
        if ent.filename in (".", ".."):
            continue
        path = f"{remote.rstrip('/')}/{ent.filename}"
        if ent.st_mode and (ent.st_mode & 0o40000):
            _rmtree(sftp, path)
        else:
            sftp.remove(path)
    sftp.rmdir(remote)


def clear_folder(sftp: paramiko.SFTPClient, base: str, folder: str) -> int:
    remote = remote_path(base, folder)
    freed = 0
    try:
        entries = sftp.listdir_attr(remote)
    except OSError:
        return 0
    for ent in entries:
        if ent.filename in (".", ".."):
            continue
        path = f"{remote.rstrip('/')}/{ent.filename}"
        if ent.st_mode and (ent.st_mode & 0o40000):
            freed += folder_size(sftp, base, f"{folder}/{ent.filename}")
            _rmtree(sftp, path)
        else:
            freed += ent.st_size or 0
            sftp.remove(path)
    return freed


def folder_size(sftp: paramiko.SFTPClient, base: str, rel: str) -> int:
    total, _ = sum_tree(sftp, base, rel, max_depth=6)
    return total


def collect_targets(sftp: paramiko.SFTPClient, base: str) -> list[tuple[str, str]]:
    """(type file|dir, relative path)"""
    targets: list[tuple[str, str]] = []

    for name in sftp.listdir(base):
        low = name.lower()
        if name in (".", ".."):
            continue
        if name == "world" or name.startswith("world_"):
            continue
        if low.startswith("archive-") and (low.endswith(".tar.gz") or low.endswith(".zip")):
            targets.append(("file", name))
        if low.endswith(".log") and name not in ("latest.log",):
            targets.append(("file", name))

    for folder in ("logs", "crash-reports", "debug"):
        targets.append(("clear", folder))

    for fname in (
        "FLOODGATE_LINK_SETUP.txt",
        "fabric-installer.jar",
        "hs_err_pid1.log",
        "fabricloader.log",
    ):
        try:
            sftp.stat(remote_path(base, fname))
            targets.append(("file", fname))
        except OSError:
            pass

    return targets


def apply_clean(
    sftp: paramiko.SFTPClient, base: str, targets: list[tuple[str, str]], dry_run: bool
) -> int:
    freed = 0
    for kind, rel in targets:
        remote = remote_path(base, rel)
        if kind == "clear":
            if dry_run:
                sz = folder_size(sftp, base, rel)
                print(f"  [dry-run] clear {rel}/ ({fmt_size(sz)})")
                freed += sz
            else:
                sz = clear_folder(sftp, base, rel)
                print(f"  cleared {rel}/ ({fmt_size(sz)})")
                freed += sz
            continue
        try:
            st = sftp.stat(remote)
            sz = st.st_size or 0
        except OSError:
            continue
        print(f"  {'[dry-run] ' if dry_run else ''}delete {rel} ({fmt_size(sz)})")
        if not dry_run:
            sftp.remove(remote)
        freed += sz
    return freed


def cmd_scan(sftp: paramiko.SFTPClient, base: str) -> None:
    print(f"REMOTE_BASE={base!r}\n")
    print("Top-level (estimate):")
    for name, size in top_level_sizes(sftp, base):
        tag = " [WORLD - protected]" if name == "world" else ""
        print(f"  {fmt_size(size):>12}  {name}{tag}")
    wsize, wfiles = sum_tree(sftp, base, "world", max_depth=2)
    print(f"\nworld/ (~depth 2): {fmt_size(wsize)}, {wfiles} files")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("action", choices=("scan", "clean"))
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    load_env_file(ENV_FILE)
    transport, sftp, base = connect()
    try:
        if args.action == "scan":
            cmd_scan(sftp, base)
            return
        targets = collect_targets(sftp, base)
        if not targets:
            print("Nothing to clean.")
            return
        print(f"Actions: {len(targets)}")
        freed = apply_clean(sftp, base, targets, dry_run=args.dry_run)
        print(f"\n{'Would free' if args.dry_run else 'Freed'}: ~{fmt_size(freed)}")
    finally:
        sftp.close()
        transport.close()


if __name__ == "__main__":
    main()
