package ru.isnix.stats;

import net.fabricmc.api.DedicatedServerModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class IsnixPlayerStatsMod implements DedicatedServerModInitializer {
	public static final String MOD_ID = "isnix_player_stats";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);
	private static int flushTickCounter = 0;

	@Override
	public void onInitializeServer() {
		StatsConfig.load();

		ServerTickEvents.END_SERVER_TICK.register(server -> {
			if (!StatsConfig.get().isReady()) {
				return;
			}
			int interval = StatsConfig.get().flushIntervalTicks;
			if (interval < 1200) {
				interval = 1200;
			}
			flushTickCounter++;
			if (flushTickCounter < interval) {
				return;
			}
			flushTickCounter = 0;
			for (var player : server.getPlayerManager().getPlayerList()) {
				SupabaseStatsService.flushSession(player.getGameProfile().name());
				SupabaseStatsService.syncPlayerMeta(player);
			}
		});

		ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
			var player = handler.getPlayer();
			if (player == null) {
				return;
			}
			SupabaseStatsService.onPlayerJoin(player.getGameProfile().name());
			SupabaseStatsService.syncPlayerMeta(player);
		});

		ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
			var player = handler.getPlayer();
			if (player == null) {
				return;
			}
			SupabaseStatsService.onPlayerQuit(player.getGameProfile().name());
		});

		if (StatsConfig.get().isReady()) {
			LOGGER.info("ISNIX Player Stats: Supabase включён");
		} else {
			LOGGER.warn(
					"ISNIX Player Stats: укажи service_role_key в config/isnix-player-stats.json (enabled: true)");
		}
	}
}
