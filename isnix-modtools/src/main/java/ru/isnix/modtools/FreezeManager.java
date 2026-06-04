package ru.isnix.modtools;

import net.minecraft.entity.Entity;
import net.minecraft.network.packet.c2s.play.PlayerMoveC2SPacket;
import net.minecraft.network.packet.s2c.play.PositionFlag;
import net.minecraft.server.network.ServerPlayNetworkHandler;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.PlayerInput;
import net.minecraft.util.math.MathHelper;
import net.minecraft.util.math.Vec3d;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

public final class FreezeManager {
	/**
	 * Синхронизация позиции с клиентом: координаты → якорь, углы без изменения
	 * (дельта 0). Нельзя использовать только {@link PositionFlag#ROT} — иначе
	 * {@code requestTeleport} вызовет {@code updatePositionAndAngles(..., 0, 0)} и
	 * сбросит взгляд.
	 */
	private static final Set<PositionFlag> SYNC_POSITION_KEEP_LOOK = EnumSet.of(
			PositionFlag.X,
			PositionFlag.Y,
			PositionFlag.Z,
			PositionFlag.X_ROT,
			PositionFlag.Y_ROT);
	private static final double DRIFT_SQ = 1.0E-6;
	/** Не чаще одного teleport-пакета клиенту раз в N тиков (иначе кик «превышение частоты пакетов»). */
	private static final int NETWORK_SYNC_INTERVAL_TICKS = 5;

	private static final ThreadLocal<Boolean> INTERNAL_TELEPORT = ThreadLocal.withInitial(() -> false);
	private static final Map<UUID, Long> LAST_NETWORK_SYNC_TICK = new ConcurrentHashMap<>();

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

	public static void clearPlayer(UUID uuid) {
		if (uuid != null) {
			LAST_NETWORK_SYNC_TICK.remove(uuid);
		}
	}

	public static boolean isFrozen(ServerPlayerEntity player) {
		return storage != null && storage.isFrozen(player.getUuid());
	}

	/** Однократная фиксация при /freeze или входе (с синхронизацией клиенту). */
	public static void snapToAnchor(ServerPlayerEntity player) {
		maintainFrozen(player, true);
	}

	/** Фиксация позиции после отклонённого пакета движения (клиент мог «уехать» визуально). */
	public static void onMovementPacketBlocked(ServerPlayerEntity player, PlayerMoveC2SPacket packet) {
		maintainFrozen(player, false);
		ModerationStorage.FreezeEntry entry = storage != null ? storage.getFreeze(player.getUuid()) : null;
		if (entry == null || !shouldSyncClientAfterBlockedMove(player, packet, entry)) {
			return;
		}
		if (maySendNetworkSync(player)) {
			syncClientToAnchor(player, entry);
		}
	}

	private static boolean shouldSyncClientAfterBlockedMove(
			ServerPlayerEntity player, PlayerMoveC2SPacket packet, ModerationStorage.FreezeEntry entry) {
		double px = packet.getX(entry.x);
		double py = packet.getY(entry.y);
		double pz = packet.getZ(entry.z);
		double dx = px - entry.x;
		double dy = py - entry.y;
		double dz = pz - entry.z;
		// Микросдвиг при копании блока под собой — не дёргать teleport (сбивает ломание).
		return dx * dx + dy * dy + dz * dz > 0.01;
	}

	public static void clearMovementInput(ServerPlayerEntity player) {
		player.setPlayerInput(PlayerInput.DEFAULT);
	}

	public static void applyLookFromPacket(ServerPlayerEntity player, PlayerMoveC2SPacket packet) {
		if (!packet.changesLook()) {
			return;
		}
		float yaw = MathHelper.wrapDegrees(packet.getYaw(player.getYaw()));
		float pitch = MathHelper.clamp(
				MathHelper.wrapDegrees(packet.getPitch(player.getPitch())), -90.0f, 90.0f);
		ModerationStorage.FreezeEntry entry = storage != null ? storage.getFreeze(player.getUuid()) : null;
		if (entry != null) {
			runInternalTeleport(() -> player.updatePositionAndAngles(entry.x, entry.y, entry.z, yaw, pitch));
		} else {
			player.setYaw(yaw);
			player.setPitch(pitch);
		}
	}

	public static void tickFrozen(ServerPlayerEntity player) {
		if (!isFrozen(player)) {
			return;
		}
		clearMovementInput(player);
		maintainFrozen(player, false);
	}

	private static void maintainFrozen(ServerPlayerEntity player, boolean forceNetworkSync) {
		if (storage == null || !isFrozen(player)) {
			return;
		}
		ModerationStorage.FreezeEntry entry = storage.getFreeze(player.getUuid());
		if (entry == null) {
			return;
		}
		String worldKey = player.getEntityWorld().getRegistryKey().getValue().toString();
		if (!worldKey.equals(entry.world)) {
			return;
		}

		player.setVelocity(Vec3d.ZERO);
		player.fallDistance = 0.0f;

		Vec3d pos = player.getEntityPos();
		double dx = pos.x - entry.x;
		double dy = pos.y - entry.y;
		double dz = pos.z - entry.z;
		boolean drifted = dx * dx + dy * dy + dz * dz > DRIFT_SQ;

		if (drifted) {
			float yaw = player.getYaw();
			float pitch = player.getPitch();
			runInternalTeleport(() -> {
				player.refreshPositionAfterTeleport(entry.x, entry.y, entry.z);
				player.setYaw(yaw);
				player.setPitch(pitch);
			});
		}

		// Клиенту — только при /freeze или попытке шагнуть (не при микродрифте: лишний
		// requestTeleport сбрасывает копание блока и крутит голову).
		if (forceNetworkSync) {
			syncClientToAnchor(player, entry);
		}
	}

	private static boolean maySendNetworkSync(ServerPlayerEntity player) {
		long tick = player.getEntityWorld().getServer().getTicks();
		Long last = LAST_NETWORK_SYNC_TICK.get(player.getUuid());
		if (last != null && tick - last < NETWORK_SYNC_INTERVAL_TICKS) {
			return false;
		}
		LAST_NETWORK_SYNC_TICK.put(player.getUuid(), tick);
		return true;
	}

	private static void syncClientToAnchor(ServerPlayerEntity player, ModerationStorage.FreezeEntry entry) {
		ServerPlayNetworkHandler handler = player.networkHandler;
		if (handler == null) {
			return;
		}
		float yaw = player.getYaw();
		float pitch = player.getPitch();
		runInternalTeleport(() -> handler.requestTeleport(entry.x, entry.y, entry.z, yaw, pitch));
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
