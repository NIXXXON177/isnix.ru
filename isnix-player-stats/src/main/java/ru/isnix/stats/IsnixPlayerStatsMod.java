package ru.isnix.stats;

import net.fabricmc.api.DedicatedServerModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class IsnixPlayerStatsMod implements DedicatedServerModInitializer {
	public static final String MOD_ID = "isnix_player_stats";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	@Override
	public void onInitializeServer() {
		ServerLifecycleEvents.SERVER_STARTING.register(server -> StatsConfig.load());

		ServerPlayConnectionEvents.JOIN.register((handler, sender, server) -> {
			var player = handler.getPlayer();
			if (player == null) {
				return;
			}
			SupabaseStatsService.onPlayerJoin(player.getGameProfile().getName());
		});

		ServerPlayConnectionEvents.DISCONNECT.register((handler, server) -> {
			var player = handler.getPlayer();
			if (player == null) {
				return;
			}
			SupabaseStatsService.onPlayerQuit(player.getGameProfile().getName());
		});

		if (StatsConfig.get().isReady()) {
			LOGGER.info("ISNIX Player Stats: Supabase включён");
		} else {
			LOGGER.warn(
					"ISNIX Player Stats: укажи service_role_key в config/isnix-player-stats.json (enabled: true)");
		}
	}
}
