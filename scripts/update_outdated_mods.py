#!/usr/bin/env python3
"""Скачать свежие версии устаревших модов, пересобрать клиентский модпак и залить на сервер."""
from __future__ import annotations

import json
import subprocess
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SERVER_STAGING = ROOT / "build" / "server-modpack-1.21.11"
CLIENT_STAGING = ROOT / "build" / "client-modpack-staging"
GAME = "1.21.11"

# slug -> (prefer_server, glob prefix for удаления старых jar)
UPDATES = {
    "create-cyber-goggles": (False, "createcybergoggles"),
    "xaeros-minimap": (False, "xaerominimap"),
    "xaeros-world-map": (False, "xaeroworldmap"),
    "open-parties-and-claims": (False, "open-parties-and-claims"),
    "collective": (False, "collective"),
    "tab-was-taken": (False, "tab v"),
}

OLD_REMOTE = [
    "automodpack/host-modpack/main/mods/CreateCyberGoggles-1.21.11-5.0.2-Fabric.jar",
    "automodpack/host-modpack/main/mods/xaerominimap-fabric-1.21.11-25.3.12.jar",
    "automodpack/host-modpack/main/mods/xaeroworldmap-fabric-1.21.11-1.40.16.jar",
    "automodpack/host-modpack/main/mods/open-parties-and-claims-fabric-1.21.11-0.26.3.jar",
    "automodpack/host-modpack/main/mods/collective-1.21.11-8.22.jar",
    "mods/open-parties-and-claims-fabric-1.21.11-0.26.3.jar",
    "mods/collective-1.21.11-8.22.jar",
    "mods/TAB v5.5.0.jar",
]

sys.path.insert(0, str(ROOT / "scripts"))
from play2go_sftp import connect, remote_path  # noqa: E402


def fetch_version(slug: str, prefer_server: bool = False) -> dict | None:
    url = (
        f"https://api.modrinth.com/v2/project/{slug}/version"
        f'?game_versions=%5B%22{GAME}%22%5D&loaders=%5B%22fabric%22%5D'
    )
    req = urllib.request.Request(url, headers={"User-Agent": "isnix-update/1.0"})
    data = json.load(urllib.request.urlopen(req, timeout=60))
    if not data:
        return None
    v = data[0]
    files = v["files"]
    chosen = None
    if prefer_server:
        for f in files:
            if "-server.jar" in f["filename"].lower():
                chosen = f
                break
    if chosen is None:
        chosen = next((f for f in files if f.get("primary")), files[0])
    return {
        "slug": slug,
        "version": v["version_number"],
        "filename": chosen["filename"],
        "url": chosen["url"],
        "date": (v.get("date_published") or "")[:10],
    }


def remove_matching(directory: Path, needle: str) -> None:
    if not directory.is_dir():
        return
    n = needle.lower().replace(" ", "")
    for jar in directory.glob("*.jar"):
        if n in jar.name.lower().replace(" ", ""):
            print(f"  del local {jar.name}")
            jar.unlink()


def download(info: dict, dest: Path) -> Path:
    dest.mkdir(parents=True, exist_ok=True)
    out = dest / info["filename"]
    req = urllib.request.Request(info["url"], headers={"User-Agent": "isnix-update/1.0"})
    out.write_bytes(urllib.request.urlopen(req, timeout=120).read())
    print(f"  OK {info['filename']} ({info['version']}, {info['date']})")
    return out


def push_server_jar(local: Path, remote_name: str) -> None:
    subprocess.check_call(
        [
            sys.executable,
            str(ROOT / "scripts" / "play2go_sftp.py"),
            "push",
            str(local),
            f"mods/{remote_name}",
        ],
        cwd=ROOT,
    )


def main() -> None:
    downloaded: dict[str, Path] = {}
    print("=== 1) Скачивание свежих jar ===")
    for slug, (prefer_server, needle) in UPDATES.items():
        print(slug)
        remove_matching(SERVER_STAGING, needle)
        info = fetch_version(slug, prefer_server)
        if not info:
            print(f"  SKIP: нет версии для {GAME}")
            continue
        downloaded[slug] = download(info, SERVER_STAGING)

    print("\n=== 2) Пересборка клиентского модпака ===")
    subprocess.check_call([sys.executable, str(ROOT / "scripts" / "build_client_modpack_12111.py")], cwd=ROOT)

    print("\n=== 3) Удаление старых jar на сервере ===")
    transport, sftp, base = connect()
    try:
        for rel in OLD_REMOTE:
            path = remote_path(base, rel)
            try:
                sftp.remove(path)
                print(f"  rm {rel}")
            except OSError:
                pass
    finally:
        sftp.close()
        transport.close()

    print("\n=== 4) host-modpack (AutoModpack) ===")
    subprocess.check_call([sys.executable, str(ROOT / "scripts" / "deploy_automodpack.py")], cwd=ROOT)

    print("\n=== 5) Серверные jar в /mods ===")
    for slug in ("open-parties-and-claims", "collective", "tab-was-taken"):
        path = downloaded.get(slug)
        if path and path.is_file():
            push_server_jar(path, path.name)

    print("\nГОТОВО. Перезапустите сервер в Play2GO.")
    print("После рестарта: /automodpack generate (или дождаться автогенерации).")
    print("Игроки получат обновления при следующем заходе через AutoModpack.")


if __name__ == "__main__":
    main()
