package ru.isnix.market.screen;

import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.registry.Registries;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

public final class ItemCatalog {
	public static final int PAGE_SIZE = 45;

	private static List<Item> cached;

	private ItemCatalog() {
	}

	public static List<Item> all() {
		if (cached != null) {
			return cached;
		}
		List<Item> items = new ArrayList<>();
		for (Item item : Registries.ITEM) {
			if (item == Items.AIR || item == Items.BARRIER || item == Items.COMMAND_BLOCK
					|| item == Items.CHAIN_COMMAND_BLOCK || item == Items.REPEATING_COMMAND_BLOCK
					|| item == Items.STRUCTURE_VOID || item == Items.JIGSAW) {
				continue;
			}
			ItemStack probe = item.getDefaultStack();
			if (probe.isEmpty()) {
				continue;
			}
			items.add(item);
		}
		items.sort(Comparator.comparing(i -> Registries.ITEM.getId(i).toString()));
		cached = List.copyOf(items);
		return cached;
	}

	public static int totalPages() {
		int n = all().size();
		return Math.max(1, (n + PAGE_SIZE - 1) / PAGE_SIZE);
	}

	public static List<ItemStack> pageStacks(int page) {
		List<Item> items = all();
		int from = page * PAGE_SIZE;
		int to = Math.min(from + PAGE_SIZE, items.size());
		List<ItemStack> out = new ArrayList<>(PAGE_SIZE);
		for (int i = from; i < to; i++) {
			out.add(items.get(i).getDefaultStack());
		}
		while (out.size() < PAGE_SIZE) {
			out.add(ItemStack.EMPTY);
		}
		return out;
	}
}
