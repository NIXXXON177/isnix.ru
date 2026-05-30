package ru.isnix.market;

import net.minecraft.item.Item;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.util.Identifier;

import java.util.ArrayList;
import java.util.List;

/** Разрешённые варианты цены (только кнопки в GUI, без каталога всех блоков). */
public final class PricePresets {
	public static final int PAGE_SIZE = 45;

	private static List<ItemStack> cached;

	private PricePresets() {
	}

	public static List<ItemStack> all() {
		if (cached != null) {
			return cached;
		}
		List<ItemStack> out = new ArrayList<>();
		for (MarketConfig.MarketConfigData.PricePresetEntry entry : MarketConfig.get().pricePresets) {
			ItemStack stack = entry.toStack();
			if (!stack.isEmpty() && !MarketItemRules.isBanned(stack)) {
				out.add(stack);
			}
		}
		cached = List.copyOf(out);
		return cached;
	}

	public static void invalidate() {
		cached = null;
	}

	public static int totalPages() {
		int n = all().size();
		return Math.max(1, (n + PAGE_SIZE - 1) / PAGE_SIZE);
	}

	public static List<ItemStack> pageStacks(int page) {
		List<ItemStack> items = all();
		int from = page * PAGE_SIZE;
		int to = Math.min(from + PAGE_SIZE, items.size());
		List<ItemStack> out = new ArrayList<>(PAGE_SIZE);
		for (int i = from; i < to; i++) {
			out.add(items.get(i).copy());
		}
		while (out.size() < PAGE_SIZE) {
			out.add(ItemStack.EMPTY);
		}
		return out;
	}

	public static boolean matchesPreset(ItemStack price) {
		if (price == null || price.isEmpty()) {
			return false;
		}
		for (ItemStack preset : all()) {
			if (ItemStack.areItemsAndComponentsEqual(price, preset) && price.getCount() == preset.getCount()) {
				return true;
			}
		}
		return false;
	}
}
