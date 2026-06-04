package ru.isnix.playerbackup.command;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.context.CommandContext;
import net.minecraft.command.argument.EntityArgumentType;
import net.minecraft.server.command.CommandManager;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import ru.isnix.playerbackup.BackupConfig;
import ru.isnix.playerbackup.OpAccess;
import ru.isnix.playerbackup.PlayerSnapshotService;
import ru.isnix.playerbackup.SnapshotReason;

import java.nio.file.Files;
import java.nio.file.Path;

public final class BackupCommands {
	private BackupCommands() {
	}

	public static void register(CommandDispatcher<ServerCommandSource> dispatcher) {
		dispatcher.register(CommandManager.literal("playerbackup")
				.requires(OpAccess::canUse)
				.then(CommandManager.literal("snapshot")
						.executes(ctx -> snapshotSelf(ctx))
						.then(CommandManager.argument("player", EntityArgumentType.player())
								.executes(ctx -> snapshotPlayer(ctx))))
				.then(CommandManager.literal("snapshotall")
						.executes(BackupCommands::snapshotAll))
				.then(CommandManager.literal("prune")
						.executes(BackupCommands::prune))
				.then(CommandManager.literal("status")
						.executes(BackupCommands::status)));
	}

	private static int snapshotSelf(CommandContext<ServerCommandSource> ctx) {
		ServerCommandSource source = ctx.getSource();
		ServerPlayerEntity player = source.getPlayer();
		if (player == null) {
			source.sendError(Text.literal("Команда только от игрока или укажите ник."));
			return 0;
		}
		return doSnapshot(source, player);
	}

	private static int snapshotPlayer(CommandContext<ServerCommandSource> ctx) throws com.mojang.brigadier.exceptions.CommandSyntaxException {
		ServerPlayerEntity player = EntityArgumentType.getPlayer(ctx, "player");
		return doSnapshot(ctx.getSource(), player);
	}

	private static int doSnapshot(ServerCommandSource source, ServerPlayerEntity player) {
		if (!BackupConfig.get().enabled) {
			source.sendError(Text.literal("ISNIX Player Backup отключён в конфиге."));
			return 0;
		}
		Path file = PlayerSnapshotService.snapshot(player, SnapshotReason.MANUAL);
		if (file == null) {
			source.sendError(Text.literal("Не удалось сохранить снимок."));
			return 0;
		}
		source.sendFeedback(
				() -> Text.literal("Снимок инвентаря: ")
						.formatted(Formatting.GREEN)
						.append(Text.literal(player.getGameProfile().name()).formatted(Formatting.WHITE))
						.append(Text.literal(" → ").formatted(Formatting.GRAY))
						.append(Text.literal(file.getFileName().toString()).formatted(Formatting.AQUA)),
				true);
		return 1;
	}

	private static int snapshotAll(CommandContext<ServerCommandSource> ctx) {
		var source = ctx.getSource();
		if (!BackupConfig.get().enabled) {
			source.sendError(Text.literal("ISNIX Player Backup отключён в конфиге."));
			return 0;
		}
		int count = 0;
		for (ServerPlayerEntity player : source.getServer().getPlayerManager().getPlayerList()) {
			if (PlayerSnapshotService.snapshot(player, SnapshotReason.MANUAL) != null) {
				count++;
			}
		}
		int finalCount = count;
		source.sendFeedback(
				() -> Text.literal("Снимки сохранены для " + finalCount + " онлайн-игроков.")
						.formatted(Formatting.GREEN),
				true);
		return count;
	}

	private static int prune(CommandContext<ServerCommandSource> ctx) {
		PlayerSnapshotService.pruneOldSnapshots();
		ctx.getSource().sendFeedback(
				() -> Text.literal("Старые снимки удалены (старше " + BackupConfig.get().keepDays + " дн.).")
						.formatted(Formatting.YELLOW),
				true);
		return 1;
	}

	private static int status(CommandContext<ServerCommandSource> ctx) {
		var cfg = BackupConfig.get();
		Path root = PlayerSnapshotService.snapshotRoot();
		long snapshotFiles = 0;
		Path snapshots = root.resolve("snapshots");
		if (Files.isDirectory(snapshots)) {
			try (var stream = Files.walk(snapshots)) {
				snapshotFiles = stream.filter(p -> p.getFileName().toString().endsWith(".json")).count();
			} catch (Exception ignored) {
				// ignore
			}
		}
		long finalSnapshotFiles = snapshotFiles;
		ctx.getSource().sendFeedback(
				() -> Text.literal(String.format(
						"Player Backup: %s, интервал %d мин, хранение %d дн., файлов снимков: %d, каталог: %s",
						cfg.enabled ? "включён" : "выключен",
						cfg.intervalMinutes,
						cfg.keepDays,
						finalSnapshotFiles,
						root.toString())),
				false);
		return 1;
	}
}
