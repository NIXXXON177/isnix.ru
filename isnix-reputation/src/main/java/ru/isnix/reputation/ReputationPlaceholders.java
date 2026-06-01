package ru.isnix.reputation;

import eu.pb4.placeholders.api.PlaceholderResult;
import eu.pb4.placeholders.api.Placeholders;
import net.minecraft.util.Identifier;

public final class ReputationPlaceholders {
	private static final Identifier REP = Identifier.of("isnix", "rep");
	private static final Identifier REP_SCORE = Identifier.of("isnix", "rep_score");
	private static final Identifier REP_LIKES = Identifier.of("isnix", "rep_likes");
	private static final Identifier REP_DISLIKES = Identifier.of("isnix", "rep_dislikes");

	private ReputationPlaceholders() {
	}

	public static void register() {
		Placeholders.register(REP, (ctx, arg) -> {
			if (!ctx.hasPlayer()) {
				return PlaceholderResult.value("");
			}
			var player = ctx.player();
			if (!(player instanceof net.minecraft.server.network.ServerPlayerEntity serverPlayer)) {
				return PlaceholderResult.value("");
			}
			if (!ReputationConfig.get().isReady()) {
				return PlaceholderResult.value("");
			}
			return PlaceholderResult.value(ReputationCache.formatted(serverPlayer));
		});

		Placeholders.register(REP_SCORE, (ctx, arg) -> number(ctx, ReputationScore::score));
		Placeholders.register(REP_LIKES, (ctx, arg) -> number(ctx, ReputationScore::likes));
		Placeholders.register(REP_DISLIKES, (ctx, arg) -> number(ctx, ReputationScore::dislikes));
	}

	private static PlaceholderResult number(
			eu.pb4.placeholders.api.PlaceholderContext ctx,
			java.util.function.ToLongFunction<ReputationScore> getter) {
		if (!ctx.hasPlayer()) {
			return PlaceholderResult.value("0");
		}
		var player = ctx.player();
		if (!(player instanceof net.minecraft.server.network.ServerPlayerEntity serverPlayer)) {
			return PlaceholderResult.value("0");
		}
		long value = getter.applyAsLong(ReputationCache.get(serverPlayer));
		return PlaceholderResult.value(Long.toString(value));
	}
}
