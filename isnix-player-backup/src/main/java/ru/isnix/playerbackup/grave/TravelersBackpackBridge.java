package ru.isnix.playerbackup.grave;

import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import ru.isnix.playerbackup.IsnixPlayerBackupMod;

import java.io.File;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Чтение death-backup рюкзака из папки Traveler's Backpack (при ly-graves TB не кладёт рюкзак в могилу).
 */
public final class TravelersBackpackBridge {
	private static boolean checked;
	private static boolean available;
	private static Method getPlayerBackpackFolder;
	private static Method readBackpack;
	private static Method getBackpackFile;

	private TravelersBackpackBridge() {
	}

	public static boolean isAvailable() {
		ensureInitialized();
		return available;
	}

	public static boolean isBackpackItem(ItemStack stack) {
		if (stack == null || stack.isEmpty()) {
			return false;
		}
		var id = Registries.ITEM.getId(stack.getItem());
		return id != null && "travelersbackpack".equals(id.getNamespace());
	}

	/** Все .dat рюкзаков игрока, отсортированные по времени изменения (старые первыми). */
	public static List<StoredBackpack> readAllStoredBackpacks(ServerWorld world, UUID playerUuid) {
		if (!isAvailable() || world == null || playerUuid == null) {
			return List.of();
		}
		try {
			File folder = (File) getPlayerBackpackFolder.invoke(null, world, playerUuid);
			if (folder == null || !folder.isDirectory()) {
				return List.of();
			}
			File[] files = folder.listFiles((dir, name) -> name.endsWith(".dat"));
			if (files == null || files.length == 0) {
				return List.of();
			}
			Arrays.sort(files, Comparator.comparingLong(File::lastModified));
			List<StoredBackpack> result = new ArrayList<>(files.length);
			for (File file : files) {
				readStoredBackpack(world, playerUuid, file).ifPresent(result::add);
			}
			return result;
		} catch (Throwable t) {
			IsnixPlayerBackupMod.LOGGER.warn(
					"readAllStoredBackpacks {}: {}",
					playerUuid,
					t.toString());
			return List.of();
		}
	}

	/** .dat-файлы, изменённые не раньше {@code sinceEpochMs} (смерть и дропы TB). */
	public static List<StoredBackpack> readStoredBackpacksSince(ServerWorld world, UUID playerUuid, long sinceEpochMs) {
		if (!isAvailable() || world == null || playerUuid == null) {
			return List.of();
		}
		try {
			File folder = (File) getPlayerBackpackFolder.invoke(null, world, playerUuid);
			if (folder == null || !folder.isDirectory()) {
				return List.of();
			}
			File[] files = folder.listFiles((dir, name) -> name.endsWith(".dat"));
			if (files == null || files.length == 0) {
				return List.of();
			}
			Arrays.sort(files, Comparator.comparingLong(File::lastModified));
			List<StoredBackpack> result = new ArrayList<>();
			for (File file : files) {
				if (file.lastModified() >= sinceEpochMs) {
					readStoredBackpack(world, playerUuid, file).ifPresent(result::add);
				}
			}
			return result;
		} catch (Throwable t) {
			IsnixPlayerBackupMod.LOGGER.warn(
					"readStoredBackpacksSince {}: {}",
					playerUuid,
					t.toString());
			return List.of();
		}
	}

	public static Optional<StoredBackpack> readLatestBackpack(ServerWorld world, UUID playerUuid) {
		if (!isAvailable() || world == null || playerUuid == null) {
			return Optional.empty();
		}
		List<StoredBackpack> all = readAllStoredBackpacks(world, playerUuid);
		if (all.isEmpty()) {
			return Optional.empty();
		}
		return Optional.of(all.get(all.size() - 1));
	}

	private static Optional<StoredBackpack> readStoredBackpack(ServerWorld world, UUID playerUuid, File file) {
		try {
			String filename = file.getName();
			int dot = filename.lastIndexOf('.');
			String key = dot > 0 ? filename.substring(0, dot) : filename;
			ItemStack stack = (ItemStack) readBackpack.invoke(null, world, playerUuid, key);
			if (stack == null || stack.isEmpty()) {
				return Optional.empty();
			}
			return Optional.of(new StoredBackpack(stack.copy(), key));
		} catch (Throwable t) {
			IsnixPlayerBackupMod.LOGGER.warn(
					"readStoredBackpack {} {}: {}",
					playerUuid,
					file.getName(),
					t.toString());
			return Optional.empty();
		}
	}

	public static Optional<StoredBackpack> readLatestBackpack(ServerPlayerEntity player) {
		if (player == null) {
			return Optional.empty();
		}
		return readLatestBackpack(player.getEntityWorld(), player.getUuid());
	}

	public static boolean deleteStoredBackpack(ServerWorld world, UUID playerUuid, String filename) {
		if (!isAvailable() || world == null || playerUuid == null || filename == null || filename.isBlank()) {
			return false;
		}
		try {
			File file = (File) getBackpackFile.invoke(null, world, playerUuid, filename);
			if (file == null || !file.isFile()) {
				return false;
			}
			return file.delete();
		} catch (Throwable t) {
			IsnixPlayerBackupMod.LOGGER.warn(
					"deleteStoredBackpack {} {}: {}",
					playerUuid,
					filename,
					t.toString());
			return false;
		}
	}

	private static void ensureInitialized() {
		if (checked) {
			return;
		}
		checked = true;
		try {
			Class<?> manager = Class.forName("com.tiviacz.travelersbackpack.common.BackpackManager");
			getPlayerBackpackFolder = manager.getMethod("getPlayerBackpackFolder", ServerWorld.class, UUID.class);
			readBackpack = manager.getMethod("readBackpack", ServerWorld.class, UUID.class, String.class);
			getBackpackFile = manager.getMethod("getBackpackFile", ServerWorld.class, UUID.class, String.class);
			available = true;
		} catch (Throwable t) {
			available = false;
			IsnixPlayerBackupMod.LOGGER.warn("Traveler's Backpack API недоступен: {}", t.toString());
		}
	}

	public record StoredBackpack(ItemStack stack, String filename) {
	}
}
