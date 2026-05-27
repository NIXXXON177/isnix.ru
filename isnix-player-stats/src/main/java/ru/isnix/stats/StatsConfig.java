package ru.isnix.stats;

import com.google.gson.FieldNamingPolicy;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

public final class StatsConfig {
	private static final Logger LOGGER = LoggerFactory.getLogger(IsnixPlayerStatsMod.MOD_ID);
	private static final Gson GSON = new GsonBuilder()
			.setPrettyPrinting()
			.setFieldNamingPolicy(FieldNamingPolicy.LOWER_CASE_WITH_UNDERSCORES)
			.create();
	private static StatsConfig INSTANCE = new StatsConfig();

	public boolean enabled = false;
	public String supabaseUrl = "https://yfrlgeztbaebdapdnefy.supabase.co";
	public String serviceRoleKey = "";
	/** Как часто писать накопленное время в Supabase (тики, 20 = 1 сек). 6000 ≈ 5 мин. */
	public int flushIntervalTicks = 6000;

	public static StatsConfig get() {
		return INSTANCE;
	}

	public boolean isReady() {
		return enabled && supabaseUrl != null && !supabaseUrl.isBlank() && serviceRoleKey != null
				&& !serviceRoleKey.isBlank()
				&& !serviceRoleKey.contains("ВСТАВЬ");
	}

	public static void load() {
		Path path = FabricLoader.getInstance().getConfigDir().resolve("isnix-player-stats.json");

		if (!Files.isRegularFile(path)) {
			try {
				Files.createDirectories(path.getParent());
				try (var in = StatsConfig.class.getClassLoader().getResourceAsStream("isnix-player-stats.json")) {
					if (in != null) {
						Files.copy(in, path);
					} else {
						Files.writeString(path, GSON.toJson(new StatsConfig()), StandardCharsets.UTF_8);
					}
				}
				LOGGER.info("Создан config/isnix-player-stats.json — включи enabled и вставь service_role_key");
			} catch (IOException e) {
				LOGGER.warn("Не удалось создать isnix-player-stats.json: {}", e.getMessage());
			}
		}

		if (Files.isRegularFile(path)) {
			try (var reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
				StatsConfig loaded = GSON.fromJson(reader, StatsConfig.class);
				if (loaded != null) {
					loaded.normalize();
					INSTANCE = loaded;
				}
			} catch (IOException e) {
				LOGGER.warn("Ошибка чтения isnix-player-stats.json: {}", e.getMessage());
			}
		}
	}

	private void normalize() {
		if (supabaseUrl == null || supabaseUrl.isBlank()) {
			supabaseUrl = "https://yfrlgeztbaebdapdnefy.supabase.co";
		}
		supabaseUrl = supabaseUrl.trim().replaceAll("/+$", "");
		if (serviceRoleKey != null) {
			serviceRoleKey = serviceRoleKey.trim();
		} else {
			serviceRoleKey = "";
		}
		if (flushIntervalTicks < 1200) {
			flushIntervalTicks = 1200;
		}
		if (flushIntervalTicks > 72000) {
			flushIntervalTicks = 72000;
		}
	}
}
