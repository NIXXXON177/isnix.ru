package ru.isnix.playerbackup.grave;

import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.NbtComponent;
import net.minecraft.entity.Entity;
import net.minecraft.item.ItemStack;
import net.minecraft.nbt.NbtCompound;
import net.minecraft.nbt.NbtElement;
import net.minecraft.nbt.NbtList;
import net.minecraft.nbt.NbtOps;
import net.minecraft.registry.RegistryOps;
import net.minecraft.registry.RegistryWrapper;
import net.minecraft.scoreboard.ScoreHolder;
import net.minecraft.scoreboard.Scoreboard;
import net.minecraft.scoreboard.ScoreboardObjective;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.util.math.Box;
import ru.isnix.playerbackup.IsnixPlayerBackupMod;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/** Чтение и очистка могил датапака ly-graves (Vanilla Tweaks Graves). */
public final class LyGravesBridge {
	private static final String TAG_GRAVE = "graves.grave";
	static final String MARKER_TAG = "graves.grave.marker";
	private static final String TAG_MARKER = MARKER_TAG;

	private LyGravesBridge() {
	}

	public static boolean isGraveRelated(Entity entity) {
		if (entity == null) {
			return false;
		}
		for (String tag : entity.getCommandTags()) {
			if (tag.equals(TAG_GRAVE)
					|| tag.equals(TAG_MARKER)
					|| tag.startsWith("graves.grave.")
					|| tag.equals("graves.entity")
					|| tag.equals("graves.marker")) {
				return true;
			}
		}
		return false;
	}

	/** Корневая сущность могилы (interaction с тегом graves.grave). */
	public static Entity resolveGraveRoot(Entity clicked) {
		MinecraftServer server = null;
		if (clicked != null && clicked.getEntityWorld() instanceof ServerWorld world) {
			server = world.getServer();
		}
		return resolveGraveRoot(clicked, server);
	}

	public static Entity resolveGraveRoot(Entity clicked, MinecraftServer server) {
		if (clicked == null) {
			return null;
		}
		if (clicked.getCommandTags().contains(TAG_GRAVE)) {
			return clicked;
		}
		Entity current = clicked.getVehicle();
		Set<Entity> visited = new HashSet<>();
		while (current != null && visited.add(current)) {
			if (current.getCommandTags().contains(TAG_GRAVE)) {
				return current;
			}
			current = current.getVehicle();
		}
		if (clicked.getCommandTags().contains(TAG_MARKER)) {
			Entity vehicle = clicked.getVehicle();
			if (vehicle != null && vehicle.getCommandTags().contains(TAG_GRAVE)) {
				return vehicle;
			}
		}
		int graveId = readGraveId(clicked, server);
		if (graveId > 0 && clicked.getEntityWorld() instanceof ServerWorld world) {
			return findGraveRootById(world, graveId, clicked.getBlockPos()).orElse(null);
		}
		return null;
	}

	public static Optional<Entity> findStorageEntity(Entity graveRoot, MinecraftServer server) {
		Optional<Entity> marker = findMarker(graveRoot, server);
		if (marker.isPresent()) {
			return marker;
		}
		if (graveRoot == null || !(graveRoot.getEntityWorld() instanceof ServerWorld world)) {
			return Optional.empty();
		}
		List<Entity> candidates = new ArrayList<>();
		candidates.add(graveRoot);
		for (Entity passenger : graveRoot.getPassengersDeep()) {
			candidates.add(passenger);
		}
		Box box = graveRoot.getBoundingBox().expand(12.0);
		world.getOtherEntities(graveRoot, box, LyGravesBridge::isGraveRelated)
				.forEach(candidates::add);
		int graveId = readGraveId(graveRoot, server);
		if (graveId > 0) {
			String markerTag = MARKER_TAG + "." + graveId;
			for (Entity entity : world.iterateEntities()) {
				if (entity.getCommandTags().contains(markerTag)) {
					return Optional.of(entity);
				}
			}
		}
		for (Entity entity : candidates) {
			if (hasStoredItems(readCustomData(entity))) {
				return Optional.of(entity);
			}
		}
		return Optional.empty();
	}

	public static Optional<Entity> findMarker(Entity graveRoot) {
		MinecraftServer server = null;
		if (graveRoot != null && graveRoot.getEntityWorld() instanceof ServerWorld world) {
			server = world.getServer();
		}
		return findMarker(graveRoot, server);
	}

