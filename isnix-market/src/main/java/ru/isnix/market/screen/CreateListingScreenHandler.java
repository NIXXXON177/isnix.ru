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

public class CreateListingScreenHandler extends GenericContainerScreenHandler {
	public static final int SLOT_PICK_SALE = 9;
	public static final int SLOT_SALE = 10;
	public static final int SLOT_PICK_PRICE = 11;
	public static final int SLOT_PRICE = 12;
	public static final int SLOT_SALE_MINUS = 19;
	public static final int SLOT_SALE_PLUS = 20;
	public static final int SLOT_CONFIRM = 22;
	public static final int SLOT_PRICE_MINUS = 23;
	public static final int SLOT_PRICE_PLUS = 24;

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
		SimpleInventory inv = new SimpleInventory(27);
		for (int i = 0; i < 27; i++) {
			if (i == SLOT_SALE || i == SLOT_PRICE) {
				inv.setStack(i, ItemStack.EMPTY);
			} else if (i == SLOT_CONFIRM) {
				inv.setStack(i, MarketScreens.confirmButton());
			} else if (i == SLOT_PICK_SALE) {
				inv.setStack(i, MarketScreens.pickSaleButton());
			} else if (i == SLOT_PICK_PRICE) {
				inv.setStack(i, MarketScreens.pickPriceButton());
			} else if (i == SLOT_SALE_MINUS || i == SLOT_PRICE_MINUS) {
				inv.setStack(i, MarketScreens.countButton(false));
			} else if (i == SLOT_SALE_PLUS || i == SLOT_PRICE_PLUS) {
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
	public void onSlotClick(int slotIndex, int button, SlotActionType actionType, PlayerEntity player) {
		if (!(player instanceof ServerPlayerEntity serverPlayer)) {
			super.onSlotClick(slotIndex, button, actionType, player);
			return;
		}
		if (actionType == SlotActionType.QUICK_MOVE) {
			handleQuickMove(serverPlayer, slotIndex);
			return;
		}
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
		if (slotIndex == SLOT_SALE_MINUS) {
			adjustCount(draft.sale, -1);
			draft.salePhysical = false;
			refreshDisplayStacks();
			return;
		}
		if (slotIndex == SLOT_SALE_PLUS) {
			adjustCount(draft.sale, 1);
			draft.salePhysical = false;
			refreshDisplayStacks();
			return;
		}
		if (slotIndex == SLOT_PRICE_MINUS) {
			adjustCount(draft.price, -1);
			draft.pricePhysical = false;
			refreshDisplayStacks();
			return;
		}
		if (slotIndex == SLOT_PRICE_PLUS) {
			adjustCount(draft.price, 1);
			draft.pricePhysical = false;
			refreshDisplayStacks();
			return;
		}
		if (slotIndex == SLOT_SALE || slotIndex == SLOT_PRICE) {
			if (button == 1) {
				if (slotIndex == SLOT_SALE) {
					draft.sale = ItemStack.EMPTY;
					draft.salePhysical = false;
				} else {
					draft.price = ItemStack.EMPTY;
					draft.pricePhysical = false;
				}
				refreshDisplayStacks();
				return;
			}
			if (container.getStack(slotIndex).isEmpty()) {
				syncDraftFromContainer();
				MarketSession.PickerTarget target = slotIndex == SLOT_SALE
						? MarketSession.PickerTarget.SALE
						: MarketSession.PickerTarget.PRICE;
				MarketScreens.openItemPicker(serverPlayer, target, 0);
				return;
			}
			super.onSlotClick(slotIndex, button, actionType, player);
			syncDraftFromContainerAfterSlot(slotIndex);
			return;
		}
		if (isDecorSlot(slotIndex)) {
			return;
		}
		super.onSlotClick(slotIndex, button, actionType, player);
	}

	private void handleQuickMove(ServerPlayerEntity player, int slotIndex) {
		if (slotIndex < 0 || slotIndex >= player.getInventory().size()) {
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
			draft.salePhysical = true;
			playerSlot.setStack(ItemStack.EMPTY);
			refreshDisplayStacks();
		} else if (draft.price.isEmpty()) {
			draft.price = stack.copy();
			draft.price.setCount(Math.min(stack.getCount(), 64));
			draft.pricePhysical = true;
			playerSlot.setStack(ItemStack.EMPTY);
			refreshDisplayStacks();
		}
	}

	private static void adjustCount(ItemStack stack, int delta) {
		if (stack.isEmpty()) {
			return;
		}
		int max = Math.max(1, stack.getMaxCount());
		stack.setCount(Math.max(1, Math.min(max, stack.getCount() + delta)));
	}

	private void syncDraftFromContainer() {
		ItemStack sale = container.getStack(SLOT_SALE);
		ItemStack price = container.getStack(SLOT_PRICE);
		if (!sale.isEmpty()) {
			draft.sale = sale.copy();
		}
		if (!price.isEmpty()) {
			draft.price = price.copy();
		}
	}

	private void syncDraftFromContainerAfterSlot(int slotIndex) {
		if (slotIndex == SLOT_SALE) {
			ItemStack s = container.getStack(SLOT_SALE);
			if (!s.isEmpty()) {
				draft.sale = s.copy();
				draft.salePhysical = true;
			}
		} else if (slotIndex == SLOT_PRICE) {
			ItemStack p = container.getStack(SLOT_PRICE);
			if (!p.isEmpty()) {
				draft.price = p.copy();
				draft.pricePhysical = true;
			}
		}
	}

	private void tryConfirm(ServerPlayerEntity player) {
		ItemStack sale = draft.sale.copy();
		ItemStack price = draft.price.copy();
		if (sale.isEmpty() || price.isEmpty()) {
			player.sendMessage(Text.literal("Выберите товар и цену (книги или слоты).").formatted(Formatting.RED), false);
			return;
		}
		if (sale.getItem() == Items.GRAY_STAINED_GLASS_PANE || price.getItem() == Items.GRAY_STAINED_GLASS_PANE) {
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
		if (draft.salePhysical) {
			ItemStack inSlot = container.getStack(SLOT_SALE);
			if (inSlot.isEmpty()) {
				player.sendMessage(Text.literal("Положите товар в слот продажи.").formatted(Formatting.RED), false);
				return;
			}
			sale = inSlot.copy();
			container.setStack(SLOT_SALE, ItemStack.EMPTY);
			draft.salePhysical = false;
		} else if (!InventoryHelper.removeItems(player, sale)) {
			player.sendMessage(
					Text.literal("Нет в инвентаре: ").formatted(Formatting.RED).append(sale.toHoverableText()),
					false
			);
			return;
		}
		if (draft.pricePhysical) {
			ItemStack inSlot = container.getStack(SLOT_PRICE);
			if (!inSlot.isEmpty()) {
				InventoryHelper.giveOrDrop(player, inSlot.copy());
				container.setStack(SLOT_PRICE, ItemStack.EMPTY);
			}
		}
		MarketListing listing = MarketListing.create(player.getUuid(), player.getName().getString(), sale, price);
		if (!IsnixMarketMod.listings().add(listing)) {
			InventoryHelper.giveOrDrop(player, sale);
			player.sendMessage(Text.literal("Рынок переполнен, попробуйте позже.").formatted(Formatting.RED), false);
			return;
		}
		draft.sale = ItemStack.EMPTY;
		draft.price = ItemStack.EMPTY;
		draft.salePhysical = false;
		draft.pricePhysical = false;
		container.setStack(SLOT_SALE, ItemStack.EMPTY);
		container.setStack(SLOT_PRICE, ItemStack.EMPTY);
		player.sendMessage(
				Text.literal("Лот выставлен: ")
						.formatted(Formatting.GREEN)
						.append(sale.toHoverableText())
						.append(Text.literal(" за ").formatted(Formatting.GRAY))
						.append(price.toHoverableText()),
				false
		);
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
		if (!(player instanceof ServerPlayerEntity serverPlayer)) {
			return;
		}
		if (draft.salePhysical) {
			ItemStack stack = container.getStack(SLOT_SALE);
			if (!stack.isEmpty()) {
				InventoryHelper.giveOrDrop(serverPlayer, stack.copy());
			}
		}
		if (draft.pricePhysical) {
			ItemStack stack = container.getStack(SLOT_PRICE);
			if (!stack.isEmpty()) {
				InventoryHelper.giveOrDrop(serverPlayer, stack.copy());
			}
		}
	}

	private static boolean isDecorSlot(int slotIndex) {
		return slotIndex != SLOT_SALE && slotIndex != SLOT_PRICE;
	}

	@Override
	public boolean canUse(PlayerEntity player) {
		return true;
	}
}
