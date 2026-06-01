package ru.isnix.graveguard;

import net.minecraft.entity.Entity;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import net.minecraft.util.math.Vec3d;

import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

public final class GraveEntityDetector {
	private GraveEntityDetector() {
	}

	public static boolean isGraveEntity(Entity entity) {
		return isGraveEntity(entity, new HashSet<>());
	}

	private static boolean isGraveEntity(Entity entity, Set<UUID> visited) {
		if (entity == null || !visited.add(entity.getUuid())) {
			return false;
		}
		if (hasGraveTag(entity)) {
			return true;
		}
		for (Entity passenger : entity.getPassengerList()) {
			if (isGraveEntity(passenger, visited)) {
				return true;
			}
		}
		Entity vehicle = entity.getVehicle();
		return vehicle != null && isGraveEntity(vehicle, visited);
	}

	public static boolean isNearOwnGrave(ServerPlayerEntity player, double radius) {
		Box box = player.getBoundingBox().expand(radius);
		for (Entity entity : player.getServerWorld().getOtherEntities(player, box, GraveEntityDetector::isGraveEntity)) {
			if (isOwnedBy(player, entity)) {
				return true;
			}
		}
		return false;
	}

	public static boolean isOwnedBy(ServerPlayerEntity player, Entity entity) {
		if (matchesPlayerIdentity(player, entity)) {
			return true;
		}
		for (Entity passenger : entity.getPassengerList()) {
			if (matchesPlayerIdentity(player, passenger)) {
				return true;
			}
		}
		Entity vehicle = entity.getVehicle();
		if (vehicle != null && matchesPlayerIdentity(player, vehicle)) {
			return true;
		}
		return isNearDeathSite(player, entity);
	}

	private static boolean matchesPlayerIdentity(ServerPlayerEntity player, Entity entity) {
		Text customName = entity.getCustomName();
		if (customName != null) {
			String name = customName.getString();
			String playerName = player.getName().getString();
			if (!name.isEmpty() && name.contains(playerName)) {
				return true;
			}
		}

		String uuid = player.getUuidAsString();
		String shortUuid = uuid.replace("-", "");
		Set<String> tags = entity.getCommandTags();
		for (String tag : tags) {
			if (tag.contains(uuid) || tag.contains(shortUuid)) {
				return true;
			}
			if (tag.startsWith("graves.owner.") && tag.endsWith(shortUuid)) {
				return true;
			}
		}
		return false;
	}

	private static boolean isNearDeathSite(ServerPlayerEntity player, Entity entity) {
		BlockPos deathPos = GraveGuardManager.getLastDeathPos(player.getUuid());
		if (deathPos == null) {
			return false;
		}
		Vec3d gravePos = entity.getPos();
		double dx = gravePos.x - (deathPos.getX() + 0.5);
		double dy = gravePos.y - deathPos.getY();
		double dz = gravePos.z - (deathPos.getZ() + 0.5);
		return dx * dx + dy * dy + dz * dz <= 12.0 * 12.0;
	}

	private static boolean hasGraveTag(Entity entity) {
		for (String tag : entity.getCommandTags()) {
			if (isKnownGraveTag(tag)) {
				return true;
			}
		}
		return false;
	}

	private static boolean isKnownGraveTag(String tag) {
		if (tag.equals("graves.entity") || tag.equals("graves.marker")) {
			return true;
		}
		if (tag.startsWith("graves.")) {
			return true;
		}
		for (String extra : GraveGuardConfig.get().extraGraveEntityTags) {
			if (tag.equals(extra)) {
				return true;
			}
		}
		return false;
	}
}
