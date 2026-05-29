package ru.isnix.market.screen;

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.inventory.Inventory;
import net.minecraft.screen.ScreenHandler;
import net.minecraft.screen.slot.Slot;
import net.minecraft.screen.slot.SlotActionType;

/**
 * Защита GUI: нельзя забирать декор и лоты, нельзя класть предметы в меню рынка.
 * (аналог event.setCancelled(true) в Spigot для всех слотов кроме инвентаря игрока)
 */
public final class GuiSlotPolicy {
	private GuiSlotPolicy() {
	}

	public static boolean isMenuInventory(Inventory menu, Inventory slotInventory) {
		return slotInventory == menu;
	}

	public static boolean isMenuSlotIndex(int slotIndex, int menuSize) {
		return slotIndex >= 0 && slotIndex < menuSize;
	}

	/** Слот принадлежит инвентарю игрока (нижняя часть экрана). */
	public static boolean isPlayerSlot(ScreenHandler handler, int slotIndex) {
		if (slotIndex < 0 || slotIndex >= handler.slots.size()) {
			return false;
		}
		Slot slot = handler.slots.get(slotIndex);
		return slot.inventory instanceof net.minecraft.entity.player.PlayerInventory;
	}

	/**
	 * Блокирует перенос предметов в/из меню. Разрешены только клики-обработчики в onSlotClick.
	 */
	public static boolean shouldBlockMenuTransfer(
			int slotIndex,
			int menuSize,
			SlotActionType actionType,
			PlayerEntity player
	) {
		if (actionType == SlotActionType.PICKUP_ALL) {
			return true;
		}
		if (isMenuSlotIndex(slotIndex, menuSize)) {
			return true;
		}
		// Клик по инвентарю игрока при переносе в верхнее меню
		if (actionType == SlotActionType.PICKUP || actionType == SlotActionType.QUICK_MOVE) {
			return slotIndex >= 0 && slotIndex < menuSize;
		}
		return false;
	}
}
