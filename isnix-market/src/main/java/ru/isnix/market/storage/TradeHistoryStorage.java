package ru.isnix.market.storage;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.item.ItemStack;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import ru.isnix.market.IsnixMarketMod;
import ru.isnix.market.MarketConfig;
import ru.isnix.market.listing.MarketListing;
import ru.isnix.market.util.ItemStackCodec;
import ru.isnix.market.util.ListingMessages;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** Журнал покупок (JSONL) для споров и /sell log. */
public class TradeHistoryStorage {
	private static final Gson GSON = new GsonBuilder().create();

	private final Path file;
	private final MinecraftServer server;

	public TradeHistoryStorage(MinecraftServer server) {
		this.server = server;
		this.file = server.getRunDirectory().resolve("config/isnix-market/trades.jsonl");
	}

	public void recordPurchase(
			MarketListing listing,
			UUID buyerUuid,
			String buyerName,
			int saleQty,
			ItemStack saleGiven,
			ItemStack pricePaid
	) {
		try {
			Files.createDirectories(file.getParent());
			JsonObject row = new JsonObject();
			row.addProperty("at", System.currentTimeMillis());
			row.addProperty("listingId", listing.id().toString());
			row.addProperty("buyerUuid", buyerUuid.toString());
			row.addProperty("buyerName", buyerName);
			row.addProperty("sellerUuid", listing.sellerUuid().toString());
			row.addProperty("sellerName", listing.sellerName());
			row.addProperty("saleQty", saleQty);
			var lookup = server.getRegistryManager();
			row.add("sale", ItemStackCodec.toJson(saleGiven, lookup));
			row.add("price", ItemStackCodec.toJson(pricePaid, lookup));
			Files.writeString(
					file,
					GSON.toJson(row) + System.lineSeparator(),
					StandardCharsets.UTF_8,
					StandardOpenOption.CREATE,
					StandardOpenOption.APPEND);
			trimIfNeeded();
		} catch (IOException e) {
			IsnixMarketMod.LOGGER.warn("Не удалось записать журнал сделки", e);
		}
	}

	private void trimIfNeeded() throws IOException {
		int max = MarketConfig.get().tradeLogMaxLines;
		if (max <= 0 || !Files.exists(file)) {
			return;
		}
		List<String> lines = Files.readAllLines(file, StandardCharsets.UTF_8);
		if (lines.size() <= max) {
			return;
		}
		List<String> tail = lines.subList(lines.size() - max, lines.size());
		Files.write(file, tail, StandardCharsets.UTF_8);
	}

	public void sendRecentTo(ServerPlayerEntity player, int limit) {
		List<JsonObject> rows = loadRecentFor(player.getUuid(), limit);
		if (rows.isEmpty()) {
			player.sendMessage(Text.literal("Журнал сделок пуст.").formatted(Formatting.GRAY), false);
			return;
		}
		player.sendMessage(
				Text.literal("Последние сделки (вы — покупатель или продавец):").formatted(Formatting.GOLD),
				false);
		for (JsonObject row : rows) {
			player.sendMessage(formatRow(row), false);
		}
	}

	private static Text formatRow(JsonObject row) {
		String buyer = row.has("buyerName") ? row.get("buyerName").getAsString() : "?";
		String seller = row.has("sellerName") ? row.get("sellerName").getAsString() : "?";
		int qty = row.has("saleQty") ? row.get("saleQty").getAsInt() : 1;
		String id = row.has("listingId") ? ListingMessages.shortId(UUID.fromString(row.get("listingId").getAsString()))
				: "#?";
		return Text.literal("• ").formatted(Formatting.DARK_GRAY)
				.append(Text.literal(buyer).formatted(Formatting.YELLOW))
				.append(Text.literal(" ← ").formatted(Formatting.GRAY))
				.append(Text.literal(qty + " шт. ").formatted(Formatting.WHITE))
				.append(Text.literal("← ").formatted(Formatting.GRAY))
				.append(Text.literal(seller).formatted(Formatting.AQUA))
				.append(Text.literal(" · ").formatted(Formatting.DARK_GRAY))
				.append(Text.literal(id).formatted(Formatting.GOLD));
	}

	private List<JsonObject> loadRecentFor(UUID playerUuid, int limit) {
		if (!Files.exists(file)) {
			return List.of();
		}
		try {
			List<String> lines = Files.readAllLines(file, StandardCharsets.UTF_8);
			List<JsonObject> matched = new ArrayList<>();
			for (int i = lines.size() - 1; i >= 0 && matched.size() < limit * 4; i--) {
				String line = lines.get(i).trim();
				if (line.isEmpty()) {
					continue;
				}
				JsonObject row = JsonParser.parseString(line).getAsJsonObject();
				String buyer = row.has("buyerUuid") ? row.get("buyerUuid").getAsString() : "";
				String seller = row.has("sellerUuid") ? row.get("sellerUuid").getAsString() : "";
				if (playerUuid.toString().equals(buyer) || playerUuid.toString().equals(seller)) {
					matched.add(row);
				}
			}
			if (matched.size() > limit) {
				return matched.subList(0, limit);
			}
			return matched;
		} catch (Exception e) {
			IsnixMarketMod.LOGGER.warn("Не удалось прочитать trades.jsonl", e);
			return List.of();
		}
	}
}
