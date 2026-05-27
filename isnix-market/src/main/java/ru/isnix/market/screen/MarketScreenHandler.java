package ru.isnix.market.screen;

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.inventory.Inventory;
import net.minecraft.inventory.SimpleInventory;
import net.minecraft.item.ItemStack;
import net.minecraft.screen.GenericContainerScreenHandler;
import net.minecraft.screen.ScreenHandlerType;
import net.minecraft.screen.slot.SlotActionType;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import ru.isnix.market.IsnixMarketMod;
import ru.isnix.market.listing.MarketListing;
import ru.isnix.market.storage.ListingStorage;
import ru.isnix.market.trade.PurchaseService;

import java.util.List;

public class MarketScreenHandler extends GenericContainerScreenHandler {
	public static final int PAGE_SIZE = 45;
	public static final int SLOT_PREV = 45;
	public static final int SLOT_CREATE = 49;
	public static final int SLOT_NEXT = 53;

	private final int page;
	private final List<MarketListing> pageListings;

	public MarketScreenHandler(int syncId, PlayerInventory playerInventory, int page) {
		super(ScreenHandlerType.GENERIC_9X6, syncId, playerInventory, createDisplayInventory(page), 6);
		this.page = page;
		this.pageListings = loadPage(page);
	}

	private static Inventory createDisplayInventory(int page) {
		SimpleInventory inv = new SimpleInventory(54);
		fill(inv, page);
		return inv;
	}

	private static List<MarketListing> loadPage(int page) {
		List<MarketListing> all = IsnixMarketMod.listings().allSorted();
		int from = page * PAGE_SIZE;
		int to = Math.min(from + PAGE_SIZE, all.size());
		if (from >= all.size()) {
			return List.of();
		}
		return all.subList(from, to);
	}

	private static void fill(SimpleInventory inv, int page) {
		List<MarketListing> slice = loadPage(page);
		for (int i = 0; i < PAGE_SIZE; i++) {
			if (i < slice.size()) {
				MarketListing listing = slice.get(i);
				ItemStack display = listing.saleItem().copy();
				display.set(net.minecraft.component.DataComponentTypes.LORE,
						new net.minecraft.component.type.LoreComponent(
								List.of(ListingStorage.listingLore(listing))));
				inv.setStack(i, display);
			} else {
				inv.setStack(i, ItemStack.EMPTY);
			}
		}
		for (int i = PAGE_SIZE; i < 54; i++) {
			inv.setStack(i, MarketScreens.fillerPane());
		}
		inv.setStack(SLOT_PREV, page > 0 ? MarketScreens.navArrow(false) : MarketScreens.fillerPane());
		List<MarketListing> all = IsnixMarketMod.listings().allSorted();
		boolean hasNext = (page + 1) * PAGE_SIZE < all.size();
		inv.setStack(SLOT_NEXT, hasNext ? MarketScreens.navArrow(true) : MarketScreens.fillerPane());
		inv.setStack(SLOT_CREATE, MarketScreens.createButton());
	}

	@Override
	public void onSlotClick(int slotIndex, int button, SlotActionType actionType, PlayerEntity player) {
		if (!(player instanceof ServerPlayerEntity serverPlayer)) {
			return;
		}
		if (actionType == SlotActionType.QUICK_MOVE || slotIndex < 0 || slotIndex >= 54) {
			return;
		}
		if (slotIndex == SLOT_CREATE) {
			serverPlayer.closeHandledScreen();
			MarketScreens.openCreate(serverPlayer);
			return;
		}
		if (slotIndex == SLOT_PREV && page > 0) {
			serverPlayer.closeHandledScreen();
			MarketScreens.openMarket(serverPlayer, page - 1);
			return;
		}
		if (slotIndex == SLOT_NEXT) {
			List<MarketListing> all = IsnixMarketMod.listings().allSorted();
			if ((page + 1) * PAGE_SIZE < all.size()) {
				serverPlayer.closeHandledScreen();
				MarketScreens.openMarket(serverPlayer, page + 1);
			}
			return;
		}
		if (slotIndex < PAGE_SIZE && slotIndex < pageListings.size()) {
			MarketListing listing = pageListings.get(slotIndex);
			var fresh = IsnixMarketMod.listings().find(listing.id()).orElse(null);
			if (fresh == null) {
				serverPlayer.sendMessage(PurchaseService.messageFor(PurchaseService.Result.NOT_FOUND), false);
				serverPlayer.closeHandledScreen();
				MarketScreens.openMarket(serverPlayer, page);
				return;
			}
			PurchaseService.Result result = PurchaseService.tryPurchase(serverPlayer, fresh);
			if (result == PurchaseService.Result.SUCCESS) {
				serverPlayer.closeHandledScreen();
				MarketScreens.openMarket(serverPlayer, page);
			} else {
				serverPlayer.sendMessage(PurchaseService.messageFor(result), false);
			}
		}
	}

	@Override
	public ItemStack quickMove(PlayerEntity player, int slot) {
		return ItemStack.EMPTY;
	}

	@Override
	public boolean canUse(PlayerEntity player) {
		return true;
	}
}
