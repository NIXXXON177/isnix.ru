package ru.isnix.opactab;

import net.fabricmc.api.DedicatedServerModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class IsnixOpacTabMod implements DedicatedServerModInitializer {
	public static final String MOD_ID = "isnix_opac_tab";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	@Override
	public void onInitializeServer() {
		ServerLifecycleEvents.SERVER_STARTING.register(server -> ClanTagConfig.load(server));

		ServerLifecycleEvents.SERVER_STARTED.register(server -> TabBridge.register(server));

		ClanTagPlaceholders.register();

		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) ->
				ClanTagCommands.register(dispatcher));

		LOGGER.info("ISNIX OPAC Tab: placeholder %isnix:clan_tag% (OPAC loaded: {})", OpacBridge.isAvailable());
	}
}
