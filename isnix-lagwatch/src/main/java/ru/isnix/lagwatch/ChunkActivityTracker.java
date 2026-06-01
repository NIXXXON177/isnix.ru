package ru.isnix.lagwatch;

import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicInteger;

public final class ChunkActivityTracker {
	private static final ConcurrentHashMap<ChunkKey, AtomicInteger> BLOCK_UPDATES =
			new ConcurrentHashMap<>();

	private ChunkActivityTracker() {
	}

	public static void recordBlockUpdate(ServerWorld world, BlockPos pos) {
		if (!LagWatchConfig.get().enabled) {
			return;
		}
		ChunkKey key = ChunkKey.of(world, pos);
		BLOCK_UPDATES.computeIfAbsent(key, ignored -> new AtomicInteger()).incrementAndGet();
	}

	public static Map<ChunkKey, Integer> drainBlockUpdates() {
		ConcurrentHashMap<ChunkKey, Integer> snapshot = new ConcurrentHashMap<>();
		for (Map.Entry<ChunkKey, AtomicInteger> entry : BLOCK_UPDATES.entrySet()) {
			int value = entry.getValue().getAndSet(0);
			if (value > 0) {
				snapshot.put(entry.getKey(), value);
			}
		}
		BLOCK_UPDATES.entrySet().removeIf(e -> e.getValue().get() == 0);
		return snapshot;
	}
}
