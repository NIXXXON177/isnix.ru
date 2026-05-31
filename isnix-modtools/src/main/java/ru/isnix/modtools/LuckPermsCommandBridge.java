package ru.isnix.modtools;

import net.minecraft.server.MinecraftServer;
import net.minecraft.server.command.ServerCommandSource;

public final class LuckPermsCommandBridge {
	private LuckPermsCommandBridge() {
	}

	public static void muteVoice(MinecraftServer server, String playerName, String lpDuration) {
		run(server, "lp user " + playerName + " permission settemp voicechat.speak false " + lpDuration);
	}

	public static void unmuteVoice(MinecraftServer server, String playerName) {
		run(server, "lp user " + playerName + " permission unset voicechat.speak");
	}

	private static void run(MinecraftServer server, String command) {
		ServerCommandSource source = server.getCommandSource()
				.withLevel(4)
				.withSilent();
		server.getCommandManager().executeWithPrefix(source, command);
	}
}
