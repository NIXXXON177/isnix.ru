package ru.isnix.lagwatch;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public final class LagWatchConfig {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static LagWatchConfig INSTANCE = new LagWatchConfig();

	public boolean enabled = true;
	public int opPermissionLevel = 4;
	public int sampleIntervalTicks = 20;
	public int alertCooldownSeconds = 60;
	/** Обновлений блоков в чанке за один интервал (по умолчанию ~1 сек). */
	public int blockUpdatesPerSecondThreshold = 400;
	/** Все сущности в чанке (кроме игроков), кроме item — доп. проверка. */
	public int entityCountThreshold = 250;
	/** Предметы на земле в чанке. */
	public int itemEntityCountThreshold = 120;
	public boolean logToConsole = true;
	public boolean alertAdminsInChat = true;

	public static LagWatchConfig get() {
		return INSTANCE;
	}

	public String modVersionLabel() {
		return FabricLoader.getInstance()
				.getModContainer(IsnixLagWatchMod.MOD_ID)
				.map(c -> c.getMetadata().getVersion().getFriendlyString())
				.orElse("?");
	}

	public static void load() {
		Path path = FabricLoader.getInstance().getConfigDir().resolve("isnix-lagwatch.json");
		if (Files.isRegularFile(path)) {
			try {
				String json = Files.readString(path);
				LagWatchConfig loaded = GSON.fromJson(json, LagWatchConfig.class);
				if (loaded != null) {
					INSTANCE = loaded;
				}
			} catch (IOException e) {
				IsnixLagWatchMod.LOGGER.warn("Не удалось прочитать isnix-lagwatch.json: {}", e.getMessage());
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
			IsnixLagWatchMod.LOGGER.warn("Не удалось записать isnix-lagwatch.json: {}", e.getMessage());
		}
	}
}
