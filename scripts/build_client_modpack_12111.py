#!/usr/bin/env python3
"""Сборка downloads/ISTHISNIXXXONmods.zip для Minecraft 1.21.11 (Fabric)."""
from __future__ import annotations

import json
import re
import shutil
import urllib.request
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "docs" / "modpack-1.21.11-manifest.json"
SERVER_STAGING = ROOT / "build" / "server-modpack-1.21.11"
CLIENT_STAGING = ROOT / "build" / "client-modpack-staging"
OUT_ZIP = ROOT / "downloads" / "ISTHISNIXXXONmods.zip"
GAME = "1.21.11"

# Не ставить игрокам — только сервер
EXCLUDE_SUBSTR = (
    "easyauth",
    "luckperms",
    "grimac",
    "servercore",
    "spark-",
    "krypton",
    "ledger-",
    "chunky",
    "fastrtp",
    "fallingtree",
    "fsit-",
    "vanish-",
    "worldedit",
    "xaeros-map-server",
    "invview",
    "easywhitelist",
    "essential_commands",
    "placeholder-api",
    "tab v",  # TAB — только сервер
)

# Доп. клиентские моды (Modrinth), если нет в server staging
EXTRA_CLIENT_SLUGS = [
    "rei",  # EMI нет на 1.21.11; REI — просмотр рецептов
    "advancement-plaques",
    "appleskin",
    "shulkerboxtooltip",
    "libipn",  # обязательная зависимость inventory-profiles-next
    "inventory-profiles-next",
    "mouse-tweaks",
    "immediatelyfast",
    "ferritecore",
    "modernfix",
    "dynamic-fps",
    "sound-physics-remastered",
    "presence-footsteps-fabric",
]


def fetch_version(slug: str, prefer_server: bool = False) -> dict | None:
    url = (
        "https://api.modrinth.com/v2/project/"
        + slug
        + f"/version?game_versions=%5B%22{GAME}%22%5D&loaders=%5B%22fabric%22%5D"
    )
    req = urllib.request.Request(url, headers={"User-Agent": "isnix-modpack/1.0"})
    try:
        data = json.load(urllib.request.urlopen(req, timeout=60))
    except Exception as e:
        print(f"  FAIL fetch {slug}: {e}")
        return None
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
    if prefer_server is False:
        for f in files:
            if "-server.jar" not in f["filename"].lower():
                chosen = f
                break
    if chosen is None:
        chosen = next((f for f in files if f.get("primary")), files[0])
    return {
        "filename": chosen["filename"],
        "url": chosen["url"],
    }


def download_mod(info: dict, dest_dir: Path) -> bool:
    dest = dest_dir / info["filename"]
    if dest.is_file() and dest.stat().st_size > 0:
        print(f"  cached {info['filename']}")
        return True
    req = urllib.request.Request(info["url"], headers={"User-Agent": "isnix-modpack/1.0"})
    try:
        dest.write_bytes(urllib.request.urlopen(req, timeout=120).read())
        print(f"  OK {info['filename']}")
        return True
    except Exception as e:
        print(f"  FAIL {info['filename']}: {e}")
        return False


def should_include_server_jar(name: str) -> bool:
    low = name.lower()
    if low.endswith("-server.jar"):
        return False
    if low.startswith("isnix-") and not low.startswith("isnix-chat"):
        return False
    if any(x in low for x in EXCLUDE_SUBSTR):
        return False
    return True


def mod_key(name: str) -> str:
    low = name.lower()
    low = re.sub(r"\+1\.21[^+]*", "", low)
    low = re.sub(r"-1\.21[^-]*", "", low)
    return low.split("-fabric")[0].split("+")[0][:40]


