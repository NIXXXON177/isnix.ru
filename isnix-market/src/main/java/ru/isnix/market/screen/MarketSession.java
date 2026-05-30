package ru.isnix.market.screen;

import net.minecraft.item.ItemStack;
import net.minecraft.server.network.ServerPlayerEntity;

import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Черновик окна «Выставить лот» между переключениями GUI. */
public final class MarketSession {
	public static final class CreateDraft {
		public ItemStack sale = ItemStack.EMPTY;
		public ItemStack price = ItemStack.EMPTY;
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

	public static void applyPricePreset(ServerPlayerEntity player, ItemStack chosen) {
		CreateDraft d = draft(player);
		if (chosen == null || chosen.isEmpty()) {
			return;
		}
		d.price = chosen.copy();
	}
}
