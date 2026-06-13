package ru.isnix.playerbackup.grave;

import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import ru.isnix.playerbackup.IsnixPlayerBackupMod;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * После смерти кладёт все рюкзаки Traveler's Backpack в NBT могилы ly-graves.
 * TB при grave-моде не спавнит предметы на землю (graves v4 подбирает только item entity),
 * а надетый рюкзак сохраняется в .dat; инъектор раньше брал только последний файл.
 */
public final class GraveBackpackInjector {
	private static final int INITIAL_DELAY_TICKS = 8;
	private static final int MAX_WAIT_TICKS = 120;
	/** Запас до метки смерти: дропы и addBackpack могут чуть отставать. */
	private static final long DEATH_FILE_SKEW_MS = 5_000L;

	private static final List<PendingInjection> pending = new ArrayList<>();
	private static final Map<Integer, UUID> recentDeathUuids = new ConcurrentHashMap<>();

	private GraveBackpackInjector() {
	}

	public static UUID getRecentDeathUuid(int gravesPlayerId) {
		return recentDeathUuids.get(gravesPlayerId);
	}

	public static void register() {
		ServerLivingEntityEvents.ALLOW_DEATH.register((entity, damageSource, damageAmount) -> {
			if (!(entity instanceof ServerPlayerEntity player)) {
				return true;
			}
			if (!TravelersBackpackBridge.isAvailable()) {
				return true;
			}
			int gravesPlayerId = LyGravesBridge.readPlayerUtilsId(player);
			if (gravesPlayerId < 0) {
				return true;
			}
			List<ItemStack> inventoryBackpacks = collectInventoryBackpacks(player);
			if (inventoryBackpacks.isEmpty()) {
				return true;
			}
			synchronized (pending) {
				pending.add(new PendingInjection(
						player.getUuid(),
						gravesPlayerId,
						player.getEntityWorld().getRegistryKey(),
						System.currentTimeMillis(),
						inventoryBackpacks,
						INITIAL_DELAY_TICKS));
			}
			return true;
		});

		ServerLivingEntityEvents.AFTER_DEATH.register((entity, damageSource) -> {
			if (!(entity instanceof ServerPlayerEntity player)) {
				return;
			}
			if (!TravelersBackpackBridge.isAvailable()) {
				return;
			}
			int gravesPlayerId = LyGravesBridge.readPlayerUtilsId(player);
			if (gravesPlayerId < 0) {
				return;
			}
			recentDeathUuids.put(gravesPlayerId, player.getUuid());
			synchronized (pending) {
				PendingInjection existing = findPending(player.getUuid(), gravesPlayerId);
				if (existing != null) {
					existing.ticksRemaining = Math.min(existing.ticksRemaining, INITIAL_DELAY_TICKS);
					return;
				}
				pending.add(new PendingInjection(
						player.getUuid(),
						gravesPlayerId,
						player.getEntityWorld().getRegistryKey(),
						System.currentTimeMillis(),
						List.of(),
						INITIAL_DELAY_TICKS));
			}
		});

		ServerTickEvents.END_SERVER_TICK.register(GraveBackpackInjector::tick);
	}

	private static PendingInjection findPending(UUID playerUuid, int gravesPlayerId) {
		for (PendingInjection job : pending) {
			if (job.playerUuid.equals(playerUuid) && job.gravesPlayerId == gravesPlayerId) {
				return job;
			}
		}
		return null;
	}

	private static List<ItemStack> collectInventoryBackpacks(ServerPlayerEntity player) {
		List<ItemStack> backpacks = new ArrayList<>();
		for (ItemStack stack : player.getInventory().getMainStacks()) {
			if (TravelersBackpackBridge.isBackpackItem(stack)) {
				backpacks.add(stack.copy());
			}
		}
		ItemStack offhand = player.getOffHandStack();
		if (TravelersBackpackBridge.isBackpackItem(offhand)) {
			backpacks.add(offhand.copy());
		}
		return backpacks;
	}

