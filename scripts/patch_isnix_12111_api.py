#!/usr/bin/env python3
"""Массовые правки Java API Minecraft 1.21.11 для isnix-* модулей."""
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Только ServerPlayerEntity / Entity — не трогаем source.getServer()
PLAYER_GET_SERVER = re.compile(
    r"(?<![.\w])(player|sender|buyer|voter|receiver|serverPlayer|target|actor|self|other)\.getServer\(\)"
)

SUBS = [
    ("getGameProfile().getName()", "getGameProfile().name()"),
    (".getServerWorld()", ".getEntityWorld()"),
    (PLAYER_GET_SERVER, r"\1.getEntityWorld().getServer()"),
    (".getPos()", ".getEntityPos()"),
    (".getWorld()", ".getEntityWorld()"),
]

PERMISSION_CHECKS = '''package {package};

import net.minecraft.command.permission.LeveledPermissionPredicate;
import net.minecraft.command.permission.Permission;
import net.minecraft.command.permission.PermissionLevel;
import net.minecraft.command.permission.PermissionPredicate;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;

public final class PermissionChecks {{
	private PermissionChecks() {{
	}}

	public static boolean sourceAtLeast(ServerCommandSource source, int level) {{
		return predicateAtLeast(source.getPermissions(), level);
	}}

	public static boolean playerAtLeast(ServerPlayerEntity player, int level) {{
		return predicateAtLeast(player.getPermissions(), level);
	}}

	private static boolean predicateAtLeast(PermissionPredicate pred, int level) {{
		PermissionLevel min = PermissionLevel.fromLevel(level);
		if (pred instanceof LeveledPermissionPredicate leveled) {{
			return leveled.getLevel().isAtLeast(min);
		}}
		return pred.hasPermission(new Permission.Level(min));
	}}
}}
'''

MODULE_PACKAGES = {
    "isnix-player-backup": "ru.isnix.playerbackup",
    "isnix-graveguard": "ru.isnix.graveguard",
    "isnix-lagwatch": "ru.isnix.lagwatch",
    "isnix-modtools": "ru.isnix.modtools",
    "isnix-reputation": "ru.isnix.reputation",
    "isnix-market": "ru.isnix.market",
}


def patch_java(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
    orig = text
    for old, new in SUBS:
        if isinstance(old, re.Pattern):
            text = old.sub(new, text)
        else:
            text = text.replace(old, new)
    if text != orig:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> None:
    changed = 0
    for mod in ROOT.glob("isnix-*"):
        for java in mod.rglob("src/main/java/**/*.java"):
            if patch_java(java):
                changed += 1
                print(f"patched {java.relative_to(ROOT)}")

    for mod_name, package in MODULE_PACKAGES.items():
        rel = Path(*package.split(".")) / "PermissionChecks.java"
        target = ROOT / mod_name / "src" / "main" / "java" / rel
        if target.is_file():
            continue
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(PERMISSION_CHECKS.format(package=package), encoding="utf-8")
        print(f"added {target.relative_to(ROOT)}")

    print(f"done, {changed} files patched")


if __name__ == "__main__":
    main()
