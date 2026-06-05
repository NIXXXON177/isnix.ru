package ru.isnix.messages;

import net.fabricmc.api.DedicatedServerModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.ArrayList;
import java.util.List;

public class IsnixServerMessagesMod implements DedicatedServerModInitializer {
	public static final String MOD_ID = "isnix_server_messages";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	@Override
	public void onInitializeServer() {
		ServerLifecycleEvents.SERVER_STARTING.register(MessagesConfig::load);

		ServerLifecycleEvents.SERVER_STOPPING.register(server -> {
			MessagesConfig.load(server);
			Text message = MessagesConfig.get().serverRestarting(server);
			List<ServerPlayerEntity> players = new ArrayList<>(server.getPlayerManager().getPlayerList());
			for (ServerPlayerEntity player : players) {
				player.networkHandler.disconnect(message);
			}
			if (!players.isEmpty()) {
				LOGGER.info("Отключено {} игрок(ов): сообщение о перезапуске", players.size());
			}
		});

		ServerLifecycleEvents.SERVER_STOPPED.register(server -> {
			MessagesConfig cfg = MessagesConfig.get();
			if (!cfg.forceJvmExitOnStop) {
				return;
			}
			int delay = Math.max(0, cfg.forceJvmExitDelayMs);
			LOGGER.info(
					"Play2GO: завершение JVM через {} мс (force_jvm_exit_on_stop). Иначе Restart зависает.",
					delay);
			Thread exitThread = new Thread(() -> {
				if (delay > 0) {
					try {
						Thread.sleep(delay);
					} catch (InterruptedException ignored) {
						Thread.currentThread().interrupt();
					}
				}
				System.exit(0);
			}, "isnix-server-messages-jvm-exit");
			exitThread.setDaemon(false);
			exitThread.start();
		});

		LOGGER.info("ISNIX Server Messages: вайтлист и перезапуск — config/isnix-server-messages.json");
	}
}
