package ru.isnix.opactab;

import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.UUID;

/**
 * Доступ к Open Parties and Claims через reflection — jar OPAC не нужен при сборке.
 */
public final class OpacBridge {
	private static boolean available;
	private static boolean checked;
	private static Class<?> apiClass;
	private static Method apiGet;
	private static Method getPartyManager;
	private static Method getPartyByMember;
	private static Method getOwner;
	private static Method getMemberUuid;
	private static Method getMemberCount;
	private static Method getDefaultName;
	private static Method getPlayerConfigManager;
	private static Method getLoadedConfig;
	private static Method getEffective;
	private static Object partyNameOption;

	private OpacBridge() {
	}

	public static boolean isAvailable() {
		if (!checked) {
			init();
		}
		return available;
	}

	private static void init() {
		checked = true;
		try {
			apiClass = Class.forName("xaero.pac.common.server.api.OpenPACServerAPI");
			apiGet = apiClass.getMethod("get", MinecraftServer.class);
			getPartyManager = apiClass.getMethod("getPartyManager");
			Class<?> partyManagerClass = Class.forName("xaero.pac.common.server.parties.party.api.IPartyManagerAPI");
			getPartyByMember = partyManagerClass.getMethod("getPartyByMember", UUID.class);
			Class<?> serverPartyClass = Class.forName("xaero.pac.common.server.parties.party.api.IServerPartyAPI");
			getOwner = serverPartyClass.getMethod("getOwner");
			getMemberCount = serverPartyClass.getMethod("getMemberCount");
			getDefaultName = serverPartyClass.getMethod("getDefaultName");
			Class<?> partyMemberClass = Class.forName("xaero.pac.common.parties.party.member.api.IPartyMemberAPI");
			getMemberUuid = partyMemberClass.getMethod("getUUID");
			getPlayerConfigManager = apiClass.getMethod("getPlayerConfigManager");
			Class<?> configManagerClass = Class.forName("xaero.pac.common.server.player.config.api.IPlayerConfigManagerAPI");
			getLoadedConfig = configManagerClass.getMethod("getLoadedConfig", UUID.class);
			Class<?> playerConfigClass = Class.forName("xaero.pac.common.server.player.config.api.IPlayerConfigAPI");
			getEffective = playerConfigClass.getMethod("getEffective", Class.forName(
					"xaero.pac.common.server.player.config.api.IPlayerConfigOptionSpecAPI"));
			Class<?> optionsClass = Class.forName("xaero.pac.common.server.player.config.api.v2.PlayerConfigOptions");
			Field partyNameField = optionsClass.getField("PARTY_NAME");
			partyNameOption = partyNameField.get(null);
			available = true;
		} catch (Throwable t) {
			available = false;
			IsnixOpacTabMod.LOGGER.warn("Open Parties and Claims API недоступен: {}", t.toString());
		}
	}

	public static boolean isPlayerInClan(ServerPlayerEntity player) {
		return getPartyMemberCount(player) > 1;
	}

	public static int getPartyMemberCount(ServerPlayerEntity player) {
		Object party = getPartyForMember(player);
		if (party == null) {
			return 0;
		}
		try {
			return (Integer) getMemberCount.invoke(party);
		} catch (Throwable t) {
			return 0;
		}
	}

	public static UUID getPartyOwnerId(ServerPlayerEntity player) {
		Object party = getPartyForMember(player);
		if (party == null) {
			return null;
		}
		try {
			Object owner = getOwner.invoke(party);
			if (owner == null) {
				return null;
			}
			return (UUID) getMemberUuid.invoke(owner);
		} catch (Throwable t) {
			return null;
		}
	}

	private static Object getPartyForMember(ServerPlayerEntity player) {
		if (!isAvailable() || player == null) {
			return null;
		}
		try {
			Object api = apiGet.invoke(null, player.getServer());
			Object partyManager = getPartyManager.invoke(api);
			return getPartyByMember.invoke(partyManager, player.getUuid());
		} catch (Throwable t) {
			return null;
		}
	}

	public static String getPartyNameForPlayer(ServerPlayerEntity player) {
		Object party = getPartyForMember(player);
		if (party == null) {
			return null;
		}
		UUID ownerId = getPartyOwnerId(player);
		if (ownerId != null) {
			String configured = getPartyNameForOwner(ownerId, player.getServer());
			if (configured != null && !configured.isEmpty()) {
				return configured;
			}
		}
		try {
			Object value = getDefaultName.invoke(party);
			if (value == null) {
				return null;
			}
			String name = value.toString().trim();
			return name.isEmpty() ? null : name;
		} catch (Throwable t) {
			return null;
		}
	}

	public static String getPartyNameForOwner(UUID ownerId, MinecraftServer server) {
		if (!isAvailable() || ownerId == null || server == null) {
			return null;
		}
		try {
			Object api = apiGet.invoke(null, server);
			Object configManager = getPlayerConfigManager.invoke(api);
			Object playerConfig = getLoadedConfig.invoke(configManager, ownerId);
			if (playerConfig == null) {
				return null;
			}
			Object value = getEffective.invoke(playerConfig, partyNameOption);
			if (value == null) {
				return null;
			}
			String name = value.toString().trim();
			return name.isEmpty() ? null : name;
		} catch (Throwable t) {
			return null;
		}
	}

	public static boolean setPartyNameForOwner(UUID ownerId, MinecraftServer server, String name) {
		if (!isAvailable() || ownerId == null || server == null) {
			return false;
		}
		try {
			Object api = apiGet.invoke(null, server);
			Object configManager = getPlayerConfigManager.invoke(api);
			Object playerConfig = getLoadedConfig.invoke(configManager, ownerId);
			if (playerConfig == null) {
				return false;
			}
			Method tryToSet = playerConfig.getClass().getMethod("tryToSet",
					Class.forName("xaero.pac.common.server.player.config.api.IPlayerConfigOptionSpecAPI"),
					Object.class);
			Object result = tryToSet.invoke(playerConfig, partyNameOption, name);
			if (result == null) {
				return false;
			}
			Method isSuccess = result.getClass().getMethod("isSuccess");
			return Boolean.TRUE.equals(isSuccess.invoke(result));
		} catch (Throwable t) {
			IsnixOpacTabMod.LOGGER.debug("setPartyName failed: {}", t.toString());
			return false;
		}
	}
}
