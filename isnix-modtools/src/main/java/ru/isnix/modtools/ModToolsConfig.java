package ru.isnix.modtools;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public final class ModToolsConfig {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static ModToolsConfig INSTANCE = new ModToolsConfig();

	/** Уровень OP (/op) — обычно 4. */
	public int opPermissionLevel = 4;
	/** Группа LuckPerms с правом на /mute, /freeze и т.д. */
	public String luckpermsAdminGroup = "admin";
	public String chatMutedMessage = "&cВы замьючены в чате. Осталось: &f%remaining%";
	public String voiceMutedMessage = "&cВам запрещено говорить в голосовом чате. Осталось: &f%remaining%";
	public String frozenMessage = "&cВы заморожены администратором. Двигаться и телепортироваться нельзя.";
	public String frozenCommandBlocked = "&cВы заморожены — команды недоступны.";

	public static ModToolsConfig get() {
		return INSTANCE;
	}

	public static void load() {
		Path path = FabricLoader.getInstance().getConfigDir().resolve("isnix-modtools.json");
		if (Files.isRegularFile(path)) {
			try {
				String json = Files.readString(path);
				ModToolsConfig loaded = GSON.fromJson(json, ModToolsConfig.class);
				if (loaded != null) {
					INSTANCE = loaded;
				}
			} catch (IOException e) {
				IsnixModToolsMod.LOGGER.warn("Не удалось прочитать isnix-modtools.json: {}", e.getMessage());
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
			IsnixModToolsMod.LOGGER.warn("Не удалось записать isnix-modtools.json: {}", e.getMessage());
		}
	}
}