	public static Optional<Entity> findMarker(Entity graveRoot, MinecraftServer server) {
		if (graveRoot == null) {
			return Optional.empty();
		}
		if (graveRoot.getCommandTags().contains(TAG_MARKER)) {
			return Optional.of(graveRoot);
		}
		int graveId = readGraveId(graveRoot, server);
		if (graveId > 0 && graveRoot.getEntityWorld() instanceof ServerWorld world) {
			String markerTag = MARKER_TAG + "." + graveId;
			for (Entity entity : world.iterateEntities()) {
				if (entity.getCommandTags().contains(markerTag)) {
					return Optional.of(entity);
				}
			}
		}
		for (Entity passenger : graveRoot.getPassengersDeep()) {
			if (passenger.getCommandTags().contains(TAG_MARKER)) {
				return Optional.of(passenger);
			}
		}
		if (!(graveRoot.getEntityWorld() instanceof ServerWorld world)) {
			return Optional.empty();
		}
		Box box = graveRoot.getBoundingBox().expand(12.0);
		List<Entity> nearby = world.getOtherEntities(
				graveRoot, box, entity -> entity.getCommandTags().contains(TAG_MARKER));
		for (Entity candidate : nearby) {
			if (candidate.getVehicle() == graveRoot) {
				return Optional.of(candidate);
			}
			if (graveId > 0
					&& server != null
					&& readEntityScore(server, candidate, "graves.marker.grave.id") == graveId) {
				return Optional.of(candidate);
			}
		}
		if (graveId > 0 && server != null) {
			for (Entity entity : world.iterateEntities()) {
				if (!entity.getCommandTags().contains(TAG_MARKER)) {
					continue;
				}
				if (readEntityScore(server, entity, "graves.marker.grave.id") == graveId) {
					return Optional.of(entity);
				}
			}
		}
		return Optional.empty();
	}

	public static int readPlayerUtilsId(ServerPlayerEntity player) {
		if (player == null) {
			return -1;
		}
		MinecraftServer server = player.getEntityWorld().getServer();
		if (server == null) {
			return -1;
		}
		Scoreboard scoreboard = server.getScoreboard();
		ScoreboardObjective objective = scoreboard.getNullableObjective("utils.player.id");
		if (objective == null) {
			return -1;
		}
		try {
			return scoreboard.getOrCreateScore(player, objective).getScore();
		} catch (Throwable t) {
			return -1;
		}
	}

	/** Marker последней могилы игрока (по graves.marker.player.id). */
	public static Optional<Entity> findMarkerForGravesPlayerId(MinecraftServer server, int gravesPlayerId) {
		if (server == null || gravesPlayerId < 1) {
			return Optional.empty();
		}
		String lastGraveTag = "graves.grave.player." + gravesPlayerId + ".last_grave";
		for (ServerWorld world : server.getWorlds()) {
			for (Entity entity : world.iterateEntities()) {
				if (!entity.getCommandTags().contains(TAG_GRAVE)
						|| !entity.getCommandTags().contains(lastGraveTag)) {
					continue;
				}
				Optional<Entity> marker = findMarker(entity);
				if (marker.isPresent()) {
					return marker;
				}
			}
		}
		for (ServerWorld world : server.getWorlds()) {
			for (Entity entity : world.iterateEntities()) {
				if (!entity.getCommandTags().contains(TAG_MARKER)) {
					continue;
				}
				if (readEntityScore(server, entity, "graves.marker.player.id") == gravesPlayerId) {
					return Optional.of(entity);
				}
			}
		}
		return Optional.empty();
	}

	public static boolean appendItemToMarkerInventory(
			Entity marker,
			ItemStack stack,
			RegistryWrapper.WrapperLookup lookup) {
		if (marker == null || stack == null || stack.isEmpty()) {
			return false;
		}
		NbtCompound data = readCustomData(marker).copy();
		NbtList inventory = data.contains("Inventory")
				? data.getList("Inventory").orElse(new NbtList()).copy()
				: new NbtList();
		RegistryOps<NbtElement> ops = RegistryOps.of(NbtOps.INSTANCE, lookup);
		Optional<NbtElement> encoded = ItemStack.CODEC.encodeStart(ops, stack.copy()).result();
		if (encoded.isEmpty() || !(encoded.get() instanceof NbtCompound compound)) {
			return false;
		}
		inventory.add(compound);
		data.put("Inventory", inventory);
		return writeMarkerData(marker, data);
	}

