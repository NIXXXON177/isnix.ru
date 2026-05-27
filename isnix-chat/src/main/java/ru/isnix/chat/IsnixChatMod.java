package ru.isnix.chat;

import net.fabricmc.api.DedicatedServerModInitializer;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerLifecycleEvents;
import net.fabricmc.fabric.api.message.v1.ServerMessageEvents;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class IsnixChatMod implements DedicatedServerModInitializer {
	public static final String MOD_ID = "isnix_chat";
	public static final Logger LOGGER = LoggerFactory.getLogger(MOD_ID);

	@Override
	public void onInitializeServer() {
		ServerLifecycleEvents.SERVER_STARTING.register(server -> ChatConfig.load());

		ServerMessageEvents.ALLOW_CHAT_MESSAGE.register((message, sender, params) -> {
			if (ChatHandler.handle(message, sender, params)) {
				return true;
			}
			return false;
		});

		LOGGER.info("ISNIX Chat: локальный радиус {} блоков, глобальный префикс «{}»",
				ChatConfig.get().localRadius,
				ChatConfig.get().globalPrefix);
	}
}
