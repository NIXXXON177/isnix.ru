package ru.isnix.opactab;

import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.MutableText;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

/** Префикс LP + ник + тег клана (суффикс) — как в TAB. */
public final class PlayerDisplayFormat {
	private PlayerDisplayFormat() {
	}

	public static Text withPrefixSuffixAndClan(ServerPlayerEntity player) {
		if (player == null) {
			return Text.empty();
		}
		MutableText out = Text.empty();
		String lpPrefix = LuckPermsBridge.prefix(player);
		if (!lpPrefix.isEmpty()) {
			out.append(LegacyTexts.parse(lpPrefix));
		}
		out.append(player.getName().copy());
		String lpSuffix = LuckPermsBridge.suffix(player);
		if (!lpSuffix.isEmpty()) {
			out.append(LegacyTexts.parse(lpSuffix));
		}
		String clan = ClanTagCache.get(player.getUuid());
		if (clan.isEmpty()) {
			clan = ClanTagFormatter.formatForPlayer(player);
		}
		if (!clan.isEmpty()) {
			if (!clan.startsWith(" ")) {
				out.append(Text.literal(" "));
			}
			out.append(LegacyTexts.parse(clan));
		}
		return out;
	}

	public static ServerPlayerEntity findByNick(MinecraftServer server, String nick) {
		if (server == null || nick == null || nick.isEmpty()) {
			return null;
		}
		return server.getPlayerManager().getPlayer(nick);
	}
}
