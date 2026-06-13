#!/usr/bin/env python3
"""Сравнить моды на сервере с последними на Modrinth для 1.21.11 Fabric."""
from __future__ import annotations

import json
import re
import sys
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from play2go_sftp import connect, remote_path  # noqa: E402

GAME = "1.21.11"


def fetch_latest(slug: str, prefer_server: bool = False) -> dict | None:
    url = (
        f"https://api.modrinth.com/v2/project/{slug}/version"
        f'?game_versions=%5B%22{GAME}%22%5D&loaders=%5B%22fabric%22%5D'
    )
    req = urllib.request.Request(url, headers={"User-Agent": "isnix-check/1.0"})
    data = json.load(urllib.request.urlopen(req, timeout=30))
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
        "date": (v.get("date_published") or "")[:10],
    }


def main() -> None:
    manifest = json.loads((ROOT / "docs/modpack-1.21.11-manifest.json").read_text(encoding="utf-8"))
    transport, sftp, base = connect()
    try:
        host = set(sftp.listdir(remote_path(base, "automodpack/host-modpack/main/mods")))
        server = set(sftp.listdir(remote_path(base, "mods")))
    finally:
        sftp.close()
        transport.close()
    all_jars = host | server

    entries: list[tuple] = []
    seen: set[str] = set()
    for m in manifest.get("modrinth_server", []):
        if not m.get("required"):
            continue
        slug = m["slug"]
        if slug in seen:
            continue
        seen.add(slug)
        entries.append((slug, m.get("server_variant", False)))

    outdated: list[str] = []
    ok = 0
    for slug, prefer_server in entries:
        info = fetch_latest(slug, prefer_server)
        if info is None:
            outdated.append(f"[NO VER] {slug}: нет версии для {GAME}")
            continue
        latest = info["filename"]
        installed = [j for j in all_jars if j == latest]
        if not installed:
            needle = slug.replace("-", "").lower()
            fuzzy = [
                j
                for j in all_jars
                if needle in j.lower().replace("-", "").replace("_", "")
                or j.lower().startswith(slug.split("-")[0])
            ]
            if fuzzy and fuzzy[0] == latest:
                ok += 1
                continue
            if fuzzy:
                outdated.append(
                    f"[OLD] {slug}\n"
                    f"  сервер: {fuzzy[0]}\n"
                    f"  modrinth ({info['date']}): {latest}  v{info['version']}"
                )
            else:
                outdated.append(f"[MISS] {slug}: на сервере нет, modrinth: {latest}")
        else:
            ok += 1

    print(f"Проверено slug из манифеста: {len(entries)}")
    print(f"Актуально: {ok}")
    print(f"Расхождения: {len(outdated)}\n")
    for line in outdated:
        print(line)
        print()


if __name__ == "__main__":
    main()
