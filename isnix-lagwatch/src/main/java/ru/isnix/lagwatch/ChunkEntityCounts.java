package ru.isnix.lagwatch;

import net.minecraft.entity.Entity;
import net.minecraft.entity.ItemEntity;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.Box;

public final class ChunkEntityCounts {
	public final int totalNonPlayer;
	public final int items;

	public ChunkEntityCounts(int totalNonPlayer, int items) {
		this.totalNonPlayer = totalNonPlayer;
		this.items = items;
	}

	public static ChunkEntityCounts count(ServerWorld world, int chunkX, int chunkZ) {
		int minX = chunkX << 4;
		int minZ = chunkZ << 4;
		int maxX = minX + 15;
		int maxZ = minZ + 15;
		Box box = new Box(
				minX,
				world.getBottomY(),
				minZ,
				maxX + 1.0,
				world.getTopY(),
				maxZ + 1.0);

		int total = 0;
		int items = 0;
		for (Entity entity : world.getEntitiesByClass(Entity.class, box, e -> true)) {
			if (entity instanceof ServerPlayerEntity) {
				continue;
			}
			total++;
			if (entity instanceof ItemEntity) {
				items++;
			}
		}
		return new ChunkEntityCounts(total, items);
	}
}
