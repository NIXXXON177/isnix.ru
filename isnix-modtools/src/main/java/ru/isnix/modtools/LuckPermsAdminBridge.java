package ru.isnix.modtools;

import net.minecraft.server.network.ServerPlayerEntity;

import java.util.Collection;
import java.util.UUID;

/** LuckPerms: группа admin (без jar в compile). */
public final class LuckPermsAdminBridge {
	private static boolean checked;
	private static boolean available;
	private static Object api;
	private static java.lang.reflect.Method getUserManager;
	private static java.lang.reflect.Method getUser;
	private static java.lang.reflect.Method getInheritedGroups;
	private static Object queryOptions;

	private LuckPermsAdminBridge() {
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
			getInheritedGroups = user.getMethod("getInheritedGroups", Class.forName("net.luckperms.api.query.QueryOptions"));
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

	public static boolean hasAdminGroup(ServerPlayerEntity player) {
		if (player == null || !isAvailable()) {
			return false;
		}
		String groupName = ModToolsConfig.get().luckpermsAdminGroup;
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
}
