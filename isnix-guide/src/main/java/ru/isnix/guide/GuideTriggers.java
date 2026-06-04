package ru.isnix.guide;

import net.minecraft.server.network.ServerPlayerEntity;

/** Точка входа для isnix-market (reflection) и других модов. */
public final class GuideTriggers {
	private GuideTriggers() {
	}

	public static void onListingCreated(ServerPlayerEntity seller) {
		GuideManager.onListingCreated(seller);
	}

	public static void onPurchase(ServerPlayerEntity buyer) {
		GuideManager.onPurchase(buyer);
	}
}
