#!/usr/bin/env python3
"""Create-стек: снять битый Ultimate Factory, залить Nerfad и isnix-guide."""
from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGING = ROOT / "build" / "server-modpack-1.21.11"
SFTP = ROOT / "scripts" / "play2go_sftp.py"
PUSH = ROOT / ".github" / "scripts" / "push_sftp.py"
ENV_FILE = ROOT / "server-sftp.env"
ULTIMATE_REMOTE = "mods/create_ultimate_factory_unofficial_fix-createfly-1.21.11.jar"


def load_env() -> None:
    import os

    if not ENV_FILE.is_file():
        return
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def sftp(*args: str) -> int:
    return subprocess.call([sys.executable, str(SFTP), *args])


def push_jar(jar: Path) -> int:
    import os
    import re

    name = jar.name
    match = re.match(r"^(isnix-[a-z-]+)-", name)
    prefix = match.group(1) if match else name.replace(".jar", "")
    os.environ["LOCAL_FILE"] = str(jar.resolve())
    os.environ["REMOTE_PATH"] = f"mods/{name}"
    os.environ["CLEANUP_MOD_PREFIX"] = prefix
    print(f"=== push {name} ===")
    return subprocess.call([sys.executable, str(PUSH)])


def main() -> int:
    load_env()
    failed: list[str] = []

    print(f"=== rm {ULTIMATE_REMOTE} (ignore if missing) ===")
    sftp("rm", ULTIMATE_REMOTE)

    nerfad = sorted(STAGING.glob("*nerfad*.jar")) + sorted(STAGING.glob("*Nerfad*.jar"))
    if not nerfad:
        print("WARN: create-nerfad jar не найден — сначала: python scripts/fetch_modpack_12111.py create-nerfad")
    else:
        jar = nerfad[-1]
        print(f"=== push {jar.name} ===")
        if sftp("push", str(jar), f"mods/{jar.name}") != 0:
            failed.append(jar.name)

    guides = sorted(STAGING.glob("isnix-guide-*.jar"))
    if guides:
        if push_jar(guides[-1]) != 0:
            failed.append(guides[-1].name)
    else:
        print("WARN: isnix-guide jar нет — python scripts/build_isnix_mods_12111.py isnix-guide")

    if failed:
        print("FAILED:", ", ".join(failed), file=sys.stderr)
        return 1
    print("\nOK — перезапусти сервер и /tab reload если нужно.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
