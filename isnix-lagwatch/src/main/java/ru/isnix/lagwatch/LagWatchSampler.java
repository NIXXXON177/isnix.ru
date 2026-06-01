package ru.isnix.lagwatch;

import net.minecraft.server.MinecraftServer;
import net.minecraft.server.world.ServerWorld;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

public final class LagWatchSampler {
	public record HotChunk(
			ChunkKey key,
			int blockUpdates,
			int entities,
			int items,
			String reason) {
	}

	private static volatile List<HotChunk> lastHotChunks = List.of();

	private LagWatchSampler() {
	}

	public static List<HotChunk> getLastHotChunks() {
		return lastHotChunks;
	}

	public static void sample(MinecraftServer server) {
		LagWatchConfig cfg = LagWatchConfig.get();
		Map<ChunkKey, Integer> blockUpdates = ChunkActivityTracker.drainBlockUpdates();
		List<HotChunk> hot = new ArrayList<>();

		for (Map.Entry<ChunkKey, Integer> entry : blockUpdates.entrySet()) {
			ChunkKey key = entry.getKey();
			int updates = entry.getValue();
			ServerWorld world = server.getWorld(key.dimension());
			if (world == null) {
				continue;
			}

			ChunkEntityCounts counts = ChunkEntityCounts.count(world, key.chunkX(), key.chunkZ());
			String reason = evaluate(key, updates, counts, cfg);
			if (reason != null) {
				hot.add(new HotChunk(key, updates, counts.totalNonPlayer, counts.items, reason));
				LagWatchAlerts.notify(server, key, updates, counts, reason);
			}
		}

		hot.sort(Comparator.comparingInt(HotChunk::blockUpdates).reversed());
		if (hot.size() > 10) {
			hot = new ArrayList<>(hot.subList(0, 10));
		}
		lastHotChunks = List.copyOf(hot);
	}

	public static String evaluate(ChunkKey key, int blockUpdates, ChunkEntityCounts counts, LagWatchConfig cfg) {
		boolean blockHot = blockUpdates >= cfg.blockUpdatesPerSecondThreshold;
		boolean entityHot = counts.totalNonPlayer >= cfg.entityCountThreshold;
		boolean itemHot = counts.items >= cfg.itemEntityCountThreshold;

		if (blockHot && (entityHot || itemHot)) {
			return "лаг-машина (блоки + сущности)";
		}
		if (blockHot) {
			return "много обновлений блоков";
		}
		if (itemHot && counts.items >= cfg.itemEntityCountThreshold * 2) {
			return "спам предметов";
		}
		if (entityHot && counts.totalNonPlayer >= cfg.entityCountThreshold * 2) {
			return "спам сущностей";
		}
		return null;
	}

	public static HotChunk scanChunk(ServerWorld world, int chunkX, int chunkZ) {
		ChunkKey key = ChunkKey.of(world, chunkX, chunkZ);
		ChunkEntityCounts counts = ChunkEntityCounts.count(world, chunkX, chunkZ);
		String reason = evaluate(key, 0, counts, LagWatchConfig.get());
		if (reason == null && counts.totalNonPlayer > 0) {
			reason = "проверка";
		}
		return new HotChunk(key, 0, counts.totalNonPlayer, counts.items, reason != null ? reason : "норма");
	}
}
