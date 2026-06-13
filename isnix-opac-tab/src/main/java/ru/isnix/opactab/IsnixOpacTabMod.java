package ru.isnix.opactab;

import net.fabricmc.api.DedicatedServerModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class IsnixOpacTabMod implements DedicatedServerModInitializer {
	public static final String MOD_ID = "isnix_opac_tab";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	@Override
	public void onInitializeServer() {
		ServerLifecycleEvents.SERVER_STARTING.register(ClanTagConfig::load);

		ServerLifecycleEvents.SERVER_STARTED.register(server -> {
			TabBridge.register(server);
			ClanTagCache.refreshAll(server);
		});

		ServerLifecycleEvents.SERVER_STOPPING.register(server -> ClanTagConfig.save());

		ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
			ClanTagCache.put(handler.player);
			ClaimBypass.apply(handler.player);
		});

		ServerPlayConnectionEvents.DISCONNECT.register((handler, server) ->
				ClanTagCache.remove(handler.player.getUuid()));

		ServerTickEvents.END_SERVER_TICK.register(server -> {
			long ticks = server.getTicks();
			if (ticks == 40L || ticks == 200L) {
				OpacBridge.retryInitIfNeeded();
				ClanTagCache.refreshAll(server);
				ClaimBypass.applyAll(server);
			} else if (ticks % 20 == 0) {
				ClanTagCache.refreshAll(server);
				// раз в 5 сек пересинхронизируем байпас — подхватываем выдачу/снятие ноды на лету
				if (ticks % 100 == 0) {
					ClaimBypass.applyAll(server);
				}
			}
		});

		ClanTagPlaceholders.register();

		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) ->
				ClanTagCommands.register(dispatcher));

		LOGGER.info("ISNIX OPAC Tab: placeholder %isnix:clan_tag% (OPAC loaded: {})", OpacBridge.isAvailable());
	}
}
