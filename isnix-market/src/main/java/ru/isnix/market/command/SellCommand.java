package ru.isnix.market.command;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.server.command.CommandManager;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import ru.isnix.market.IsnixMarketMod;
import ru.isnix.market.screen.MarketScreens;

import java.util.UUID;

public final class SellCommand {
	private SellCommand() {
	}

	public static void register(CommandDispatcher<ServerCommandSource> dispatcher) {
		dispatcher.register(CommandManager.literal("sell")
				.executes(ctx -> {
					ServerPlayerEntity player = ctx.getSource().getPlayerOrThrow();
					MarketScreens.openMarket(player, 0);
					return 1;
				})
				.then(CommandManager.literal("list")
						.executes(ctx -> {
							ServerPlayerEntity player = ctx.getSource().getPlayerOrThrow();
							MarketScreens.openCreate(player);
							return 1;
						}))
				.then(CommandManager.literal("cancel")
						.then(CommandManager.argument("id", StringArgumentType.greedyString())
								.executes(ctx -> {
									ServerPlayerEntity player = ctx.getSource().getPlayerOrThrow();
									String raw = StringArgumentType.getString(ctx, "id");
									UUID id;
									try {
										id = UUID.fromString(raw.trim());
									} catch (IllegalArgumentException e) {
										player.sendMessage(Text.literal("Неверный ID лота (UUID).").formatted(Formatting.RED), false);
										return 0;
									}
									var listing = IsnixMarketMod.listings().find(id).orElse(null);
									if (listing == null) {
										player.sendMessage(Text.literal("Лот не найден.").formatted(Formatting.RED), false);
										return 0;
									}
									if (!listing.sellerUuid().equals(player.getUuid())
											&& !ctx.getSource().hasPermissionLevel(2)) {
										player.sendMessage(Text.literal("Это не ваш лот.").formatted(Formatting.RED), false);
										return 0;
									}
									IsnixMarketMod.listings().remove(id);
									ru.isnix.market.util.InventoryHelper.giveOrDrop(player, listing.saleItem());
									player.sendMessage(Text.literal("Лот снят с продажи.").formatted(Formatting.YELLOW), false);
									return 1;
								}))));
	}
}
