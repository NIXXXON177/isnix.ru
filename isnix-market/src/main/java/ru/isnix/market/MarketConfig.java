package ru.isnix.market;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.annotations.SerializedName;
import com.google.gson.reflect.TypeToken;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.util.Identifier;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public final class MarketConfig {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static MarketConfigData data = MarketConfigData.withDefaults();

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
			data.applyDefaults();
			PricePresets.invalidate();
		} catch (Exception e) {
			IsnixMarketMod.LOGGER.error("Не удалось загрузить isnix-market.json", e);
			data = MarketConfigData.withDefaults();
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
		public int listingsExpireDays = 14;

		@SerializedName("broadcastNewListings")
		public boolean broadcastNewListings = true;

		@SerializedName("banAllSpawnEggs")
		public boolean banAllSpawnEggs = true;

		@SerializedName("bannedItemIds")
		public List<String> bannedItemIds;

		@SerializedName("pricePresets")
		public List<PricePresetEntry> pricePresets;

		@SerializedName("purchaseSound")
		public String purchaseSound = "entity.experience_orb.pickup";

		@SerializedName("purchaseSoundVolume")
		public float purchaseSoundVolume = 0.7f;

		@SerializedName("purchaseSoundPitch")
		public float purchaseSoundPitch = 1.25f;

		public static class PricePresetEntry {
			@SerializedName("id")
			public String id;

			@SerializedName("count")
			public int count = 1;

			public ItemStack toStack() {
				if (id == null || id.isBlank()) {
					return ItemStack.EMPTY;
				}
				Identifier identifier = Identifier.tryParse(id.trim());
				if (identifier == null || !Registries.ITEM.containsId(identifier)) {
					return ItemStack.EMPTY;
				}
				Item item = Registries.ITEM.get(identifier);
				int amount = Math.max(1, Math.min(64, count));
				return new ItemStack(item, amount);
			}
		}

		private static List<String> defaultBannedItems() {
			return List.of(
					"minecraft:bedrock",
					"minecraft:barrier",
					"minecraft:command_block",
					"minecraft:chain_command_block",
					"minecraft:repeating_command_block",
					"minecraft:structure_void",
					"minecraft:jigsaw",
					"minecraft:structure_block",
					"minecraft:light",
					"minecraft:debug_stick",
					"minecraft:written_book",
					"minecraft:writable_book"
			);
		}

		static MarketConfigData withDefaults() {
			MarketConfigData cfg = new MarketConfigData();
			cfg.applyDefaults();
			return cfg;
		}

		void applyDefaults() {
			if (bannedItemIds == null || bannedItemIds.isEmpty()) {
				bannedItemIds = new ArrayList<>(defaultBannedItems());
			}
			if (pricePresets == null || pricePresets.isEmpty()) {
				pricePresets = new ArrayList<>(loadPricePresetsFromResource());
			}
		}

		private static List<PricePresetEntry> loadPricePresetsFromResource() {
			try (InputStream in = IsnixMarketMod.class.getClassLoader().getResourceAsStream("isnix-market.json")) {
				if (in == null) {
					return List.of();
				}
				String json = new String(in.readAllBytes(), StandardCharsets.UTF_8);
				JsonObject root = JsonParser.parseString(json).getAsJsonObject();
				if (!root.has("pricePresets")) {
					return List.of();
				}
				var type = new TypeToken<List<PricePresetEntry>>() {
				}.getType();
				List<PricePresetEntry> parsed = GSON.fromJson(root.get("pricePresets"), type);
				if (parsed == null || parsed.isEmpty()) {
					return List.of();
				}
				return new ArrayList<>(parsed);
			} catch (Exception e) {
				IsnixMarketMod.LOGGER.warn("Не удалось загрузить pricePresets из ресурса мода", e);
				return List.of();
			}
		}
	}
}
