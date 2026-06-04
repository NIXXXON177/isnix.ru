package ru.isnix.reputation;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class ReputationCache {
	private static final Logger LOGGER = LoggerFactory.getLogger(IsnixReputationMod.MOD_ID);
	private static final Map<UUID, ReputationScore> BY_UUID = new ConcurrentHashMap<>();
	private static final Map<String, UUID> NICK_TO_UUID = new ConcurrentHashMap<>();
	private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor(r -> {
		var t = new Thread(r, "isnix-reputation");
		t.setDaemon(true);
		return t;
	});

	private ReputationCache() {
	}

	public static ReputationScore get(ServerPlayerEntity player) {
		return BY_UUID.getOrDefault(player.getUuid(), ReputationScore.ZERO);
	}

	public static ReputationScore getByNick(String nick) {
		if (nick == null || nick.isBlank()) {
			return ReputationScore.ZERO;
		}
		UUID id = NICK_TO_UUID.get(nick.toLowerCase(Locale.ROOT));
		if (id == null) {
			return ReputationScore.ZERO;
		}
		return BY_UUID.getOrDefault(id, ReputationScore.ZERO);
	}

	public static void put(ServerPlayerEntity player, ReputationScore score) {
		BY_UUID.put(player.getUuid(), score);
		NICK_TO_UUID.put(player.getGameProfile().name().toLowerCase(Locale.ROOT), player.getUuid());
	}

	public static String formatted(ServerPlayerEntity player) {
		ReputationConfig cfg = ReputationConfig.get();
		ReputationScore score = get(player);
		if (score.isEmpty()) {
			return cfg.placeholderEmpty;
		}
		return cfg.applyPlaceholders(cfg.placeholderFormat, player.getGameProfile().name(), score);
	}

	public static void refreshAsync(ServerPlayerEntity player) {
		if (!ReputationConfig.get().isReady()) {
			return;
		}
		final String nick = player.getGameProfile().name();
		final UUID uuid = player.getUuid();
		EXECUTOR.execute(() -> {
			ReputationScore score = SupabaseReputationService.fetchReputation(nick);
			BY_UUID.put(uuid, score);
			NICK_TO_UUID.put(nick.toLowerCase(Locale.ROOT), uuid);
		});
	}

	public static void refreshAllOnline(MinecraftServer server) {
		if (!ReputationConfig.get().isReady()) {
			return;
		}
		List<ServerPlayerEntity> players = server.getPlayerManager().getPlayerList();
		if (players.isEmpty()) {
			return;
		}
		List<String> nicks = new ArrayList<>();
		for (ServerPlayerEntity player : players) {
			nicks.add(player.getGameProfile().name());
		}
		EXECUTOR.execute(() -> {
			Map<String, ReputationScore> batch = SupabaseReputationService.fetchReputations(nicks);
			for (ServerPlayerEntity player : players) {
				String nick = player.getGameProfile().name();
				ReputationScore score = batch.getOrDefault(nick.toLowerCase(Locale.ROOT), ReputationScore.ZERO);
				put(player, score);
			}
			LOGGER.debug("Reputation: обновлено {} игрок(ов)", players.size());
		});
	}

	public static void applyBatchJson(String body, List<ServerPlayerEntity> players) {
		try {
			JsonObject root = JsonParser.parseString(body).getAsJsonObject();
			if (!root.has("players") || !root.get("players").isJsonArray()) {
				return;
			}
			var arr = root.getAsJsonArray("players");
			for (int i = 0; i < arr.size() && i < players.size(); i++) {
				JsonObject row = arr.get(i).getAsJsonObject();
				ServerPlayerEntity player = players.get(i);
				put(player, parseRow(row));
			}
		} catch (Exception e) {
			LOGGER.warn("Reputation batch parse: {}", e.getMessage());
		}
	}

	public static ReputationScore parseRow(JsonObject row) {
		long likes = row.has("likes") ? row.get("likes").getAsLong() : 0;
		long dislikes = row.has("dislikes") ? row.get("dislikes").getAsLong() : 0;
		long score = row.has("score") ? row.get("score").getAsLong() : 0;
		return new ReputationScore(likes, dislikes, score);
	}
}
