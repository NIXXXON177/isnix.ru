package ru.isnix.guide;

import net.minecraft.server.MinecraftServer;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.lang.reflect.Method;
import java.util.UUID;

/** Проверка claim OPAC через reflection (jar не нужен при сборке). */
public final class OpacClaimsBridge {
	private static final Logger LOGGER = LoggerFactory.getLogger("isnix_guide");
	private static boolean available;
	private static boolean checked;
	private static Method apiGet;
	private static Method getServerClaimsManager;
	private static Method getPlayerInfo;
	private static Method getClaimCount;

	private OpacClaimsBridge() {
	}

	public static boolean hasAnyClaim(MinecraftServer server, UUID playerId) {
		ensureInitialized();
		if (!available) {
			return false;
		}
		try {
			Object api = apiGet.invoke(null, server);
			Object claimsManager = getServerClaimsManager.invoke(api);
			Object playerInfo = getPlayerInfo.invoke(claimsManager, playerId);
			if (playerInfo == null) {
				return false;
			}
			Object count = getClaimCount.invoke(playerInfo);
			if (count instanceof Integer n) {
				return n > 0;
			}
			if (count instanceof Number num) {
				return num.intValue() > 0;
			}
		} catch (ReflectiveOperationException e) {
			LOGGER.debug("OPAC claim check failed: {}", e.toString());
		}
		return false;
	}

	private static void ensureInitialized() {
		if (!checked) {
			init();
		}
	}

	private static void init() {
		checked = true;
		try {
			Class<?> apiClass = Class.forName("xaero.pac.common.server.api.OpenPACServerAPI");
			apiGet = apiClass.getMethod("get", MinecraftServer.class);
			getServerClaimsManager = apiClass.getMethod("getServerClaimsManager");
			Class<?> claimsManagerClass =
					Class.forName("xaero.pac.common.server.claims.api.IServerClaimsManagerAPI");
			getPlayerInfo = claimsManagerClass.getMethod("getPlayerInfo", UUID.class);
			Class<?> playerInfoClass =
					Class.forName("xaero.pac.common.server.claims.player.api.IPlayerChunkClaimInfoAPI");
			getClaimCount = playerInfoClass.getMethod("getClaimCount");
			available = true;
			LOGGER.info("OPAC API для путеводителя доступен.");
		} catch (ReflectiveOperationException e) {
			available = false;
			LOGGER.info("OPAC не найден — достижение «Свой участок» только при наличии мода.");
		}
	}
}
