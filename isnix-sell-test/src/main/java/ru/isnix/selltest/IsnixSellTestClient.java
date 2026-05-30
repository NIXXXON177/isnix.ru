package ru.isnix.selltest;

import net.fabricmc.api.ClientModInitializer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class IsnixSellTestClient implements ClientModInitializer {
	public static final String MOD_ID = "isnix_sell_test";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	@Override
	public void onInitializeClient() {
		SellTestKeybinds.register();
		MarketScreenWatcher.register();
		LOGGER.info("ISNIX Sell Test: клавиши /sell (настройки → Управление → ISNIX /sell)");
	}
}
