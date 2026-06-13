package ru.isnix.playerbackup;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.entity.EquipmentSlot;
import net.minecraft.item.ItemStack;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.collection.DefaultedList;
import net.minecraft.util.math.BlockPos;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.Map;
import java.util.stream.Stream;

public final class PlayerSnapshotService {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static final DateTimeFormatter FILE_TS =
			DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH-mm-ss'Z'").withZone(ZoneOffset.UTC);

	private PlayerSnapshotService() {
	}

	public static Path snapshotRoot() {
		return FabricLoader.getInstance().getGameDir().resolve("backups").resolve("isnix-player-backup");
	}

	public static Path snapshot(ServerPlayerEntity player, SnapshotReason reason) {
		if (!BackupConfig.get().enabled) {
			return null;
		}
		try {
			JsonObject root = buildSnapshot(player, reason);
			String stamp = FILE_TS.format(Instant.now());
			String uuid = player.getUuidAsString();
			Path playerDir = snapshotRoot().resolve("snapshots").resolve(uuid);
			Files.createDirectories(playerDir);

			Path file = playerDir.resolve(stamp + "_" + reason.id() + ".json");
			Files.writeString(file, GSON.toJson(root));

			Path latestByUuid = snapshotRoot().resolve("latest").resolve(uuid + ".json");
			Files.createDirectories(latestByUuid.getParent());
			Files.writeString(latestByUuid, GSON.toJson(root));

			String safeNick = player.getGameProfile().name().replaceAll("[^a-zA-Z0-9_\\-.]", "_");
			Path latestByNick = snapshotRoot().resolve("latest-by-nick").resolve(safeNick + ".json");
			Files.createDirectories(latestByNick.getParent());
			Files.writeString(latestByNick, GSON.toJson(root));

			return file;
		} catch (IOException e) {
			IsnixPlayerBackupMod.LOGGER.warn(
					"Не удалось сохранить снимок для {}: {}",
					player.getGameProfile().name(),
					e.getMessage());
			return null;
		}
	}

	private static JsonObject buildSnapshot(ServerPlayerEntity player, SnapshotReason reason) {
		JsonObject root = new JsonObject();
		root.addProperty("nick", player.getGameProfile().name());
		root.addProperty("uuid", player.getUuidAsString());
		root.addProperty("timestamp", Instant.now().toString());
		root.addProperty("reason", reason.id());

		var inv = player.getInventory();
		root.add("inventory", slotsToJson(inv.getMainStacks(), "main"));

		DefaultedList<ItemStack> armor = DefaultedList.ofSize(4, ItemStack.EMPTY);
		armor.set(0, player.getEquippedStack(EquipmentSlot.HEAD));
		armor.set(1, player.getEquippedStack(EquipmentSlot.CHEST));
		armor.set(2, player.getEquippedStack(EquipmentSlot.LEGS));
		armor.set(3, player.getEquippedStack(EquipmentSlot.FEET));
		root.add("armor", slotsToJson(armor, "armor"));

		DefaultedList<ItemStack> offHand = DefaultedList.ofSize(1, ItemStack.EMPTY);
		offHand.set(0, player.getEquippedStack(EquipmentSlot.OFFHAND));
		root.add("offhand", slotsToJson(offHand, "offhand"));

		if (BackupConfig.get().includeEnderChest) {
			root.add("ender_chest", inventoryToJson(player.getEnderChestInventory(), "ender"));
		}

		if (BackupConfig.get().includeExperience) {
			root.addProperty("xp_level", player.experienceLevel);
			root.addProperty("xp_total", player.totalExperience);
		}

		if (BackupConfig.get().includePosition) {
			BlockPos pos = player.getBlockPos();
			JsonObject location = new JsonObject();
			location.addProperty("dimension", player.getEntityWorld().getRegistryKey().getValue().toString());
			location.addProperty("x", pos.getX());
			location.addProperty("y", pos.getY());
			location.addProperty("z", pos.getZ());
			root.add("position", location);
		}

		if (BackupConfig.get().includeItemTotals) {
			Map<String, Integer> totals = ItemStackJson.emptyTotals();
			accumulateTotals(totals, inv.getMainStacks());
			accumulateTotals(totals, armor);
			accumulateTotals(totals, offHand);
			if (BackupConfig.get().includeEnderChest) {
				for (int i = 0; i < player.getEnderChestInventory().size(); i++) {
					ItemStack stack = player.getEnderChestInventory().getStack(i);
					ItemStackJson.addTotals(totals, stack);
				}
			}
			root.add("item_totals", ItemStackJson.totalsToJson(totals));
		}

		return root;
	}

	private static void accumulateTotals(Map<String, Integer> totals, DefaultedList<ItemStack> stacks) {
		for (ItemStack stack : stacks) {
			ItemStackJson.addTotals(totals, stack);
		}
	}

	private static JsonArray slotsToJson(net.minecraft.util.collection.DefaultedList<ItemStack> stacks, String group) {
		JsonArray arr = new JsonArray();
		for (int i = 0; i < stacks.size(); i++) {
			addSlot(arr, stacks.get(i), group, i);
		}
		return arr;
	}

	private static JsonArray inventoryToJson(net.minecraft.inventory.Inventory inventory, String group) {
		JsonArray arr = new JsonArray();
		for (int i = 0; i < inventory.size(); i++) {
			addSlot(arr, inventory.getStack(i), group, i);
		}
		return arr;
	}

	private static void addSlot(JsonArray arr, ItemStack stack, String group, int index) {
		if (stack.isEmpty()) {
			return;
		}
		JsonObject slot = stackToJson(stack);
		slot.addProperty("group", group);
		slot.addProperty("slot", index);
		arr.add(slot);
	}

	private static JsonObject stackToJson(ItemStack stack) {
		return ItemStackJson.toJson(stack);
	}

	public static void pruneOldSnapshots() {
		int keepDays = Math.max(1, BackupConfig.get().keepDays);
		Instant cutoff = Instant.now().minus(keepDays, ChronoUnit.DAYS);
		Path snapshots = snapshotRoot().resolve("snapshots");
		if (!Files.isDirectory(snapshots)) {
			return;
		}
		try (Stream<Path> players = Files.list(snapshots)) {
			players.filter(Files::isDirectory).forEach(playerDir -> prunePlayerDir(playerDir, cutoff));
		} catch (IOException e) {
			IsnixPlayerBackupMod.LOGGER.warn("Ошибка очистки старых снимков: {}", e.getMessage());
		}
	}

	private static void prunePlayerDir(Path playerDir, Instant cutoff) {
		try (Stream<Path> files = Files.list(playerDir)) {
			files.filter(Files::isRegularFile)
					.filter(p -> p.getFileName().toString().endsWith(".json"))
					.sorted(Comparator.comparing(Path::getFileName))
					.forEach(path -> {
						try {
							Instant modified = Files.getLastModifiedTime(path).toInstant();
							if (modified.isBefore(cutoff)) {
								Files.deleteIfExists(path);
							}
						} catch (IOException e) {
							IsnixPlayerBackupMod.LOGGER.debug("Не удалось удалить {}: {}", path, e.getMessage());
						}
					});
		} catch (IOException e) {
			IsnixPlayerBackupMod.LOGGER.debug("Не удалось прочитать {}: {}", playerDir, e.getMessage());
		}
	}
}