	private static void tick(MinecraftServer server) {
		if (pending.isEmpty()) {
			return;
		}
		synchronized (pending) {
			Iterator<PendingInjection> it = pending.iterator();
			while (it.hasNext()) {
				PendingInjection job = it.next();
				job.waitedTicks++;
				job.ticksRemaining--;
				if (job.ticksRemaining > 0) {
					continue;
				}
				if (process(server, job)) {
					it.remove();
				} else if (job.waitedTicks >= MAX_WAIT_TICKS) {
					IsnixPlayerBackupMod.LOGGER.warn(
							"Не удалось вложить рюкзак(и) в могилу игрока {} (utils.player.id={})",
							job.playerUuid,
							job.gravesPlayerId);
					it.remove();
				} else {
					job.ticksRemaining = 4;
				}
			}
		}
	}

	private static boolean process(MinecraftServer server, PendingInjection job) {
		ServerWorld world = server.getWorld(job.dimension);
		if (world == null) {
			world = server.getOverworld();
		}

		Optional<net.minecraft.entity.Entity> markerOpt =
				LyGravesBridge.findMarkerForGravesPlayerId(server, job.gravesPlayerId);
		if (markerOpt.isEmpty()) {
			return false;
		}

		long sinceMs = job.deathEpochMs - DEATH_FILE_SKEW_MS;
		List<TravelersBackpackBridge.StoredBackpack> stored =
				TravelersBackpackBridge.readStoredBackpacksSince(world, job.playerUuid, sinceMs);
		Set<String> injectedFromDat = new HashSet<>();
		int injected = 0;

		for (TravelersBackpackBridge.StoredBackpack backpack : stored) {
			if (!LyGravesBridge.appendItemToMarkerInventory(
					markerOpt.get(),
					backpack.stack(),
					server.getRegistryManager())) {
				return false;
			}
			TravelersBackpackBridge.deleteStoredBackpack(world, job.playerUuid, backpack.filename());
			injectedFromDat.add(itemId(backpack.stack()));
			injected++;
		}

		for (ItemStack stack : job.inventoryBackpacks) {
			String id = itemId(stack);
			if (injectedFromDat.contains(id)) {
				continue;
			}
			if (!LyGravesBridge.appendItemToMarkerInventory(
					markerOpt.get(),
					stack,
					server.getRegistryManager())) {
				return false;
			}
			injected++;
		}

		if (injected == 0 && job.inventoryBackpacks.isEmpty() && stored.isEmpty()) {
			return true;
		}

		IsnixPlayerBackupMod.LOGGER.info(
				"В могилу игрока {} добавлено рюкзаков: {} (utils.player.id={})",
				job.playerUuid,
				injected,
				job.gravesPlayerId);
		return true;
	}

	private static String itemId(ItemStack stack) {
		var id = Registries.ITEM.getId(stack.getItem());
		return id != null ? id.toString() : stack.getItem().toString();
	}

	private static final class PendingInjection {
		private final UUID playerUuid;
		private final int gravesPlayerId;
		private final net.minecraft.registry.RegistryKey<net.minecraft.world.World> dimension;
		private final long deathEpochMs;
		private final List<ItemStack> inventoryBackpacks;
		private int ticksRemaining;
		private int waitedTicks;

		private PendingInjection(
				UUID playerUuid,
				int gravesPlayerId,
				net.minecraft.registry.RegistryKey<net.minecraft.world.World> dimension,
				long deathEpochMs,
				List<ItemStack> inventoryBackpacks,
				int delay) {
			this.playerUuid = playerUuid;
			this.gravesPlayerId = gravesPlayerId;
			this.dimension = dimension;
			this.deathEpochMs = deathEpochMs;
			this.inventoryBackpacks = inventoryBackpacks;
			this.ticksRemaining = delay;
		}
	}
}
