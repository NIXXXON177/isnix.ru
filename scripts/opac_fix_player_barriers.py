#!/usr/bin/env python3
"""
Патч OPAC player-configs: Players/Ender_Pearls barrier E -> N (гости могут входить).

  python scripts/opac_fix_player_barriers.py --dry-run
  python scripts/opac_fix_player_barriers.py --apply-local   # только server-remote mirror
  python scripts/opac_fix_player_barriers.py --push            # SFTP все *.toml (сервер STOP)
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LOCAL_DIR = ROOT / "server-remote" / "world" / "data" / "openpartiesandclaims" / "player-configs"
SFTP = ROOT / "scripts" / "play2go_sftp.py"
REMOTE_DIR = "world/data/openpartiesandclaims/player-configs"

# inline TOML: barrier={Players="E", Ender_Pearls="E", ...}
PLAYERS_E = re.compile(r'(\bPlayers\s*=\s*)"E"')
PEARL_E = re.compile(r'(\bEnder_Pearls\s*=\s*)"E"')


def patch_text(text: str) -> tuple[str, int]:
    n = 0
    new, c1 = PLAYERS_E.subn(r'\1"N"', text)
    n += c1
    new, c2 = PEARL_E.subn(r'\1"N"', new)
    n += c2
    return new, n


def patch_file(path: Path, dry_run: bool) -> int:
    raw = path.read_text(encoding="utf-8")
    new, n = patch_text(raw)
    if n and not dry_run:
        path.write_text(new, encoding="utf-8")
    return n


def pull_all_configs() -> int:
    """Скачать все player-config toml с сервера."""
    proc = subprocess.run(
        [sys.executable, str(SFTP), "ls", REMOTE_DIR],
        capture_output=True,
        text=True,
        cwd=str(ROOT),
    )
    if proc.returncode != 0:
        print(proc.stderr, file=sys.stderr)
        return 1
    names = [
        line.strip()
        for line in proc.stdout.splitlines()
        if line.strip().endswith(".toml")
    ]
    LOCAL_DIR.mkdir(parents=True, exist_ok=True)
    for name in names:
        subprocess.run(
            [sys.executable, str(SFTP), "pull", f"{REMOTE_DIR}/{name}"],
            cwd=str(ROOT),
            check=False,
        )
    print(f"Pulled {len(names)} configs")
    return 0


def push_all_configs() -> int:
    failed = 0
    for path in sorted(LOCAL_DIR.glob("*.toml")):
        remote = f"{REMOTE_DIR}/{path.name}"
        r = subprocess.run(
            [sys.executable, str(SFTP), "push", str(path), remote],
            cwd=str(ROOT),
        )
        if r.returncode:
            failed += 1
    return failed


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--pull", action="store_true", help="Сначала скачать с SFTP")
    parser.add_argument("--push", action="store_true", help="Залить исправленные на SFTP")
    args = parser.parse_args()

    if args.pull:
        pull_all_configs()

    if not LOCAL_DIR.is_dir():
        print(f"Нет каталога {LOCAL_DIR}. Запустите с --pull", file=sys.stderr)
        sys.exit(1)

    total_files = 0
    total_patches = 0
    for path in sorted(LOCAL_DIR.glob("*.toml")):
        n = patch_file(path, args.dry_run)
        if n:
            total_files += 1
            total_patches += n
            print(f"{'DRY' if args.dry_run else 'OK'} {path.name}: {n} замен")

    print(f"Файлов с barrier E: {total_files}, замен: {total_patches}")
    if total_patches == 0:
        print("Ничего не найдено (уже N?) или формат изменился.")

    if args.push and not args.dry_run:
        print("Заливка на сервер… (нужен STOP)")
        failed = push_all_configs()
        print(f"Залито файлов: {len(list(LOCAL_DIR.glob('*.toml')))}, ошибок: {failed}")
        sys.exit(failed)


if __name__ == "__main__":
    main()
