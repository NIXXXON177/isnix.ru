package ru.isnix.guide;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import net.minecraft.server.MinecraftServer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.lang.reflect.Type;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public final class GuideProgressStorage {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static final Type ROOT_TYPE = new TypeToken<Root>() {}.getType();
	private static final Logger LOGGER = LoggerFactory.getLogger("isnix_guide");

	private Path file;
	private Root root = new Root();

	public void bind(MinecraftServer server) {
		file = server.getSavePath(net.minecraft.util.WorldSavePath.ROOT)
				.resolve("isnix-guide-progress.json");
		load();
	}

	public PlayerProgress of(UUID uuid) {
		return root.players.computeIfAbsent(uuid.toString(), k -> new PlayerProgress());
	}

	public void save() {
		if (file == null) {
			return;
		}
		try {
			Files.createDirectories(file.getParent());
			Files.writeString(file, GSON.toJson(root));
		} catch (IOException e) {
			LOGGER.warn("Не удалось сохранить isnix-guide-progress.json", e);
		}
	}

	private void load() {
		if (file == null || !Files.isRegularFile(file)) {
			return;
		}
		try {
			Root parsed = GSON.fromJson(Files.readString(file), ROOT_TYPE);
			if (parsed != null && parsed.players != null) {
				root = parsed;
			}
		} catch (Exception e) {
			LOGGER.warn("Не удалось прочитать isnix-guide-progress.json", e);
		}
	}

	public static final class Root {
		public Map<String, PlayerProgress> players = new HashMap<>();
	}

	public static final class PlayerProgress {
		public boolean bookGiven;
		public boolean welcomeAdvancement;
		public boolean opacClaim;
		public boolean marketSeller;
		public boolean marketBuyer;
	}
}
