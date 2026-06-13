package ru.isnix.reputation;

import net.fabricmc.api.DedicatedServerModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import ru.isnix.reputation.command.ReputationCommands;

public class IsnixReputationMod implements DedicatedServerModInitializer {
	public static final String MOD_ID = "isnix_reputation";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	private static int refreshTickCounter = 0;

	@Override
	public void onInitializeServer() {
		ReputationConfig.load();

		ReputationPlaceholders.register();

		ServerLifecycleEvents.SERVER_STARTED.register(TabBridge::register);

		CommandRegistrationCallback.EVENT.register(
				(dispatcher, registryAccess, environment) -> ReputationCommands.register(dispatcher));

		ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
			var player = handler.player;
			if (player != null) {
				ReputationCache.refreshAsync(player);
			}
		});

		ServerTickEvents.END_SERVER_TICK.register(server -> {
			if (!ReputationConfig.get().isReady()) {
				return;
			}
			int interval = ReputationConfig.get().refreshIntervalTicks;
			refreshTickCounter++;
			if (refreshTickCounter < interval) {
				return;
			}
			refreshTickCounter = 0;
			ReputationCache.refreshAllOnline(server);
		});

		if (ReputationConfig.get().isReady()) {
			LOGGER.info(
					"ISNIX Reputation {}: placeholder %isnix:rep%, дизы={}",
					ReputationConfig.get().modVersionLabel(),
					ReputationConfig.get().allowDislikes);
		} else {
			LOGGER.warn(
					"ISNIX Reputation: выключено или нет service_role_key в config/isnix-reputation.json");
		}
	}
}
