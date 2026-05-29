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

import java.util.List;

/** Каталог предметов — только выбор, без переноса стаков. */
public class ItemPickerScreenHandler extends GenericContainerScreenHandler {
	public static final int MENU_SIZE = 54;
	public static final int SLOT_PREV = 45;
	public static final int SLOT_BACK = 48;
	public static final int SLOT_INFO = 49;
	public static final int SLOT_NEXT = 53;

	private final MarketSession.PickerTarget target;
	private final int page;
	private final List<ItemStack> pageItems;

	public ItemPickerScreenHandler(
			int syncId,
			PlayerInventory playerInventory,
			MarketSession.PickerTarget target,
			int page
	) {
		super(ScreenHandlerType.GENERIC_9X6, syncId, playerInventory, buildInventory(target, page), 6);
		this.target = target;
		this.page = page;
		this.pageItems = ItemCatalog.pageStacks(page);
	}

	private static SimpleInventory buildInventory(MarketSession.PickerTarget target, int page) {
		SimpleInventory inv = new SimpleInventory(MENU_SIZE);
		List<ItemStack> stacks = ItemCatalog.pageStacks(page);
		for (int i = 0; i < ItemCatalog.PAGE_SIZE; i++) {
			inv.setStack(i, stacks.get(i).isEmpty() ? ItemStack.EMPTY : stacks.get(i).copy());
		}
		for (int i = ItemCatalog.PAGE_SIZE; i < MENU_SIZE; i++) {
			if (i == SLOT_PREV) {
				inv.setStack(i, page > 0 ? MarketScreens.navArrow(false) : MarketScreens.fillerPane());
			} else if (i == SLOT_NEXT) {
				inv.setStack(i, page < ItemCatalog.totalPages() - 1 ? MarketScreens.navArrow(true) : MarketScreens.fillerPane());
			} else if (i == SLOT_BACK) {
				inv.setStack(i, MarketScreens.backButton());
			} else if (i == SLOT_INFO) {
				inv.setStack(i, MarketScreens.pickerInfo(target, page));
			} else {
				inv.setStack(i, MarketScreens.fillerPane());
			}
		}
		return inv;
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
		if (!GuiSlotPolicy.isMenuSlotIndex(slotIndex, MENU_SIZE)) {
			return;
		}
		if (slotIndex == SLOT_PREV && page > 0) {
			MarketScreens.openItemPicker(serverPlayer, target, page - 1);
			return;
		}
		if (slotIndex == SLOT_NEXT && page < ItemCatalog.totalPages() - 1) {
			MarketScreens.openItemPicker(serverPlayer, target, page + 1);
			return;
		}
		if (slotIndex == SLOT_BACK) {
			MarketScreens.openCreate(serverPlayer);
			return;
		}
		if (slotIndex >= 0 && slotIndex < ItemCatalog.PAGE_SIZE && slotIndex < pageItems.size()) {
			ItemStack chosen = pageItems.get(slotIndex);
			if (!chosen.isEmpty()) {
				ItemStack pick = chosen.copy();
				pick.setCount(1);
				if (button == 1) {
					pick.setCount(Math.min(64, pick.getMaxCount()));
				}
				MarketSession.applyPickerChoice(serverPlayer, target, pick);
				serverPlayer.sendMessage(
						Text.literal(target == MarketSession.PickerTarget.SALE ? "Товар: " : "Цена: ")
								.formatted(Formatting.GREEN)
								.append(pick.toHoverableText()),
						false
				);
				MarketScreens.openCreate(serverPlayer);
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
