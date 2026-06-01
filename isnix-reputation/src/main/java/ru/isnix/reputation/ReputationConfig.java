package ru.isnix.reputation;

import com.google.gson.FieldNamingPolicy;
import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

public final class ReputationConfig {
	private static final Gson GSON = new GsonBuilder()
			.setPrettyPrinting()
			.setFieldNamingPolicy(FieldNamingPolicy.LOWER_CASE_WITH_UNDERSCORES)
			.create();
	private static ReputationConfig INSTANCE = new ReputationConfig();

	public boolean enabled = false;
	public String supabaseUrl = "https://yfrlgeztbaebdapdnefy.supabase.co";
	public String serviceRoleKey = "";
	public boolean allowDislikes = false;
	public int refreshIntervalTicks = 6000;
	public int opPermissionLevel = 4;
	public String placeholderFormat = "&e★%score%";
	public String placeholderEmpty = "&8—";
	public String voteSuccessLike = "&aВы поставили лайк игроку &f%target%&a. Его рейтинг: &e★%score%";
	public String voteSuccessDislike = "&cВы поставили диз игроку &f%target%&c. Его рейтинг: &e★%score%";
	public String voteErrorNotLinked =
			"&cГолосовать могут только игроки с привязанным ником на &fisnix.ru";
	public String voteErrorSelf = "&cНельзя голосовать за себя.";
	public String voteErrorCooldown = "&cВы уже меняли оценку недавно. Попробуйте позже.";
	public String voteErrorAlready = "&7Вы уже поставили такую оценку.";
	public String voteErrorTarget = "&cИгрок не найден или не привязан к аккаунту на сайте.";

	public static ReputationConfig get() {
		return INSTANCE;
	}

	public boolean isReady() {
		return enabled && supabaseUrl != null && !supabaseUrl.isBlank() && serviceRoleKey != null
				&& !serviceRoleKey.isBlank() && !serviceRoleKey.contains("ВСТАВЬ");
	}

	public String modVersionLabel() {
		return FabricLoader.getInstance()
				.getModContainer(IsnixReputationMod.MOD_ID)
				.map(c -> c.getMetadata().getVersion().getFriendlyString())
				.orElse("?");
	}

	public static void load() {
		Path path = FabricLoader.getInstance().getConfigDir().resolve("isnix-reputation.json");
		if (!Files.isRegularFile(path)) {
			try {
				Files.createDirectories(path.getParent());
				try (InputStream in = ReputationConfig.class.getResourceAsStream("/isnix-reputation.json")) {
					if (in != null) {
						Files.copy(in, path);
					} else {
						Files.writeString(path, GSON.toJson(new ReputationConfig()), StandardCharsets.UTF_8);
					}
				}
				IsnixReputationMod.LOGGER.info("Создан config/isnix-reputation.json");
			} catch (IOException e) {
				IsnixReputationMod.LOGGER.warn("Не удалось создать isnix-reputation.json: {}", e.getMessage());
			}
		}
		if (Files.isRegularFile(path)) {
			try {
				ReputationConfig loaded = GSON.fromJson(Files.readString(path, StandardCharsets.UTF_8), ReputationConfig.class);
				if (loaded != null) {
					loaded.normalize();
					INSTANCE = loaded;
				}
			} catch (IOException e) {
				IsnixReputationMod.LOGGER.warn("Ошибка чтения isnix-reputation.json: {}", e.getMessage());
			}
		}
	}

	public static void reload() {
		load();
	}

	private void normalize() {
		if (supabaseUrl != null) {
			supabaseUrl = supabaseUrl.trim().replaceAll("/+$", "");
		}
		if (serviceRoleKey != null) {
			serviceRoleKey = serviceRoleKey.trim();
		}
		if (refreshIntervalTicks < 1200) {
			refreshIntervalTicks = 1200;
		}
	}

	public String applyPlaceholders(String template, String target, ReputationScore score) {
		if (template == null) {
			return "";
		}
		long s = score != null ? score.score() : 0;
		long likes = score != null ? score.likes() : 0;
		long dislikes = score != null ? score.dislikes() : 0;
		return template.replace("%target%", target != null ? target : "")
				.replace("%score%", Long.toString(s))
				.replace("%likes%", Long.toString(likes))
				.replace("%dislikes%", Long.toString(dislikes));
	}
}
