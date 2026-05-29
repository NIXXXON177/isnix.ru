package ru.isnix.market.screen;

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.inventory.SimpleInventory;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
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
import ru.isnix.market.util.InventoryHelper;
import ru.isnix.market.util.ListingAnnouncements;
import ru.isnix.market.util.ListingMessages;

/**
 * Окно «Выставить лот»: предметы только из инвентаря игрока, без +/-, центр сетки.
 */
public class CreateListingScreenHandler extends GenericContainerScreenHandler {
	public static final int MENU_SIZE = 27;
	/** Центр среднего ряда (9×3). */
	public static final int SLOT_PICK_SALE = 10;
	public static final int SLOT_SALE = 11;
	public static final int SLOT_PICK_PRICE = 12;
	public static final int SLOT_PRICE = 13;
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
		// Запрет класть предметы в слоты меню — только нижний инвентарь игрока
		return GuiSlotPolicy.isPlayerSlot(this, slot.id);
	}

	@Override
	public void onSlotClick(int slotIndex, int button, SlotActionType actionType, PlayerEntity player) {
		if (!(player instanceof ServerPlayerEntity serverPlayer)) {
			super.onSlotClick(slotIndex, button, actionType, player);
			return;
		}
		if (GuiSlotPolicy.isMenuSlotIndex(slotIndex, MENU_SIZE)) {
			if (actionType == SlotActionType.QUICK_MOVE && GuiSlotPolicy.isPlayerSlot(this, slotIndex)) {
				handleQuickMoveFromPlayer(serverPlayer, slotIndex);
				return;
			}
			handleMenuClick(serverPlayer, slotIndex, button, actionType);
			return;
		}
		if (actionType == SlotActionType.QUICK_MOVE) {
			handleQuickMoveFromPlayer(serverPlayer, slotIndex);
			return;
		}
		super.onSlotClick(slotIndex, button, actionType, player);
	}

	private void handleMenuClick(
			ServerPlayerEntity serverPlayer,
			int slotIndex,
			int button,
			SlotActionType actionType
	) {
		if (slotIndex == SLOT_CONFIRM && actionType != SlotActionType.QUICK_MOVE) {
			syncDraftFromContainer();
			tryConfirm(serverPlayer);
			return;
		}
		if (slotIndex == SLOT_PICK_SALE) {
			syncDraftFromContainer();
			MarketScreens.openItemPicker(serverPlayer, MarketSession.PickerTarget.SALE, 0);
			return;
		}
		if (slotIndex == SLOT_PICK_PRICE) {
			syncDraftFromContainer();
			MarketScreens.openItemPicker(serverPlayer, MarketSession.PickerTarget.PRICE, 0);
			return;
		}
		if (slotIndex == SLOT_SALE || slotIndex == SLOT_PRICE) {
			if (button == 1) {
				if (slotIndex == SLOT_SALE) {
					draft.sale = ItemStack.EMPTY;
				} else {
					draft.price = ItemStack.EMPTY;
				}
				refreshDisplayStacks();
				return;
			}
			syncDraftFromContainer();
			MarketSession.PickerTarget target = slotIndex == SLOT_SALE
					? MarketSession.PickerTarget.SALE
					: MarketSession.PickerTarget.PRICE;
			MarketScreens.openItemPicker(serverPlayer, target, 0);
		}
	}

	/** Shift+клик только из инвентаря игрока (нижние слоты), не из GUI. */
	private void handleQuickMoveFromPlayer(ServerPlayerEntity player, int slotIndex) {
		if (!GuiSlotPolicy.isPlayerSlot(this, slotIndex)) {
			return;
		}
		Slot playerSlot = slots.get(slotIndex);
		if (playerSlot == null || !playerSlot.hasStack()) {
			return;
		}
		ItemStack stack = playerSlot.getStack();
		if (draft.sale.isEmpty()) {
			draft.sale = stack.copy();
			draft.sale.setCount(Math.min(stack.getCount(), 64));
			playerSlot.setStack(ItemStack.EMPTY);
			refreshDisplayStacks();
		} else if (draft.price.isEmpty()) {
			draft.price = stack.copy();
			draft.price.setCount(Math.min(stack.getCount(), 64));
			playerSlot.setStack(ItemStack.EMPTY);
			refreshDisplayStacks();
		}
	}

	private void syncDraftFromContainer() {
		ItemStack sale = container.getStack(SLOT_SALE);
		ItemStack price = container.getStack(SLOT_PRICE);
		if (!sale.isEmpty() && !MarketScreens.isDecorStack(sale)) {
			draft.sale = sale.copy();
		}
		if (!price.isEmpty() && !MarketScreens.isDecorStack(price)) {
			draft.price = price.copy();
		}
	}

	private void tryConfirm(ServerPlayerEntity player) {
		ItemStack sale = draft.sale.copy();
		ItemStack price = draft.price.copy();
		if (sale.isEmpty() || price.isEmpty()) {
			player.sendMessage(Text.literal("Выберите товар и цену (книги или Shift+клик из инвентаря).").formatted(Formatting.RED), false);
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
		MarketConfig.MarketConfigData cfg = MarketConfig.get();
		if (IsnixMarketMod.listings().countBySeller(player.getUuid()) >= cfg.maxListingsPerPlayer) {
			player.sendMessage(Text.literal("Лимит ваших лотов: " + cfg.maxListingsPerPlayer).formatted(Formatting.RED), false);
			return;
		}
		// Товар списывается только из основного инвентаря игрока
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
			player.sendMessage(Text.literal("Рынок переполнен, попробуйте позже.").formatted(Formatting.RED), false);
			return;
		}
		draft.sale = ItemStack.EMPTY;
		draft.price = ItemStack.EMPTY;
		container.setStack(SLOT_SALE, ItemStack.EMPTY);
		container.setStack(SLOT_PRICE, ItemStack.EMPTY);
		player.sendMessage(ListingMessages.listed(sale, price, listing.id()), false);
		ListingAnnouncements.broadcastNewListing(player.getServer(), listing);
		player.closeHandledScreen();
		MarketScreens.openMarket(player, 0);
	}

	@Override
	public ItemStack quickMove(PlayerEntity player, int slot) {
		return ItemStack.EMPTY;
	}

	@Override
	public void onClosed(PlayerEntity player) {
		super.onClosed(player);
	}

	@Override
	public boolean canUse(PlayerEntity player) {
		return true;
	}
}
