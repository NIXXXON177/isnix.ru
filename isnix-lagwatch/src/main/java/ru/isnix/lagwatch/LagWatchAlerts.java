package ru.isnix.lagwatch;

import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

public final class LagWatchAlerts {
	private static final java.util.concurrent.ConcurrentHashMap<ChunkKey, Long> LAST_ALERT_MS =
			new java.util.concurrent.ConcurrentHashMap<>();

	private LagWatchAlerts() {
	}

	public static boolean shouldAlert(ChunkKey key) {
		long now = System.currentTimeMillis();
		long cooldownMs = LagWatchConfig.get().alertCooldownSeconds * 1000L;
		Long last = LAST_ALERT_MS.get(key);
		if (last != null && now - last < cooldownMs) {
			return false;
		}
		LAST_ALERT_MS.put(key, now);
		return true;
	}

	public static void notify(
			MinecraftServer server,
			ChunkKey key,
			int blockUpdates,
			ChunkEntityCounts entities,
			String reason) {
		if (!shouldAlert(key)) {
			return;
		}

		String message = String.format(
				"[LagWatch] %s — %s (%s): блоков/интервал=%d, сущностей=%d, предметов=%d",
				reason,
				key.dimensionId(),
				key.centerCoords(),
				blockUpdates,
				entities.totalNonPlayer,
				entities.items);

		if (LagWatchConfig.get().logToConsole) {
			IsnixLagWatchMod.LOGGER.warn(message);
		}

		if (!LagWatchConfig.get().alertAdminsInChat) {
			return;
		}

		Text chat = Text.literal(message).formatted(Formatting.GOLD, Formatting.BOLD);
		int level = LagWatchConfig.get().opPermissionLevel;
		for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
			if (PermissionChecks.playerAtLeast(player, level)) {
				player.sendMessage(chat, false);
			}
		}
	}
}
