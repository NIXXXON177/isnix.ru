package ru.isnix.playerbackup;

import net.fabricmc.api.DedicatedServerModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import ru.isnix.playerbackup.command.BackupCommands;

public class IsnixPlayerBackupMod implements DedicatedServerModInitializer {
	public static final String MOD_ID = "isnix_player_backup";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	private static int tickCounter = 0;

	@Override
	public void onInitializeServer() {
		BackupConfig.load();

		ServerLifecycleEvents.SERVER_STARTED.register(server -> {
			PlayerSnapshotService.pruneOldSnapshots();
			if (BackupConfig.get().enabled) {
				LOGGER.info(
						"ISNIX Player Backup: снимки каждые {} мин, хранение {} дн, каталог {}",
						BackupConfig.get().intervalMinutes,
						BackupConfig.get().keepDays,
						PlayerSnapshotService.snapshotRoot());
			} else {
				LOGGER.warn("ISNIX Player Backup: отключён в config/isnix-player-backup.json");
			}
		});

		CommandRegistrationCallback.EVENT.register(
				(dispatcher, registryAccess, environment) -> BackupCommands.register(dispatcher));

		ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
			if (!BackupConfig.get().enabled || !BackupConfig.get().snapshotOnQuit) {
				return;
			}
			var player = handler.player;
			if (player != null) {
				PlayerSnapshotService.snapshot(player, SnapshotReason.QUIT);
			}
		});

		ServerTickEvents.END_SERVER_TICK.register(server -> {
			if (!BackupConfig.get().enabled) {
				return;
			}
			int intervalTicks = Math.max(1, BackupConfig.get().intervalMinutes) * 60 * 20;
			tickCounter++;
			if (tickCounter < intervalTicks) {
				return;
			}
			tickCounter = 0;
			for (var player : server.getPlayerManager().getPlayerList()) {
				PlayerSnapshotService.snapshot(player, SnapshotReason.PERIODIC);
			}
		});

		LOGGER.info("ISNIX Player Backup загружен");
	}
}
