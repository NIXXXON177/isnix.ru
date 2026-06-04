package ru.isnix.guide;

import net.minecraft.advancement.AdvancementEntry;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.Identifier;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class AdvancementHelper {
	private static final Logger LOGGER = LoggerFactory.getLogger("isnix_guide");

	private AdvancementHelper() {
	}

	public static boolean grant(ServerPlayerEntity player, String path) {
		var server = player.getEntityWorld().getServer();
		if (server == null) {
			return false;
		}
		Identifier id = Identifier.of("isnix", path);
		AdvancementEntry entry = server.getAdvancementLoader().get(id);
		if (entry == null) {
			LOGGER.debug("Advancement не найден: {}", id);
			return false;
		}
		var tracker = player.getAdvancementTracker();
		if (tracker.getProgress(entry).isDone()) {
			return false;
		}
		tracker.grantCriterion(entry, "grant");
		return tracker.getProgress(entry).isDone();
	}
}
