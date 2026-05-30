package ru.isnix.opactab;

import eu.pb4.placeholders.api.PlaceholderResult;
import eu.pb4.placeholders.api.Placeholders;
import net.minecraft.util.Identifier;

public final class ClanTagPlaceholders {
	private static final Identifier CLAN_TAG = Identifier.of("isnix", "clan_tag");

	private ClanTagPlaceholders() {
	}

	public static void register() {
		Placeholders.register(CLAN_TAG, (ctx, arg) -> {
			if (!ctx.hasPlayer()) {
				return PlaceholderResult.value("");
			}
			var player = ctx.player();
			if (!(player instanceof net.minecraft.server.network.ServerPlayerEntity serverPlayer)) {
				return PlaceholderResult.value("");
			}
			ClanTagCache.put(serverPlayer);
			return PlaceholderResult.value(ClanTagCache.get(serverPlayer.getUuid()));
		});
	}
}
