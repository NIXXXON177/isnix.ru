package ru.isnix.modtools.command;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import net.minecraft.command.argument.EntityArgumentType;
import net.minecraft.server.command.CommandManager;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import ru.isnix.modtools.AdminAccess;
import ru.isnix.modtools.DurationParser;
import ru.isnix.modtools.FreezeManager;
import ru.isnix.modtools.IsnixModToolsMod;
import ru.isnix.modtools.LuckPermsCommandBridge;
import ru.isnix.modtools.ModToolsConfig;
import ru.isnix.modtools.ModerationStorage;
import ru.isnix.modtools.TextColors;

public final class ModToolsCommands {
	private ModToolsCommands() {
	}

	public static void register(CommandDispatcher<ServerCommandSource> dispatcher) {
		var admin = CommandManager.literal("mute")
				.requires(ModToolsCommands::isAdmin);

		dispatcher.register(admin
				.then(CommandManager.argument("player", EntityArgumentType.player())
						.then(CommandManager.argument("duration", StringArgumentType.word())
								.executes(ctx -> muteChat(ctx, ""))
								.then(CommandManager.argument("reason", StringArgumentType.greedyString())
										.executes(ctx -> muteChat(
												ctx,
												StringArgumentType.getString(ctx, "reason")))))));

		dispatcher.register(CommandManager.literal("unmute")
				.requires(ModToolsCommands::isAdmin)
				.then(CommandManager.argument("player", EntityArgumentType.player())
						.executes(ModToolsCommands::unmuteChat)));

		dispatcher.register(CommandManager.literal("mutevoice")
				.requires(ModToolsCommands::isAdmin)
				.then(CommandManager.argument("player", EntityArgumentType.player())
						.then(CommandManager.argument("duration", StringArgumentType.word())
								.executes(ctx -> muteVoice(ctx, ""))
								.then(CommandManager.argument("reason", StringArgumentType.greedyString())
										.executes(ctx -> muteVoice(
												ctx,
												StringArgumentType.getString(ctx, "reason")))))));

		dispatcher.register(CommandManager.literal("unmutevoice")
				.requires(ModToolsCommands::isAdmin)
				.then(CommandManager.argument("player", EntityArgumentType.player())
						.executes(ModToolsCommands::unmuteVoice)));

		dispatcher.register(CommandManager.literal("freeze")
				.requires(ModToolsCommands::isAdmin)
				.then(CommandManager.argument("player", EntityArgumentType.player())
						.executes(ctx -> freeze(ctx, ""))
						.then(CommandManager.argument("reason", StringArgumentType.greedyString())
								.executes(ctx -> freeze(
										ctx,
										StringArgumentType.getString(ctx, "reason"))))));

		dispatcher.register(CommandManager.literal("unfreeze")
				.requires(ModToolsCommands::isAdmin)
				.then(CommandManager.argument("player", EntityArgumentType.player())
						.executes(ModToolsCommands::unfreeze)));
	}

	private static boolean isAdmin(ServerCommandSource source) {
		return AdminAccess.canUseModTools(source);
	}

	private static int muteChat(CommandContext<ServerCommandSource> ctx, String reason) throws CommandSyntaxException {
		ServerPlayerEntity target = EntityArgumentType.getPlayer(ctx, "player");
		String durationRaw = StringArgumentType.getString(ctx, "duration");
		long ms = DurationParser.parseMillis(durationRaw);
		if (ms <= 0) {
			ctx.getSource().sendError(Text.literal("Неверное время. Примеры: 30m, 1h, 2d, 1h30m"));
			return 0;
		}
		ServerPlayerEntity actor = ctx.getSource().getPlayer();
		String actorName = actor != null ? actor.getGameProfile().getName() : "Console";
		long until = System.currentTimeMillis() + ms;
		IsnixModToolsMod.storage().setChatMute(
				target.getUuid(),
				target.getGameProfile().getName(),
				until,
				actorName,
				reason);
		broadcastAdmin(ctx.getSource(),
				"Чат-мут " + target.getGameProfile().getName()
						+ " на " + durationRaw
						+ (reason.isBlank() ? "" : " («" + reason + "»)"));
		target.sendMessage(TextColors.parse(
				"&cВас замьючили в чате на &f" + durationRaw), false);
		return 1;
	}

