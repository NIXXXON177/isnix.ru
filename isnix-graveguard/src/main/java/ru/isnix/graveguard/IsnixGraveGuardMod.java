package ru.isnix.graveguard;

import net.fabricmc.api.DedicatedServerModInitializer;
import net.fabricmc.fabric.api.command.v2.CommandRegistrationCallback;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import ru.isnix.graveguard.command.GraveGuardCommands;

public class IsnixGraveGuardMod implements DedicatedServerModInitializer {
	public static final String MOD_ID = "isnix_graveguard";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	@Override
	public void onInitializeServer() {
		GraveGuardConfig.load();
		GraveGuardEvents.register();
		CommandRegistrationCallback.EVENT.register(
				(dispatcher, registryAccess, environment) -> GraveGuardCommands.register(dispatcher));

		GraveGuardConfig cfg = GraveGuardConfig.get();
		LOGGER.info(
				"ISNIX GraveGuard {}: защита {} сек, радиус могилы {}, зона смерти {}, запас {} сек, полный иммунитет у могилы={}",
				cfg.modVersionLabel(),
				cfg.protectionSeconds,
				cfg.nearGraveRadius,
				cfg.deathSiteRadius,
				cfg.lootGraceSeconds,
				cfg.protectAllDamageInLootZone);
	}
}
