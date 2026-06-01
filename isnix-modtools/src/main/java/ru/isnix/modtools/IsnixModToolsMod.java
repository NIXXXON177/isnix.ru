package ru.isnix.modtools;

import net.fabricmc.api.DedicatedServerModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import ru.isnix.modtools.command.ModToolsCommands;

import net.minecraft.server.network.ServerPlayerEntity;

public class IsnixModToolsMod implements DedicatedServerModInitializer {
	public static final String MOD_ID = "isnix_modtools";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	private static ModerationStorage storage;

	@Override
	public void onInitializeServer() {
		ModToolsConfig.load();

		ServerLifecycleEvents.SERVER_STARTING.register(server -> {
			storage = new ModerationStorage();
			storage.bind(server);
			FreezeManager.bind(storage);
			MuteManager.bind(storage);
		});

		ServerLifecycleEvents.SERVER_STOPPING.register(server -> {
			if (storage != null) {
				storage.save(server);
			}
		});

		CommandRegistrationCallback.EVENT.register(
				(dispatcher, registryAccess, environment) -> ModToolsCommands.register(dispatcher));

		ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
			ServerPlayerEntity player = handler.player;
		if (FreezeManager.isFrozen(player)) {
			FreezeManager.snapToAnchor(player);
		}
		});

		ServerTickEvents.END_SERVER_TICK.register(server -> {
			if (storage == null) {
				return;
			}
			if (server.getTicks() % 20 == 0) {
				storage.pruneExpired(server);
			}
			for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
				FreezeManager.tickFrozen(player);
			}
		});

		LOGGER.info("ISNIX ModTools: /mute, /mutevoice, /freeze (OP {} или LP группа {})",
				ModToolsConfig.get().opPermissionLevel,
				ModToolsConfig.get().luckpermsAdminGroup);
	}

	public static ModerationStorage storage() {
		return storage;
	}
}