def copy_server_parity(dest: Path) -> int:
    n = 0
    seen: set[str] = set()
    if not SERVER_STAGING.is_dir():
        print("WARN: нет build/server-modpack-1.21.11 — сначала fetch_modpack_12111.py")
        return 0
    for jar in sorted(SERVER_STAGING.glob("*.jar")):
        if not should_include_server_jar(jar.name):
            continue
        key = mod_key(jar.name)
        if key in seen:
            continue
        seen.add(key)
        shutil.copy2(jar, dest / jar.name)
        print(f"  parity: {jar.name}")
        n += 1
    return n


def ensure_create_fly_client(dest: Path) -> None:
    if any("create-fly" in p.name and "-server" not in p.name for p in dest.glob("*.jar")):
        return
    info = fetch_version("create-fly", prefer_server=False)
    if info:
        download_mod(info, dest)


def fetch_client_extras(dest: Path, manifest: dict) -> None:
    slugs = list({m["slug"] for m in manifest.get("modrinth_client_extra", [])})
    slugs += EXTRA_CLIENT_SLUGS
    have = {mod_key(p.name) for p in dest.glob("*.jar")}
    for slug in slugs:
        info = fetch_version(slug, prefer_server=False)
        if not info:
            continue
        key = mod_key(info["filename"])
        if key in have:
            continue
        if download_mod(info, dest):
            have.add(key)


def write_modpack_txt(dest: Path, jars: list[str]) -> None:
    text = "\n".join(
        [
            "ISTHISNIXXXON — клиентская сборка (Fabric 1.21.11)",
            f"Собрано: {datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')}",
            f"Модов: {len(jars)}",
            "",
            "Create-Fly (клиентский jar), FD, OPAC, Voice Chat, карты, Sodium/Iris.",
            "QoL только на сервере (FallingTree, EasyAuth, Grim, /sell) — не ставить.",
            "",
            "ElyPrismLauncher: Добавить -> Импортировать из ZIP",
            "или jar в mods инстанса Minecraft 1.21.11 Fabric.",
            "",
            "Список:",
            *[f"  - {j}" for j in sorted(jars)],
            "",
        ]
    )
    (dest / "MODPACK.txt").write_text(text, encoding="utf-8")


def build_zip(staging: Path, out: Path) -> list[str]:
    jars = sorted(p.name for p in staging.glob("*.jar"))
    out.parent.mkdir(parents=True, exist_ok=True)
    bak = out.with_suffix(".zip.bak")
    if out.is_file():
        shutil.copy2(out, bak)
        print(f"Backup: {bak}")
    write_modpack_txt(staging, jars)
    with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        zf.write(staging / "MODPACK.txt", "MODPACK.txt")
        for name in jars:
            zf.write(staging / name, name)
    return jars


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if CLIENT_STAGING.exists():
        shutil.rmtree(CLIENT_STAGING)
    CLIENT_STAGING.mkdir(parents=True)

    print("1) Моды с серверной сборки (без server-only)...")
    copy_server_parity(CLIENT_STAGING)

    print("\n2) Create-Fly клиент...")
    ensure_create_fly_client(CLIENT_STAGING)

    print("\n3) Доп. клиентские моды Modrinth...")
    fetch_client_extras(CLIENT_STAGING, manifest)

    jars = build_zip(CLIENT_STAGING, OUT_ZIP)
    mb = OUT_ZIP.stat().st_size / (1024 * 1024)

    doc = {
        "name": "ISTHISNIXXXON Client Modpack",
        "minecraft": "1.21.11",
        "loader": "Fabric 0.18.4",
        "java": "21",
        "launcher": "ElyPrismLauncher (recommended)",
        "version": "3.0.0-client-12111",
        "built": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "mods_count": len(jars),
        "note": "Java only. Create-Fly + FD + client UX. Bedrock removed.",
    }
    (ROOT / "docs" / "client-modpack-manifest.json").write_text(
        json.dumps(doc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"\nOK: {OUT_ZIP} ({len(jars)} mods, {mb:.1f} MiB)")


if __name__ == "__main__":
    main()
