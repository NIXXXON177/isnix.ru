package ru.isnix.market.trade;

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import ru.isnix.market.listing.MarketListing;
import ru.isnix.market.util.InventoryHelper;

/**
 * Пропорциональная цена: 32 пороха за 32 палки → 1 порох = 1 палка.
 */
public final class MarketPricing {
	private MarketPricing() {
	}

	/** Сколько предметов оплаты за {@code buySaleQty} единиц товара (округление вверх). */
	public static int priceCountForSaleQuantity(int buySaleQty, int saleTotal, int priceTotal) {
		if (buySaleQty <= 0 || saleTotal <= 0 || priceTotal <= 0) {
			return 0;
		}
		if (buySaleQty >= saleTotal) {
			return priceTotal;
		}
		return (buySaleQty * priceTotal + saleTotal - 1) / saleTotal;
	}

	public static ItemStack priceStackForSaleQuantity(MarketListing listing, int buySaleQty) {
		int saleTotal = listing.saleItem().getCount();
		int priceTotal = listing.priceItem().getCount();
		int count = priceCountForSaleQuantity(buySaleQty, saleTotal, priceTotal);
		return listing.priceItem().copyWithCount(count);
	}

	public static ItemStack saleStackForQuantity(MarketListing listing, int buySaleQty) {
		return listing.saleItem().copyWithCount(Math.min(buySaleQty, listing.saleItem().getCount()));
	}

	public static int maxAffordableSaleQuantity(PlayerEntity buyer, MarketListing listing) {
		int max = listing.saleItem().getCount();
		while (max > 0) {
			if (InventoryHelper.hasItems(buyer, priceStackForSaleQuantity(listing, max))) {
				return max;
			}
			max--;
		}
		return 0;
	}

	public static int clampQuantity(MarketListing listing, int requested) {
		int max = listing.saleItem().getCount();
		if (requested < 1) {
			return 1;
		}
		return Math.min(requested, max);
	}
}
