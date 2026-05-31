package ru.isnix.modtools;

import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;

public final class MuteManager {
	private static ModerationStorage storage;

	private MuteManager() {
	}

	public static void bind(ModerationStorage s) {
		storage = s;
	}

	public static boolean blockChat(ServerPlayerEntity player) {
		if (storage == null) {
			return false;
		}
		ModerationStorage.TimedEntry mute = storage.getChatMute(player.getUuid());
		if (mute == null) {
			return false;
		}
		String msg = ModToolsConfig.get().chatMutedMessage
				.replace("%remaining%", TextColors.formatRemaining(mute.remainingMs()));
		player.sendMessage(TextColors.parse(msg), false);
		return true;
	}
}
