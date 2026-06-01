package ru.isnix.market.screen;

import net.minecraft.item.ItemStack;
import net.minecraft.server.network.ServerPlayerEntity;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Черновик окна «Выставить лот» между переключениями GUI. */
public final class MarketSession {
	public static final class CreateDraft {
		public ItemStack sale = ItemStack.EMPTY;
		public ItemStack price = ItemStack.EMPTY;
	}

	public static final class BuyContext {
		public UUID listingId;
		public int marketPage;
		public MarketViewMode marketViewMode = MarketViewMode.ALL;
		public int quantity = 1;
	}

	private static final Map<UUID, CreateDraft> DRAFTS = new ConcurrentHashMap<>();
	private static final Map<UUID, BuyContext> BUY = new ConcurrentHashMap<>();
	private static final Map<UUID, MarketViewMode> VIEW_MODE = new ConcurrentHashMap<>();
	private static final Map<UUID, MarketSortMode> SORT_MODE = new ConcurrentHashMap<>();
	private static final Map<UUID, String> SEARCH_FILTER = new ConcurrentHashMap<>();
	private static final Map<UUID, Boolean> AWAITING_SEARCH = new ConcurrentHashMap<>();

	private MarketSession() {
	}

	public static CreateDraft draft(ServerPlayerEntity player) {
		return DRAFTS.computeIfAbsent(player.getUuid(), u -> new CreateDraft());
	}

	public static void clearDraft(ServerPlayerEntity player) {
		DRAFTS.remove(player.getUuid());
	}

	public static void applyPricePreset(ServerPlayerEntity player, ItemStack chosen) {
		CreateDraft d = draft(player);
		if (chosen == null || chosen.isEmpty()) {
			return;
		}
		d.price = chosen.copy();
	}

	public static BuyContext buy(ServerPlayerEntity player) {
		return BUY.computeIfAbsent(player.getUuid(), u -> new BuyContext());
	}

	public static void clearBuy(ServerPlayerEntity player) {
		BUY.remove(player.getUuid());
	}

	public static void startBuy(
			ServerPlayerEntity player,
			UUID listingId,
			int marketPage,
			MarketViewMode marketViewMode
	) {
		BuyContext ctx = buy(player);
		ctx.listingId = listingId;
		ctx.marketPage = marketPage;
		ctx.marketViewMode = marketViewMode;
		ctx.quantity = 1;
	}

	public static MarketViewMode viewMode(ServerPlayerEntity player) {
		return VIEW_MODE.getOrDefault(player.getUuid(), MarketViewMode.ALL);
	}

	public static void setViewMode(ServerPlayerEntity player, MarketViewMode mode) {
		VIEW_MODE.put(player.getUuid(), mode);
	}

	public static MarketSortMode sortMode(ServerPlayerEntity player) {
		return SORT_MODE.getOrDefault(player.getUuid(), MarketSortMode.NEWEST);
	}

	public static void setSortMode(ServerPlayerEntity player, MarketSortMode mode) {
		SORT_MODE.put(player.getUuid(), mode);
	}

	public static MarketSortMode cycleSortMode(ServerPlayerEntity player) {
		MarketSortMode next = sortMode(player).next();
		setSortMode(player, next);
		return next;
	}

	public static String searchFilter(ServerPlayerEntity player) {
		return SEARCH_FILTER.get(player.getUuid());
	}

	public static void setSearchFilter(ServerPlayerEntity player, String itemIdOrNull) {
		if (itemIdOrNull == null || itemIdOrNull.isBlank()) {
			SEARCH_FILTER.remove(player.getUuid());
		} else {
			SEARCH_FILTER.put(player.getUuid(), itemIdOrNull.trim());
		}
		AWAITING_SEARCH.remove(player.getUuid());
	}

	public static void clearSearch(ServerPlayerEntity player) {
		setSearchFilter(player, null);
	}

	public static boolean awaitingSearchPick(ServerPlayerEntity player) {
		return Boolean.TRUE.equals(AWAITING_SEARCH.get(player.getUuid()));
	}

	public static void beginSearchPick(ServerPlayerEntity player) {
		AWAITING_SEARCH.put(player.getUuid(), true);
	}
}