	public static List<ItemStack> extractItems(Entity marker, RegistryWrapper.WrapperLookup lookup) {
		List<ItemStack> items = new ArrayList<>();
		NbtCompound data = readCustomData(marker);
		if (data.isEmpty()) {
			return items;
		}

		if (data.contains("Inventory")) {
			NbtList list = data.getList("Inventory").orElse(new NbtList());
			for (int i = 0; i < list.size(); i++) {
				parseItem(list.getCompound(i).orElse(new NbtCompound()), lookup).ifPresent(items::add);
			}
		}
		for (String slot : new String[] { "offhand", "head", "chest", "legs", "feet" }) {
			if (data.contains(slot)) {
				parseItem(data.getCompound(slot).orElse(new NbtCompound()), lookup).ifPresent(items::add);
			}
		}
		return items;
	}

	public static String resolveOwnerNick(MinecraftServer server, Entity graveRoot, Entity marker) {
		int gravesPlayerId = readEntityScore(server, marker, "graves.marker.player.id");
		if (gravesPlayerId < 0 && graveRoot != null) {
			gravesPlayerId = readEntityScore(server, graveRoot, "graves.grave.player.id");
		}
		if (gravesPlayerId >= 0) {
			String nick = findNickForUtilsPlayerId(server, gravesPlayerId);
			if (nick != null && !nick.isBlank()) {
				return nick;
			}
		}
		return "неизвестный";
	}

	public static void clearGrave(Entity graveRoot) {
		if (graveRoot == null) {
			return;
		}
		List<Entity> toRemove = new ArrayList<>();
		collectDescendants(graveRoot, toRemove, new HashSet<>());
		for (Entity entity : toRemove) {
			entity.discard();
		}
	}

	private static void collectDescendants(Entity entity, List<Entity> out, Set<Entity> visited) {
		if (entity == null || !visited.add(entity)) {
			return;
		}
		for (Entity passenger : entity.getPassengerList()) {
			collectDescendants(passenger, out, visited);
		}
		out.add(entity);
	}

	private static Optional<Entity> findGraveRootById(ServerWorld world, int graveId, BlockPos near) {
		String idTag = TAG_GRAVE + "." + graveId;
		Box box = new Box(near).expand(16.0);
		for (Entity entity : world.getOtherEntities(null, box, candidate ->
				candidate.getCommandTags().contains(TAG_GRAVE)
						&& candidate.getCommandTags().contains(idTag))) {
			return Optional.of(entity);
		}
		return Optional.empty();
	}

	private static int readGraveId(Entity entity, MinecraftServer server) {
		if (entity == null) {
			return -1;
		}
		if (server != null) {
			int score = readEntityScore(server, entity, "graves.grave.id");
			if (score > 0) {
				return score;
			}
			score = readEntityScore(server, entity, "graves.marker.grave.id");
			if (score > 0) {
				return score;
			}
			score = readEntityScore(server, entity, "graves.grave.entity.grave.id");
			if (score > 0) {
				return score;
			}
		}
		return readGraveIdFromTags(entity);
	}

	private static int readGraveIdFromTags(Entity entity) {
		for (String tag : entity.getCommandTags()) {
			int id = parseNumericSuffix(tag, TAG_GRAVE + ".");
			if (id > 0 && !tag.contains("player") && !tag.contains("marker") && !tag.contains("block_display")
					&& !tag.contains("entity")) {
				return id;
			}
			id = parseNumericSuffix(tag, MARKER_TAG + ".");
			if (id > 0) {
				return id;
			}
			id = parseNumericSuffix(tag, "graves.grave.block_display.");
			if (id > 0) {
				return id;
			}
			id = parseNumericSuffix(tag, "graves.grave.entity.");
			if (id > 0) {
				return id;
			}
		}
		return -1;
	}

	private static int parseNumericSuffix(String tag, String prefix) {
		if (!tag.startsWith(prefix)) {
			return -1;
		}
		String suffix = tag.substring(prefix.length());
		if (!suffix.matches("\\d+")) {
			return -1;
		}
		try {
			return Integer.parseInt(suffix);
		} catch (NumberFormatException e) {
			return -1;
		}
	}

	private static boolean hasStoredItems(NbtCompound data) {
		if (data == null || data.isEmpty()) {
			return false;
		}
		if (data.contains("Inventory") && !data.getList("Inventory").orElse(new NbtList()).isEmpty()) {
			return true;
		}
		for (String slot : new String[] { "offhand", "head", "chest", "legs", "feet" }) {
			if (data.contains(slot)) {
				return true;
			}
		}
		return false;
	}

