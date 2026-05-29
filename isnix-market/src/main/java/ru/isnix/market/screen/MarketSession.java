package ru.isnix.market.screen;

import net.minecraft.item.ItemStack;
import net.minecraft.server.network.ServerPlayerEntity;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Черновик окна «Выставить лот» между переключениями GUI. */
public final class MarketSession {
	public enum PickerTarget {
		SALE,
		PRICE
	}

	public static final class CreateDraft {
		public ItemStack sale = ItemStack.EMPTY;
		public ItemStack price = ItemStack.EMPTY;
		/** Предмет продажи переложен из инвентаря игрока. */
		public boolean salePhysical;
		/** Предмет цены переложен из инвентаря (при подтверждении вернётся). */
		public boolean pricePhysical;
	}

	private static final Map<UUID, CreateDraft> DRAFTS = new ConcurrentHashMap<>();

	private MarketSession() {
	}

	public static CreateDraft draft(ServerPlayerEntity player) {
		return DRAFTS.computeIfAbsent(player.getUuid(), u -> new CreateDraft());
	}

	public static void clearDraft(ServerPlayerEntity player) {
		DRAFTS.remove(player.getUuid());
	}

	public static void applyPickerChoice(ServerPlayerEntity player, PickerTarget target, ItemStack chosen) {
		CreateDraft d = draft(player);
		ItemStack stack = chosen.copy();
		if (stack.isEmpty()) {
			return;
		}
		stack.setCount(Math.max(1, Math.min(64, stack.getCount())));
		if (target == PickerTarget.SALE) {
			d.sale = stack;
			d.salePhysical = false;
		} else {
			d.price = stack;
			d.pricePhysical = false;
		}
	}

	public static void syncFromContainer(CreateDraft d, ItemStack sale, ItemStack price) {
		if (!sale.isEmpty() && sale.getItem() != net.minecraft.item.Items.GRAY_STAINED_GLASS_PANE) {
			d.sale = sale.copy();
		}
		if (!price.isEmpty() && price.getItem() != net.minecraft.item.Items.GRAY_STAINED_GLASS_PANE) {
			d.price = price.copy();
		}
	}
}
