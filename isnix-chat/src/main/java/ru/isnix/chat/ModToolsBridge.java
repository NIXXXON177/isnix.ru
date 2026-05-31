package ru.isnix.chat;

import net.minecraft.server.network.ServerPlayerEntity;

/** Опциональная связка с isnix-modtools (без жёсткой зависимости при сборке). */
final class ModToolsBridge {
	private static final String MUTE_MANAGER = "ru.isnix.modtools.MuteManager";
	private static java.lang.reflect.Method blockChat;

	private ModToolsBridge() {
	}

	static boolean blockChat(ServerPlayerEntity sender) {
		try {
			if (blockChat == null) {
				Class<?> cls = Class.forName(MUTE_MANAGER);
				blockChat = cls.getMethod("blockChat", ServerPlayerEntity.class);
			}
			Object result = blockChat.invoke(null, sender);
			return result instanceof Boolean b && b;
		} catch (ClassNotFoundException e) {
			return false;
		} catch (Throwable t) {
			return false;
		}
	}
}
