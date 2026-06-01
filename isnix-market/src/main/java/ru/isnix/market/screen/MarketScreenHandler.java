package ru.isnix.market.screen;

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.inventory.Inventory;
import net.minecraft.inventory.SimpleInventory;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.screen.GenericContainerScreenHandler;
import net.minecraft.screen.ScreenHandlerType;
import net.minecraft.screen.slot.Slot;
import net.minecraft.screen.slot.SlotActionType;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import ru.isnix.market.IsnixMarketMod;
import ru.isnix.market.MarketConfig;
import ru.isnix.market.listing.MarketListing;
import ru.isnix.market.storage.ListingStorage;
import ru.isnix.market.trade.ListingCancelService;
import ru.isnix.market.trade.MarketListingQuery;
import ru.isnix.market.trade.PurchaseService;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Просмотр лотов: только клики, без изъятия предметов из GUI (анти-дюп).
 */
public class MarketScreenHandler extends GenericContainerScreenHandler {
	public static final int PAGE_SIZE = 45;
	public static final int MENU_SIZE = 54;
	public static final int SLOT_PREV = 45;
	public static final int SLOT_SORT = 46;
	public static final int SLOT_FILTER = 47;
	public static final int SLOT_SEARCH = 48;
	public static final int SLOT_CREATE = 49;
	public static final int SLOT_NEXT = 53;

	private final int page;
	private final MarketViewMode viewMode;
	private final UUID viewerUuid;
	private final List<MarketListing> pageListings;
	private final Map<Integer, MarketListing> slotToListing = new HashMap<>();

	public MarketScreenHandler(
			int syncId,
			PlayerInventory playerInventory,
			int page,
			ServerPlayerEntity viewer,
			MarketViewMode viewMode
	) {
		super(ScreenHandlerType.GENERIC_9X6, syncId, playerInventory,
				createDisplayInventory(page, viewer, viewMode), 6);
		this.page = page;
		this.viewMode = viewMode;
		this.viewerUuid = viewer.getUuid();
		this.pageListings = loadPage(page, viewer, viewMode);
		buildSlotMap();
	}

	private static Inventory createDisplayInventory(int page, ServerPlayerEntity viewer, MarketViewMode viewMode) {
		SimpleInventory inv = new SimpleInventory(MENU_SIZE);
		Map<Integer, MarketListing> map = buildCenteredSlotMap(loadPage(page, viewer, viewMode));
		fill(inv, page, map, viewer, viewMode);
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

	private static List<MarketListing> loadPage(int page, ServerPlayerEntity viewer, MarketViewMode viewMode) {
		List<MarketListing> all = browseList(viewer, viewMode);
		int from = page * PAGE_SIZE;
		if (from >= all.size()) {
			return List.of();
		}
		int to = Math.min(from + PAGE_SIZE, all.size());
		return all.subList(from, to);
	}

	private static List<MarketListing> browseList(ServerPlayerEntity viewer, MarketViewMode viewMode) {
		return MarketListingQuery.browse(
				viewer.getUuid(),
				viewMode,
				MarketSession.searchFilter(viewer),
				MarketSession.sortMode(viewer));
	}

	private void buildSlotMap() {
		slotToListing.clear();
		slotToListing.putAll(buildCenteredSlotMap(pageListings));
	}

	private static void fill(
			SimpleInventory inv,
			int page,
			Map<Integer, MarketListing> slotMap,
			ServerPlayerEntity viewer,
			MarketViewMode viewMode
	) {
		UUID viewerUuid = viewer.getUuid();
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
			if (i != SLOT_PREV && i != SLOT_SORT && i != SLOT_FILTER && i != SLOT_SEARCH && i != SLOT_CREATE
					&& i != SLOT_NEXT) {
				inv.setStack(i, MarketScreens.fillerPane());
			}
		}
		List<MarketListing> all = browseList(viewer, viewMode);
		inv.setStack(SLOT_PREV, page > 0 ? MarketScreens.navArrow(false) : MarketScreens.fillerPane());
		boolean hasNext = (page + 1) * PAGE_SIZE < all.size();
		inv.setStack(SLOT_NEXT, hasNext ? MarketScreens.navArrow(true) : MarketScreens.fillerPane());
		int myCount = IsnixMarketMod.listings().countBySeller(viewerUuid);
		int max = MarketConfig.get().maxListingsPerPlayer;
		inv.setStack(SLOT_FILTER, MarketScreens.viewModeButton(viewMode, myCount, max));
		inv.setStack(SLOT_SORT, MarketScreens.sortButton(MarketSession.sortMode(viewer)));
		String search = MarketSession.searchFilter(viewer);
		inv.setStack(SLOT_SEARCH, search != null
				? MarketScreens.clearSearchButton()
				: MarketScreens.searchButton());
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
		if (GuiSlotPolicy.isPlayerSlot(this, slotIndex) && MarketSession.awaitingSearchPick(serverPlayer)) {
			handleSearchPick(serverPlayer, slotIndex);
			return;
		}
		if (GuiSlotPolicy.isMenuSlotIndex(slotIndex, MENU_SIZE)) {
			handleMenuClick(serverPlayer, slotIndex, button, actionType);
		}
	}

