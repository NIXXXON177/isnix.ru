package ru.isnix.modtools;

import net.minecraft.command.permission.LeveledPermissionPredicate;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.command.ServerCommandSource;

public final class LuckPermsCommandBridge {
	private LuckPermsCommandBridge() {
	}

	public static void muteVoice(MinecraftServer server, String playerName, String lpDuration) {
		String user = quoteLpUsername(playerName);
		run(server, "lp user " + user + " permission settemp voicechat.speak false " + lpDuration);
	}

	public static void unmuteVoice(MinecraftServer server, String playerName) {
		String user = quoteLpUsername(playerName);
		// mutevoice использует settemp — снимается только unsettemp (+ unset на всякий случай)
		run(server, "lp user " + user + " permission unsettemp voicechat.speak");
		run(server, "lp user " + user + " permission unset voicechat.speak");
		run(server, "lp sync");
	}

	private static String quoteLpUsername(String playerName) {
		if (playerName == null || playerName.isBlank()) {
			return "\"\"";
		}
		return "\"" + playerName.replace("\"", "\\\"") + "\"";
	}

	private static void run(MinecraftServer server, String command) {
		ServerCommandSource source = server.getCommandSource()
				.withPermissions(LeveledPermissionPredicate.OWNERS)
				.withSilent();
		String cmd = command.startsWith("/") ? command.substring(1) : command;
		server.getCommandManager().parseAndExecute(source, cmd);
	}
}
