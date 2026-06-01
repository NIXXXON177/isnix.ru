package ru.isnix.modtools;

import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.math.Vec3d;

public final class FreezeManager {
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

	public static void enforcePosition(ServerPlayerEntity player) {
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
		player.setVelocity(Vec3d.ZERO);
		player.fallDistance = 0.0f;
		Vec3d pos = player.getPos();
		double dx = pos.x - entry.x;
		double dy = pos.y - entry.y;
		double dz = pos.z - entry.z;
		if (dx * dx + dy * dy + dz * dz > 1.0E-8) {
			runInternalTeleport(() -> player.requestTeleport(entry.x, entry.y, entry.z));
		}
	}

	/** Каждый тик: обнулить скорость и вернуть на точку заморозки (поворот головы не трогаем). */
	public static void tickFrozen(ServerPlayerEntity player) {
		if (!isFrozen(player)) {
			return;
		}
		enforcePosition(player);
	}

	public static boolean shouldBlockPositionMove(ServerPlayerEntity player) {
		return isFrozen(player);
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
