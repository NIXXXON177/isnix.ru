package ru.isnix.opactab;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.server.command.CommandManager;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

import java.util.UUID;

public final class ClanTagCommands {
	private ClanTagCommands() {
	}

	public static void register(CommandDispatcher<ServerCommandSource> dispatcher) {
		var root = CommandManager.literal("clantag")
				.then(CommandManager.literal("help").executes(ctx -> help(ctx.getSource())))
				.then(CommandManager.literal("color")
						.then(CommandManager.argument("value", StringArgumentType.word())
								.executes(ctx -> setColor(ctx.getSource(), StringArgumentType.getString(ctx, "value")))))
				.then(CommandManager.literal("bold")
						.then(CommandManager.literal("on").executes(ctx -> setBold(ctx.getSource(), true)))
						.then(CommandManager.literal("off").executes(ctx -> setBold(ctx.getSource(), false))))
				.then(CommandManager.literal("italic")
						.then(CommandManager.literal("on").executes(ctx -> setItalic(ctx.getSource(), true)))
						.then(CommandManager.literal("off").executes(ctx -> setItalic(ctx.getSource(), false))))
				.then(CommandManager.literal("underline")
						.then(CommandManager.literal("on").executes(ctx -> setUnderline(ctx.getSource(), true)))
						.then(CommandManager.literal("off").executes(ctx -> setUnderline(ctx.getSource(), false))))
				.then(CommandManager.literal("strike")
						.then(CommandManager.literal("on").executes(ctx -> setStrike(ctx.getSource(), true)))
						.then(CommandManager.literal("off").executes(ctx -> setStrike(ctx.getSource(), false))))
				.then(CommandManager.literal("reset").executes(ctx -> reset(ctx.getSource())))
				.then(CommandManager.literal("name")
						.then(CommandManager.argument("value", StringArgumentType.greedyString())
								.executes(ctx -> setName(ctx.getSource(), StringArgumentType.getString(ctx, "value")))))
				.then(CommandManager.literal("show").executes(ctx -> show(ctx.getSource())))
				.then(CommandManager.literal("sync").executes(ctx -> sync(ctx.getSource())))
				.then(CommandManager.literal("preview").executes(ctx -> preview(ctx.getSource())));
		dispatcher.register(root);
	}

	private static int help(ServerCommandSource source) {
		source.sendFeedback(
				() -> Text.literal("═══ /clantag (владелец клана) ═══").formatted(Formatting.GOLD, Formatting.BOLD),
				false);
		sendLine(source, "/clantag name [Тег]", "текст в OPAC Party name (1–32 симв.)");
		sendLine(source, "/clantag color <цвет>", "gold, red, 6, &6… — см. /clantag show");
		sendLine(source, "/clantag bold|italic|underline|strike on|off", "оформление тега в TAB");
		sendLine(source, "/clantag reset", "сброс цвета и стилей (текст клана не трогает)");
		sendLine(source, "/clantag preview", "как тег видят другие в TAB");
		sendLine(source, "/clantag show", "текущие настройки (всем в клане)");
		sendLine(source, "Либо в Party name коды: &6&l[GKSAS]", "тогда /clantag color не нужен");
		return 1;
	}

	private static void sendLine(ServerCommandSource source, String cmd, String desc) {
		source.sendFeedback(
				() -> Text.literal(cmd).formatted(Formatting.GREEN)
						.append(Text.literal(" — " + desc).formatted(Formatting.GRAY)),
				false);
	}

	private static ServerPlayerEntity requireOwnerPlayer(ServerCommandSource source) {
		ServerPlayerEntity player = source.getPlayer();
		if (player == null) {
			return null;
		}
		if (!OpacBridge.isPlayerInClan(player)) {
			source.sendError(Text.literal("Вы не в клане OPAC."));
			return null;
		}
		UUID ownerId = OpacBridge.getPartyOwnerId(player);
		if (ownerId == null) {
			source.sendError(Text.literal("Не удалось определить клан OPAC."));
			return null;
		}
		if (!ownerId.equals(player.getUuid())) {
			source.sendError(Text.literal("Только владелец клана может менять оформление тега."));
			return null;
		}
		return player;
	}

	private static void refreshAndPreview(ServerCommandSource source, ServerPlayerEntity player) {
		ClanTagCache.refreshAll(player.getServer());
		String legacy = ClanTagFormatter.formatForPlayer(player);
		source.sendFeedback(
				() -> Text.literal("В TAB: ").formatted(Formatting.GRAY)
						.append(LegacyTexts.parse(legacy.isEmpty() ? "&7(пусто)" : legacy)),
				false);
	}

	private static int setColor(ServerCommandSource source, String value) {
		ServerPlayerEntity player = requireOwnerPlayer(source);
		if (player == null) {
			return 0;
		}
		ClanTagConfig.ClanStyle style = getOrCreate(player.getUuid());
		style.color = value;
		ClanTagConfig.putStyle(player.getUuid(), style);
		refreshAndPreview(source, player);
		return 1;
	}

	private static int setBold(ServerCommandSource source, boolean bold) {
		return setFlag(source, bold, Flag.BOLD);
	}

	private static int setItalic(ServerCommandSource source, boolean italic) {
		return setFlag(source, italic, Flag.ITALIC);
	}

	private static int setUnderline(ServerCommandSource source, boolean underline) {
		return setFlag(source, underline, Flag.UNDERLINE);
	}

