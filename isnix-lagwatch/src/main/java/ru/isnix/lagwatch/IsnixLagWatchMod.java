package ru.isnix.lagwatch;

import net.fabricmc.api.DedicatedServerModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.server.MinecraftServer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import ru.isnix.lagwatch.command.LagWatchCommands;

public class IsnixLagWatchMod implements DedicatedServerModInitializer {
	public static final String MOD_ID = "isnix_lagwatch";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	private static int tickCounter = 0;

	@Override
	public void onInitializeServer() {
		LagWatchConfig.load();

		CommandRegistrationCallback.EVENT.register(
				(dispatcher, registryAccess, environment) -> LagWatchCommands.register(dispatcher));

		ServerTickEvents.END_SERVER_TICK.register(IsnixLagWatchMod::onEndTick);

		LOGGER.info(
				"ISNIX LagWatch {}: порог блоков/сек={}, сущностей={} (OP {})",
				LagWatchConfig.get().modVersionLabel(),
				LagWatchConfig.get().blockUpdatesPerSecondThreshold,
				LagWatchConfig.get().entityCountThreshold,
				LagWatchConfig.get().opPermissionLevel);
	}

	private static void onEndTick(MinecraftServer server) {
		if (!LagWatchConfig.get().enabled) {
			return;
		}
		tickCounter++;
		if (tickCounter < LagWatchConfig.get().sampleIntervalTicks) {
			return;
		}
		tickCounter = 0;
		LagWatchSampler.sample(server);
	}
}
