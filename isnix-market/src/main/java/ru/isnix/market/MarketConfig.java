package ru.isnix.market;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.annotations.SerializedName;
import net.fabricmc.loader.api.FabricLoader;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

public final class MarketConfig {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static MarketConfigData data = new MarketConfigData();

	private MarketConfig() {
	}

	public static void load() {
		Path configDir = FabricLoader.getInstance().getConfigDir().resolve("isnix-market");
		Path configFile = configDir.resolve("isnix-market.json");

		try {
			if (!Files.isDirectory(configDir)) {
				Files.createDirectories(configDir);
			}
			if (!Files.exists(configFile)) {
				try (var in = IsnixMarketMod.class.getClassLoader().getResourceAsStream("isnix-market.json")) {
					if (in != null) {
						Files.writeString(configFile, new String(in.readAllBytes()));
					} else {
						Files.writeString(configFile, GSON.toJson(new MarketConfigData()));
					}
				}
			}
			data = GSON.fromJson(Files.readString(configFile), MarketConfigData.class);
			if (data == null) {
				data = new MarketConfigData();
			}
		} catch (IOException e) {
			IsnixMarketMod.LOGGER.error("Не удалось загрузить isnix-market.json", e);
			data = new MarketConfigData();
		}
	}

	public static MarketConfigData get() {
		return data;
	}

	public static class MarketConfigData {
		@SerializedName("maxListingsPerPlayer")
		public int maxListingsPerPlayer = 8;

		@SerializedName("maxListingsTotal")
		public int maxListingsTotal = 300;

		@SerializedName("listingsExpireDays")
		public int listingsExpireDays = 30;

		@SerializedName("purchaseSound")
		public String purchaseSound = "entity.experience_orb.pickup";

		@SerializedName("purchaseSoundVolume")
		public float purchaseSoundVolume = 0.7f;

		@SerializedName("purchaseSoundPitch")
		public float purchaseSoundPitch = 1.25f;
	}
}
