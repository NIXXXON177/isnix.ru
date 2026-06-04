package ru.isnix.reputation.command;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.suggestion.SuggestionProvider;
import net.minecraft.command.CommandSource;
import net.minecraft.server.command.CommandManager;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import ru.isnix.reputation.PermissionChecks;
import ru.isnix.reputation.ReputationCache;
import ru.isnix.reputation.ReputationConfig;
import ru.isnix.reputation.ReputationScore;
import ru.isnix.reputation.ReputationText;
import ru.isnix.reputation.SupabaseReputationService;
import ru.isnix.reputation.VoteResult;

public final class ReputationCommands {
	private static final SuggestionProvider<ServerCommandSource> ONLINE_PLAYERS =
			(ctx, builder) -> CommandSource.suggestMatching(
					ctx.getSource().getServer().getPlayerManager().getPlayerNames(), builder);

	private ReputationCommands() {
	}

	public static void register(CommandDispatcher<ServerCommandSource> dispatcher) {
		var root = CommandManager.literal("rep");

		dispatcher.register(root.then(CommandManager.literal("like")
				.then(CommandManager.argument("player", StringArgumentType.word())
						.suggests(ONLINE_PLAYERS)
						.executes(ctx -> vote(ctx, 1)))));

		dispatcher.register(root.then(CommandManager.literal("dislike")
				.then(CommandManager.argument("player", StringArgumentType.word())
						.suggests(ONLINE_PLAYERS)
						.executes(ctx -> vote(ctx, -1)))));

		dispatcher.register(root.then(CommandManager.literal("info")
				.executes(ctx -> info(ctx, null))
				.then(CommandManager.argument("player", StringArgumentType.word())
						.suggests(ONLINE_PLAYERS)
						.executes(ctx -> info(ctx, StringArgumentType.getString(ctx, "player"))))));

		dispatcher.register(root.then(CommandManager.literal("reload")
				.requires(source -> PermissionChecks.sourceAtLeast(source, ReputationConfig.get().opPermissionLevel))
				.executes(ReputationCommands::reload)));
	}

	private static int vote(CommandContext<ServerCommandSource> ctx, int voteValue) {
		if (!ReputationConfig.get().isReady()) {
			ctx.getSource().sendError(Text.literal("Рейтинг временно недоступен.").formatted(Formatting.RED));
			return 0;
		}
		if (voteValue < 0 && !ReputationConfig.get().allowDislikes) {
			ctx.getSource()
					.sendError(Text.literal("Дизы отключены на этом сервере — только лайки.")
							.formatted(Formatting.GRAY));
			return 0;
		}
		ServerPlayerEntity voter = ctx.getSource().getPlayer();
		if (voter == null) {
			ctx.getSource().sendError(Text.literal("Только для игроков.").formatted(Formatting.RED));
			return 0;
		}
		String target = StringArgumentType.getString(ctx, "player");
		if (target.equalsIgnoreCase(voter.getGameProfile().name())) {
			voter.sendMessage(ReputationText.parse(ReputationConfig.get().voteErrorSelf), false);
			return 0;
		}

		voter.sendMessage(Text.literal("Отправляем оценку…").formatted(Formatting.GRAY), false);
		SupabaseReputationService.voteAsync(voter.getGameProfile().name(), target, voteValue)
				.thenAccept(result -> voter.getEntityWorld().getServer().execute(() -> handleVoteResult(voter, target, voteValue, result)));
		return 1;
	}

	private static void handleVoteResult(
			ServerPlayerEntity voter, String targetNick, int voteValue, VoteResult result) {
		if (!result.ok()) {
			voter.sendMessage(ReputationText.parse(result.message()), false);
			return;
		}
		ReputationConfig cfg = ReputationConfig.get();
		String template = voteValue > 0 ? cfg.voteSuccessLike : cfg.voteSuccessDislike;
		voter.sendMessage(
				ReputationText.parse(cfg.applyPlaceholders(template, result.targetNick(), result.score())),
				false);

		ServerPlayerEntity target = voter.getEntityWorld().getServer().getPlayerManager().getPlayer(targetNick);
		if (target != null) {
			ReputationCache.put(target, result.score());
		}
		ReputationCache.refreshAsync(voter);
	}

	private static int info(CommandContext<ServerCommandSource> ctx, String targetNick) {
		ServerCommandSource source = ctx.getSource();
		if (!ReputationConfig.get().isReady()) {
			source.sendError(Text.literal("Рейтинг временно недоступен.").formatted(Formatting.RED));
			return 0;
		}
		String nick = targetNick;
		if (nick == null) {
			ServerPlayerEntity self = source.getPlayer();
			if (self == null) {
				source.sendError(Text.literal("Укажите ник: /rep info <игрок>").formatted(Formatting.RED));
				return 0;
			}
			nick = self.getGameProfile().name();
		}

		final String queryNick = nick;
		source.sendFeedback(() -> Text.literal("Загрузка рейтинга…").formatted(Formatting.GRAY), false);

		SupabaseReputationService.fetchReputationAsync(queryNick).thenAccept(score -> source.getServer()
				.execute(() -> source.sendFeedback(
						() -> Text.literal("Рейтинг ")
								.formatted(Formatting.GREEN)
								.append(Text.literal(queryNick).formatted(Formatting.WHITE))
								.append(Text.literal(": ★" + score.score()
										+ " (👍 " + score.likes() + ", 👎 " + score.dislikes() + ")")
										.formatted(Formatting.YELLOW)),
						false)));
		return 1;
	}

	private static int reload(CommandContext<ServerCommandSource> ctx) {
		ReputationConfig.reload();
		ctx.getSource()
				.sendFeedback(
						() -> Text.literal("ISNIX Reputation: конфиг перечитан.")
								.formatted(Formatting.GREEN),
						true);
		return 1;
	}
}
