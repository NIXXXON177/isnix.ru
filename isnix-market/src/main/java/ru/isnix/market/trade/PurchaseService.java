package ru.isnix.market.trade;

import net.minecraft.item.ItemStack;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import ru.isnix.market.IsnixMarketMod;
import ru.isnix.market.listing.MarketListing;
import ru.isnix.market.util.InventoryHelper;
import ru.isnix.market.util.ListingMessages;
import ru.isnix.market.util.MarketSounds;

import java.util.UUID;

public final class PurchaseService {
	public enum Result {
		SUCCESS,
		OWN_LISTING,
		NOT_ENOUGH_ITEMS,
		NOT_FOUND,
		INVENTORY_FULL,
		INVALID_AMOUNT
	}

	private PurchaseService() {
	}

	/** Покупка всего оставшегося лота. */
	public static Result tryPurchase(ServerPlayerEntity buyer, MarketListing listing) {
		return tryPurchaseQuantity(buyer, listing.id(), listing.saleItem().getCount());
	}

	public static Result tryPurchaseQuantity(ServerPlayerEntity buyer, UUID listingId, int buySaleQty) {
		MarketListing listing = IsnixMarketMod.listings().find(listingId).orElse(null);
		if (listing == null) {
			return Result.NOT_FOUND;
		}
		if (listing.sellerUuid().equals(buyer.getUuid())) {
			return Result.OWN_LISTING;
		}
		int saleTotal = listing.saleItem().getCount();
		if (buySaleQty < 1 || buySaleQty > saleTotal) {
			return Result.INVALID_AMOUNT;
		}

		ItemStack pricePay = MarketPricing.priceStackForSaleQuantity(listing, buySaleQty);
		ItemStack saleGive = MarketPricing.saleStackForQuantity(listing, buySaleQty);

		if (!InventoryHelper.hasItems(buyer, pricePay)) {
			return Result.NOT_ENOUGH_ITEMS;
		}
		if (!InventoryHelper.removeItems(buyer, pricePay)) {
			return Result.NOT_ENOUGH_ITEMS;
		}

		listing = IsnixMarketMod.listings().find(listingId).orElse(null);
		if (listing == null) {
			InventoryHelper.giveOrDrop(buyer, pricePay);
			return Result.NOT_FOUND;
		}
		saleTotal = listing.saleItem().getCount();
		if (buySaleQty > saleTotal) {
			InventoryHelper.giveOrDrop(buyer, pricePay);
			return Result.NOT_FOUND;
		}

		int remainingSale = saleTotal - buySaleQty;
		int remainingPrice = listing.priceItem().getCount() - pricePay.getCount();
		boolean removed;
		if (remainingSale <= 0) {
			removed = IsnixMarketMod.listings().remove(listingId);
		} else {
			MarketListing updated = listing.withStacks(
					listing.saleItem().copyWithCount(remainingSale),
					listing.priceItem().copyWithCount(remainingPrice));
			removed = IsnixMarketMod.listings().replace(updated);
		}
		if (!removed) {
			InventoryHelper.giveOrDrop(buyer, pricePay);
			return Result.NOT_FOUND;
		}

		InventoryHelper.giveOrDrop(buyer, saleGive);
		paySeller(buyer.getServer(), listing, saleGive, pricePay);
		MarketSounds.playPurchase(buyer);

		buyer.sendMessage(
				Text.literal("Покупка: ")
						.formatted(Formatting.GREEN)
						.append(saleGive.toHoverableText())
						.append(Text.literal(" за ").formatted(Formatting.GRAY))
						.append(pricePay.toHoverableText())
						.append(Text.literal("\n").formatted(Formatting.GRAY))
						.append(ListingMessages.idLine(listing.id())),
				false
		);
		if (IsnixMarketMod.trades() != null) {
			IsnixMarketMod.trades().recordPurchase(
					listing,
					buyer.getUuid(),
					buyer.getName().getString(),
					buySaleQty,
					saleGive,
					pricePay);
		}
		return Result.SUCCESS;
	}

	private static void paySeller(
			MinecraftServer server,
			MarketListing listing,
			ItemStack salePart,
			ItemStack pricePart
	) {
		ServerPlayerEntity seller = server.getPlayerManager().getPlayer(listing.sellerUuid());
		if (seller != null) {
			InventoryHelper.giveOrDrop(seller, pricePart);
			seller.sendMessage(ListingMessages.soldToBuyer(listing.id(), salePart, pricePart), false);
			MarketSounds.playSellerSale(seller);
		} else {
			IsnixMarketMod.payouts().add(listing.sellerUuid(), pricePart);
		}
	}

	public static Text messageFor(Result result) {
		return switch (result) {
			case SUCCESS -> Text.literal("Сделка завершена.").formatted(Formatting.GREEN);
			case OWN_LISTING -> Text.literal("Нельзя купить свой лот.").formatted(Formatting.RED);
			case NOT_ENOUGH_ITEMS -> Text.literal("Недостаточно ресурсов для оплаты.").formatted(Formatting.RED);
			case NOT_FOUND -> Text.literal("Лот уже продан или снят.").formatted(Formatting.RED);
			case INVENTORY_FULL -> Text.literal("Освободите место в инвентаре.").formatted(Formatting.RED);
			case INVALID_AMOUNT -> Text.literal("Неверное количество для покупки.").formatted(Formatting.RED);
		};
	}
}
