package ru.isnix.market.util;

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.entity.player.PlayerInventory;
import net.minecraft.item.ItemStack;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.collection.DefaultedList;

public final class InventoryHelper {
	private InventoryHelper() {
	}

	public static boolean hasItems(PlayerEntity player, ItemStack template) {
		return countMatching(player, template) >= template.getCount();
	}

	public static int countMatching(PlayerEntity player, ItemStack template) {
		if (template.isEmpty()) {
			return 0;
		}
		int total = 0;
		for (ItemStack stack : player.getInventory().main) {
			if (ItemStack.areItemsAndComponentsEqual(stack, template)) {
				total += stack.getCount();
			}
		}
		return total;
	}

	public static boolean removeItems(PlayerEntity player, ItemStack template) {
		int needed = template.getCount();
		if (!hasItems(player, template)) {
			return false;
		}
		DefaultedList<ItemStack> main = player.getInventory().main;
		for (int i = 0; i < main.size() && needed > 0; i++) {
			ItemStack stack = main.get(i);
			if (stack.isEmpty() || !ItemStack.areItemsAndComponentsEqual(stack, template)) {
				continue;
			}
			int take = Math.min(stack.getCount(), needed);
			stack.decrement(take);
			needed -= take;
		}
		player.getInventory().markDirty();
		return needed <= 0;
	}

	public static void giveOrDrop(ServerPlayerEntity player, ItemStack stack) {
		if (stack.isEmpty()) {
			return;
		}
		ItemStack remaining = stack.copy();
		player.getInventory().insertStack(remaining);
		if (!remaining.isEmpty()) {
			player.dropItem(remaining, false);
		}
	}
}
