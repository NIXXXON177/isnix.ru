package ru.isnix.modtools;

import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;

public final class AdminAccess {
	private AdminAccess() {
	}

	/**
	 * Консоль, OP (уровень 4) или группа LuckPerms {@code admin}.
	 */
	public static boolean canUseModTools(ServerCommandSource source) {
		if (PermissionChecks.sourceAtLeast(source, ModToolsConfig.get().opPermissionLevel)) {
			return true;
		}
		if (source.getEntity() instanceof ServerPlayerEntity player) {
			return LuckPermsAdminBridge.hasAdminGroup(player);
		}
		return false;
	}
}
