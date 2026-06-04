package ru.isnix.guide;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import net.fabricmc.loader.api.FabricLoader;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public final class GuideConfig {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static final Logger LOGGER = LoggerFactory.getLogger("isnix_guide");
	private static Data data = new Data();

	private GuideConfig() {
	}

	public static Data get() {
		return data;
	}

	public static void load() {
		Path path = FabricLoader.getInstance().getConfigDir().resolve("isnix-guide.json");
		if (!Files.isRegularFile(path)) {
			save(path);
			return;
		}
		try {
			String json = Files.readString(path);
			Data parsed = GSON.fromJson(json, Data.class);
			if (parsed != null) {
				data = parsed;
			}
		} catch (Exception e) {
			LOGGER.warn("Не удалось прочитать isnix-guide.json, значения по умолчанию", e);
		}
	}

	private static void save(Path path) {
		try {
			Files.createDirectories(path.getParent());
			Files.writeString(path, GSON.toJson(data));
		} catch (IOException e) {
			LOGGER.warn("Не удалось записать isnix-guide.json", e);
		}
	}

	public static final class Data {
		public boolean giveBookOnFirstJoin = true;
		public boolean joinGuideMessage = true;
		public int checkOpacClaimsEveryTicks = 1200;
	}
}
