package ru.isnix.market.storage;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import net.minecraft.server.MinecraftServer;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import ru.isnix.market.IsnixMarketMod;
import ru.isnix.market.MarketConfig;
import ru.isnix.market.listing.MarketListing;
import ru.isnix.market.util.ItemStackCodec;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;

public class ListingStorage {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

	private final Path file;
	private final MinecraftServer server;
	private final CopyOnWriteArrayList<MarketListing> listings = new CopyOnWriteArrayList<>();

	public ListingStorage(MinecraftServer server) {
		this.server = server;
		this.file = server.getRunDirectory().resolve("config/isnix-market/listings.json");
	}

	public List<MarketListing> allSorted() {
		return listings.stream()
				.sorted(Comparator.comparingLong(MarketListing::createdAtEpochMs).reversed())
				.toList();
	}

	public int countBySeller(UUID seller) {
		int n = 0;
		for (MarketListing l : listings) {
			if (l.sellerUuid().equals(seller)) {
				n++;
			}
		}
		return n;
	}

	public Optional<MarketListing> find(UUID id) {
		return listings.stream().filter(l -> l.id().equals(id)).findFirst();
	}

	public boolean add(MarketListing listing) {
		MarketConfig.MarketConfigData cfg = MarketConfig.get();
		if (listings.size() >= cfg.maxListingsTotal) {
			return false;
		}
		if (countBySeller(listing.sellerUuid()) >= cfg.maxListingsPerPlayer) {
			return false;
		}
		listings.add(listing);
		save();
		return true;
	}

	public boolean remove(UUID id) {
		boolean removed = listings.removeIf(l -> l.id().equals(id));
		if (removed) {
			save();
		}
		return removed;
	}

	public void load() {
		listings.clear();
		try {
			if (!Files.exists(file)) {
				return;
			}
			JsonObject root = GSON.fromJson(Files.readString(file), JsonObject.class);
			if (root == null || !root.has("listings")) {
				return;
			}
			var lookup = server.getRegistryManager();
			JsonArray arr = root.getAsJsonArray("listings");
			for (var el : arr) {
				try {
					MarketListing listing = MarketListing.fromJson(el.getAsJsonObject(), lookup);
					if (!listing.saleItem().isEmpty() && !listing.priceItem().isEmpty()) {
						listings.add(listing);
					}
				} catch (Exception e) {
					IsnixMarketMod.LOGGER.warn("Пропуск битого лота: {}", e.getMessage());
				}
			}
			pruneExpired();
		} catch (IOException e) {
			IsnixMarketMod.LOGGER.error("Не удалось загрузить listings.json", e);
		}
	}

	public void save() {
		try {
			Files.createDirectories(file.getParent());
			JsonObject root = new JsonObject();
			JsonArray arr = new JsonArray();
			var lookup = server.getRegistryManager();
			for (MarketListing listing : listings) {
				arr.add(listing.toJson(lookup));
			}
			root.add("listings", arr);
			Files.writeString(file, GSON.toJson(root));
		} catch (IOException e) {
			IsnixMarketMod.LOGGER.error("Не удалось сохранить listings.json", e);
		}
	}

	public void pruneExpired() {
		long days = MarketConfig.get().listingsExpireDays;
		if (days <= 0) {
			return;
		}
		long cutoff = System.currentTimeMillis() - days * 86_400_000L;
		boolean changed = listings.removeIf(l -> l.createdAtEpochMs() < cutoff);
		if (changed) {
			save();
		}
	}

	public static Text listingLore(MarketListing listing, java.util.UUID viewerUuid) {
		var price = listing.priceItem();
		var sale = listing.saleItem();
		var lore = Text.empty()
				.append(Text.literal("ID: ").formatted(Formatting.DARK_GRAY))
				.append(Text.literal(ru.isnix.market.util.ListingMessages.shortId(listing.id()))
						.formatted(Formatting.GOLD))
				.append(Text.literal("\nПродавец: ").formatted(Formatting.GRAY))
				.append(Text.literal(listing.sellerName()).formatted(Formatting.YELLOW))
				.append(Text.literal("\nЦена: ").formatted(Formatting.GRAY))
				.append(Text.literal(price.getCount() + "× ").formatted(Formatting.WHITE))
				.append(price.getName())
				.append(Text.literal("\nЛот: ").formatted(Formatting.GRAY))
				.append(Text.literal(sale.getCount() + "× ").formatted(Formatting.WHITE))
				.append(sale.getName());
		if (viewerUuid != null && listing.sellerUuid().equals(viewerUuid)) {
			lore = lore.append(Text.literal("\n\nShift+ПКМ — снять лот").formatted(Formatting.RED));
		} else {
			lore = lore.append(Text.literal("\n\nЛКМ — купить").formatted(Formatting.GREEN));
		}
		return lore;
	}
}
