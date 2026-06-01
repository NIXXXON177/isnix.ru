package ru.isnix.modtools;

import net.minecraft.server.network.ServerPlayerEntity;

import java.util.Locale;

/** Блокировка /warp set и /warp delete для не-админов (Essential Commands). */
public final class WarpCommandGuard {
	private WarpCommandGuard() {
	}

	public static boolean isWarpManageCommand(String command) {
		if (command == null || command.isBlank()) {
			return false;
		}
		String[] parts = command.trim().toLowerCase(Locale.ROOT).split("\\s+");
		if (parts.length < 2 || !"warp".equals(parts[0])) {
			return false;
		}
		String sub = parts[1];
		return "set".equals(sub) || "delete".equals(sub);
	}

	public static boolean canManageWarps(ServerPlayerEntity player) {
		return AdminAccess.canUseModTools(player.getCommandSource());
	}
}
