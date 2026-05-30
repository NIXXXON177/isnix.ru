package ru.isnix.opactab;

import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Кэш тега на главном потоке — TAB не дергает OPAC из Netty при отправке чата. */
public final class ClanTagCache {
	private static final Map<UUID, String> BY_UUID = new ConcurrentHashMap<>();

	private ClanTagCache() {
	}

	public static String get(UUID uuid) {
		if (uuid == null) {
			return "";
		}
		return BY_UUID.getOrDefault(uuid, "");
	}

	public static void put(ServerPlayerEntity player) {
		if (player == null) {
			return;
		}
		String tag = ClanTagFormatter.formatForPlayer(player);
		BY_UUID.put(player.getUuid(), tag == null ? "" : tag);
	}

	public static void refreshAll(MinecraftServer server) {
		if (server == null) {
			return;
		}
		for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
			put(player);
		}
	}

	public static void remove(UUID uuid) {
		if (uuid != null) {
			BY_UUID.remove(uuid);
		}
	}
}
