package ru.isnix.lagwatch.command;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import com.mojang.brigadier.context.CommandContext;
import net.minecraft.server.command.CommandManager;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import ru.isnix.lagwatch.AdminAccess;
import ru.isnix.lagwatch.ChunkEntityCounts;
import ru.isnix.lagwatch.LagWatchConfig;
import ru.isnix.lagwatch.LagWatchSampler;

import java.util.Comparator;
import java.util.List;

public final class LagWatchCommands {
	private LagWatchCommands() {
	}

	public static void register(CommandDispatcher<ServerCommandSource> dispatcher) {
		var root = CommandManager.literal("lagwatch").requires(AdminAccess::canUse);

		dispatcher.register(root.then(CommandManager.literal("status").executes(LagWatchCommands::status)));

		dispatcher.register(root.then(CommandManager.literal("scan")
				.executes(ctx -> scan(ctx, 2))
				.then(CommandManager.argument("radiusChunks", IntegerArgumentType.integer(1, 8))
						.executes(ctx -> scan(ctx, IntegerArgumentType.getInteger(ctx, "radiusChunks"))))));

		dispatcher.register(root.then(CommandManager.literal("reload").executes(LagWatchCommands::reload)));
	}

	private static int status(CommandContext<ServerCommandSource> ctx) {
		LagWatchConfig cfg = LagWatchConfig.get();
		ctx.getSource()
				.sendFeedback(
						() -> Text.literal("LagWatch: "
										+ (cfg.enabled ? "включён" : "выключён")
										+ ", порог блоков="
										+ cfg.blockUpdatesPerSecondThreshold
										+ ", сущностей="
										+ cfg.entityCountThreshold)
								.formatted(Formatting.GREEN),
						false);

		List<LagWatchSampler.HotChunk> hot = LagWatchSampler.getLastHotChunks();
		if (hot.isEmpty()) {
			ctx.getSource()
					.sendFeedback(
							() -> Text.literal("За последний интервал подозрительных чанков нет.")
									.formatted(Formatting.GRAY),
							false);
			return 1;
		}

		for (LagWatchSampler.HotChunk chunk : hot) {
			ctx.getSource()
					.sendFeedback(
							() -> Text.literal(String.format(
											"• %s %s — %s | блоки=%d, сущн.=%d, предметы=%d",
											chunk.key().dimensionId(),
											chunk.key().centerCoords(),
											chunk.reason(),
											chunk.blockUpdates(),
											chunk.entities(),
											chunk.items()))
									.formatted(Formatting.YELLOW),
							false);
		}
		return 1;
	}

	private static int scan(CommandContext<ServerCommandSource> ctx, int radiusChunks) {
		ServerCommandSource source = ctx.getSource();
		if (!(source.getEntity() instanceof ServerPlayerEntity player)) {
			source.sendError(Text.literal("Команда только для игрока в мире."));
			return 0;
		}

		ServerWorld world = player.getEntityWorld();
		int centerX = player.getBlockX() >> 4;
		int centerZ = player.getBlockZ() >> 4;

		List<LagWatchSampler.HotChunk> results = new java.util.ArrayList<>();
		for (int dx = -radiusChunks; dx <= radiusChunks; dx++) {
			for (int dz = -radiusChunks; dz <= radiusChunks; dz++) {
				int cx = centerX + dx;
				int cz = centerZ + dz;
				LagWatchSampler.HotChunk row = LagWatchSampler.scanChunk(world, cx, cz);
				if (row.entities() > 0 || row.items() > 20) {
					results.add(row);
				}
			}
		}

		results.sort(Comparator.comparingInt(LagWatchSampler.HotChunk::entities).reversed());

		source.sendFeedback(
				() -> Text.literal("Скан "
								+ radiusChunks
								+ " чанк(ов): "
								+ world.getRegistryKey().getValue())
						.formatted(Formatting.AQUA),
				false);

		if (results.isEmpty()) {
			source.sendFeedback(
					() -> Text.literal("Мало сущностей в радиусе — явных лаг-чанков не видно.")
							.formatted(Formatting.GRAY),
					false);
			return 1;
		}

		int limit = Math.min(8, results.size());
		for (int i = 0; i < limit; i++) {
			LagWatchSampler.HotChunk chunk = results.get(i);
			ChunkEntityCounts counts =
					new ChunkEntityCounts(chunk.entities(), chunk.items());
			String flag = LagWatchSampler.evaluate(
							chunk.key(), chunk.blockUpdates(), counts, LagWatchConfig.get())
					!= null
					? " ⚠"
					: "";
			int finalI = i;
			source.sendFeedback(
					() -> Text.literal(String.format(
									"%d) %s — сущн.=%d, предметы=%d%s",
									finalI + 1,
									chunk.key().centerCoords(),
									chunk.entities(),
									chunk.items(),
									flag))
							.formatted(Formatting.YELLOW),
					false);
		}
		return 1;
	}

	private static int reload(CommandContext<ServerCommandSource> ctx) {
		LagWatchConfig.load();
		ctx.getSource()
				.sendFeedback(
						() -> Text.literal("isnix-lagwatch.json перечитан.").formatted(Formatting.GREEN),
						true);
		return 1;
	}
}
