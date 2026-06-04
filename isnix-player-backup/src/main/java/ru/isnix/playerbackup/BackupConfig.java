package ru.isnix.playerbackup;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public final class BackupConfig {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static BackupConfig INSTANCE = new BackupConfig();

	public boolean enabled = true;
	/** Интервал автоснимков для онлайн-игроков (минуты). */
	public int intervalMinutes = 15;
	/** Сколько дней хранить файлы снимков на диске сервера. */
	public int keepDays = 14;
	public boolean snapshotOnQuit = true;
	public boolean includeEnderChest = true;
	public boolean includePosition = true;
	public boolean includeExperience = true;

	public static BackupConfig get() {
		return INSTANCE;
	}

	public static void load() {
		Path path = FabricLoader.getInstance().getConfigDir().resolve("isnix-player-backup.json");
		if (Files.isRegularFile(path)) {
			try {
				String json = Files.readString(path);
				BackupConfig loaded = GSON.fromJson(json, BackupConfig.class);
				if (loaded != null) {
					INSTANCE = loaded;
				}
			} catch (IOException e) {
				IsnixPlayerBackupMod.LOGGER.warn("Не удалось прочитать isnix-player-backup.json: {}", e.getMessage());
			}
		} else {
			save(path);
		}
	}

	private static void save(Path path) {
		try {
			Files.createDirectories(path.getParent());
			Files.writeString(path, GSON.toJson(INSTANCE));
		} catch (IOException e) {
			IsnixPlayerBackupMod.LOGGER.warn("Не удалось записать isnix-player-backup.json: {}", e.getMessage());
		}
	}
}
