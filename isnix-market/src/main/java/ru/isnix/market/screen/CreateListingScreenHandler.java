package ru.isnix.market.screen;

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.player.PlayerInventory;
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
import ru.isnix.market.MarketConfig;
import ru.isnix.market.MarketItemRules;
import ru.isnix.market.listing.MarketListing;
import ru.isnix.market.util.InventoryHelper;
import ru.isnix.market.trade.MarketRatioGuard;
import ru.isnix.market.util.ListingAnnouncements;
import ru.isnix.market.util.ListingMessages;
import ru.isnix.market.util.MarketGuideHook;

/**
 * Окно «Выставить лот»: товар и цена — из инвентаря игрока (списание только товара при подтверждении).
 */
public class CreateListingScreenHandler extends GenericContainerScreenHandler {
	public static final int MENU_SIZE = 27;
	public static final int SLOT_PICK_SALE = 10;
	public static final int SLOT_SALE = 11;
	public static final int SLOT_PICK_PRICE = 12;
	public static final int SLOT_PRICE = 13;
	public static final int SLOT_PRICE_MINUS = 14;
	public static final int SLOT_PRICE_PLUS = 15;
	public static final int SLOT_CONFIRM = 22;

	private final SimpleInventory container;
	private final MarketSession.CreateDraft draft;

	public CreateListingScreenHandler(int syncId, PlayerInventory playerInventory) {
		super(ScreenHandlerType.GENERIC_9X3, syncId, playerInventory, buildInventory(playerInventory.player), 3);
		this.container = (SimpleInventory) getInventory();
		if (playerInventory.player instanceof ServerPlayerEntity serverPlayer) {
			this.draft = MarketSession.draft(serverPlayer);
			refreshDisplayStacks();
		} else {
			this.draft = new MarketSession.CreateDraft();
		}
	}

	private static SimpleInventory buildInventory(PlayerEntity player) {
		SimpleInventory inv = new SimpleInventory(MENU_SIZE);
		for (int i = 0; i < MENU_SIZE; i++) {
			if (i == SLOT_CONFIRM) {
				inv.setStack(i, MarketScreens.confirmButton());
			} else if (i == SLOT_PICK_SALE) {
				inv.setStack(i, MarketScreens.pickSaleButton());
			} else if (i == SLOT_PICK_PRICE) {
				inv.setStack(i, MarketScreens.pickPriceButton());
			} else if (i == SLOT_SALE || i == SLOT_PRICE) {
				inv.setStack(i, ItemStack.EMPTY);
			} else if (i == SLOT_PRICE_MINUS) {
				inv.setStack(i, MarketScreens.countButton(false));
			} else if (i == SLOT_PRICE_PLUS) {
				inv.setStack(i, MarketScreens.countButton(true));
			} else {
				inv.setStack(i, MarketScreens.fillerPane());
			}
		}
		if (player instanceof ServerPlayerEntity serverPlayer) {
			MarketSession.CreateDraft d = MarketSession.draft(serverPlayer);
			if (!d.sale.isEmpty()) {
				inv.setStack(SLOT_SALE, d.sale.copy());
			}
			if (!d.price.isEmpty()) {
				inv.setStack(SLOT_PRICE, d.price.copy());
			}
		}
		return inv;
	}

	private void refreshDisplayStacks() {
		container.setStack(SLOT_SALE, draft.sale.isEmpty() ? ItemStack.EMPTY : draft.sale.copy());
		container.setStack(SLOT_PRICE, draft.price.isEmpty() ? ItemStack.EMPTY : draft.price.copy());
	}

	@Override
	public boolean canInsertIntoSlot(ItemStack stack, Slot slot) {
		return false;
	}

