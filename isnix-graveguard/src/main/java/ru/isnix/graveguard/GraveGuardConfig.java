package ru.isnix.graveguard;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public final class GraveGuardConfig {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static GraveGuardConfig INSTANCE = new GraveGuardConfig();

	public boolean enabled = true;
	public int opPermissionLevel = 4;
	/** Иммунитет к урону (сек), обновляется у своей могилы после смерти. */
	public int protectionSeconds = 12;
	/** Сколько минут после смерти игрок считается «идущим к могиле». */
	public int eligibleMinutesAfterDeath = 10;
	/** Радиус (блоки) вокруг игрока для поиска своей могилы. */
	public double nearGraveRadius = 6.0;
	/** Блокировать только урон от других игроков (мобы/лава проходят). */
	public boolean protectFromPlayersOnly = true;
	/** Сообщение в action bar при активации защиты. */
	public boolean notifyPlayer = true;
	/** Доп. теги сущностей могил (кроме graves.entity / graves.marker). */
	public String[] extraGraveEntityTags = new String[] { "graves.grave", "graves.display" };

	public static GraveGuardConfig get() {
		return INSTANCE;
	}

	public String modVersionLabel() {
		return FabricLoader.getInstance()
				.getModContainer(IsnixGraveGuardMod.MOD_ID)
				.map(c -> c.getMetadata().getVersion().getFriendlyString())
				.orElse("?");
	}

	public static void load() {
		Path path = FabricLoader.getInstance().getConfigDir().resolve("isnix-graveguard.json");
		if (Files.isRegularFile(path)) {
			try {
				String json = Files.readString(path);
				GraveGuardConfig loaded = GSON.fromJson(json, GraveGuardConfig.class);
				if (loaded != null) {
					INSTANCE = loaded;
				}
			} catch (IOException e) {
				IsnixGraveGuardMod.LOGGER.warn("Не удалось прочитать isnix-graveguard.json: {}", e.getMessage());
			}
		} else {
			save(path);
		}
	}

	public static void reload() {
		load();
	}

	private static void save(Path path) {
		try {
			Files.createDirectories(path.getParent());
			Files.writeString(path, GSON.toJson(INSTANCE));
		} catch (IOException e) {
			IsnixGraveGuardMod.LOGGER.warn("Не удалось записать isnix-graveguard.json: {}", e.getMessage());
		}
	}
}
