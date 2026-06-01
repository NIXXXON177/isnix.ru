package ru.isnix.stats;

import net.minecraft.server.network.ServerPlayerEntity;

import java.util.Collection;
import java.util.UUID;
import java.util.regex.Pattern;

/** LuckPerms через reflection (jar не нужен при сборке). */
public final class LuckPermsBridge {
	private static final Pattern FORMAT = Pattern.compile("(?i)[&§][0-9a-fk-or]");
	private static boolean checked;
	private static boolean available;
	private static Object api;
	private static java.lang.reflect.Method getUserManager;
	private static java.lang.reflect.Method getUser;
	private static java.lang.reflect.Method getCachedData;
	private static java.lang.reflect.Method getMetaData;
	private static java.lang.reflect.Method getPrefix;
	private static java.lang.reflect.Method getInheritedGroups;
	private static Object queryOptions;

	private LuckPermsBridge() {
	}

	private static void init() {
		if (checked) {
			return;
		}
		checked = true;
		try {
			Class<?> provider = Class.forName("net.luckperms.api.LuckPermsProvider");
			api = provider.getMethod("get").invoke(null);
			getUserManager = api.getClass().getMethod("getUserManager");
			Class<?> userManager = Class.forName("net.luckperms.api.model.user.UserManager");
			getUser = userManager.getMethod("getUser", UUID.class);
			Class<?> user = Class.forName("net.luckperms.api.model.user.User");
			getCachedData = user.getMethod("getCachedData");
			getInheritedGroups = user.getMethod("getInheritedGroups", Class.forName("net.luckperms.api.query.QueryOptions"));
			Class<?> cached = Class.forName("net.luckperms.api.cacheddata.CachedDataManager");
			getMetaData = cached.getMethod("getMetaData");
			Class<?> meta = Class.forName("net.luckperms.api.cacheddata.CachedMetaData");
			getPrefix = meta.getMethod("getPrefix");
			Class<?> queryOptionsClass = Class.forName("net.luckperms.api.query.QueryOptions");
			queryOptions = queryOptionsClass.getMethod("nonContextual").invoke(null);
			available = true;
		} catch (Throwable t) {
			available = false;
		}
	}

	public static boolean isAvailable() {
		init();
		return available;
	}

	public static String prefix(ServerPlayerEntity player) {
		if (player == null || !isAvailable() || getPrefix == null) {
			return "";
		}
		try {
			Object userManager = getUserManager.invoke(api);
			Object user = getUser.invoke(userManager, player.getUuid());
			if (user == null) {
				return "";
			}
			Object cached = getCachedData.invoke(user);
			Object meta = getMetaData.invoke(cached);
			Object value = getPrefix.invoke(meta);
			if (value == null) {
				return "";
			}
			String s = value.toString();
			return s.isBlank() ? "" : s;
		} catch (Throwable t) {
			return "";
		}
	}

	public static boolean hasAdminGroup(ServerPlayerEntity player) {
		if (player == null || !isAvailable()) {
			return false;
		}
		String groupName = StatsConfig.get().luckpermsAdminGroup;
		try {
			Object userManager = getUserManager.invoke(api);
			Object user = getUser.invoke(userManager, player.getUuid());
			if (user == null) {
				return false;
			}
			@SuppressWarnings("unchecked")
			Collection<String> groups = (Collection<String>) getInheritedGroups.invoke(user, queryOptions);
			if (groups == null) {
				return false;
			}
			for (String g : groups) {
				if (groupName.equalsIgnoreCase(g)) {
					return true;
				}
			}
			return false;
		} catch (Throwable t) {
			return false;
		}
	}

	public static String stripFormat(String raw) {
		if (raw == null || raw.isBlank()) {
			return "";
		}
		return FORMAT.matcher(raw).replaceAll("").trim();
	}
}
