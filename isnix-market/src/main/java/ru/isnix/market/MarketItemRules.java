package ru.isnix.market;

import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;
import net.minecraft.util.Identifier;

public final class MarketItemRules {
	private MarketItemRules() {
	}

	public static boolean isBanned(ItemStack stack) {
		if (stack == null || stack.isEmpty()) {
			return true;
		}
		MarketConfig.MarketConfigData cfg = MarketConfig.get();
		Identifier id = Registries.ITEM.getId(stack.getItem());
		if (cfg.banAllSpawnEggs && "minecraft".equals(id.getNamespace()) && id.getPath().endsWith("_spawn_egg")) {
			return true;
		}
		String key = id.toString();
		for (String banned : cfg.bannedItemIds) {
			if (banned != null && !banned.isBlank() && key.equals(banned.trim())) {
				return true;
			}
		}
		return false;
	}

	public static net.minecraft.text.Text banMessage(ItemStack stack) {
		return net.minecraft.text.Text.literal("Этот предмет нельзя продавать и использовать как цену на рынке.")
				.formatted(net.minecraft.util.Formatting.RED);
	}
}
