#!/usr/bin/env python3
"""Извлекает заводской список playerConfigurablePlayerConfigOptions из jar OPAC."""
import re
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
JAR = ROOT / "server-remote/mods/open-parties-and-claims-fabric-1.21.1-0.26.3.jar"
CLASS = "xaero/pac/common/server/config/ServerConfig.class"

EXTRA = [
    "parties.name",
    "claims.forceload.offlineForceload",
    "claims.protection.neighborChunksItemUse",
    "claims.protection.overrideMobGriefingRule",
    "claims.protection.exceptions.blocksByPlayers",
    "claims.protection.exceptions.blocksByMobs",
    "claims.protection.exceptions.blocksByOther",
    "claims.protection.exceptions.blocksRedirect",
    "claims.protection.exceptions.blocksByExplosions",
    "claims.protection.exceptions.fireSpread",
    "claims.protection.exceptions.itemUse",
    "claims.protection.exceptions.playersByPlayers",
    "claims.protection.exceptions.playersByMobs",
    "claims.protection.exceptions.playersByOther",
    "claims.protection.exceptions.playersRedirect",
    "claims.protection.exceptions.chorusFruitTeleport",
]


def main() -> None:
    data = zipfile.ZipFile(JAR).read(CLASS).decode("latin-1", errors="ignore")
    opts = set(re.findall(r"(?:party|claims)\.[a-zA-Z0-9_.-]+", data))
    opts.update(EXTRA)
    opts = {
        o
        for o in opts
        if not o.endswith(".")
        and "..." not in o
        and len(o) >= 10
        and "remove comment" not in o
        and not o.endswith(".groups.")
        and not o.endswith(".exceptions.")
        and not o.endswith(".exceptionGroups.")
        and not o.endswith(".barrier.")
    }
    lines = ["playerConfigurablePlayerConfigOptions = ["]
    for o in sorted(opts):
        lines.append(f'\t"{o}",')
    lines.append("]")
    print("\n".join(lines))


if __name__ == "__main__":
    main()
