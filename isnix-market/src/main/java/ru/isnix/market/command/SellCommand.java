package ru.isnix.market.command;

import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import net.minecraft.server.command.CommandManager;
import net.minecraft.server.command.ServerCommandSource;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import ru.isnix.market.IsnixMarketMod;
import ru.isnix.market.MarketConfig;
import ru.isnix.market.listing.MarketListing;
import ru.isnix.market.screen.MarketScreens;
import ru.isnix.market.screen.MarketSession;
import ru.isnix.market.trade.ListingCancelService;
import ru.isnix.market.trade.MarketListingQuery;
import ru.isnix.market.trade.PurchaseService;

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
				.then(CommandManager.literal("help")
						.executes(ctx -> {
							sendHelp(ctx.getSource().getPlayerOrThrow());
							return 1;
						}))
				.then(CommandManager.literal("list")
						.executes(ctx -> {
							ServerPlayerEntity player = ctx.getSource().getPlayerOrThrow();
							MarketScreens.openCreate(player);
							return 1;
						}))
				.then(CommandManager.literal("buy")
						.then(CommandManager.argument("id", StringArgumentType.string())
								.executes(ctx -> executeBuy(
										ctx.getSource().getPlayerOrThrow(),
										StringArgumentType.getString(ctx, "id"),
										0))
								.then(CommandManager.argument("count", IntegerArgumentType.integer(1, 64))
										.executes(ctx -> executeBuy(
												ctx.getSource().getPlayerOrThrow(),
												StringArgumentType.getString(ctx, "id"),
												IntegerArgumentType.getInteger(ctx, "count"))))))
				.then(CommandManager.literal("search")
						.then(CommandManager.argument("query", StringArgumentType.greedyString())
								.executes(ctx -> executeSearch(
										ctx.getSource().getPlayerOrThrow(),
										StringArgumentType.getString(ctx, "query")))))
				.then(CommandManager.literal("clear")
						.executes(ctx -> {
							ServerPlayerEntity player = ctx.getSource().getPlayerOrThrow();
							MarketSession.clearSearch(player);
							player.sendMessage(Text.literal("Поиск сброшен.").formatted(Formatting.GRAY), false);
							MarketScreens.openMarket(player, 0);
							return 1;
						}))
				.then(CommandManager.literal("log")
						.executes(ctx -> {
							ServerPlayerEntity player = ctx.getSource().getPlayerOrThrow();
							if (IsnixMarketMod.trades() != null) {
								IsnixMarketMod.trades().sendRecentTo(player, 8);
							}
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
										player.sendMessage(
												Text.literal("Неверный ID лота (UUID).").formatted(Formatting.RED),
												false);
										return 0;
									}
									var listing = IsnixMarketMod.listings().find(id).orElse(null);
									if (listing == null) {
										player.sendMessage(Text.literal("Лот не найден.").formatted(Formatting.RED), false);
										return 0;
									}
									ListingCancelService.cancel(player, id);
									return 1;
								}))));
	}

	private static void sendHelp(ServerPlayerEntity player) {
		MarketConfig.MarketConfigData cfg = MarketConfig.get();
		player.sendMessage(
				Text.literal("═══ Рынок ISNIX (/sell) ═══").formatted(Formatting.DARK_GREEN, Formatting.BOLD),
				false);
		player.sendMessage(
				Text.literal("/sell").formatted(Formatting.GREEN)
						.append(Text.literal(" — рынок; воронка — сорт; лупа — поиск")
								.formatted(Formatting.GRAY)),
				false);
		player.sendMessage(
				Text.literal("/sell search <слово>").formatted(Formatting.GREEN)
						.append(Text.literal(" — gunpowder, stick… · /sell clear · /sell log")
								.formatted(Formatting.GRAY)),
				false);
		player.sendMessage(
				Text.literal("Анти-скам: ").formatted(Formatting.GRAY)
						.append(Text.literal("в lore «За 1 шт.»; дорогие лоты — Shift+Подтвердить")
								.formatted(Formatting.YELLOW)),
				false);
		player.sendMessage(
				Text.literal("Свой лот: ").formatted(Formatting.GRAY)
						.append(Text.literal("Shift+ПКМ на рынке или /sell cancel <uuid>")
								.formatted(Formatting.WHITE)),
				false);
		player.sendMessage(
				Text.literal("/sell list").formatted(Formatting.GREEN)
						.append(Text.literal(" — лот: товар из инвентаря, цена — каталог или ±1")
								.formatted(Formatting.GRAY)),
				false);
		player.sendMessage(
				Text.literal("Лимит: ").formatted(Formatting.GRAY)
						.append(Text.literal(cfg.maxListingsPerPlayer + " лотов на игрока, срок "
								+ cfg.listingsExpireDays + " дн.")
								.formatted(Formatting.WHITE)),
				false);
		player.sendMessage(
				Text.literal("Оплата только предметами — монет на сервере нет.")
						.formatted(Formatting.YELLOW),
				false);
	}

	private static int executeSearch(ServerPlayerEntity player, String query) {
		if (query == null || query.isBlank()) {
			player.sendMessage(Text.literal("Пример: /sell search gunpowder").formatted(Formatting.RED), false);
			return 0;
		}
		MarketSession.setSearchFilter(player, query.trim().toLowerCase());
		var list = MarketListingQuery.browse(
				player.getUuid(),
				MarketSession.viewMode(player),
				MarketSession.searchFilter(player),
				MarketSession.sortMode(player));
		player.sendMessage(
				Text.literal("Найдено лотов: ").formatted(Formatting.AQUA)
						.append(Text.literal(String.valueOf(list.size())).formatted(Formatting.WHITE))
						.append(Text.literal(" · «").formatted(Formatting.GRAY))
						.append(Text.literal(query.trim()).formatted(Formatting.YELLOW))
						.append(Text.literal("»").formatted(Formatting.GRAY)),
				false);
		MarketScreens.openMarket(player, 0);
		return 1;
	}

	private static int executeBuy(ServerPlayerEntity player, String rawId, int count) {
		UUID id;
		try {
			id = UUID.fromString(rawId.trim());
		} catch (IllegalArgumentException e) {
			player.sendMessage(Text.literal("Неверный ID лота.").formatted(Formatting.RED), false);
			return 0;
		}
		MarketListing listing = IsnixMarketMod.listings().find(id).orElse(null);
		if (listing == null) {
			player.sendMessage(Text.literal("Лот уже продан или снят.").formatted(Formatting.RED), false);
			return 0;
		}
		int qty = count > 0 ? count : listing.saleItem().getCount();
		PurchaseService.Result result = PurchaseService.tryPurchaseQuantity(player, id, qty);
		if (result != PurchaseService.Result.SUCCESS) {
			player.sendMessage(PurchaseService.messageFor(result), false);
			return 0;
		}
		return 1;
	}
}
