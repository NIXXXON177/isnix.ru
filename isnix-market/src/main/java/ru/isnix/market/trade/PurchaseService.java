package ru.isnix.market.trade;

import net.minecraft.item.ItemStack;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import ru.isnix.market.IsnixMarketMod;
import ru.isnix.market.listing.MarketListing;
import ru.isnix.market.util.InventoryHelper;
import ru.isnix.market.util.MarketSounds;

public final class PurchaseService {
	public enum Result {
		SUCCESS,
		OWN_LISTING,
		NOT_ENOUGH_ITEMS,
		NOT_FOUND,
		INVENTORY_FULL
	}

	private PurchaseService() {
	}

	public static Result tryPurchase(ServerPlayerEntity buyer, MarketListing listing) {
		if (listing.sellerUuid().equals(buyer.getUuid())) {
			return Result.OWN_LISTING;
		}
		ItemStack price = listing.priceItem();
		ItemStack sale = listing.saleItem();
		if (!InventoryHelper.hasItems(buyer, price)) {
			return Result.NOT_ENOUGH_ITEMS;
		}
		if (!buyer.getInventory().getEmptySlot() && !InventoryHelper.hasItems(buyer, sale)) {
			// allow if can stack with existing
			boolean canFit = false;
			for (ItemStack stack : buyer.getInventory().main) {
				if (stack.isEmpty() || ItemStack.areItemsAndComponentsEqual(stack, sale)) {
					canFit = true;
					break;
				}
			}
			if (!canFit) {
				return Result.INVENTORY_FULL;
			}
		}

		if (!InventoryHelper.removeItems(buyer, price)) {
			return Result.NOT_ENOUGH_ITEMS;
		}
		if (!IsnixMarketMod.listings().remove(listing.id())) {
			InventoryHelper.giveOrDrop(buyer, price);
			return Result.NOT_FOUND;
		}

		InventoryHelper.giveOrDrop(buyer, sale);
		paySeller(buyer.getServer(), listing, price);
		MarketSounds.playPurchase(buyer);

		buyer.sendMessage(
				Text.literal("Покупка: ")
						.formatted(Formatting.GREEN)
						.append(sale.toHoverableText())
						.append(Text.literal(" за ").formatted(Formatting.GRAY))
						.append(price.toHoverableText()),
				false
		);
		return Result.SUCCESS;
	}

	private static void paySeller(MinecraftServer server, MarketListing listing, ItemStack price) {
		ServerPlayerEntity seller = server.getPlayerManager().getPlayer(listing.sellerUuid());
		if (seller != null) {
			InventoryHelper.giveOrDrop(seller, price);
			seller.sendMessage(
					Text.literal("Продано: ")
							.formatted(Formatting.GOLD)
							.append(listing.saleItem().toHoverableText())
							.append(Text.literal(" — оплата ").formatted(Formatting.GRAY))
							.append(price.toHoverableText()),
					false
			);
		} else {
			IsnixMarketMod.payouts().add(listing.sellerUuid(), price);
		}
	}

	public static Text messageFor(Result result) {
		return switch (result) {
			case SUCCESS -> Text.literal("Сделка завершена.").formatted(Formatting.GREEN);
			case OWN_LISTING -> Text.literal("Нельзя купить свой лот.").formatted(Formatting.RED);
			case NOT_ENOUGH_ITEMS -> Text.literal("Недостаточно ресурсов для оплаты.").formatted(Formatting.RED);
			case NOT_FOUND -> Text.literal("Лот уже продан или снят.").formatted(Formatting.RED);
			case INVENTORY_FULL -> Text.literal("Освободите место в инвентаре.").formatted(Formatting.RED);
		};
	}
}
