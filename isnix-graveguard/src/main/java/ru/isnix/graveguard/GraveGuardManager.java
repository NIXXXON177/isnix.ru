package ru.isnix.graveguard;

import net.minecraft.entity.damage.DamageSource;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import net.minecraft.util.math.BlockPos;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

public final class GraveGuardManager {
	private static final Map<UUID, Integer> PROTECT_UNTIL_TICK = new HashMap<>();
	private static final Map<UUID, Integer> ELIGIBLE_UNTIL_TICK = new HashMap<>();
	private static final Map<UUID, BlockPos> LAST_DEATH_POS = new HashMap<>();
	/** Пока игрок в зоне лута — продлевается; после выхода ещё lootGraceSeconds. */
	private static final Map<UUID, Integer> LOOT_ZONE_UNTIL_TICK = new HashMap<>();
	private static final Set<UUID> BLOCK_ALL_DAMAGE = new HashSet<>();
	private static final Set<UUID> WAS_IN_LOOT_ZONE = new HashSet<>();

	private GraveGuardManager() {
	}

	public static void onPlayerDeath(ServerPlayerEntity player) {
		if (!GraveGuardConfig.get().enabled) {
			return;
		}
		MinecraftServer server = player.getEntityWorld().getServer();
		if (server == null) {
			return;
		}
		int eligibleTicks = GraveGuardConfig.get().eligibleMinutesAfterDeath * 60 * 20;
		ELIGIBLE_UNTIL_TICK.put(player.getUuid(), server.getTicks() + eligibleTicks);
		LAST_DEATH_POS.put(player.getUuid(), player.getBlockPos());
		clearProtection(player.getUuid());
		WAS_IN_LOOT_ZONE.remove(player.getUuid());
	}

	public static void grantProtection(ServerPlayerEntity player, boolean notify, boolean blockAllDamage) {
		if (!GraveGuardConfig.get().enabled || !isEligible(player)) {
			return;
		}
		MinecraftServer server = player.getEntityWorld().getServer();
		if (server == null) {
			return;
		}
		int until = server.getTicks() + GraveGuardConfig.get().protectionSeconds * 20;
		Integer previous = PROTECT_UNTIL_TICK.get(player.getUuid());
		boolean wasProtected = previous != null && previous > server.getTicks();
		PROTECT_UNTIL_TICK.put(player.getUuid(), until);
		if (blockAllDamage) {
			BLOCK_ALL_DAMAGE.add(player.getUuid());
		} else {
			BLOCK_ALL_DAMAGE.remove(player.getUuid());
		}

		if (notify
				&& GraveGuardConfig.get().notifyPlayer
				&& !wasProtected) {
			String detail = blockAllDamage
					? "без урона (игроки и мобы)"
					: "без урона от игроков";
			player.sendMessage(
					Text.literal("Защита могилы: "
									+ GraveGuardConfig.get().protectionSeconds
									+ " сек "
									+ detail)
							.formatted(Formatting.AQUA),
					true);
		}
	}

	public static boolean isEligible(ServerPlayerEntity player) {
		if (!GraveGuardConfig.get().enabled) {
			return false;
		}
		MinecraftServer server = player.getEntityWorld().getServer();
		if (server == null) {
			return false;
		}
		Integer until = ELIGIBLE_UNTIL_TICK.get(player.getUuid());
		if (until == null) {
			return false;
		}
		if (server.getTicks() >= until) {
			clearEligibility(player.getUuid());
			return false;
		}
		return true;
	}

	public static boolean isProtected(ServerPlayerEntity player) {
		if (!GraveGuardConfig.get().enabled) {
			return false;
		}
		MinecraftServer server = player.getEntityWorld().getServer();
		if (server == null) {
			return false;
		}
		Integer until = PROTECT_UNTIL_TICK.get(player.getUuid());
		if (until == null) {
			return false;
		}
		if (server.getTicks() >= until) {
			clearProtection(player.getUuid());
			return false;
		}
		return true;
	}

	/** Только рядом с сущностью своей могилы — не «вся зона смерти». */
	public static boolean isInLootZone(ServerPlayerEntity player) {
		GraveGuardConfig cfg = GraveGuardConfig.get();
		return GraveEntityDetector.isNearOwnGrave(player, cfg.nearGraveRadius);
	}

	public static void extendLootZone(ServerPlayerEntity player) {
		MinecraftServer server = player.getEntityWorld().getServer();
		if (server == null || !isEligible(player)) {
			return;
		}
		int graceTicks = GraveGuardConfig.get().lootGraceSeconds * 20;
		int until = server.getTicks() + graceTicks;
		Integer prev = LOOT_ZONE_UNTIL_TICK.get(player.getUuid());
		if (prev == null || until > prev) {
			LOOT_ZONE_UNTIL_TICK.put(player.getUuid(), until);
		}
	}

