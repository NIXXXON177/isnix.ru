package ru.isnix.guide;

import net.fabricmc.api.DedicatedServerModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class IsnixGuideMod implements DedicatedServerModInitializer {
	public static final String MOD_ID = "isnix_guide";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	private static GuideProgressStorage storage;

	@Override
	public void onInitializeServer() {
		GuideConfig.load();

		ServerLifecycleEvents.SERVER_STARTING.register(server -> {
			storage = new GuideProgressStorage();
			storage.bind(server);
			GuideManager.bind(storage);
		});

		ServerLifecycleEvents.SERVER_STOPPING.register(server -> {
			if (storage != null) {
				storage.save();
			}
		});

		ServerPlayConnectionEvents.JOIN.register((handler, sender, server) ->
				server.execute(() -> GuideManager.onPlayerJoin(handler.player)));

		ServerTickEvents.END_SERVER_TICK.register(server ->
				GuideManager.onServerTick(server, GuideConfig.get().checkOpacClaimsEveryTicks));

		CommandRegistrationCallback.EVENT.register((dispatcher, registryAccess, environment) ->
				GuidebookCommand.register(dispatcher));

		LOGGER.info("ISNIX Guide: достижения isnix:*, /guidebook, книга при первом входе");
	}
}
