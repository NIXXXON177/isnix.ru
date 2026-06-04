#!/usr/bin/env python3
"""
Деплой сборки 1.21.11 на Play2GO:
1) Очистка старых jar (geyser, floodgate, 1.21.1)
2) Заливка build/server-modpack-1.21.11/*.jar

Перед запуском: server jar 1.21.11, бэкап мира, стоп сервера.
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGING = ROOT / "build" / "server-modpack-1.21.11"
MANIFEST = ROOT / "docs" / "modpack-1.21.11-manifest.json"
SFTP = ROOT / "scripts" / "play2go_sftp.py"


def sftp(*args: str) -> None:
    cmd = [sys.executable, str(SFTP), *args]
    r = subprocess.run(cmd, cwd=ROOT)
    if r.returncode != 0:
        raise SystemExit(r.returncode)


def list_remote_mods() -> list[str]:
    r = subprocess.run(
        [sys.executable, str(SFTP), "ls", "mods"],
        cwd=ROOT,
        capture_output=True,
        text=True,
    )
    lines = r.stdout.splitlines()
    return [ln.strip() for ln in lines if ln.strip() and not ln.startswith("#")]


def should_remove(name: str, patterns: list[str]) -> bool:
    low = name.lower()
    for p in patterns:
        p = p.lower().replace("*", "")
        if p and p in low:
            return True
    if "1.21.1" in name and "1.21.11" not in name:
        return True
    return False


def main() -> None:
    if not STAGING.is_dir() or not any(STAGING.glob("*.jar")):
        print("Сначала: python scripts/fetch_modpack_12111.py")
        print("         python scripts/build_isnix_mods_12111.py")
        sys.exit(1)

    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    patterns = manifest.get("remove_jars_glob", [])

    print("=== Удаление устаревших модов на сервере ===")
    for name in list_remote_mods():
        if should_remove(name, patterns):
            print(f"  rm {name}")
            try:
                sftp("rm", f"mods/{name}")
            except SystemExit:
                print(f"  WARN не удалось удалить {name}")

    print("\n=== Заливка новых jar ===")
    for jar in sorted(STAGING.glob("*.jar")):
        remote = f"mods/{jar.name}"
        print(f"  push {jar.name}")
        sftp("push", str(jar), remote)

    print("\nГотово. Дальше в панели Play2GO:")
    print("  - server.jar -> Minecraft 1.21.11 Fabric")
    print("  - Start → проверить лог (Create, FD, isnix)")
    print("  - /spark tps после 5+ игроков")


if __name__ == "__main__":
    main()