	public static boolean isLootZoneActive(ServerPlayerEntity player) {
		MinecraftServer server = player.getEntityWorld().getServer();
		if (server == null) {
			return false;
		}
		Integer until = LOOT_ZONE_UNTIL_TICK.get(player.getUuid());
		return until != null && server.getTicks() < until;
	}

	public static boolean shouldBlockDamage(ServerPlayerEntity victim, DamageSource source) {
		if (!isProtected(victim)) {
			return false;
		}
		if (BLOCK_ALL_DAMAGE.contains(victim.getUuid())) {
			return true;
		}
		GraveGuardConfig cfg = GraveGuardConfig.get();
		if (!cfg.protectFromPlayersOnly) {
			return true;
		}
		if (source.getAttacker() instanceof PlayerEntity attacker && attacker != victim) {
			return true;
		}
		return source.getSource() instanceof PlayerEntity attacker && attacker != victim;
	}

	public static BlockPos getLastDeathPos(UUID playerId) {
		return LAST_DEATH_POS.get(playerId);
	}

	public static int remainingProtectionSeconds(ServerPlayerEntity player) {
		MinecraftServer server = player.getEntityWorld().getServer();
		if (server == null) {
			return 0;
		}
		Integer until = PROTECT_UNTIL_TICK.get(player.getUuid());
		if (until == null) {
			return 0;
		}
		int remainingTicks = until - server.getTicks();
		if (remainingTicks <= 0) {
			return 0;
		}
		return (remainingTicks + 19) / 20;
	}

	public static int remainingLootZoneSeconds(ServerPlayerEntity player) {
		MinecraftServer server = player.getEntityWorld().getServer();
		if (server == null) {
			return 0;
		}
		Integer until = LOOT_ZONE_UNTIL_TICK.get(player.getUuid());
		if (until == null) {
			return 0;
		}
		int remainingTicks = until - server.getTicks();
		if (remainingTicks <= 0) {
			return 0;
		}
		return (remainingTicks + 19) / 20;
	}

	public static void tick(MinecraftServer server) {
		if (!GraveGuardConfig.get().enabled) {
			return;
		}
		GraveGuardConfig cfg = GraveGuardConfig.get();
		int now = server.getTicks();

		ELIGIBLE_UNTIL_TICK.entrySet().removeIf(entry -> {
			if (now < entry.getValue()) {
				return false;
			}
			clearEligibilityAux(entry.getKey());
			return true;
		});

		LOOT_ZONE_UNTIL_TICK.entrySet().removeIf(entry -> now >= entry.getValue());

		for (UUID playerId : new ArrayList<>(ELIGIBLE_UNTIL_TICK.keySet())) {
			ServerPlayerEntity player = server.getPlayerManager().getPlayer(playerId);
			if (player == null) {
				continue;
			}

			boolean inZone = isInLootZone(player);

			if (inZone) {
				extendLootZone(player);
				boolean entering = !WAS_IN_LOOT_ZONE.contains(playerId);
				boolean needsRefresh = !isProtected(player) || remainingProtectionSeconds(player) <= 5;
				if (entering || needsRefresh) {
					grantProtection(player, entering, cfg.protectAllDamageInLootZone);
				}
				WAS_IN_LOOT_ZONE.add(playerId);
			} else {
				WAS_IN_LOOT_ZONE.remove(playerId);
				if (isProtected(player)) {
					clearProtection(playerId);
				}
			}
		}
	}

	public static void clearProtection(UUID playerId) {
		PROTECT_UNTIL_TICK.remove(playerId);
		BLOCK_ALL_DAMAGE.remove(playerId);
	}

	private static void clearEligibilityAux(UUID playerId) {
		LAST_DEATH_POS.remove(playerId);
		LOOT_ZONE_UNTIL_TICK.remove(playerId);
		WAS_IN_LOOT_ZONE.remove(playerId);
		clearProtection(playerId);
	}

	public static void clearEligibility(UUID playerId) {
		ELIGIBLE_UNTIL_TICK.remove(playerId);
		clearEligibilityAux(playerId);
	}

	public static void onLogout(ServerPlayerEntity player) {
		UUID id = player.getUuid();
		clearProtection(id);
		LOOT_ZONE_UNTIL_TICK.remove(id);
		WAS_IN_LOOT_ZONE.remove(id);
	}
}
