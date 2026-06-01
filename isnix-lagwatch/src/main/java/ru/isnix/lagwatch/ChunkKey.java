package ru.isnix.lagwatch;

import net.minecraft.registry.RegistryKey;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.World;

public record ChunkKey(RegistryKey<World> dimension, int chunkX, int chunkZ) {
	public static ChunkKey of(ServerWorld world, BlockPos pos) {
		return new ChunkKey(world.getRegistryKey(), pos.getX() >> 4, pos.getZ() >> 4);
	}

	public static ChunkKey of(ServerWorld world, int chunkX, int chunkZ) {
		return new ChunkKey(world.getRegistryKey(), chunkX, chunkZ);
	}

	public String dimensionId() {
		return dimension.getValue().toString();
	}

	public String centerCoords() {
		int x = chunkX * 16 + 8;
		int z = chunkZ * 16 + 8;
		return x + " ~ " + z;
	}
}
