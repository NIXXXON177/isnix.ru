#!/usr/bin/env python3
"""
Патч create_useful_recipes для Create Fly 1.21.11:
- pack.mcmeta: min_format / max_format
- compacting: fluid_ingredients + results (вместо fluid_ingredient / result)

  python scripts/patch_create_useful_recipes.py
  python scripts/patch_create_useful_recipes.py --jar path/to/mod.jar
"""
from __future__ import annotations

import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_JAR = ROOT / "build" / "server-modpack-1.21.11" / "create_useful_recipes_1.21.11_0.0.1.jar"
OUT_JAR = DEFAULT_JAR

PACK_MCMETA = {
    "pack": {
        "pack_format": 82,
        "min_format": 82,
        "max_format": 99,
        "description": "Create: Useful Recipes (ISNIX patch for Create Fly 1.21.11)",
    }
}

COMPACTING = {
    "magmablockcompact.json": {
        "type": "create:compacting",
        "ingredients": ["minecraft:cobblestone"],
        "fluid_ingredients": [
            {"type": "fluid_stack", "amount": 8100, "fluid": "minecraft:lava"}
        ],
        "results": [{"id": "minecraft:magma_block"}],
    },
    "tuffcompact.json": {
        "type": "create:compacting",
        "ingredients": ["minecraft:cobblestone", "minecraft:blackstone"],
        "fluid_ingredients": [
            {"type": "fluid_stack", "amount": 8100, "fluid": "minecraft:lava"}
        ],
        "results": [{"id": "minecraft:tuff"}],
    },
}


def patch_tree(work: Path) -> None:
    (work / "pack.mcmeta").write_text(
        json.dumps(PACK_MCMETA, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    recipe_dir = work / "data" / "create_useful_recipes" / "recipe" / "compacting"
    recipe_dir.mkdir(parents=True, exist_ok=True)
    for name, data in COMPACTING.items():
        (recipe_dir / name).write_text(
            json.dumps(data, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )


def repack_jar(work: Path, jar_path: Path) -> None:
    if jar_path.exists():
        jar_path.unlink()
    # jar cf from work dir contents
    entries = []
    for path in sorted(work.rglob("*")):
        if path.is_file():
            entries.append(path.relative_to(work).as_posix())
    if not entries:
        raise SystemExit("empty work dir")
    cmd = ["jar", "cf", str(jar_path.resolve())] + entries
    subprocess.run(cmd, cwd=work, check=True)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--jar", type=Path, default=DEFAULT_JAR)
    parser.add_argument("--work", type=Path, default=ROOT / "build" / "useful-recipes-fix")
    args = parser.parse_args()
    jar = args.jar.resolve()
    if not jar.is_file():
        print(f"Нет jar: {jar}", file=sys.stderr)
        print("Сначала: python scripts/fetch_modpack_12111.py", file=sys.stderr)
        sys.exit(1)

    work = args.work
    if work.is_dir():
        shutil.rmtree(work, ignore_errors=True)
    work.mkdir(parents=True)

    subprocess.run(["jar", "xf", str(jar)], cwd=work, check=True)
    patch_tree(work)
    repack_jar(work, jar)
    print(f"OK patched -> {jar}")

    client = ROOT / "build" / "client-modpack-staging"
    if client.is_dir():
        dest = client / jar.name
        shutil.copy2(jar, dest)
        print(f"OK copied -> {dest}")


if __name__ == "__main__":
    main()
