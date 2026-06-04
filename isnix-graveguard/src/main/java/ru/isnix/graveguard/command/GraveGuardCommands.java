package ru.isnix.graveguard.command;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.context.CommandContext;
import net.minecraft.server.command.CommandManager;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import ru.isnix.graveguard.AdminAccess;
import ru.isnix.graveguard.GraveGuardConfig;
import ru.isnix.graveguard.GraveGuardManager;

public final class GraveGuardCommands {
	private GraveGuardCommands() {
	}

	public static void register(CommandDispatcher<ServerCommandSource> dispatcher) {
		var root = CommandManager.literal("graveguard").requires(AdminAccess::canUse);

		dispatcher.register(root.then(CommandManager.literal("status").executes(GraveGuardCommands::status)));
		dispatcher.register(root.then(CommandManager.literal("reload").executes(GraveGuardCommands::reload)));
	}

	private static int status(CommandContext<ServerCommandSource> ctx) {
		GraveGuardConfig cfg = GraveGuardConfig.get();
		ctx.getSource()
				.sendFeedback(
						() -> Text.literal("GraveGuard: "
										+ (cfg.enabled ? "включён" : "выключен")
										+ ", защита "
										+ cfg.protectionSeconds
										+ " сек, радиус могилы "
										+ cfg.nearGraveRadius
										+ ", зона смерти "
										+ cfg.deathSiteRadius
										+ ", запас после выхода "
										+ cfg.lootGraceSeconds
										+ " сек")
								.formatted(Formatting.GREEN),
						false);

		ServerPlayerEntity player = ctx.getSource().getPlayer();
		if (player != null) {
			int remaining = GraveGuardManager.remainingProtectionSeconds(player);
			int lootZone = GraveGuardManager.remainingLootZoneSeconds(player);
			boolean eligible = GraveGuardManager.isEligible(player);
			boolean inZone = GraveGuardManager.isInLootZone(player);
			ctx.getSource()
					.sendFeedback(
							() -> Text.literal("Твой статус: "
											+ (eligible ? "после смерти" : "обычный")
											+ (inZone ? ", у могилы/места смерти" : "")
											+ ", защита "
											+ remaining
											+ " сек"
											+ (lootZone > 0 ? ", зона лута ещё " + lootZone + " сек" : ""))
									.formatted(Formatting.GRAY),
							false);
		}
		return 1;
	}

	private static int reload(CommandContext<ServerCommandSource> ctx) {
		GraveGuardConfig.reload();
		ctx.getSource()
				.sendFeedback(
						() -> Text.literal("GraveGuard: конфиг перечитан.").formatted(Formatting.GREEN),
						true);
		return 1;
	}
}
