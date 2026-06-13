package ru.isnix.opactab;

import net.minecraft.command.permission.LeveledPermissionPredicate;
import net.minecraft.command.permission.Permission;
import net.minecraft.command.permission.PermissionLevel;
import net.minecraft.command.permission.PermissionPredicate;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;

/**
 * Полный обход защиты приватов OPAC для админов.
 *
 * <p>Право выдаётся, если у игрока есть нода LuckPerms {@code isnix.claims.bypass}
 * ИЛИ он реальный оператор сервера (OP-уровень 4). Состояние OPAC fullPass хранится
 * в памяти и сбрасывается при рестарте — поэтому применяем на входе и периодически,
 * чтобы подхватывать выдачу/снятие права на лету.
 */
public final class ClaimBypass {
	public static final String BYPASS_NODE = "isnix.claims.bypass";
	/** Реальные операторы сервера всегда получают байпас. */
	private static final int OP_LEVEL = 4;

	private ClaimBypass() {
	}

	/** Синхронизировать состояние байпаса одного игрока с его правами. */
	public static void apply(ServerPlayerEntity player) {
		if (player == null) {
			return;
		}
		MinecraftServer server = player.getEntityWorld().getServer();
		if (server == null || !OpacBridge.isAvailable()) {
			return;
		}
		if (shouldBypass(player)) {
			OpacBridge.giveFullPass(server, player.getUuid());
		} else {
			OpacBridge.removeFullPass(server, player.getUuid());
		}
	}

	/** Пройтись по всем онлайн-игрокам (на входе нового и периодически в тике). */
	public static void applyAll(MinecraftServer server) {
		if (server == null || !OpacBridge.isAvailable()) {
			return;
		}
		for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
			apply(player);
		}
	}

	private static boolean shouldBypass(ServerPlayerEntity player) {
		if (isOperator(player)) {
			return true;
		}
		return LuckPermsBridge.hasPermission(player, BYPASS_NODE);
	}

	private static boolean isOperator(ServerPlayerEntity player) {
		PermissionPredicate pred = player.getPermissions();
		PermissionLevel min = PermissionLevel.fromLevel(OP_LEVEL);
		if (pred instanceof LeveledPermissionPredicate leveled) {
			return leveled.getLevel().isAtLeast(min);
		}
		return pred.hasPermission(new Permission.Level(min));
	}
}