	private static int setStrike(ServerCommandSource source, boolean strike) {
		return setFlag(source, strike, Flag.STRIKE);
	}

	private enum Flag {
		BOLD,
		ITALIC,
		UNDERLINE,
		STRIKE
	}

	private static int setFlag(ServerCommandSource source, boolean on, Flag flag) {
		ServerPlayerEntity player = requireOwnerPlayer(source);
		if (player == null) {
			return 0;
		}
		ClanTagConfig.ClanStyle style = getOrCreate(player.getUuid());
		switch (flag) {
			case BOLD -> style.bold = on;
			case ITALIC -> style.italic = on;
			case UNDERLINE -> style.underline = on;
			case STRIKE -> style.strikethrough = on;
		}
		ClanTagConfig.putStyle(player.getUuid(), style);
		refreshAndPreview(source, player);
		return 1;
	}

	private static int reset(ServerCommandSource source) {
		ServerPlayerEntity player = requireOwnerPlayer(source);
		if (player == null) {
			return 0;
		}
		ClanTagConfig.putStyle(player.getUuid(), ClanTagConfig.ClanStyle.defaults());
		source.sendFeedback(() -> Text.literal("Стиль тега сброшен (цвет серый, без жирного/курсива)."), false);
		refreshAndPreview(source, player);
		return 1;
	}

	private static int setName(ServerCommandSource source, String value) {
		ServerPlayerEntity player = requireOwnerPlayer(source);
		if (player == null) {
			return 0;
		}
		String trimmed = value.trim();
		if (trimmed.isEmpty() || trimmed.length() > 32) {
			source.sendError(Text.literal("Имя клана: 1–32 символа."));
			return 0;
		}
		if (!OpacBridge.setPartyNameForOwner(player.getUuid(), player.getServer(), trimmed)) {
			source.sendError(Text.literal("Не удалось сохранить Party name в OPAC."));
			return 0;
		}
		refreshAndPreview(source, player);
		return 1;
	}

	private static int preview(ServerCommandSource source) {
		ServerPlayerEntity player = requireOwnerPlayer(source);
		if (player == null) {
			return 0;
		}
		refreshAndPreview(source, player);
		return 1;
	}

	private static int show(ServerCommandSource source) {
		ServerPlayerEntity player = source.getPlayer();
		if (player == null) {
			return 0;
		}
		if (!OpacBridge.isPlayerInClan(player)) {
			source.sendError(Text.literal("Вы не в клане."));
			return 0;
		}
		UUID ownerId = OpacBridge.getPartyOwnerId(player);
		if (ownerId == null) {
			source.sendError(Text.literal("Не удалось определить клан OPAC."));
			return 0;
		}
		String name = OpacBridge.getPartyNameForPlayer(player);
		int members = OpacBridge.getPartyMemberCount(player);
		ClanTagConfig.ClanStyle resolved = ClanTagConfig.styleFor(ownerId);
		if (resolved == null) {
			resolved = ClanTagConfig.ClanStyle.defaults();
		}
		final ClanTagConfig.ClanStyle style = resolved;
		boolean isOwner = ownerId.equals(player.getUuid());
		final String legacy = ClanTagFormatter.formatForPlayer(player);
		source.sendFeedback(
				() -> Text.literal("Клан: ").formatted(Formatting.YELLOW)
						.append(Text.literal(name == null ? "—" : name).formatted(Formatting.WHITE))
						.append(Text.literal(" | участников: " + members).formatted(Formatting.GRAY)),
				false);
		source.sendFeedback(
				() -> Text.literal("Владелец: ").formatted(Formatting.GRAY)
						.append(Text.literal(isOwner ? "вы" : ownerId.toString()).formatted(Formatting.WHITE)),
				false);
		source.sendFeedback(
				() -> Text.literal("Стиль: цвет=").formatted(Formatting.GRAY)
						.append(Text.literal(style.color).formatted(Formatting.WHITE))
						.append(Text.literal(
								" bold=" + style.bold
										+ " italic=" + style.italic
										+ " underline=" + style.underline
										+ " strike=" + style.strikethrough).formatted(Formatting.DARK_GRAY)),
				false);
		source.sendFeedback(
				() -> Text.literal("В TAB: ").formatted(Formatting.GRAY)
						.append(LegacyTexts.parse(legacy.isEmpty() ? "&7—" : legacy)),
				false);
		if (isOwner) {
			source.sendFeedback(
					() -> Text.literal("Цвета: black, dark_red, gold, green, aqua, red, yellow, white или 0–f")
							.formatted(Formatting.DARK_GRAY),
					false);
		}
		return 1;
	}

	private static int sync(ServerCommandSource source) {
		ServerPlayerEntity player = requireOwnerPlayer(source);
		if (player == null) {
			return 0;
		}
		ClanTagCache.refreshAll(player.getServer());
		source.sendFeedback(
				() -> Text.literal("Тег обновлён из Party name OPAC (клавиша ')."),
				false);
		refreshAndPreview(source, player);
		return 1;
	}

	private static ClanTagConfig.ClanStyle getOrCreate(UUID ownerId) {
		ClanTagConfig.ClanStyle style = ClanTagConfig.styleFor(ownerId);
		if (style == null) {
			style = ClanTagConfig.ClanStyle.defaults();
		}
		return style;
	}
}
