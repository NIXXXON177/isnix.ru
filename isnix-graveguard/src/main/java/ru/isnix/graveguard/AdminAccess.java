package ru.isnix.graveguard;

import net.minecraft.server.command.ServerCommandSource;

public final class AdminAccess {
	private AdminAccess() {
	}

	public static boolean canUse(ServerCommandSource source) {
		return PermissionChecks.sourceAtLeast(source, GraveGuardConfig.get().opPermissionLevel);
	}
}
