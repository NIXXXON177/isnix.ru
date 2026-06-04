package ru.isnix.graveguard;

import net.minecraft.command.permission.LeveledPermissionPredicate;
import net.minecraft.command.permission.Permission;
import net.minecraft.command.permission.PermissionLevel;
import net.minecraft.command.permission.PermissionPredicate;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;

public final class PermissionChecks {
	private PermissionChecks() {
	}

	public static boolean sourceAtLeast(ServerCommandSource source, int level) {
		return predicateAtLeast(source.getPermissions(), level);
	}

	public static boolean playerAtLeast(ServerPlayerEntity player, int level) {
		return predicateAtLeast(player.getPermissions(), level);
	}

	private static boolean predicateAtLeast(PermissionPredicate pred, int level) {
		PermissionLevel min = PermissionLevel.fromLevel(level);
		if (pred instanceof LeveledPermissionPredicate leveled) {
			return leveled.getLevel().isAtLeast(min);
		}
		return pred.hasPermission(new Permission.Level(min));
	}
}
