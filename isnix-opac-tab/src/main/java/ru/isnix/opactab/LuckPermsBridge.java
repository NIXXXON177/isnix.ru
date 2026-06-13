package ru.isnix.opactab;

import net.minecraft.server.network.ServerPlayerEntity;

import java.util.UUID;

/** LuckPerms через reflection — jar не нужен при сборке. */
public final class LuckPermsBridge {
	private static boolean checked;
	private static boolean available;
	private static Object api;
	private static java.lang.reflect.Method getUserManager;
	private static java.lang.reflect.Method getUser;
	private static java.lang.reflect.Method getCachedData;
	private static java.lang.reflect.Method getMetaData;
	private static java.lang.reflect.Method getPrefix;
	private static java.lang.reflect.Method getSuffix;

	// Проверка ноды прав — резолвится лениво (отдельно от meta, чтобы не ломать prefix/suffix).
	private static boolean permChecked;
	private static java.lang.reflect.Method getPermissionData;
	private static java.lang.reflect.Method checkPermission;
	private static java.lang.reflect.Method tristateAsBoolean;

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
			Class<?> cached = Class.forName("net.luckperms.api.cacheddata.CachedDataManager");
			getMetaData = cached.getMethod("getMetaData");
			Class<?> meta = Class.forName("net.luckperms.api.cacheddata.CachedMetaData");
			getPrefix = meta.getMethod("getPrefix");
			getSuffix = meta.getMethod("getSuffix");
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
		return meta(player, getPrefix);
	}

	public static String suffix(ServerPlayerEntity player) {
		return meta(player, getSuffix);
	}

	private static String meta(ServerPlayerEntity player, java.lang.reflect.Method reader) {
		if (player == null || !isAvailable() || reader == null) {
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
			Object value = reader.invoke(meta);
			if (value == null) {
				return "";
			}
			String s = value.toString();
			return s.isBlank() ? "" : s;
		} catch (Throwable t) {
			return "";
		}
	}

	private static void ensurePerm() {
		if (permChecked) {
			return;
		}
		permChecked = true;
		try {
			Class<?> cached = Class.forName("net.luckperms.api.cacheddata.CachedDataManager");
			getPermissionData = cached.getMethod("getPermissionData");
			Class<?> permData = Class.forName("net.luckperms.api.cacheddata.CachedPermissionData");
			checkPermission = permData.getMethod("checkPermission", String.class);
			Class<?> tristate = Class.forName("net.luckperms.api.util.Tristate");
			tristateAsBoolean = tristate.getMethod("asBoolean");
		} catch (Throwable ignored) {
		}
	}

	/** Есть ли у игрока нода прав LuckPerms (false, если LP недоступен или нода не задана). */
	public static boolean hasPermission(ServerPlayerEntity player, String node) {
		if (player == null || node == null || node.isBlank() || !isAvailable()) {
			return false;
		}
		ensurePerm();
		if (getPermissionData == null) {
			return false;
		}
		try {
			Object userManager = getUserManager.invoke(api);
			Object user = getUser.invoke(userManager, player.getUuid());
			if (user == null) {
				return false;
			}
			Object cached = getCachedData.invoke(user);
			Object permData = getPermissionData.invoke(cached);
			Object tri = checkPermission.invoke(permData, node);
			Object bool = tristateAsBoolean.invoke(tri);
			return Boolean.TRUE.equals(bool);
		} catch (Throwable t) {
			return false;
		}
	}
}
