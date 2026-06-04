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
	/** Иммунитет к урону (сек), продлевается в зоне лута. */
	public int protectionSeconds = 30;
	/** Сколько минут после смерти действует логика могилы. */
	public int eligibleMinutesAfterDeath = 10;
	/** Радиус поиска сущности могилы (блоки). */
	public double nearGraveRadius = 10.0;
	/** Радиус вокруг точки смерти, если сущность могилы не найдена. */
	public double deathSiteRadius = 14.0;
	/** После выхода из зоны — ещё столько секунд защиты (успеть забрать вещи). */
	public int lootGraceSeconds = 60;
	/** В зоне лута блокировать весь урон (мобы, лава), не только PvP. */
	public boolean protectAllDamageInLootZone = true;
	/** Блокировать только урон от игроков вне полной зоны лута. */
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
