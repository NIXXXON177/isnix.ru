package ru.isnix.playerbackup;

import net.minecraft.server.PlayerConfigEntry;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;

public final class OpAccess {
	private OpAccess() {
	}

	/** Консоль/Rcon или игрок из списка /op (ops.json), не LuckPerms-группы. */
	public static boolean canUse(ServerCommandSource source) {
		if (!(source.getEntity() instanceof ServerPlayerEntity player)) {
			return PermissionChecks.sourceAtLeast(source, 4);
		}
		return source.getServer().getPlayerManager().isOperator(new PlayerConfigEntry(player.getGameProfile()));
	}
}
