package ru.isnix.modtools;

import net.minecraft.entity.Entity;
import net.minecraft.network.packet.s2c.play.PositionFlag;
import net.minecraft.server.network.ServerPlayNetworkHandler;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.math.Vec3d;

import java.util.Collections;
import java.util.Set;

public final class FreezeManager {
	private static final Set<PositionFlag> ABSOLUTE_TELEPORT = Collections.emptySet();
	private static final ThreadLocal<Boolean> INTERNAL_TELEPORT = ThreadLocal.withInitial(() -> false);
	private static ModerationStorage storage;

	private FreezeManager() {
	}

	public static boolean isInternalTeleport() {
		return Boolean.TRUE.equals(INTERNAL_TELEPORT.get());
	}

	public static void runInternalTeleport(Runnable action) {
		INTERNAL_TELEPORT.set(true);
		try {
			action.run();
		} finally {
			INTERNAL_TELEPORT.set(false);
		}
	}

	public static void bind(ModerationStorage s) {
		storage = s;
	}

	public static boolean isFrozen(ServerPlayerEntity player) {
		return storage != null && storage.isFrozen(player.getUuid());
	}

	/** Жёстко фиксирует тело на точке freeze; yaw/pitch не меняет. */
	public static void snapToAnchor(ServerPlayerEntity player) {
		if (storage == null || !isFrozen(player)) {
			return;
		}
		ModerationStorage.FreezeEntry entry = storage.getFreeze(player.getUuid());
		if (entry == null) {
			return;
		}
		String worldKey = player.getWorld().getRegistryKey().getValue().toString();
		if (!worldKey.equals(entry.world)) {
			return;
		}

		float yaw = player.getYaw();
		float pitch = player.getPitch();
		player.setVelocity(Vec3d.ZERO);
		player.fallDistance = 0.0f;

		runInternalTeleport(() -> {
			player.setPos(entry.x, entry.y, entry.z);
			player.prevX = entry.x;
			player.prevY = entry.y;
			player.prevZ = entry.z;
			player.setYaw(yaw);
			player.setPitch(pitch);
		});

		ServerPlayNetworkHandler handler = player.networkHandler;
		if (handler != null) {
			runInternalTeleport(() -> handler.requestTeleport(
					entry.x, entry.y, entry.z, yaw, pitch, ABSOLUTE_TELEPORT));
		}
	}

	public static void applyLookFromPacket(ServerPlayerEntity player, net.minecraft.network.packet.c2s.play.PlayerMoveC2SPacket packet) {
		if (!packet.changesLook()) {
			return;
		}
		player.setYaw(packet.getYaw(player.getYaw()));
		player.setPitch(packet.getPitch(player.getPitch()));
	}

	public static void tickFrozen(ServerPlayerEntity player) {
		if (!isFrozen(player)) {
			return;
		}
		snapToAnchor(player);
	}

	public static boolean shouldBlockPositionMove(ServerPlayerEntity player) {
		return isFrozen(player);
	}

	public static boolean shouldBlockEntityPositionChange(Entity entity, double x, double y, double z) {
		if (!(entity instanceof ServerPlayerEntity player) || !isFrozen(player) || isInternalTeleport()) {
			return false;
		}
		ModerationStorage.FreezeEntry entry = storage.getFreeze(player.getUuid());
		if (entry == null) {
			return false;
		}
		return Math.abs(x - entry.x) > 1.0E-4
				|| Math.abs(y - entry.y) > 1.0E-4
				|| Math.abs(z - entry.z) > 1.0E-4;
	}

	public static boolean shouldBlockCommand(ServerPlayerEntity player, String command) {
		if (!isFrozen(player)) {
			return false;
		}
		String cmd = command.stripLeading();
		if (cmd.startsWith("/")) {
			cmd = cmd.substring(1);
		}
		String root = cmd.split("\\s+", 2)[0].toLowerCase();
		return switch (root) {
			case "freeze", "unfreeze", "mute", "unmute", "mutevoice", "unmutevoice" -> false;
			default -> true;
		};
	}
}
