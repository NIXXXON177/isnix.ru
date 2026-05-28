package ru.isnix.market.screen;

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.inventory.Inventory;
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
import ru.isnix.market.listing.MarketListing;
import ru.isnix.market.MarketConfig;

public class CreateListingScreenHandler extends GenericContainerScreenHandler {
	public static final int SLOT_SALE = 10;
	public static final int SLOT_PRICE = 12;
	public static final int SLOT_CONFIRM = 22;

	private final SimpleInventory container;

	public CreateListingScreenHandler(int syncId, PlayerInventory playerInventory) {
		super(ScreenHandlerType.GENERIC_9X3, syncId, playerInventory, buildInventory(), 3);
		this.container = (SimpleInventory) getInventory();
	}

	private static SimpleInventory buildInventory() {
		SimpleInventory inv = new SimpleInventory(27);
		for (int i = 0; i < 27; i++) {
			if (i == SLOT_SALE || i == SLOT_PRICE) {
				inv.setStack(i, ItemStack.EMPTY);
			} else if (i == SLOT_CONFIRM) {
				inv.setStack(i, MarketScreens.confirmButton());
			} else {
				inv.setStack(i, MarketScreens.fillerPane());
			}
		}
		return inv;
	}

	@Override
	public void onSlotClick(int slotIndex, int button, SlotActionType actionType, PlayerEntity player) {
		if (!(player instanceof ServerPlayerEntity serverPlayer)) {
			super.onSlotClick(slotIndex, button, actionType, player);
			return;
		}
		if (slotIndex == SLOT_CONFIRM && actionType != SlotActionType.QUICK_MOVE) {
			tryConfirm(serverPlayer);
			return;
		}
		if (slotIndex == SLOT_CONFIRM || (slotIndex >= 0 && slotIndex < 27 && slotIndex != SLOT_SALE && slotIndex != SLOT_PRICE)) {
			if (slotIndex != SLOT_SALE && slotIndex != SLOT_PRICE) {
				return;
			}
		}
		super.onSlotClick(slotIndex, button, actionType, player);
	}

	private void tryConfirm(ServerPlayerEntity player) {
		ItemStack sale = container.getStack(SLOT_SALE).copy();
		ItemStack price = container.getStack(SLOT_PRICE).copy();
		if (sale.isEmpty() || price.isEmpty()) {
			player.sendMessage(Text.literal("Положите товар и цену (ресурсы).").formatted(Formatting.RED), false);
			return;
		}
		if (sale.getItem() == Items.GRAY_STAINED_GLASS_PANE || price.getItem() == Items.GRAY_STAINED_GLASS_PANE) {
			player.sendMessage(Text.literal("Положите реальные предметы.").formatted(Formatting.RED), false);
			return;
		}
		MarketConfig.MarketConfigData cfg = MarketConfig.get();
		if (IsnixMarketMod.listings().countBySeller(player.getUuid()) >= cfg.maxListingsPerPlayer) {
			player.sendMessage(Text.literal("Лимит ваших лотов: " + cfg.maxListingsPerPlayer).formatted(Formatting.RED), false);
			return;
		}
		MarketListing listing = MarketListing.create(player.getUuid(), player.getName().getString(), sale, price);
		if (!IsnixMarketMod.listings().add(listing)) {
			player.sendMessage(Text.literal("Рынок переполнен, попробуйте позже.").formatted(Formatting.RED), false);
			return;
		}
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
		player.closeHandledScreen();
		MarketScreens.openMarket(player, 0);
	}

	@Override
	public ItemStack quickMove(PlayerEntity player, int slot) {
		ItemStack stack = ItemStack.EMPTY;
		Slot sourceSlot = slots.get(slot);
		if (sourceSlot == null || !sourceSlot.hasStack()) {
			return ItemStack.EMPTY;
		}
		ItemStack original = sourceSlot.getStack();
		if (slot < 27) {
			if (slot != SLOT_SALE && slot != SLOT_PRICE) {
				return ItemStack.EMPTY;
			}
		}
		if (slot >= 27) {
			if (!insertItem(original, SLOT_SALE, SLOT_PRICE + 1, false)
					&& !insertItem(original, SLOT_SALE, SLOT_SALE + 1, false)) {
				return ItemStack.EMPTY;
			}
		} else if (slot == SLOT_SALE || slot == SLOT_PRICE) {
			if (!insertItem(original, 27, 36, false)) {
				if (!insertItem(original, 36, slots.size(), false)) {
					return ItemStack.EMPTY;
				}
			}
		}
		if (original.isEmpty()) {
			sourceSlot.setStack(ItemStack.EMPTY);
		} else {
			sourceSlot.markDirty();
		}
		return stack;
	}

	@Override
	public void onClosed(PlayerEntity player) {
		super.onClosed(player);
		if (player instanceof ServerPlayerEntity serverPlayer) {
			dropSlot(serverPlayer, SLOT_SALE);
			dropSlot(serverPlayer, SLOT_PRICE);
		}
	}

	private void dropSlot(ServerPlayerEntity player, int index) {
		ItemStack stack = container.getStack(index);
		if (!stack.isEmpty() && stack.getItem() != Items.GRAY_STAINED_GLASS_PANE
				&& stack.getItem() != Items.LIME_STAINED_GLASS_PANE) {
			player.dropItem(stack.copy(), false);
			container.setStack(index, ItemStack.EMPTY);
		}
	}

	@Override
	public boolean canUse(PlayerEntity player) {
		return true;
	}
}