	@Override
	public void onSlotClick(int slotIndex, int button, SlotActionType actionType, PlayerEntity player) {
		if (!(player instanceof ServerPlayerEntity serverPlayer)) {
			return;
		}
		if (GuiSlotPolicy.isPlayerSlot(this, slotIndex)) {
			if (actionType == SlotActionType.QUICK_MOVE) {
				if (draft.sale.isEmpty()) {
					handleSaleFromPlayerInventory(serverPlayer, slotIndex, 1);
				} else {
					handlePriceFromPlayerInventory(serverPlayer, slotIndex, 1);
				}
				return;
			}
			if (actionType == SlotActionType.PICKUP) {
				if (draft.sale.isEmpty()) {
					handleSaleFromPlayerInventory(serverPlayer, slotIndex, button);
				} else {
					handlePriceFromPlayerInventory(serverPlayer, slotIndex, button);
				}
				return;
			}
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
		if (slotIndex == SLOT_CONFIRM && actionType != SlotActionType.QUICK_MOVE) {
			tryConfirm(serverPlayer);
			return;
		}
		if (slotIndex == SLOT_PICK_SALE) {
			serverPlayer.sendMessage(
					Text.literal("Товар — только из вашего инвентаря внизу: клик по предмету (ЛКМ — 1, ПКМ — стак).")
							.formatted(Formatting.YELLOW),
					false
			);
			return;
		}
		if (slotIndex == SLOT_PICK_PRICE) {
			MarketScreens.openPricePresets(serverPlayer, 0);
			return;
		}
		if (slotIndex == SLOT_PRICE_MINUS) {
			adjustPriceCount(serverPlayer, -1);
			return;
		}
		if (slotIndex == SLOT_PRICE_PLUS) {
			adjustPriceCount(serverPlayer, 1);
			return;
		}
		if (slotIndex == SLOT_PRICE && button == 1) {
			draft.price = ItemStack.EMPTY;
			refreshDisplayStacks();
			return;
		}
		if (slotIndex == SLOT_SALE && button == 1) {
			draft.sale = ItemStack.EMPTY;
			refreshDisplayStacks();
		}
	}

	/** Только товар: копия в черновик, списание при «Подтвердить». */
	private void handleSaleFromPlayerInventory(ServerPlayerEntity player, int slotIndex, int button) {
		Slot playerSlot = slots.get(slotIndex);
		if (playerSlot == null || !playerSlot.hasStack()) {
			return;
		}
		ItemStack stack = playerSlot.getStack();
		if (MarketScreens.isDecorStack(stack) || MarketItemRules.isBanned(stack)) {
			player.sendMessage(MarketItemRules.banMessage(stack), false);
			return;
		}
		int count = button == 1 ? Math.min(stack.getCount(), 64) : 1;
		ItemStack pick = stack.copy();
		pick.setCount(count);
		draft.sale = pick;
		player.sendMessage(
				Text.literal("Товар: ").formatted(Formatting.GREEN).append(pick.toHoverableText()),
				false
		);
		refreshDisplayStacks();
	}

	/** Цена: шаблон для покупателя; с инвентаря не снимается. Достаточно 1 шт. для типа, количество — +/- или ПКМ. */
	private void handlePriceFromPlayerInventory(ServerPlayerEntity player, int slotIndex, int button) {
		Slot playerSlot = slots.get(slotIndex);
		if (playerSlot == null || !playerSlot.hasStack()) {
			return;
		}
		ItemStack stack = playerSlot.getStack();
		if (MarketScreens.isDecorStack(stack) || MarketItemRules.isBanned(stack)) {
			player.sendMessage(MarketItemRules.banMessage(stack), false);
			return;
		}
		int count = button == 1 ? Math.min(stack.getCount(), 64) : 1;
		ItemStack pick = stack.copyWithCount(count);
		if (!draft.sale.isEmpty()
				&& ItemStack.areItemsAndComponentsEqual(draft.sale, pick)
				&& draft.sale.getCount() == pick.getCount()) {
			player.sendMessage(Text.literal("Товар и цена не могут совпадать.").formatted(Formatting.RED), false);
			return;
		}
		draft.price = pick;
		player.sendMessage(
				Text.literal("Цена (тип из инвентаря): ")
						.formatted(Formatting.AQUA)
						.append(pick.toHoverableText())
						.append(Text.literal(" — ±1 для другого количества").formatted(Formatting.DARK_GRAY)),
				false
		);
		refreshDisplayStacks();
	}

	private void adjustPriceCount(ServerPlayerEntity player, int delta) {
		if (draft.price.isEmpty()) {
			player.sendMessage(
					Text.literal("Сначала выберите цену: книга «Ваша цена» или клик по инвентарю.")
							.formatted(Formatting.YELLOW),
					false
			);
			return;
		}
		int next = draft.price.getCount() + delta;
		if (next < 1 || next > 64) {
			player.sendMessage(Text.literal("Количество цены: от 1 до 64.").formatted(Formatting.RED), false);
			return;
		}
		draft.price = draft.price.copyWithCount(next);
		player.sendMessage(
				Text.literal("Цена: ").formatted(Formatting.AQUA).append(draft.price.toHoverableText()),
				false
		);
		refreshDisplayStacks();
	}

	private void tryConfirm(ServerPlayerEntity player) {
		ItemStack sale = draft.sale.copy();
		ItemStack price = draft.price.copy();
		if (sale.isEmpty() || price.isEmpty()) {
			player.sendMessage(
					Text.literal("Выберите товар из инвентаря и цену (книга «Ваша цена» или инвентарь).")
							.formatted(Formatting.RED),
					false
			);
			return;
		}
		if (MarketScreens.isDecorStack(sale) || MarketScreens.isDecorStack(price)) {
			player.sendMessage(Text.literal("Выберите реальные предметы.").formatted(Formatting.RED), false);
			return;
		}
		if (ItemStack.areItemsAndComponentsEqual(sale, price) && sale.getCount() == price.getCount()) {
			player.sendMessage(Text.literal("Товар и цена не могут совпадать.").formatted(Formatting.RED), false);
			return;
		}
		if (MarketItemRules.isBanned(sale)) {
			player.sendMessage(MarketItemRules.banMessage(sale), false);
			return;
		}
		if (MarketItemRules.isBanned(price)) {
			player.sendMessage(MarketItemRules.banMessage(price), false);
			return;
		}
		MarketRatioGuard.Check ratio = MarketRatioGuard.check(sale, price);
		if (ratio.blocked()) {
			player.sendMessage(MarketRatioGuard.blockMessage(ratio), false);
			return;
		}
		if (ratio.suspicious()) {
			player.sendMessage(MarketRatioGuard.warnMessage(ratio), false);
		}
		MarketConfig.MarketConfigData cfg = MarketConfig.get();
		if (IsnixMarketMod.listings().countBySeller(player.getUuid()) >= cfg.maxListingsPerPlayer) {
			player.sendMessage(Text.literal("Лимит ваших лотов: " + cfg.maxListingsPerPlayer).formatted(Formatting.RED), false);
			return;
		}
		if (!InventoryHelper.removeItems(player, sale)) {
			player.sendMessage(
					Text.literal("Нет в инвентаре: ").formatted(Formatting.RED).append(sale.toHoverableText()),
					false
			);
			return;
		}
		MarketListing listing = MarketListing.create(player.getUuid(), player.getName().getString(), sale, price);
		if (!IsnixMarketMod.listings().add(listing)) {
			InventoryHelper.giveOrDrop(player, sale);
			player.sendMessage(
					Text.literal("Лимит ваших лотов: " + cfg.maxListingsPerPlayer).formatted(Formatting.RED),
					false);
			return;
		}
		draft.sale = ItemStack.EMPTY;
		draft.price = ItemStack.EMPTY;
		container.setStack(SLOT_SALE, ItemStack.EMPTY);
		container.setStack(SLOT_PRICE, ItemStack.EMPTY);
		player.sendMessage(ListingMessages.listed(sale, price, listing.id()), false);
		ListingAnnouncements.broadcastNewListing(player.getEntityWorld().getServer(), listing);
		MarketGuideHook.onListingCreated(player);
		player.closeHandledScreen();
		MarketScreens.openMarket(player, 0, MarketSession.viewMode(player));
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