	private static int unmuteChat(CommandContext<ServerCommandSource> ctx) throws CommandSyntaxException {
		ServerPlayerEntity target = EntityArgumentType.getPlayer(ctx, "player");
		IsnixModToolsMod.storage().clearChatMute(target.getUuid());
		broadcastAdmin(ctx.getSource(), "Снят чат-мут с " + target.getGameProfile().getName());
		target.sendMessage(Text.literal("Чат-мут снят.").formatted(Formatting.GREEN), false);
		return 1;
	}

	private static int muteVoice(CommandContext<ServerCommandSource> ctx, String reason) throws CommandSyntaxException {
		ServerPlayerEntity target = EntityArgumentType.getPlayer(ctx, "player");
		String durationRaw = StringArgumentType.getString(ctx, "duration");
		long ms = DurationParser.parseMillis(durationRaw);
		if (ms <= 0) {
			ctx.getSource().sendError(Text.literal("Неверное время. Примеры: 30m, 1h, 2d"));
			return 0;
		}
		String lpDur = DurationParser.toLuckPermsDuration(durationRaw);
		LuckPermsCommandBridge.muteVoice(
				ctx.getSource().getServer(),
				target.getGameProfile().getName(),
				lpDur);
		ServerPlayerEntity actor = ctx.getSource().getPlayer();
		String actorName = actor != null ? actor.getGameProfile().getName() : "Console";
		IsnixModToolsMod.storage().setVoiceMute(
				target.getUuid(),
				target.getGameProfile().getName(),
				System.currentTimeMillis() + ms,
				actorName,
				reason);
		broadcastAdmin(ctx.getSource(),
				"Мут микрофона " + target.getGameProfile().getName() + " на " + durationRaw);
		target.sendMessage(TextColors.parse(
				"&cВам запрещено говорить в голосовом чате на &f" + durationRaw), false);
		return 1;
	}

	private static int unmuteVoice(CommandContext<ServerCommandSource> ctx) throws CommandSyntaxException {
		ServerPlayerEntity target = EntityArgumentType.getPlayer(ctx, "player");
		LuckPermsCommandBridge.unmuteVoice(ctx.getSource().getServer(), target.getGameProfile().getName());
		IsnixModToolsMod.storage().clearVoiceMute(target.getUuid());
		broadcastAdmin(ctx.getSource(), "Снят мут микрофона с " + target.getGameProfile().getName());
		target.sendMessage(Text.literal("Мут микрофона снят.").formatted(Formatting.GREEN), false);
		return 1;
	}

	private static int freeze(CommandContext<ServerCommandSource> ctx, String reason) throws CommandSyntaxException {
		ServerPlayerEntity target = EntityArgumentType.getPlayer(ctx, "player");
		if (FreezeManager.isFrozen(target)) {
			ctx.getSource().sendError(Text.literal("Игрок уже заморожен."));
			return 0;
		}
		IsnixModToolsMod.storage().freeze(target, actorName(ctx), reason);
		broadcastAdmin(ctx.getSource(), "Заморожен " + target.getGameProfile().getName());
		target.sendMessage(TextColors.parse(ModToolsConfig.get().frozenMessage), false);
		return 1;
	}

	private static int unfreeze(CommandContext<ServerCommandSource> ctx) throws CommandSyntaxException {
		ServerPlayerEntity target = EntityArgumentType.getPlayer(ctx, "player");
		if (!FreezeManager.isFrozen(target)) {
			ctx.getSource().sendError(Text.literal("Игрок не заморожен."));
			return 0;
		}
		IsnixModToolsMod.storage().unfreeze(target.getUuid());
		broadcastAdmin(ctx.getSource(), "Разморожен " + target.getGameProfile().getName());
		target.sendMessage(Text.literal("Заморозка снята.").formatted(Formatting.GREEN), false);
		return 1;
	}

	private static String actorName(CommandContext<ServerCommandSource> ctx) {
		ServerPlayerEntity actor = ctx.getSource().getPlayer();
		return actor != null ? actor.getGameProfile().getName() : "Console";
	}

	private static void broadcastAdmin(ServerCommandSource source, String line) {
		Text msg = Text.literal("[ModTools] ").formatted(Formatting.DARK_AQUA)
				.append(Text.literal(line).formatted(Formatting.YELLOW));
		source.sendFeedback(() -> msg, true);
		IsnixModToolsMod.LOGGER.info("[modtools] {}", line);
	}
}
