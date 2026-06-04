package ru.isnix.market.util;

import net.minecraft.server.network.ServerPlayerEntity;

/** Опциональная связь с isnix-guide (без compile-time зависимости). */
public final class MarketGuideHook {
	private static final String TRIGGERS = "ru.isnix.guide.GuideTriggers";

	private MarketGuideHook() {
	}

	public static void onListingCreated(ServerPlayerEntity seller) {
		invoke("onListingCreated", seller);
	}

	public static void onPurchase(ServerPlayerEntity buyer) {
		invoke("onPurchase", buyer);
	}

	private static void invoke(String method, ServerPlayerEntity player) {
		try {
			Class<?> cls = Class.forName(TRIGGERS);
			cls.getMethod(method, ServerPlayerEntity.class).invoke(null, player);
		} catch (ReflectiveOperationException ignored) {
			// isnix-guide не установлен
		}
	}
}
