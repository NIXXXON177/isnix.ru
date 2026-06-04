#!/usr/bin/env python3
"""Скачивает моды Modrinth для 1.21.11 Fabric в build/server-modpack-1.21.11/."""
from __future__ import annotations

import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "docs" / "modpack-1.21.11-manifest.json"
OUT = ROOT / "build" / "server-modpack-1.21.11"
GAME = "1.21.11"


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
        print(f"  FAIL {slug}: {e}")
        return None
    if not data:
        print(f"  SKIP {slug}: нет версии для {GAME}")
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
    }


def download(info: dict) -> bool:
    dest = OUT / info["filename"]
    if dest.is_file() and dest.stat().st_size > 0:
        print(f"  OK {info['filename']} (cached)")
        return True
    req = urllib.request.Request(info["url"], headers={"User-Agent": "isnix-modpack/1.0"})
    try:
        data = urllib.request.urlopen(req, timeout=120).read()
        dest.write_bytes(data)
        print(f"  OK {info['filename']} ({len(data) // 1024} KiB)")
        return True
    except Exception as e:
        print(f"  FAIL download {info['filename']}: {e}")
        return False


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    OUT.mkdir(parents=True, exist_ok=True)
    server_mods = manifest["modrinth_server"]
    slugs = [m["slug"] for m in server_mods]
    slugs += [m["slug"] for m in manifest.get("modrinth_client_extra", []) if m.get("required")]

    ok, fail = 0, 0
    index = []
    seen = set()
    for entry in server_mods:
        slug = entry["slug"]
        if slug in seen:
            continue
        seen.add(slug)
        print(slug + (" (server jar)" if entry.get("server_variant") else ""))
        info = fetch_version(slug, prefer_server=bool(entry.get("server_variant")))
        if not info:
            fail += 1
            continue
        if download(info):
            ok += 1
            index.append(info)
        else:
            fail += 1

    (OUT / "MODPACK_INDEX.json").write_text(
        json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"\nГотово: {ok} ok, {fail} fail -> {OUT}")


if __name__ == "__main__":
    main()
