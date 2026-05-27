package ru.isnix.chat;

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

public final class ChatConfig {
	private static final Logger LOGGER = LoggerFactory.getLogger(IsnixChatMod.MOD_ID);
	private static final Gson GSON = new GsonBuilder()
			.setPrettyPrinting()
			.setFieldNamingPolicy(FieldNamingPolicy.LOWER_CASE_WITH_UNDERSCORES)
			.create();
	private static ChatConfig INSTANCE = new ChatConfig();

	public int localRadius = 80;
	public String globalPrefix = "!";
	public String localTag = "[рядом]";
	public String globalTag = "[все]";
	public boolean notifyWhenAlone = true;
	public boolean globalSound = true;
	public float globalSoundVolume = 0.35f;
	public float globalSoundPitch = 1.25f;

	public static ChatConfig get() {
		return INSTANCE;
	}

	public static void load() {
		Path path = FabricLoader.getInstance().getConfigDir().resolve("isnix-chat.json");

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
					loaded.clamp();
					INSTANCE = loaded;
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
		if (globalSoundVolume < 0.05f) {
			globalSoundVolume = 0.05f;
		}
		if (globalSoundVolume > 1.0f) {
			globalSoundVolume = 1.0f;
		}
		if (globalSoundPitch < 0.5f) {
			globalSoundPitch = 0.5f;
		}
		if (globalSoundPitch > 2.0f) {
			globalSoundPitch = 2.0f;
		}
	}
}
