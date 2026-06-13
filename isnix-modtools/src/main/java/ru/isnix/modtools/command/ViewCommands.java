package ru.isnix.modtools.command;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.context.CommandContext;
import com.mojang.brigadier.exceptions.CommandSyntaxException;
import net.minecraft.command.argument.EntityArgumentType;
import net.minecraft.server.command.CommandManager;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import ru.isnix.modtools.AdminAccess;
import ru.isnix.modtools.TravelersBackpackBridge;

public final class ViewCommands {
	private ViewCommands() {
	}

	public static void register(CommandDispatcher<ServerCommandSource> dispatcher) {
		dispatcher.register(CommandManager.literal("view")
				.requires(AdminAccess::canUseModTools)
				.then(CommandManager.literal("back")
						.then(CommandManager.argument("player", EntityArgumentType.player())
								.executes(ViewCommands::viewBackpack))));
	}

	private static int viewBackpack(CommandContext<ServerCommandSource> ctx) throws CommandSyntaxException {
		ServerCommandSource source = ctx.getSource();
		ServerPlayerEntity admin = source.getPlayer();
		if (admin == null) {
			source.sendError(Text.literal("Команду нужно выполнять от лица игрока (откроется GUI рюкзака)."));
			return 0;
		}

		ServerPlayerEntity target = EntityArgumentType.getPlayer(ctx, "player");
		String targetName = target.getGameProfile().name();

		TravelersBackpackBridge.OpenResult result = TravelersBackpackBridge.openBackpack(admin, target);
		switch (result) {
			case OK -> {
				source.sendFeedback(
						() -> Text.literal("Открыт рюкзак игрока ")
								.formatted(Formatting.GREEN)
								.append(Text.literal(targetName).formatted(Formatting.GOLD)),
						true);
				return 1;
			}
			case MOD_MISSING -> {
				source.sendError(Text.literal(
						"Мод Traveler's Backpack не найден на сервере — просмотр рюкзака недоступен."));
				return 0;
			}
			case TARGET_NO_BACKPACK -> {
				source.sendError(Text.literal(
						"У игрока " + targetName + " нет надетого рюкзака Traveler's Backpack."));
				return 0;
			}
			default -> {
				source.sendError(Text.literal("Не удалось открыть рюкзак. Смотрите лог сервера."));
				return 0;
			}
		}
	}
}
