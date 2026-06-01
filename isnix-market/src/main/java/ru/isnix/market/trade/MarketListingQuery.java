package ru.isnix.market.trade;

import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.util.Identifier;
import ru.isnix.market.IsnixMarketMod;
import ru.isnix.market.listing.MarketListing;
import ru.isnix.market.screen.MarketSortMode;
import ru.isnix.market.screen.MarketViewMode;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

public final class MarketListingQuery {
	private MarketListingQuery() {
	}

	public static List<MarketListing> browse(
			UUID viewerUuid,
			MarketViewMode viewMode,
			String searchFilter,
			MarketSortMode sort
	) {
		List<MarketListing> base = viewMode == MarketViewMode.MINE
				? IsnixMarketMod.listings().allSortedForSeller(viewerUuid)
				: IsnixMarketMod.listings().allSorted();
		List<MarketListing> filtered = applySearch(base, searchFilter);
		return applySort(filtered, sort);
	}

	public static List<MarketListing> applySearch(List<MarketListing> listings, String searchFilter) {
		if (searchFilter == null || searchFilter.isBlank()) {
			return listings;
		}
		String needle = searchFilter.trim().toLowerCase(Locale.ROOT);
		return listings.stream().filter(l -> matchesSaleItem(l.saleItem(), needle)).toList();
	}

	private static boolean matchesSaleItem(ItemStack sale, String needle) {
		if (sale.isEmpty()) {
			return false;
		}
		Identifier id = Registries.ITEM.getId(sale.getItem());
		String path = id.getPath().toLowerCase(Locale.ROOT);
		String full = id.toString().toLowerCase(Locale.ROOT);
		if (path.contains(needle) || full.contains(needle)) {
			return true;
		}
		String name = sale.getName().getString().toLowerCase(Locale.ROOT);
		return name.contains(needle);
	}

	public static List<MarketListing> applySort(List<MarketListing> listings, MarketSortMode sort) {
		return switch (sort) {
			case NEWEST -> listings;
			case PRICE_ASC -> listings.stream()
					.sorted(Comparator.comparingDouble(MarketListingQuery::unitPricePerSale)
							.thenComparing((MarketListing l) -> l.createdAtEpochMs()).reversed())
					.toList();
			case PRICE_DESC -> listings.stream()
					.sorted(Comparator.comparingDouble(MarketListingQuery::unitPricePerSale).reversed()
							.thenComparingLong(MarketListing::createdAtEpochMs))
					.toList();
			case SELLER -> listings.stream()
					.sorted(Comparator.comparing((MarketListing l) -> l.sellerName().toLowerCase(Locale.ROOT))
							.thenComparingLong(MarketListing::createdAtEpochMs).reversed())
					.toList();
		};
	}

	public static double unitPricePerSale(MarketListing listing) {
		int sale = listing.saleItem().getCount();
		if (sale < 1) {
			return Double.MAX_VALUE;
		}
		int priceOne = MarketPricing.priceCountForSaleQuantity(
				1,
				sale,
				listing.priceItem().getCount());
		return priceOne;
	}

	public static String saleItemLabel(String searchItemId) {
		if (searchItemId == null || searchItemId.isBlank()) {
			return "";
		}
		Identifier id = Identifier.tryParse(searchItemId);
		if (id != null && Registries.ITEM.containsId(id)) {
			return Registries.ITEM.get(id).getName().getString();
		}
		int slash = searchItemId.indexOf(':');
		return slash >= 0 ? searchItemId.substring(slash + 1) : searchItemId;
	}
}
