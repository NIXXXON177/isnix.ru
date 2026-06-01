package ru.isnix.lagwatch;

import net.minecraft.server.command.ServerCommandSource;

public final class AdminAccess {
	private AdminAccess() {
	}

	public static boolean canUse(ServerCommandSource source) {
		return source.hasPermissionLevel(LagWatchConfig.get().opPermissionLevel);
	}
}
