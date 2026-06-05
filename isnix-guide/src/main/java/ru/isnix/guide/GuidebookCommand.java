package ru.isnix.guide;

import com.mojang.brigadier.CommandDispatcher;
import net.minecraft.server.command.CommandManager;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;

public final class GuidebookCommand {
	private GuidebookCommand() {
	}

	public static void register(CommandDispatcher<ServerCommandSource> dispatcher) {
		dispatcher.register(
				CommandManager.literal("guidebook")
						.executes(ctx -> {
							ServerCommandSource source = ctx.getSource();
							ServerPlayerEntity player = source.getPlayer();
							if (player == null) {
								source.sendError(GuideManager.playerOnly());
								return 0;
							}
							GuideManager.giveBookOnRequest(player);
							return 1;
						}));
	}
}
