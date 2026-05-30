package ru.isnix.market.screen;

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.inventory.Inventory;
import net.minecraft.inventory.SimpleInventory;
import net.minecraft.item.ItemStack;
import net.minecraft.screen.GenericContainerScreenHandler;
import net.minecraft.screen.ScreenHandlerType;
import net.minecraft.screen.slot.Slot;
import net.minecraft.screen.slot.SlotActionType;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import ru.isnix.market.IsnixMarketMod;
import ru.isnix.market.listing.MarketListing;
import ru.isnix.market.storage.ListingStorage;
import ru.isnix.market.trade.ListingCancelService;
import ru.isnix.market.trade.PurchaseService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Просмотр лотов: только клики, без изъятия предметов из GUI (анти-дюп).
 */
public class MarketScreenHandler extends GenericContainerScreenHandler {
	public static final int PAGE_SIZE = 45;
	public static final int MENU_SIZE = 54;
	public static final int SLOT_PREV = 45;
	public static final int SLOT_CREATE = 49;
	public static final int SLOT_NEXT = 53;

	private final int page;
	private final List<MarketListing> pageListings;
	private final Map<Integer, MarketListing> slotToListing = new HashMap<>();

	public MarketScreenHandler(int syncId, PlayerInventory playerInventory, int page, ServerPlayerEntity viewer) {
		super(ScreenHandlerType.GENERIC_9X6, syncId, playerInventory, createDisplayInventory(page, viewer), 6);
		this.page = page;
		this.pageListings = loadPage(page);
		buildSlotMap();
	}

	private static Inventory createDisplayInventory(int page, ServerPlayerEntity viewer) {
		SimpleInventory inv = new SimpleInventory(MENU_SIZE);
		Map<Integer, MarketListing> map = buildCenteredSlotMap(loadPage(page));
		fill(inv, page, map, viewer != null ? viewer.getUuid() : null);
		return inv;
	}

	private static Map<Integer, MarketListing> buildCenteredSlotMap(List<MarketListing> slice) {
		Map<Integer, MarketListing> map = new HashMap<>();
		int n = slice.size();
		if (n == 0) {
			return map;
		}
		int cols = 9;
		int rows = (n + cols - 1) / cols;
		int topRow = (5 - rows) / 2;
		int idx = 0;
		for (int r = 0; r < rows && idx < n; r++) {
			int inRow = Math.min(cols, n - idx);
			int leftPad = (cols - inRow) / 2;
			for (int c = 0; c < inRow; c++) {
				int slot = (topRow + r) * cols + leftPad + c;
				if (slot < PAGE_SIZE) {
					map.put(slot, slice.get(idx++));
				}
			}
		}
		return map;
	}

	private static List<MarketListing> loadPage(int page) {
		List<MarketListing> all = IsnixMarketMod.listings().allSorted();
		int from = page * PAGE_SIZE;
		if (from >= all.size()) {
			return List.of();
		}
		int to = Math.min(from + PAGE_SIZE, all.size());
		return all.subList(from, to);
	}

	private void buildSlotMap() {
		slotToListing.clear();
		slotToListing.putAll(buildCenteredSlotMap(pageListings));
	}

	private static void fill(
			SimpleInventory inv,
			int page,
			Map<Integer, MarketListing> slotMap,
			java.util.UUID viewerUuid
	) {
		for (int i = 0; i < PAGE_SIZE; i++) {
			inv.setStack(i, ItemStack.EMPTY);
		}
		for (var entry : slotMap.entrySet()) {
			MarketListing listing = entry.getValue();
			ItemStack display = listing.saleItem().copy();
			display.set(net.minecraft.component.DataComponentTypes.LORE,
					new net.minecraft.component.type.LoreComponent(
							ListingStorage.listingLore(listing, viewerUuid)));
			inv.setStack(entry.getKey(), display);
		}
		for (int i = PAGE_SIZE; i < MENU_SIZE; i++) {
			inv.setStack(i, MarketScreens.fillerPane());
		}
		inv.setStack(SLOT_PREV, page > 0 ? MarketScreens.navArrow(false) : MarketScreens.fillerPane());
		List<MarketListing> all = IsnixMarketMod.listings().allSorted();
		boolean hasNext = (page + 1) * PAGE_SIZE < all.size();
		inv.setStack(SLOT_NEXT, hasNext ? MarketScreens.navArrow(true) : MarketScreens.fillerPane());
		inv.setStack(SLOT_CREATE, MarketScreens.createButton());
	}

	@Override
	public boolean canInsertIntoSlot(ItemStack stack, Slot slot) {
		return GuiSlotPolicy.isPlayerSlot(this, slot.id);
	}

	@Override
	public void onSlotClick(int slotIndex, int button, SlotActionType actionType, PlayerEntity player) {
		if (!(player instanceof ServerPlayerEntity serverPlayer)) {
			return;
		}
		if (GuiSlotPolicy.isMenuSlotIndex(slotIndex, MENU_SIZE)) {
			handleMenuClick(serverPlayer, slotIndex, button, actionType);
		}
	}

	private void handleMenuClick(
			ServerPlayerEntity serverPlayer,
			int slotIndex,
			int button,
			SlotActionType actionType
	) {
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
		MarketListing listing = listingAtDisplaySlot(slotIndex);
		if (listing == null) {
			return;
		}
		var fresh = IsnixMarketMod.listings().find(listing.id()).orElse(null);
		if (fresh == null) {
			serverPlayer.sendMessage(PurchaseService.messageFor(PurchaseService.Result.NOT_FOUND), false);
			serverPlayer.closeHandledScreen();
			MarketScreens.openMarket(serverPlayer, page);
			return;
		}
		// Shift+ПКМ — снять свой лот, предмет вернётся в инвентарь
		if (serverPlayer.isSneaking() && button == 1 && fresh.sellerUuid().equals(serverPlayer.getUuid())) {
			if (ListingCancelService.cancel(serverPlayer, fresh)) {
				serverPlayer.closeHandledScreen();
				MarketScreens.openMarket(serverPlayer, page);
			}
			return;
		}
		if (fresh.sellerUuid().equals(serverPlayer.getUuid())) {
			serverPlayer.sendMessage(
					Text.literal("Свой лот: Shift+ПКМ — снять, /sell cancel " + fresh.id())
							.formatted(Formatting.YELLOW),
					false
			);
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

	private MarketListing listingAtDisplaySlot(int slotIndex) {
		return slotToListing.get(slotIndex);
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
