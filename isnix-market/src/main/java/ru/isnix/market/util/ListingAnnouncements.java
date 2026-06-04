package ru.isnix.market.util;

import net.minecraft.item.ItemStack;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.ClickEvent;
import net.minecraft.text.HoverEvent;
import net.minecraft.text.MutableText;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import ru.isnix.market.MarketConfig;
import ru.isnix.market.listing.MarketListing;

import java.util.UUID;

public final class ListingAnnouncements {
	private ListingAnnouncements() {
	}

	public static void broadcastNewListing(MinecraftServer server, MarketListing listing) {
		if (server == null || !MarketConfig.get().broadcastNewListings) {
			return;
		}
		Text message = buildNewListingMessage(listing);
		for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
			player.sendMessage(message, false);
		}
	}

	public static Text buildNewListingMessage(MarketListing listing) {
		MutableText text = Text.literal("[Рынок] ")
				.formatted(Formatting.DARK_GREEN, Formatting.BOLD)
				.append(Text.literal(listing.sellerName()).formatted(Formatting.YELLOW))
				.append(Text.literal(" выставил ").formatted(Formatting.GRAY))
				.append(stackLabel(listing.saleItem()))
				.append(Text.literal(" за ").formatted(Formatting.GRAY))
				.append(stackLabel(listing.priceItem()))
				.append(Text.literal(" · ").formatted(Formatting.DARK_GRAY))
				.append(buyLink(listing.id()));
		return text;
	}

	private static MutableText stackLabel(ItemStack stack) {
		return Text.literal(stack.getCount() + "× ")
				.formatted(Formatting.WHITE)
				.append(stack.toHoverableText());
	}

	private static MutableText buyLink(UUID listingId) {
		String command = "/sell buy " + listingId;
		MutableText hover = Text.literal("Купить сейчас")
				.formatted(Formatting.WHITE)
				.append(Text.literal("\nНужны ресурсы цены в инвентаре.").formatted(Formatting.GRAY));
		return Text.literal("купить")
				.formatted(Formatting.GREEN, Formatting.BOLD, Formatting.UNDERLINE)
				.styled(style -> style
						.withClickEvent(new ClickEvent.RunCommand(command))
						.withHoverEvent(new HoverEvent.ShowText(hover)));
	}
}