	private void handleSearchPick(ServerPlayerEntity player, int slotIndex) {
		Slot slot = slots.get(slotIndex);
		if (slot == null || !slot.hasStack()) {
			player.sendMessage(
					Text.literal("Кликните по предмету в инвентаре внизу (что ищете на рынке).")
							.formatted(Formatting.YELLOW),
					false);
			return;
		}
		ItemStack stack = slot.getStack();
		if (MarketScreens.isDecorStack(stack)) {
			return;
		}
		String id = Registries.ITEM.getId(stack.getItem()).toString();
		MarketSession.setSearchFilter(player, id);
		player.sendMessage(
				Text.literal("Поиск: ").formatted(Formatting.AQUA)
						.append(stack.getName())
						.append(Text.literal(" · /sell clear — сброс").formatted(Formatting.DARK_GRAY)),
				false);
		player.closeHandledScreen();
		MarketScreens.openMarket(player, 0, viewMode);
	}

	private void handleMenuClick(
			ServerPlayerEntity serverPlayer,
			int slotIndex,
			int button,
			SlotActionType actionType
	) {
		if (slotIndex == SLOT_SORT) {
			MarketSortMode next = MarketSession.cycleSortMode(serverPlayer);
			serverPlayer.sendMessage(
					Text.literal("Сортировка: ").formatted(Formatting.GRAY)
							.append(Text.literal(next.label()).formatted(Formatting.AQUA)),
					false);
			serverPlayer.closeHandledScreen();
			MarketScreens.openMarket(serverPlayer, 0, viewMode);
			return;
		}
		if (slotIndex == SLOT_SEARCH) {
			if (MarketSession.searchFilter(serverPlayer) != null) {
				MarketSession.clearSearch(serverPlayer);
				serverPlayer.sendMessage(Text.literal("Поиск сброшен.").formatted(Formatting.GRAY), false);
				serverPlayer.closeHandledScreen();
				MarketScreens.openMarket(serverPlayer, 0, viewMode);
				return;
			}
			MarketSession.beginSearchPick(serverPlayer);
			serverPlayer.sendMessage(
					Text.literal("Кликните предмет в инвентаре внизу — по нему отфильтруем лоты.")
							.formatted(Formatting.YELLOW),
					false);
			serverPlayer.sendMessage(
					Text.literal("Или: /sell search <название>, напр. gunpowder")
							.formatted(Formatting.DARK_GRAY),
					false);
			return;
		}
		if (slotIndex == SLOT_FILTER) {
			MarketViewMode next = viewMode == MarketViewMode.ALL ? MarketViewMode.MINE : MarketViewMode.ALL;
			MarketSession.setViewMode(serverPlayer, next);
			serverPlayer.closeHandledScreen();
			MarketScreens.openMarket(serverPlayer, 0, next);
			return;
		}
		if (slotIndex == SLOT_CREATE) {
			serverPlayer.closeHandledScreen();
			MarketScreens.openCreate(serverPlayer);
			return;
		}
		if (slotIndex == SLOT_PREV && page > 0) {
			serverPlayer.closeHandledScreen();
			MarketScreens.openMarket(serverPlayer, page - 1, viewMode);
			return;
		}
		if (slotIndex == SLOT_NEXT) {
			if ((page + 1) * PAGE_SIZE < browseList(serverPlayer, viewMode).size()) {
				serverPlayer.closeHandledScreen();
				MarketScreens.openMarket(serverPlayer, page + 1, viewMode);
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
			MarketScreens.openMarket(serverPlayer, page, viewMode);
			return;
		}
		if (serverPlayer.isSneaking() && button == 1 && fresh.sellerUuid().equals(serverPlayer.getUuid())) {
			if (ListingCancelService.cancel(serverPlayer, fresh)) {
				serverPlayer.closeHandledScreen();
				MarketScreens.openMarket(serverPlayer, page, viewMode);
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
		serverPlayer.closeHandledScreen();
		MarketScreens.openBuy(serverPlayer, fresh.id(), page, viewMode);
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
