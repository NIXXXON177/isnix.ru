package ru.isnix.messages;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.annotations.SerializedName;
import com.google.gson.reflect.TypeToken;
import net.minecraft.server.MinecraftServer;
import net.minecraft.text.Text;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.lang.reflect.Type;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public final class MessagesConfig {
	private static final Logger LOGGER = LoggerFactory.getLogger("isnix_server_messages");
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static final Type STRING_LIST = new TypeToken<List<String>>() {}.getType();
	private static MessagesConfig instance = createDefaults();

	@SerializedName("whitelist_kick_lines")
	public List<String> whitelistKickLines;

	@SerializedName("server_restarting_lines")
	public List<String> serverRestartingLines;

	public static MessagesConfig get() {
		return instance;
	}

	public static void load(MinecraftServer server) {
		Path configPath = server.getRunDirectory().resolve("config").resolve("isnix-server-messages.json");
		if (!Files.isRegularFile(configPath)) {
			try {
				Files.createDirectories(configPath.getParent());
				Files.writeString(configPath, GSON.toJson(createDefaults()), StandardCharsets.UTF_8);
				LOGGER.info("Создан config/isnix-server-messages.json");
			} catch (IOException e) {
				LOGGER.warn("Не удалось создать isnix-server-messages.json: {}", e.getMessage());
			}
			instance = createDefaults();
			return;
		}
		try {
			String json = Files.readString(configPath, StandardCharsets.UTF_8);
			MessagesConfig loaded = GSON.fromJson(json, MessagesConfig.class);
			if (loaded == null) {
				instance = createDefaults();
				return;
			}
			if (loaded.whitelistKickLines == null || loaded.whitelistKickLines.isEmpty()) {
				loaded.whitelistKickLines = linesFromResource("whitelist_kick_lines", builtinWhitelistLines());
			}
			if (loaded.serverRestartingLines == null || loaded.serverRestartingLines.isEmpty()) {
				loaded.serverRestartingLines = linesFromResource("server_restarting_lines", builtinRestartLines());
			}
			instance = loaded;
		} catch (Exception e) {
			LOGGER.warn("Ошибка чтения isnix-server-messages.json, заводские тексты: {}", e.getMessage());
			instance = createDefaults();
		}
	}

	public Text whitelistKick(MinecraftServer server) {
		return TextUtil.fromLegacyLines(server, whitelistKickLines);
	}

	public Text serverRestarting(MinecraftServer server) {
		return TextUtil.fromLegacyLines(server, serverRestartingLines);
	}

	private static MessagesConfig createDefaults() {
		MessagesConfig config = new MessagesConfig();
		config.whitelistKickLines = linesFromResource("whitelist_kick_lines", builtinWhitelistLines());
		config.serverRestartingLines = linesFromResource("server_restarting_lines", builtinRestartLines());
		return config;
	}

	private static List<String> linesFromResource(String key, List<String> fallback) {
		try (InputStream in = MessagesConfig.class.getResourceAsStream("/isnix-server-messages.json")) {
			if (in == null) {
				return new ArrayList<>(fallback);
			}
			JsonObject root = JsonParser.parseReader(new InputStreamReader(in, StandardCharsets.UTF_8))
					.getAsJsonObject();
			if (!root.has(key) || !root.get(key).isJsonArray()) {
				return new ArrayList<>(fallback);
			}
			List<String> parsed = GSON.fromJson(root.get(key), STRING_LIST);
			if (parsed == null || parsed.isEmpty()) {
				return new ArrayList<>(fallback);
			}
			return new ArrayList<>(parsed);
		} catch (Exception ignored) {
			return new ArrayList<>(fallback);
		}
	}

	private static List<String> builtinWhitelistLines() {
		return List.of(
				"§c§lISTHISNIXXXON",
				"§7Вы не в вайтлисте.",
				"",
				"§aПодайте заявку на сайте:",
				"§f§nisnix.ru/account");
	}

	private static List<String> builtinRestartLines() {
		return List.of(
				"§e§lСервер перезапускается",
				"§7Подождите 1–3 минуты",
				"§7и подключайтесь снова:",
				"§amc.isnix.ru");
	}
}
