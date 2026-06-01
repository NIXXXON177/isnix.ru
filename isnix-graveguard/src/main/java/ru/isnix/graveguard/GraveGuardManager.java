package ru.isnix.graveguard;

import net.minecraft.entity.damage.DamageSource;
import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import net.minecraft.util.math.BlockPos;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public final class GraveGuardManager {
	private static final Map<UUID, Integer> PROTECT_UNTIL_TICK = new HashMap<>();
	private static final Map<UUID, Integer> ELIGIBLE_UNTIL_TICK = new HashMap<>();
	private static final Map<UUID, BlockPos> LAST_DEATH_POS = new HashMap<>();

	private GraveGuardManager() {
	}

	public static void onPlayerDeath(ServerPlayerEntity player) {
		if (!GraveGuardConfig.get().enabled) {
			return;
		}
		MinecraftServer server = player.getServer();
		if (server == null) {
			return;
		}
		int eligibleTicks = GraveGuardConfig.get().eligibleMinutesAfterDeath * 60 * 20;
		ELIGIBLE_UNTIL_TICK.put(player.getUuid(), server.getTicks() + eligibleTicks);
		LAST_DEATH_POS.put(player.getUuid(), player.getBlockPos());
		PROTECT_UNTIL_TICK.remove(player.getUuid());
	}

	public static void grantProtection(ServerPlayerEntity player, boolean notify) {
		if (!GraveGuardConfig.get().enabled || !isEligible(player)) {
			return;
		}
		MinecraftServer server = player.getServer();
		if (server == null) {
			return;
		}
		int until = server.getTicks() + GraveGuardConfig.get().protectionSeconds * 20;
		Integer previous = PROTECT_UNTIL_TICK.get(player.getUuid());
		PROTECT_UNTIL_TICK.put(player.getUuid(), until);

		if (notify
				&& GraveGuardConfig.get().notifyPlayer
				&& (previous == null || previous <= server.getTicks())) {
			player.sendMessage(
					Text.literal("Защита могилы: "
									+ GraveGuardConfig.get().protectionSeconds
									+ " сек без урона от игроков")
							.formatted(Formatting.AQUA),
					true);
		}
	}

	public static boolean isEligible(ServerPlayerEntity player) {
		if (!GraveGuardConfig.get().enabled) {
			return false;
		}
		MinecraftServer server = player.getServer();
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
		MinecraftServer server = player.getServer();
		if (server == null) {
			return false;
		}
		Integer until = PROTECT_UNTIL_TICK.get(player.getUuid());
		if (until == null) {
			return false;
		}
		if (server.getTicks() >= until) {
			PROTECT_UNTIL_TICK.remove(player.getUuid());
			return false;
		}
		return true;
	}

	public static boolean shouldBlockDamage(ServerPlayerEntity victim, DamageSource source) {
		if (!isProtected(victim)) {
			return false;
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
		MinecraftServer server = player.getServer();
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

	public static void tick(MinecraftServer server) {
		if (!GraveGuardConfig.get().enabled) {
			return;
		}
		if (server.getTicks() % 10 != 0) {
			return;
		}
		double radius = GraveGuardConfig.get().nearGraveRadius;
		for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
			if (!isEligible(player)) {
				continue;
			}
			if (GraveEntityDetector.isNearOwnGrave(player, radius)) {
				grantProtection(player, true);
			}
		}
	}

	public static void clearEligibility(UUID playerId) {
		ELIGIBLE_UNTIL_TICK.remove(playerId);
		LAST_DEATH_POS.remove(playerId);
	}

	public static void onLogout(ServerPlayerEntity player) {
		PROTECT_UNTIL_TICK.remove(player.getUuid());
	}
}
