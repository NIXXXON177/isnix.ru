package ru.isnix.messages;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.annotations.SerializedName;
import net.minecraft.server.MinecraftServer;
import net.minecraft.text.Text;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public final class MessagesConfig {
	private static final Logger LOGGER = LoggerFactory.getLogger("isnix_server_messages");
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static MessagesConfig instance = new MessagesConfig();

	@SerializedName("whitelist_kick_lines")
	public List<String> whitelistKickLines = defaultWhitelistLines();

	@SerializedName("server_restarting_lines")
	public List<String> serverRestartingLines = defaultRestartLines();

	public static MessagesConfig get() {
		return instance;
	}

	public static void load(MinecraftServer server) {
		Path configPath = server.getRunDirectory().resolve("config").resolve("isnix-server-messages.json");
		if (!Files.isRegularFile(configPath)) {
			try {
				Files.createDirectories(configPath.getParent());
				Files.writeString(configPath, GSON.toJson(new MessagesConfig()), StandardCharsets.UTF_8);
				LOGGER.info("Создан config/isnix-server-messages.json");
			} catch (IOException e) {
				LOGGER.warn("Не удалось создать isnix-server-messages.json: {}", e.getMessage());
			}
		} else {
			try {
				String json = Files.readString(configPath, StandardCharsets.UTF_8);
				instance = GSON.fromJson(json, MessagesConfig.class);
				if (instance == null) {
					instance = new MessagesConfig();
				}
				if (instance.whitelistKickLines == null || instance.whitelistKickLines.isEmpty()) {
					instance.whitelistKickLines = defaultWhitelistLines();
				}
				if (instance.serverRestartingLines == null || instance.serverRestartingLines.isEmpty()) {
					instance.serverRestartingLines = defaultRestartLines();
				}
			} catch (Exception e) {
				LOGGER.warn("Ошибка чтения isnix-server-messages.json, заводские тексты: {}", e.getMessage());
				instance = new MessagesConfig();
			}
		}
	}

	public Text whitelistKick(MinecraftServer server) {
		return TextUtil.fromLegacyLines(server, whitelistKickLines);
	}

	public Text serverRestarting(MinecraftServer server) {
		return TextUtil.fromLegacyLines(server, serverRestartingLines);
	}

	private static List<String> defaultWhitelistLines() {
		try (InputStream in = MessagesConfig.class.getResourceAsStream("/isnix-server-messages.json")) {
			if (in != null) {
				String json = new String(in.readAllBytes(), StandardCharsets.UTF_8);
				MessagesConfig defaults = GSON.fromJson(json, MessagesConfig.class);
				if (defaults != null && defaults.whitelistKickLines != null) {
					return new ArrayList<>(defaults.whitelistKickLines);
				}
			}
		} catch (IOException ignored) {
		}
		return List.of(
				"§c§lISTHISNIXXXON",
				"§7Вы не в вайтлисте.",
				"",
				"§aПодайте заявку на сайте:",
				"§f§nisnix.ru/account");
	}

	private static List<String> defaultRestartLines() {
		try (InputStream in = MessagesConfig.class.getResourceAsStream("/isnix-server-messages.json")) {
			if (in != null) {
				String json = new String(in.readAllBytes(), StandardCharsets.UTF_8);
				MessagesConfig defaults = GSON.fromJson(json, MessagesConfig.class);
				if (defaults != null && defaults.serverRestartingLines != null) {
					return new ArrayList<>(defaults.serverRestartingLines);
				}
			}
		} catch (IOException ignored) {
		}
		return List.of(
				"§e§lСервер перезапускается",
				"§7Подождите 1–3 минуты",
				"§7и подключайтесь снова:",
				"§amc.isnix.ru");
	}
}
