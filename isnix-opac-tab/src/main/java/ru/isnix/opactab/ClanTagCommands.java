package ru.isnix.opactab;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.server.command.CommandManager;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;

import java.util.UUID;

public final class ClanTagCommands {
	private ClanTagCommands() {
	}

	public static void register(CommandDispatcher<ServerCommandSource> dispatcher) {
		dispatcher.register(CommandManager.literal("clantag")
				.then(CommandManager.literal("color")
						.then(CommandManager.argument("value", StringArgumentType.word())
								.executes(ctx -> setColor(ctx.getSource(), StringArgumentType.getString(ctx, "value")))))
				.then(CommandManager.literal("bold")
						.then(CommandManager.literal("on").executes(ctx -> setBold(ctx.getSource(), true)))
						.then(CommandManager.literal("off").executes(ctx -> setBold(ctx.getSource(), false))))
				.then(CommandManager.literal("name")
						.then(CommandManager.argument("value", StringArgumentType.greedyString())
								.executes(ctx -> setName(ctx.getSource(), StringArgumentType.getString(ctx, "value")))))
				.then(CommandManager.literal("show").executes(ctx -> show(ctx.getSource())))
				.then(CommandManager.literal("sync").executes(ctx -> sync(ctx.getSource()))));
	}

	private static int requireOwner(ServerCommandSource source) {
		ServerPlayerEntity player = source.getPlayer();
		if (player == null) {
			return 0;
		}
		if (!OpacBridge.isPlayerInClan(player)) {
			source.sendError(Text.literal("Вы не в клане OPAC."));
			return 0;
		}
		UUID ownerId = OpacBridge.getPartyOwnerId(player);
		if (ownerId == null) {
			source.sendError(Text.literal("Не удалось определить клан OPAC."));
			return 0;
		}
		if (!ownerId.equals(player.getUuid())) {
			source.sendError(Text.literal("Только владелец клана может менять тег в TAB."));
			return 0;
		}
		return 1;
	}

	private static int setColor(ServerCommandSource source, String value) {
		if (requireOwner(source) == 0) {
			return 0;
		}
		ServerPlayerEntity player = source.getPlayer();
		ClanTagConfig.ClanStyle style = getOrCreate(player.getUuid());
		style.color = value;
		ClanTagConfig.putStyle(player.getUuid(), style);
		source.sendFeedback(() -> Text.literal("Цвет тега клана: " + value), false);
		return 1;
	}

	private static int setBold(ServerCommandSource source, boolean bold) {
		if (requireOwner(source) == 0) {
			return 0;
		}
		ServerPlayerEntity player = source.getPlayer();
		ClanTagConfig.ClanStyle style = getOrCreate(player.getUuid());
		style.bold = bold;
		ClanTagConfig.putStyle(player.getUuid(), style);
		source.sendFeedback(() -> Text.literal("Жирность тега: " + (bold ? "вкл" : "выкл")), false);
		return 1;
	}

	private static int setName(ServerCommandSource source, String value) {
		if (requireOwner(source) == 0) {
			return 0;
		}
		String trimmed = value.trim();
		if (trimmed.isEmpty() || trimmed.length() > 32) {
			source.sendError(Text.literal("Имя клана: 1–32 символа."));
			return 0;
		}
		ServerPlayerEntity player = source.getPlayer();
		if (!OpacBridge.setPartyNameForOwner(player.getUuid(), player.getServer(), trimmed)) {
			source.sendError(Text.literal("Не удалось сохранить Party name в OPAC."));
			return 0;
		}
		String preview = ClanTagFormatter.formatForPlayer(player);
		source.sendFeedback(() -> Text.literal("Party name: " + trimmed + " | в TAB: " + preview), false);
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
		ClanTagConfig.ClanStyle style = ClanTagConfig.styleFor(ownerId);
		String preview = ClanTagFormatter.formatForPlayer(player);
		source.sendFeedback(() -> Text.literal(
				"Клан: " + (name == null ? "—" : name)
						+ " | участников: " + members
						+ " | в клане: " + OpacBridge.isPlayerInClan(player)
						+ " | цвет: " + (style != null ? style.color : "7")
						+ " | жирный: " + (style != null && style.bold)
						+ " | в TAB: " + preview
						+ (name == null && ownerId.equals(player.getUuid())
								? " | подсказка: /clantag name NIXXXON"
								: "")), false);
		return 1;
	}

	private static int sync(ServerCommandSource source) {
		if (requireOwner(source) == 0) {
			return 0;
		}
		source.sendFeedback(() -> Text.literal("Тег берётся из Party name в OPAC (клавиша ')."), false);
		return 1;
	}

	private static ClanTagConfig.ClanStyle getOrCreate(UUID ownerId) {
		ClanTagConfig.ClanStyle style = ClanTagConfig.styleFor(ownerId);
		if (style == null) {
			style = new ClanTagConfig.ClanStyle();
		}
		return style;
	}
}
