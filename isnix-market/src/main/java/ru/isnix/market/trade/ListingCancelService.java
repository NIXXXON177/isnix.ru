package ru.isnix.market.trade;

import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import ru.isnix.market.IsnixMarketMod;
import ru.isnix.market.PermissionChecks;
import ru.isnix.market.listing.MarketListing;
import ru.isnix.market.util.InventoryHelper;
import ru.isnix.market.util.ListingMessages;

import java.util.UUID;

public final class ListingCancelService {
	private ListingCancelService() {
	}

	public static boolean cancel(ServerPlayerEntity player, UUID listingId) {
		MarketListing listing = IsnixMarketMod.listings().find(listingId).orElse(null);
		if (listing == null) {
			player.sendMessage(Text.literal("Лот не найден или уже снят.").formatted(Formatting.RED), false);
			return false;
		}
		return cancel(player, listing);
	}

	public static boolean cancel(ServerPlayerEntity player, MarketListing listing) {
		if (!listing.sellerUuid().equals(player.getUuid()) && !PermissionChecks.playerAtLeast(player, 2)) {
			player.sendMessage(Text.literal("Это не ваш лот.").formatted(Formatting.RED), false);
			return false;
		}
		if (!IsnixMarketMod.listings().remove(listing.id())) {
			player.sendMessage(Text.literal("Лот уже продан или снят.").formatted(Formatting.RED), false);
			return false;
		}
		InventoryHelper.giveOrDrop(player, listing.saleItem());
		player.sendMessage(ListingMessages.cancelled(listing.id()), false);
		return true;
	}
}
