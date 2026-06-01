package ru.isnix.market;

import net.fabricmc.api.ModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import ru.isnix.market.command.SellCommand;
import ru.isnix.market.storage.ListingStorage;
import ru.isnix.market.storage.PendingPayoutStorage;
import ru.isnix.market.storage.TradeHistoryStorage;

import java.util.concurrent.atomic.AtomicBoolean;

public class IsnixMarketMod implements ModInitializer {
	public static final String MOD_ID = "isnix_market";
	public static final String VERSION = "1.6.1";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	private static final AtomicBoolean STARTED = new AtomicBoolean();

	private static ListingStorage listingStorage;
	private static PendingPayoutStorage payoutStorage;
	private static TradeHistoryStorage tradeHistoryStorage;

	@Override
	public void onInitialize() {
		// В одиночке Fabric 0.19 вызывает main только на клиенте — нельзя выходить по EnvType.CLIENT.
		start();
	}

	private static void start() {
		if (!STARTED.compareAndSet(false, true)) {
			return;
		}

		ServerLifecycleEvents.SERVER_STARTING.register(server -> {
			MarketConfig.load();
			listingStorage = new ListingStorage(server);
			payoutStorage = new PendingPayoutStorage(server);
			tradeHistoryStorage = new TradeHistoryStorage(server);
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

		LOGGER.info("ISNIX Market {}: /sell зарегистрирован (одиночка и dedicated)", VERSION);
	}

	public static ListingStorage listings() {
		return listingStorage;
	}

	public static PendingPayoutStorage payouts() {
		return payoutStorage;
	}

	public static TradeHistoryStorage trades() {
		return tradeHistoryStorage;
	}
}
