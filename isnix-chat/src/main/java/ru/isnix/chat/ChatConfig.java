package ru.isnix.chat;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.minecraft.server.MinecraftServer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

public final class ChatConfig {
	private static final Logger LOGGER = LoggerFactory.getLogger(IsnixChatMod.MOD_ID);
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static ChatConfig INSTANCE = new ChatConfig();

	public int localRadius = 80;
	public String globalPrefix = "!";
	public String localTag = "[рядом]";
	public String globalTag = "[все]";
	public boolean notifyWhenAlone = true;

	public static ChatConfig get() {
		return INSTANCE;
	}

	public static void load(MinecraftServer server) {
		Path path = server.getFile("config/isnix-chat.json").toPath();
		if (!Files.isRegularFile(path)) {
			try {
				Files.createDirectories(path.getParent());
				try (var in = ChatConfig.class.getClassLoader().getResourceAsStream("isnix-chat.json")) {
					if (in != null) {
						Files.copy(in, path);
					} else {
						Files.writeString(path, GSON.toJson(new ChatConfig()), StandardCharsets.UTF_8);
					}
				}
				LOGGER.info("Создан config/isnix-chat.json");
			} catch (IOException e) {
				LOGGER.warn("Не удалось создать isnix-chat.json: {}", e.getMessage());
			}
		}

		if (Files.isRegularFile(path)) {
			try (var reader = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
				ChatConfig loaded = GSON.fromJson(reader, ChatConfig.class);
				if (loaded != null) {
					INSTANCE = loaded;
					clamp();
				}
			} catch (IOException e) {
				LOGGER.warn("Ошибка чтения isnix-chat.json: {}", e.getMessage());
			}
		}
	}

	private void clamp() {
		if (localRadius < 8) {
			localRadius = 8;
		}
		if (localRadius > 512) {
			localRadius = 512;
		}
		if (globalPrefix == null || globalPrefix.isEmpty()) {
			globalPrefix = "!";
		}
		if (localTag == null) {
			localTag = "[рядом]";
		}
		if (globalTag == null) {
			globalTag = "[все]";
		}
	}
}
