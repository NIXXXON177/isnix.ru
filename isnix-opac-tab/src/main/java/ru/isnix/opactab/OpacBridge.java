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
	private static Method getRaw;
	private static Method getFromEffectiveConfig;
	private static Class<?> optionSpecClass;
	private static Object partyNameOption;

	private OpacBridge() {
	}

	public static boolean isAvailable() {
		ensureInitialized();
		return available;
	}

	public static void ensureInitialized() {
		if (!checked) {
			init();
		}
	}

	/** Повторная попытка, если OPAC ещё не был готов при первом init (после рестарта). */
	public static void retryInitIfNeeded() {
		if (available) {
			return;
		}
		checked = false;
		init();
		if (available) {
			IsnixOpacTabMod.LOGGER.info("Open Parties and Claims API доступен после повторной инициализации.");
		}
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
			optionSpecClass = Class.forName(
					"xaero.pac.common.server.player.config.api.IPlayerConfigOptionSpecAPI");
			getEffective = playerConfigClass.getMethod("getEffective", optionSpecClass);
			getRaw = playerConfigClass.getMethod("getRaw", optionSpecClass);
			getFromEffectiveConfig = playerConfigClass.getMethod("getFromEffectiveConfig", optionSpecClass);
			Class<?> optionsClass = Class.forName("xaero.pac.common.server.player.config.api.v2.PlayerConfigOptions");
			Field partyNameField = optionsClass.getField("PARTY_NAME");
			partyNameOption = partyNameField.get(null);
			available = true;
		} catch (Throwable t) {
			available = false;
			IsnixOpacTabMod.LOGGER.warn("Open Parties and Claims API недоступен: {}", t.toString());
		}
	}

	/** Два и больше участников — «полноценный» клан. */
	public static boolean isPlayerInClan(ServerPlayerEntity player) {
		return getPartyMemberCount(player) > 1;
	}

	public static boolean hasParty(ServerPlayerEntity player) {
		return getPartyForMember(player) != null;
	}

	public static boolean isPartyOwner(ServerPlayerEntity player) {
		if (player == null) {
			return false;
		}
		UUID ownerId = getPartyOwnerId(player);
		return ownerId != null && ownerId.equals(player.getUuid());
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
		if (player == null) {
			return null;
		}
		return getPartyOwnerIdForMember(player.getUuid(), player.getServer());
	}

	public static UUID getPartyOwnerIdForMember(UUID memberUuid, MinecraftServer server) {
		Object party = getPartyForMemberUuid(memberUuid, server);
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
		if (player == null) {
			return null;
		}
		return getPartyForMemberUuid(player.getUuid(), player.getServer());
	}

	private static Object getPartyForMemberUuid(UUID memberUuid, MinecraftServer server) {
		if (!isAvailable() || memberUuid == null || server == null) {
			return null;
		}
		try {
			Object api = apiGet.invoke(null, server);
			Object partyManager = getPartyManager.invoke(api);
			return getPartyByMember.invoke(partyManager, memberUuid);
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
			String name = readOptionString(playerConfig, getRaw);
			if (name != null) {
				return name;
			}
			name = readOptionString(playerConfig, getFromEffectiveConfig);
			if (name != null) {
				return name;
			}
			name = readOptionString(playerConfig, getEffective);
			return name;
		} catch (Throwable t) {
			return null;
		}
	}

	private static String readOptionString(Object playerConfig, Method reader) {
		try {
			Object value = reader.invoke(playerConfig, partyNameOption);
			if (value == null) {
				return null;
			}
			String name = value.toString().trim();
			return name.isEmpty() ? null : name;
		} catch (Throwable t) {
			return null;
		}
	}

	/**
	 * Синхронизация с OPAC Party name (на карте). Может не сработать, если parties.name
	 * не в playerConfigurablePlayerConfigOptions — тег в TAB всё равно из isnix-opac-tab.json.
	 */
	public static SetPartyNameResult setPartyNameForOwner(UUID ownerId, MinecraftServer server, String name) {
		if (!isAvailable() || ownerId == null || server == null || name == null || name.isBlank()) {
			return SetPartyNameResult.fail("OPAC недоступен или пустое имя.");
		}
		Object option = resolvePartyNameOption();
		if (option == null) {
			return SetPartyNameResult.fail("Опция parties.name не найдена в OPAC API.");
		}
		try {
			Object api = apiGet.invoke(null, server);
			Object configManager = getPlayerConfigManager.invoke(api);
			Object playerConfig = getLoadedConfig.invoke(configManager, ownerId);
			if (playerConfig == null) {
				return SetPartyNameResult.fail("Конфиг игрока не загружен в OPAC.");
			}
			String plain = stripLegacyCodes(name.trim());
			Method tryToSet = playerConfig.getClass().getMethod("tryToSet", optionSpecClass, Object.class);
			Object result = tryToSet.invoke(playerConfig, option, plain);
			if (result == null) {
				return SetPartyNameResult.fail("OPAC tryToSet вернул null.");
			}
			Method isSuccess = result.getClass().getMethod("isSuccess");
			if (Boolean.TRUE.equals(isSuccess.invoke(result))) {
				return SetPartyNameResult.ok();
			}
			String reason = readSetFailure(result);
			return SetPartyNameResult.fail(reason);
		} catch (Throwable t) {
			IsnixOpacTabMod.LOGGER.warn("setPartyName failed for {}: {}", ownerId, t.toString());
			return SetPartyNameResult.fail(t.getClass().getSimpleName() + ": " + t.getMessage());
		}
	}

	private static Object resolvePartyNameOption() {
		if (partyNameOption != null) {
			return partyNameOption;
		}
		try {
			Class<?> optionsClass = Class.forName(
					"xaero.pac.common.server.player.config.api.v2.PlayerConfigOptions");
			for (java.lang.reflect.Field field : optionsClass.getFields()) {
				if (!optionSpecClass.isAssignableFrom(field.getType())) {
					continue;
				}
				Object spec = field.get(null);
				if ("parties.name".equals(readOptionId(spec))) {
					partyNameOption = spec;
					return spec;
				}
			}
			for (java.lang.reflect.Field field : optionsClass.getFields()) {
				if (!optionSpecClass.isAssignableFrom(field.getType())) {
					continue;
				}
				String id = readOptionId(field.get(null));
				if (id != null && id.contains("parties") && id.contains("name")) {
					partyNameOption = field.get(null);
					return partyNameOption;
				}
			}
		} catch (Throwable ignored) {
		}
		return null;
	}

	private static String readOptionId(Object spec) {
		if (spec == null) {
			return null;
		}
		for (String method : new String[] {"getId", "getStringId", "getName"}) {
			try {
				Method m = spec.getClass().getMethod(method);
				Object v = m.invoke(spec);
				if (v != null) {
					return v.toString();
				}
			} catch (Throwable ignored) {
			}
		}
		return null;
	}

	private static String readSetFailure(Object result) {
		for (String method : new String[] {"getFailMessage", "getFailureMessage", "getMessage"}) {
			try {
				Method m = result.getClass().getMethod(method);
				Object v = m.invoke(result);
				if (v != null && !v.toString().isBlank()) {
					return v.toString();
				}
			} catch (Throwable ignored) {
			}
		}
		return "OPAC отклонил значение (проверьте parties.name в openpartiesandclaims-server.toml).";
	}

	private static String stripLegacyCodes(String input) {
		StringBuilder out = new StringBuilder();
		for (int i = 0; i < input.length(); i++) {
			char ch = input.charAt(i);
			if ((ch == '&' || ch == '§') && i + 1 < input.length()) {
				i++;
				continue;
			}
			out.append(ch);
		}
		return out.toString().trim();
	}

	public record SetPartyNameResult(boolean success, String message) {
		public static SetPartyNameResult ok() {
			return new SetPartyNameResult(true, "");
		}

		public static SetPartyNameResult fail(String message) {
			return new SetPartyNameResult(false, message);
		}
	}
}
