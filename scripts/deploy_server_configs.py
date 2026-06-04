#!/usr/bin/env python3
"""
Заливает эталонные конфиги ISNIX на Play2GO (SFTP).

Требует server-sftp.env. OPAC toml — только при выключенном сервере.

  python scripts/deploy_server_configs.py
  python scripts/deploy_server_configs.py --dry-run
  python scripts/deploy_server_configs.py --only tab
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SAMPLES = ROOT / "docs" / "config-samples"
REMOTE_TAB = ROOT / "server-remote" / "config" / "tab"
SAMPLES_TAB = SAMPLES / "tab"
SFTP = ROOT / "scripts" / "play2go_sftp.py"


def tab_config(name: str) -> Path:
    """server-remote после pull, иначе эталон из docs/config-samples/tab/."""
    remote = REMOTE_TAB / name
    if remote.is_file():
        return remote
    return SAMPLES_TAB / name


# TAB: server-remote (после pull) или samples
DEPLOYS: list[tuple[Path, str, str]] = [
    (tab_config("groups.yml"), "config/tab/groups.yml", "tab"),
    (tab_config("users.yml"), "config/tab/users.yml", "tab"),
    (SAMPLES / "isnix-chat.json", "config/isnix-chat.json", "isnix"),
    (SAMPLES / "isnix-server-messages.json", "config/isnix-server-messages.json", "isnix"),
    (SAMPLES / "isnix-market.json", "config/isnix-market/isnix-market.json", "isnix"),
    (SAMPLES / "styled-chat.json", "config/styled-chat.json", "styled"),
]

OPAC_REMOTE = ROOT / "server-remote" / "config" / "openpartiesandclaims-server.toml"
OPAC_DEFAULT_PLAYER = (
    ROOT / "server-remote" / "world" / "serverconfig" / "openpartiesandclaims-default-player-config.toml"
)


def push(local: Path, remote: str, dry_run: bool) -> int:
    if not local.is_file():
        print(f"SKIP (нет файла): {local}", file=sys.stderr)
        return 1
    cmd = [sys.executable, str(SFTP), "push", str(local), remote]
    if dry_run:
        print("DRY", " ".join(cmd))
        return 0
    print(f"PUSH {local.name} -> {remote}")
    return subprocess.call(cmd)


def main() -> None:
    parser = argparse.ArgumentParser(description="Deploy ISNIX server configs via SFTP")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument(
        "--only",
        choices=("tab", "isnix", "styled", "opac", "all"),
        default="all",
    )
    parser.add_argument(
        "--with-opac",
        action="store_true",
        help="Также залить openpartiesandclaims-server.toml (сервер должен быть STOP)",
    )
    args = parser.parse_args()

    failed = 0
    for local, remote, tag in DEPLOYS:
        if args.only != "all" and args.only != tag:
            continue
        failed += push(local, remote, args.dry_run)

    if args.with_opac or (args.only == "opac"):
        if OPAC_REMOTE.is_file():
            failed += push(
                OPAC_REMOTE,
                "config/openpartiesandclaims-server.toml",
                args.dry_run,
            )
        else:
            print(
                "OPAC: сначала pull: python scripts/play2go_sftp.py pull "
                "config/openpartiesandclaims-server.toml",
                file=sys.stderr,
            )
            failed += 1
        if OPAC_DEFAULT_PLAYER.is_file():
            failed += push(
                OPAC_DEFAULT_PLAYER,
                "world/serverconfig/openpartiesandclaims-default-player-config.toml",
                args.dry_run,
            )
        else:
            print(
                "OPAC default player: pull world/serverconfig/openpartiesandclaims-default-player-config.toml",
                file=sys.stderr,
            )
            failed += 1

    if failed:
        sys.exit(failed)
    print(
        "OK. TAB: /tab reload | Styled: /styledchat reload | OPAC: только при STOP сервера, затем старт."
    )


if __name__ == "__main__":
    main()