	private static NbtCompound readCustomData(Entity entity) {
		if (entity == null) {
			return new NbtCompound();
		}
		NbtComponent custom = readCustomDataComponent(entity);
		if (custom.isEmpty()) {
			return new NbtCompound();
		}
		try {
			NbtCompound root = custom.copyNbt();
			if (root.contains("data")) {
				NbtCompound nested = root.getCompound("data").orElse(new NbtCompound());
				if (hasStoredItems(nested)) {
					return nested;
				}
			}
			if (hasStoredItems(root)) {
				return root;
			}
			if (root.contains("data")) {
				return root.getCompound("data").orElse(new NbtCompound());
			}
			return root;
		} catch (Throwable t) {
			IsnixPlayerBackupMod.LOGGER.warn("readCustomData {}: {}", entity.getUuidAsString(), t.toString());
			return new NbtCompound();
		}
	}

	private static boolean writeMarkerData(Entity entity, NbtCompound dataSection) {
		if (entity == null) {
			return false;
		}
		try {
			NbtCompound root = new NbtCompound();
			root.put("data", dataSection.copy());
			entity.setComponent(DataComponentTypes.CUSTOM_DATA, NbtComponent.of(root));
			return true;
		} catch (Throwable t) {
			IsnixPlayerBackupMod.LOGGER.warn("writeMarkerData {}: {}", entity.getUuidAsString(), t.toString());
			return false;
		}
	}

	private static NbtComponent readCustomDataComponent(Entity entity) {
		if (entity == null) {
			return NbtComponent.DEFAULT;
		}
		NbtComponent custom = entity.get(DataComponentTypes.CUSTOM_DATA);
		return custom != null ? custom : NbtComponent.DEFAULT;
	}

	private static Optional<ItemStack> parseItem(NbtCompound nbt, RegistryWrapper.WrapperLookup lookup) {
		if (nbt == null || nbt.isEmpty()) {
			return Optional.empty();
		}
		RegistryOps<NbtElement> ops = RegistryOps.of(NbtOps.INSTANCE, lookup);
		return ItemStack.CODEC.parse(ops, nbt)
				.result()
				.filter(stack -> !stack.isEmpty());
	}

	public static int readEntityScore(MinecraftServer server, Entity entity, String objectiveName) {
		if (entity == null || server == null) {
			return -1;
		}
		Scoreboard scoreboard = server.getScoreboard();
		ScoreboardObjective objective = scoreboard.getNullableObjective(objectiveName);
		if (objective == null) {
			return -1;
		}
		try {
			return scoreboard.getOrCreateScore(entity, objective).getScore();
		} catch (Throwable t) {
			try {
				ScoreHolder holder = ScoreHolder.fromName(entity.getNameForScoreboard());
				return scoreboard.getOrCreateScore(holder, objective).getScore();
			} catch (Throwable ignored) {
				return -1;
			}
		}
	}

	public static UUID resolveOwnerUuid(MinecraftServer server, int gravesPlayerId, String nickHint) {
		if (server == null || gravesPlayerId < 1) {
			return null;
		}
		UUID recent = GraveBackpackInjector.getRecentDeathUuid(gravesPlayerId);
		if (recent != null) {
			return recent;
		}
		for (ServerPlayerEntity online : server.getPlayerManager().getPlayerList()) {
			if (readPlayerUtilsId(online) == gravesPlayerId) {
				return online.getUuid();
			}
		}
		return null;
	}

	private static String findNickForUtilsPlayerId(MinecraftServer server, int gravesPlayerId) {
		Scoreboard scoreboard = server.getScoreboard();
		ScoreboardObjective objective = scoreboard.getNullableObjective("utils.player.id");
		if (objective == null) {
			return null;
		}
		for (ServerPlayerEntity online : server.getPlayerManager().getPlayerList()) {
			if (scoreboard.getOrCreateScore(online, objective).getScore() == gravesPlayerId) {
				return online.getGameProfile().name();
			}
		}
		Collection<ScoreHolder> holders = scoreboard.getKnownScoreHolders();
		for (ScoreHolder holder : holders) {
			try {
				if (scoreboard.getOrCreateScore(holder, objective).getScore() == gravesPlayerId) {
					String name = holder.getNameForScoreboard();
					if (name != null && !name.isBlank()) {
						return name;
					}
				}
			} catch (Throwable ignored) {
			}
		}
		return null;
	}
}
