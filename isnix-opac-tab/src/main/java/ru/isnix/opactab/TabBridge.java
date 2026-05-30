package ru.isnix.opactab;

import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;

import java.lang.reflect.Method;
import java.util.UUID;
import java.util.function.Function;

/**
 * Регистрация %isnix:clan_tag% в TAB (основной поток, без async pb4).
 */
public final class TabBridge {
	private TabBridge() {
	}

	public static void register(MinecraftServer server) {
		try {
			Class<?> tabApiClass = Class.forName("me.neznamy.tab.api.TabAPI");
			Object tabApi = tabApiClass.getMethod("getInstance").invoke(null);
			Object placeholderManager = tabApiClass.getMethod("getPlaceholderManager").invoke(tabApi);
			Class<?> tabPlayerClass = Class.forName("me.neznamy.tab.api.TabPlayer");
			Method getUniqueId = tabPlayerClass.getMethod("getUniqueId");

			ClanTagCache.refreshAll(server);

			@SuppressWarnings("unchecked")
			Function<Object, String> resolver = tabPlayer -> {
				try {
					UUID uuid = (UUID) getUniqueId.invoke(tabPlayer);
					return ClanTagCache.get(uuid);
				} catch (Throwable t) {
					return "";
				}
			};

			Method register = placeholderManager.getClass().getMethod(
					"registerPlayerPlaceholder", String.class, int.class, Function.class);
			register.invoke(placeholderManager, "%isnix:clan_tag%", 1000, resolver);
			IsnixOpacTabMod.LOGGER.info("TAB: зарегистрирован player placeholder %isnix:clan_tag%");
		} catch (ClassNotFoundException e) {
			IsnixOpacTabMod.LOGGER.debug("TAB не установлен");
		} catch (Throwable t) {
			IsnixOpacTabMod.LOGGER.warn("TAB placeholder не зарегистрирован: {}", t.toString());
		}
	}
}
