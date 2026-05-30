package ru.isnix.opactab;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.annotations.SerializedName;
import net.minecraft.server.MinecraftServer;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public final class ClanTagConfig {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static Path configPath;
	private static Root root = new Root();

	public static Root get() {
		return root;
	}

	public static void load(MinecraftServer server) {
		configPath = server.getRunDirectory().resolve("config").resolve("isnix-opac-tab.json");
		if (Files.exists(configPath)) {
			try {
				String json = Files.readString(configPath);
				Root loaded = GSON.fromJson(json, Root.class);
				if (loaded != null) {
					root = loaded;
					if (root.styles == null) {
						root.styles = new HashMap<>();
					}
				}
			} catch (Exception e) {
				IsnixOpacTabMod.LOGGER.warn("Не удалось прочитать isnix-opac-tab.json: {}", e.getMessage());
			}
		} else {
			save();
		}
	}

	public static void save() {
		if (configPath == null) {
			return;
		}
		try {
			Files.createDirectories(configPath.getParent());
			Files.writeString(configPath, GSON.toJson(root));
		} catch (IOException e) {
			IsnixOpacTabMod.LOGGER.warn("Не удалось сохранить isnix-opac-tab.json: {}", e.getMessage());
		}
	}

	public static ClanStyle styleFor(UUID ownerId) {
		if (ownerId == null) {
			return null;
		}
		return root.styles.get(ownerId.toString());
	}

	public static void putStyle(UUID ownerId, ClanStyle style) {
		root.styles.put(ownerId.toString(), style);
		save();
	}

	public static final class Root {
		@SerializedName("styles")
		public Map<String, ClanStyle> styles = new HashMap<>();

		@SerializedName("wrap_brackets")
		public boolean wrapBrackets = true;

		@SerializedName("suffix_reset")
		public String suffixReset = "&r";
	}

	public static final class ClanStyle {
		/** Текст тега в TAB (если пусто — из OPAC Party name). */
		@SerializedName("tag_text")
		public String tagText = "";

		@SerializedName("color")
		public String color = "7";

		@SerializedName("bold")
		public boolean bold = false;

		@SerializedName("italic")
		public boolean italic = false;

		@SerializedName("underline")
		public boolean underline = false;

		@SerializedName("strikethrough")
		public boolean strikethrough = false;

		public static ClanStyle defaults() {
			return new ClanStyle();
		}
	}
}
