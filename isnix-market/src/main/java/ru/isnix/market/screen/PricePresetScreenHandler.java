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
import ru.isnix.market.PricePresets;

import java.util.List;

/** Список кнопок-цен из конфига. Предметы нельзя забрать — только выбор. */
public class PricePresetScreenHandler extends GenericContainerScreenHandler {
	public static final int MENU_SIZE = 54;
	public static final int SLOT_PREV = 45;
	public static final int SLOT_BACK = 48;
	public static final int SLOT_INFO = 49;
	public static final int SLOT_NEXT = 53;

	private final int page;
	private final List<ItemStack> pageItems;

	public PricePresetScreenHandler(int syncId, PlayerInventory playerInventory, int page) {
		super(ScreenHandlerType.GENERIC_9X6, syncId, playerInventory, buildInventory(page), 6);
		this.page = page;
		this.pageItems = PricePresets.pageStacks(page);
	}

	private static SimpleInventory buildInventory(int page) {
		SimpleInventory inv = new SimpleInventory(MENU_SIZE);
		List<ItemStack> stacks = PricePresets.pageStacks(page);
		for (int i = 0; i < PricePresets.PAGE_SIZE; i++) {
			inv.setStack(i, stacks.get(i).isEmpty() ? ItemStack.EMPTY : stacks.get(i).copy());
		}
		for (int i = PricePresets.PAGE_SIZE; i < MENU_SIZE; i++) {
			if (i == SLOT_PREV) {
				inv.setStack(i, page > 0 ? MarketScreens.navArrow(false) : MarketScreens.fillerPane());
			} else if (i == SLOT_NEXT) {
				inv.setStack(i, page < PricePresets.totalPages() - 1 ? MarketScreens.navArrow(true) : MarketScreens.fillerPane());
			} else if (i == SLOT_BACK) {
				inv.setStack(i, MarketScreens.backButton());
			} else if (i == SLOT_INFO) {
				inv.setStack(i, MarketScreens.pricePresetInfo(page));
			} else {
				inv.setStack(i, MarketScreens.fillerPane());
			}
		}
		return inv;
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
		if (!GuiSlotPolicy.isMenuSlotIndex(slotIndex, MENU_SIZE)) {
			return;
		}
		if (slotIndex == SLOT_PREV && page > 0) {
			MarketScreens.openPricePresets(serverPlayer, page - 1);
			return;
		}
		if (slotIndex == SLOT_NEXT && page < PricePresets.totalPages() - 1) {
			MarketScreens.openPricePresets(serverPlayer, page + 1);
			return;
		}
		if (slotIndex == SLOT_BACK) {
			MarketScreens.openCreate(serverPlayer);
			return;
		}
		if (slotIndex >= 0 && slotIndex < PricePresets.PAGE_SIZE && slotIndex < pageItems.size()) {
			ItemStack chosen = pageItems.get(slotIndex);
			if (!chosen.isEmpty()) {
				MarketSession.applyPricePreset(serverPlayer, chosen);
				serverPlayer.sendMessage(
						Text.literal("Цена: ").formatted(Formatting.GREEN).append(chosen.toHoverableText()),
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
