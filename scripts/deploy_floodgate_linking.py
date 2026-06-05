#!/usr/bin/env python3
"""Floodgate linking: sqlite DB jar (если есть), config, LuckPerms-команды на сервер."""
from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGING = ROOT / "build" / "bedrock-staging"
SFTP = ROOT / "scripts" / "play2go_sftp.py"
SQLITE_JAR = STAGING / "floodgate-sqlite-database.jar"
CONFIG_SAMPLE = ROOT / "docs" / "config-samples" / "floodgate" / "config.yml"
REMOTE_CONFIG = "config/floodgate/config.yml"
CONSOLE_FILE = ROOT / "docs" / "bedrock-link-console-commands.txt"


def sftp(*args: str) -> None:
    cmd = [sys.executable, str(SFTP), *args]
    print("+", " ".join(cmd))
    subprocess.run(cmd, cwd=ROOT, check=True)


def patch_player_link(full_config: str, enable_own: bool) -> str:
    block = CONFIG_SAMPLE.read_text(encoding="utf-8")
    if "player-link:" not in block:
        raise SystemExit("sample missing player-link")
    block = re.sub(
        r"enable-own-linking:\s*\w+",
        f"enable-own-linking: {'true' if enable_own else 'false'}",
        block,
    )
    if re.search(r"(?m)^player-link:\s*$", full_config):
        return re.sub(
            r"(?ms)^player-link:.*?(?=^\S|\Z)",
            block.strip() + "\n\n",
            full_config,
            count=1,
        )
    return full_config.rstrip() + "\n\n" + block.strip() + "\n"


def main() -> None:
    has_sqlite = SQLITE_JAR.is_file() and SQLITE_JAR.stat().st_size > 10_000
    if not has_sqlite:
        print(
            "WARN: нет build/bedrock-staging/floodgate-sqlite-database.jar\n"
            "      enable-own-linking останется false до ручной заливки JAR.\n"
            "      См. docs/luckperms-floodgate-linkaccount.md"
        )

    local_cfg = ROOT / "build" / "floodgate-config-patched.yml"
    try:
        sftp("pull", REMOTE_CONFIG)
        pulled = ROOT / "server-remote" / REMOTE_CONFIG
        text = pulled.read_text(encoding="utf-8")
    except subprocess.CalledProcessError:
        print("remote config missing, using sample only")
        text = "# patched by deploy_floodgate_linking.py\n\n"

    patched = patch_player_link(text, enable_own=has_sqlite)
    local_cfg.parent.mkdir(parents=True, exist_ok=True)
    local_cfg.write_text(patched, encoding="utf-8")
    sftp("push", str(local_cfg), REMOTE_CONFIG)

    if has_sqlite:
        sftp("push", str(SQLITE_JAR), "mods/floodgate-sqlite-database.jar")

    if CONSOLE_FILE.is_file():
        sftp("push", str(CONSOLE_FILE), "FLOODGATE_LINK_SETUP.txt")

    print("\n=== Консоль сервера (обязательно) ===")
    print(CONSOLE_FILE.read_text(encoding="utf-8"))
    print("=== Рестарт Play2GO Stop -> Start ===")


if __name__ == "__main__":
    main()
