#!/usr/bin/env python3
"""Скачивает Geyser + Floodgate (Fabric 1.21.1) и заливает на Play2GO по SFTP."""
from __future__ import annotations

import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGING = ROOT / "build" / "bedrock-staging"
SFTP = ROOT / "scripts" / "play2go_sftp.py"

FLOODGATE_URL = (
    "https://cdn.modrinth.com/data/bWrNNfkb/versions/Mf2wV7re/"
    "Floodgate-Fabric-2.2.4-b38.jar"
)
GEYSER_URL = (
    "https://cdn.modrinth.com/data/wKkoqHrH/versions/jaTJtFf6/"
    "geyser-fabric-Geyser-Fabric-2.4.4-b705.jar"
)
GEYSER_CONFIG_LOCAL = ROOT / "docs" / "config-samples" / "geyser" / "config.yml"
GEYSER_CONFIG_REMOTE = "config/Geyser-Fabric/config.yml"
FLOODGATE_LINK_SNIPPET = ROOT / "docs" / "config-samples" / "floodgate" / "config.yml"
FLOODGATE_LINK_REMOTE = "config/floodgate/player-link-snippet.yml"


def download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    if dest.is_file() and dest.stat().st_size > 100_000:
        print(f"skip download (exists): {dest.name}")
        return
    print(f"download {dest.name} …")
    urllib.request.urlretrieve(url, dest)


def sftp(*args: str) -> None:
    cmd = [sys.executable, str(SFTP), *args]
    print("+", " ".join(cmd))
    subprocess.run(cmd, cwd=ROOT, check=True)


def ensure_remote_dir(remote_dir: str) -> None:
    """mkdir -p на SFTP через paramiko."""
    import os

    env_file = ROOT / "server-sftp.env"
    if env_file.is_file():
        for line in env_file.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                if k.strip() and k.strip() not in os.environ:
                    os.environ[k.strip()] = v.strip().strip('"').strip("'")

    import paramiko

    host = os.environ.get("SFTP_HOST", "c11.play2go.cloud")
    user = os.environ["SFTP_USER"]
    password = os.environ["SFTP_PASSWORD"]
    port = int(os.environ.get("SFTP_PORT", "2022"))
    base = os.environ.get("REMOTE_BASE", ".").strip() or "."

    transport = paramiko.Transport((host, port))
    transport.connect(username=user, password=password)
    sftp = paramiko.SFTPClient.from_transport(transport)
    assert sftp is not None

    parts = remote_dir.replace("\\", "/").strip("/").split("/")
    cur = base if base != "." else ""
    for part in parts:
        cur = f"{cur}/{part}" if cur else part
        try:
            sftp.mkdir(cur)
            print(f"mkdir {cur}")
        except OSError:
            pass
    sftp.close()
    transport.close()


def main() -> None:
    download(FLOODGATE_URL, STAGING / "Floodgate-Fabric-2.2.4-b38.jar")
    download(GEYSER_URL, STAGING / "geyser-fabric-Geyser-Fabric-2.4.4-b705.jar")

    sftp(
        "push",
        str(STAGING / "Floodgate-Fabric-2.2.4-b38.jar"),
        "mods/Floodgate-Fabric-2.2.4-b38.jar",
    )
    sftp(
        "push",
        str(STAGING / "geyser-fabric-Geyser-Fabric-2.4.4-b705.jar"),
        "mods/geyser-fabric-Geyser-Fabric-2.4.4-b705.jar",
    )

    ensure_remote_dir("config/Geyser-Fabric")
    sftp("push", str(GEYSER_CONFIG_LOCAL), GEYSER_CONFIG_REMOTE)

    ensure_remote_dir("config/floodgate")
    if FLOODGATE_LINK_SNIPPET.is_file():
        sftp("push", str(FLOODGATE_LINK_SNIPPET), FLOODGATE_LINK_REMOTE)

    print("\nГотово. Перезапусти сервер в Play2GO (Stop -> Start).")
    print(
        "Floodgate: в config/floodgate/config.yml включи player-link "
        "(образец: config/floodgate/player-link-snippet.yml на сервере)."
    )
    print("Игрокам: bedrock.isnix.ru (DNS: docs/dns-bedrock-isnix-ru.md)")
    print("Java: mc.isnix.ru")


if __name__ == "__main__":
    main()
