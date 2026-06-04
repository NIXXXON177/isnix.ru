#!/usr/bin/env python3
"""Пересборка всех isnix-* модов под Minecraft 1.21.11."""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "docs" / "modpack-1.21.11-manifest.json"
STAGING = ROOT / "build" / "server-modpack-1.21.11"

GRADLE_PROPS = """org.gradle.jvmargs=-Xmx2G
org.gradle.parallel=true

minecraft_version=1.21.11
yarn_mappings=1.21.11+build.3
loader_version=0.18.1
loom_version=1.14.10

fabric_version=0.141.4+1.21.11
"""

WRAPPER_PROPS = """distributionBase=GRADLE_USER_HOME
distributionPath=wrapper/dists
distributionUrl=https\\://services.gradle.org/distributions/gradle-9.2.0-bin.zip
networkTimeout=10000
validateDistributionUrl=true
zipStoreBase=GRADLE_USER_HOME
zipStorePath=wrapper/dists
"""


def patch_mod(mod_dir: Path) -> None:
    gp = mod_dir / "gradle.properties"
    if not gp.is_file():
        print(f"  skip {mod_dir.name}: no gradle.properties")
        return
    lines = gp.read_text(encoding="utf-8").splitlines()
    kept = []
    skip_prefix = (
        "minecraft_version",
        "yarn_mappings",
        "loader_version",
        "loom_version",
        "fabric_version",
        "org.gradle",
    )
    for line in lines:
        if any(line.startswith(p) for p in skip_prefix):
            continue
        kept.append(line)
    gp.write_text(GRADLE_PROPS + "\n".join(kept) + "\n", encoding="utf-8")

    wrapper = mod_dir / "gradle" / "wrapper" / "gradle-wrapper.properties"
    if wrapper.parent.is_dir() or (mod_dir / "gradlew.bat").is_file():
        wrapper.parent.mkdir(parents=True, exist_ok=True)
        wrapper.write_text(WRAPPER_PROPS, encoding="utf-8")

    for fj in mod_dir.rglob("fabric.mod.json"):
        text = fj.read_text(encoding="utf-8")
        if "~1.21.1" in text:
            fj.write_text(text.replace("~1.21.1", "~1.21.11"), encoding="utf-8")


def build_mod(mod_dir: Path) -> Path | None:
    gradlew = mod_dir / "gradlew.bat"
    if not gradlew.is_file():
        src = ROOT / "isnix-server-messages" / "gradlew.bat"
        if src.is_file():
            shutil.copy2(src, gradlew)
            shutil.copy2(ROOT / "isnix-server-messages" / "gradlew", mod_dir / "gradlew")
            shutil.copytree(
                ROOT / "isnix-server-messages" / "gradle",
                mod_dir / "gradle",
                dirs_exist_ok=True,
            )
    r = subprocess.run(
        [str(gradlew), "build", "--no-daemon", "-q"],
        cwd=mod_dir,
        capture_output=True,
        text=True,
    )
    if r.returncode != 0:
        print(r.stderr[-2000:] if r.stderr else r.stdout[-2000:])
        return None
    jars = [
        p
        for p in (mod_dir / "build" / "libs").glob("*.jar")
        if "sources" not in p.name and "dev" not in p.name
    ]
    if not jars:
        return None
    return max(jars, key=lambda p: p.stat().st_mtime)


def main() -> None:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    STAGING.mkdir(parents=True, exist_ok=True)
    failed = []
    for name in manifest["isnix_modules"]:
        mod_dir = ROOT / name
        print(f"=== {name} ===")
        if not mod_dir.is_dir():
            print("  missing dir")
            failed.append(name)
            continue
        patch_mod(mod_dir)
        jar = build_mod(mod_dir)
        if jar is None:
            failed.append(name)
            continue
        dest = STAGING / jar.name
        shutil.copy2(jar, dest)
        print(f"  -> {jar.name}")
    if failed:
        print("\nFAILED:", ", ".join(failed))
        sys.exit(1)
    print(f"\nOK: isnix jars in {STAGING}")


if __name__ == "__main__":
    main()
