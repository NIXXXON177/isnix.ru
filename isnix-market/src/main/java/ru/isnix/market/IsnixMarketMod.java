package ru.isnix.market;

import net.fabricmc.api.DedicatedServerModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import ru.isnix.market.command.SellCommand;
import ru.isnix.market.storage.ListingStorage;
import ru.isnix.market.storage.PendingPayoutStorage;

public class IsnixMarketMod implements DedicatedServerModInitializer {
	public static final String MOD_ID = "isnix_market";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	private static ListingStorage listingStorage;
	private static PendingPayoutStorage payoutStorage;

	@Override
	public void onInitializeServer() {
		ServerLifecycleEvents.SERVER_STARTING.register(server -> {
			MarketConfig.load();
			listingStorage = new ListingStorage(server);
			payoutStorage = new PendingPayoutStorage(server);
			listingStorage.load();
			payoutStorage.load();
		});

		ServerLifecycleEvents.SERVER_STOPPING.register(server -> {
			if (listingStorage != null) {
				listingStorage.save();
			}
			if (payoutStorage != null) {
				payoutStorage.save();
			}
		});

		ServerTickEvents.END_SERVER_TICK.register(server -> {
			if (listingStorage != null && server.getTicks() % 1200 == 0) {
				listingStorage.pruneExpired();
			}
		});

		ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
			if (payoutStorage != null) {
				payoutStorage.deliverPending(handler.player);
			}
		});

		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) ->
				SellCommand.register(dispatcher));

		LOGGER.info("ISNIX Market: /sell — рынок за ресурсы (без валюты)");
	}

	public static ListingStorage listings() {
		return listingStorage;
	}

	public static PendingPayoutStorage payouts() {
		return payoutStorage;
	}
}
