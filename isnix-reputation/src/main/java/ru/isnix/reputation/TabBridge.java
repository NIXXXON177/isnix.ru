package ru.isnix.reputation;

import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;

import java.lang.reflect.Method;
import java.util.UUID;
import java.util.function.Function;

/**
 * Регистрация %isnix:rep% в TAB (основной поток, без async pb4).
 */
public final class TabBridge {
	private static MinecraftServer boundServer;

	private TabBridge() {
	}

	public static void register(MinecraftServer server) {
		boundServer = server;
		if (!ReputationConfig.get().isReady()) {
			return;
		}
		try {
			Class<?> tabApiClass = Class.forName("me.neznamy.tab.api.TabAPI");
			Object tabApi = tabApiClass.getMethod("getInstance").invoke(null);
			Object placeholderManager = tabApiClass.getMethod("getPlaceholderManager").invoke(tabApi);
			Class<?> tabPlayerClass = Class.forName("me.neznamy.tab.api.TabPlayer");
			Method getUniqueId = tabPlayerClass.getMethod("getUniqueId");

			@SuppressWarnings("unchecked")
			Function<Object, String> repResolver = tabPlayer -> {
				try {
					UUID uuid = (UUID) getUniqueId.invoke(tabPlayer);
					if (boundServer == null) {
						return ReputationConfig.get().placeholderEmpty;
					}
					ServerPlayerEntity player = boundServer.getPlayerManager().getPlayer(uuid);
					if (player == null) {
						return ReputationConfig.get().placeholderEmpty;
					}
					return ReputationCache.formatted(player);
				} catch (Throwable t) {
					return ReputationConfig.get().placeholderEmpty;
				}
			};

			Method register = placeholderManager.getClass().getMethod(
					"registerPlayerPlaceholder", String.class, int.class, Function.class);
			register.invoke(placeholderManager, "%isnix:rep%", 2000, repResolver);

			@SuppressWarnings("unchecked")
			Function<Object, String> scoreResolver = tabPlayer -> {
				try {
					UUID uuid = (UUID) getUniqueId.invoke(tabPlayer);
					if (boundServer == null) {
						return "0";
					}
					ServerPlayerEntity player = boundServer.getPlayerManager().getPlayer(uuid);
					if (player == null) {
						return "0";
					}
					return Long.toString(ReputationCache.get(player).score());
				} catch (Throwable t) {
					return "0";
				}
			};
			register.invoke(placeholderManager, "%isnix:rep_score%", 2000, scoreResolver);
			IsnixReputationMod.LOGGER.info("TAB: зарегистрированы placeholders %isnix:rep%, %isnix:rep_score%");
		} catch (ClassNotFoundException e) {
			IsnixReputationMod.LOGGER.debug("TAB не установлен");
		} catch (Throwable t) {
			IsnixReputationMod.LOGGER.warn("TAB placeholder не зарегистрирован: {}", t.toString());
		}
	}
}
