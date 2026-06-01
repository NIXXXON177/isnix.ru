package ru.isnix.market.screen;

import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.screen.SimpleNamedScreenHandlerFactory;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import ru.isnix.market.IsnixMarketMod;
import ru.isnix.market.MarketConfig;
import ru.isnix.market.trade.MarketListingQuery;

import java.util.List;
import java.util.UUID;

public final class MarketScreens {
	private MarketScreens() {
	}

	public static void openMarket(ServerPlayerEntity player, int page) {
		openMarket(player, page, MarketSession.viewMode(player));
	}

	public static void openMarket(ServerPlayerEntity player, int page, MarketViewMode mode) {
		MarketSession.setViewMode(player, mode);
		List<?> list = MarketListingQuery.browse(
				player.getUuid(),
				mode,
				MarketSession.searchFilter(player),
				MarketSession.sortMode(player));
		int totalPages = Math.max(1, (int) Math.ceil(list.size() / (double) MarketScreenHandler.PAGE_SIZE));
		int shown = Math.min(page + 1, totalPages);
		String modeLabel = mode == MarketViewMode.MINE ? "Мои" : "Все";
		String sortLabel = MarketSession.sortMode(player).label();
		String search = MarketSession.searchFilter(player);
		String title = "Рынок · " + modeLabel + " · " + sortLabel;
		if (search != null) {
			title += " · " + MarketListingQuery.saleItemLabel(search);
		}
		title += " · " + shown + "/" + totalPages;
		player.openHandledScreen(new SimpleNamedScreenHandlerFactory(
				(syncId, inv, p) -> new MarketScreenHandler(syncId, inv, page, player, mode),
				Text.literal(title).formatted(Formatting.DARK_GREEN)
		));
	}

	public static ItemStack sortButton(MarketSortMode mode) {
		ItemStack stack = new ItemStack(Items.HOPPER);
		stack.set(net.minecraft.component.DataComponentTypes.CUSTOM_NAME,
				Text.literal("Сорт: " + mode.label()).formatted(Formatting.LIGHT_PURPLE, Formatting.BOLD));
		stack.set(net.minecraft.component.DataComponentTypes.LORE,
				new net.minecraft.component.type.LoreComponent(java.util.List.of(
						Text.literal("Клик — сменить").formatted(Formatting.GRAY),
						Text.literal("Новые → Дешевле → Дороже → Продавец").formatted(Formatting.DARK_GRAY)
				)));
		return stack;
	}

	public static ItemStack searchButton() {
		ItemStack stack = new ItemStack(Items.SPYGLASS);
		stack.set(net.minecraft.component.DataComponentTypes.CUSTOM_NAME,
				Text.literal("Поиск").formatted(Formatting.AQUA, Formatting.BOLD));
		stack.set(net.minecraft.component.DataComponentTypes.LORE,
				new net.minecraft.component.type.LoreComponent(java.util.List.of(
						Text.literal("Клик — предмет из инвентаря внизу").formatted(Formatting.GRAY),
						Text.literal("/sell search gunpowder").formatted(Formatting.DARK_GRAY)
				)));
		return stack;
	}

	public static ItemStack clearSearchButton() {
		ItemStack stack = new ItemStack(Items.BARRIER);
		stack.set(net.minecraft.component.DataComponentTypes.CUSTOM_NAME,
				Text.literal("Сброс поиска").formatted(Formatting.RED, Formatting.BOLD));
		stack.set(net.minecraft.component.DataComponentTypes.LORE,
				new net.minecraft.component.type.LoreComponent(java.util.List.of(
						Text.literal("Клик — показать все лоты").formatted(Formatting.GRAY)
				)));
		return stack;
	}

	public static void openCreate(ServerPlayerEntity player) {
		MarketConfig.MarketConfigData cfg = MarketConfig.get();
		int mine = IsnixMarketMod.listings().countBySeller(player.getUuid());
		player.sendMessage(
				Text.literal("Ваши лоты: " + mine + "/" + cfg.maxListingsPerPlayer).formatted(Formatting.GRAY),
				false
		);
		player.openHandledScreen(new SimpleNamedScreenHandlerFactory(
				(syncId, inv, p) -> new CreateListingScreenHandler(syncId, inv),
				Text.literal("Выставить лот").formatted(Formatting.GOLD)
		));
	}

	public static void openPricePresets(ServerPlayerEntity player, int page) {
		player.openHandledScreen(new SimpleNamedScreenHandlerFactory(
				(syncId, inv, p) -> new PricePresetScreenHandler(syncId, inv, page),
				Text.literal("Выберите цену").formatted(Formatting.AQUA)
		));
	}

	public static void openBuy(
			ServerPlayerEntity player,
			UUID listingId,
			int marketPage,
			MarketViewMode marketViewMode
	) {
		MarketSession.startBuy(player, listingId, marketPage, marketViewMode);
		player.openHandledScreen(new SimpleNamedScreenHandlerFactory(
				(syncId, inv, p) -> new BuyListingScreenHandler(syncId, inv),
				Text.literal("Покупка лота").formatted(Formatting.GREEN)
		));
	}

	public static ItemStack viewModeButton(MarketViewMode mode, int myCount, int max) {
		boolean mine = mode == MarketViewMode.MINE;
		ItemStack stack = new ItemStack(mine ? Items.ENDER_CHEST : Items.CHEST);
		stack.set(net.minecraft.component.DataComponentTypes.CUSTOM_NAME,
				Text.literal(mine ? "Мои лоты" : "Весь рынок").formatted(Formatting.AQUA, Formatting.BOLD));
		stack.set(net.minecraft.component.DataComponentTypes.LORE,
				new net.minecraft.component.type.LoreComponent(java.util.List.of(
						Text.literal(mine
								? "Сейчас: только ваши (" + myCount + "/" + max + ")"
								: "Сейчас: все продавцы").formatted(Formatting.GRAY),
						Text.literal("Клик — переключить").formatted(Formatting.DARK_GRAY)
				)));
		return stack;
	}

	public static ItemStack navArrow(boolean next) {
		ItemStack stack = new ItemStack(next ? Items.ARROW : Items.SPECTRAL_ARROW);
		stack.set(net.minecraft.component.DataComponentTypes.CUSTOM_NAME,
				Text.literal(next ? "След. страница" : "Пред. страница").formatted(Formatting.AQUA));
		return stack;
	}

	public static ItemStack createButton() {
		ItemStack stack = new ItemStack(Items.EMERALD);
		stack.set(net.minecraft.component.DataComponentTypes.CUSTOM_NAME,
				Text.literal("Выставить предмет").formatted(Formatting.GREEN, Formatting.BOLD));
		stack.set(net.minecraft.component.DataComponentTypes.LORE,
				new net.minecraft.component.type.LoreComponent(
						java.util.List.of(Text.literal("Открыть окно продажи").formatted(Formatting.GRAY))));
		return stack;
	}

	public static ItemStack fillerPane() {
		ItemStack stack = new ItemStack(Items.GRAY_STAINED_GLASS_PANE);
		stack.set(net.minecraft.component.DataComponentTypes.CUSTOM_NAME, Text.empty());
		return stack;
	}

	public static ItemStack confirmButton() {
		ItemStack stack = new ItemStack(Items.LIME_STAINED_GLASS_PANE);
		stack.set(net.minecraft.component.DataComponentTypes.CUSTOM_NAME,
				Text.literal("Подтвердить").formatted(Formatting.GREEN, Formatting.BOLD));
		stack.set(net.minecraft.component.DataComponentTypes.LORE,
				new net.minecraft.component.type.LoreComponent(java.util.List.of(
						Text.literal("1) Товар — клик по инвентарю внизу").formatted(Formatting.GRAY),
						Text.literal("2) Цена — книга или 1 шт. в инвентаре, ±1").formatted(Formatting.DARK_GRAY),
						Text.literal("ПКМ по слоту цены/товара — сброс").formatted(Formatting.DARK_GRAY)
				)));
		return stack;
	}

	/** Кнопки GUI с CUSTOM_NAME; обычные изумруды/книги/стрелы в инвентаре не блокируем. */
	public static boolean isDecorStack(ItemStack stack) {
		if (stack.isEmpty()) {
			return false;
		}
		var name = stack.get(net.minecraft.component.DataComponentTypes.CUSTOM_NAME);
		if (name == null) {
			return false;
		}
		String text = name.getString();
		return text.equals("Выставить предмет")
				|| text.equals("Подтвердить")
				|| text.equals("Ваш товар")
				|| text.equals("Ваша цена")
				|| text.equals("Назад")
				|| text.equals("След. страница")
				|| text.equals("Пред. страница")
				|| text.startsWith("Цена · стр. ")
				|| text.equals("+1")
				|| text.equals("−1")
				|| text.startsWith("Количество · ")
				|| text.equals("Максимум")
				|| text.equals("Мои лоты")
				|| text.equals("Весь рынок")
				|| text.startsWith("Сорт: ")
				|| text.equals("Поиск")
				|| text.equals("Сброс поиска");
	}

	public static ItemStack buyConfirmButton(boolean needShiftConfirm) {
		ItemStack stack = new ItemStack(Items.LIME_STAINED_GLASS_PANE);
		stack.set(net.minecraft.component.DataComponentTypes.CUSTOM_NAME,
				Text.literal("Подтвердить").formatted(Formatting.GREEN, Formatting.BOLD));
		var lore = new java.util.ArrayList<Text>();
		lore.add(Text.literal("Купить выбранное количество").formatted(Formatting.GRAY));
		if (needShiftConfirm) {
			lore.add(Text.literal("Дорогой лот: Shift+клик!").formatted(Formatting.RED, Formatting.BOLD));
		} else {
			lore.add(Text.literal("Цена пропорциональна лоту").formatted(Formatting.DARK_GRAY));
		}
		stack.set(net.minecraft.component.DataComponentTypes.LORE,
				new net.minecraft.component.type.LoreComponent(lore));
		return stack;
	}

	public static ItemStack maxBuyButton() {
		ItemStack stack = new ItemStack(Items.GOLD_NUGGET);
		stack.set(net.minecraft.component.DataComponentTypes.CUSTOM_NAME,
				Text.literal("Максимум").formatted(Formatting.GOLD, Formatting.BOLD));
		stack.set(net.minecraft.component.DataComponentTypes.LORE,
				new net.minecraft.component.type.LoreComponent(java.util.List.of(
						Text.literal("Сколько хватит ресурсов").formatted(Formatting.GRAY)
				)));
		return stack;
	}

	public static ItemStack quantityInfo(int qty, int maxInLot) {
		ItemStack stack = new ItemStack(Items.PAPER);
		stack.set(net.minecraft.component.DataComponentTypes.CUSTOM_NAME,
				Text.literal("Количество · " + qty + "/" + maxInLot).formatted(Formatting.WHITE, Formatting.BOLD));
		stack.set(net.minecraft.component.DataComponentTypes.LORE,
				new net.minecraft.component.type.LoreComponent(java.util.List.of(
						Text.literal("Красный/зелёный ±1").formatted(Formatting.GRAY),
						Text.literal("Золотой самородок — макс.").formatted(Formatting.DARK_GRAY)
				)));
		return stack;
	}

	public static ItemStack pickSaleButton() {
		ItemStack stack = new ItemStack(Items.WRITABLE_BOOK);
		stack.set(net.minecraft.component.DataComponentTypes.CUSTOM_NAME,
				Text.literal("Ваш товар").formatted(Formatting.YELLOW, Formatting.BOLD));
		stack.set(net.minecraft.component.DataComponentTypes.LORE,
				new net.minecraft.component.type.LoreComponent(java.util.List.of(
						Text.literal("Только из инвентаря внизу").formatted(Formatting.GRAY),
						Text.literal("Клик / Shift+клик по предмету").formatted(Formatting.DARK_GRAY),
						Text.literal("Списание при «Подтвердить»").formatted(Formatting.DARK_GRAY)
				)));
		return stack;
	}

	public static ItemStack pickPriceButton() {
		ItemStack stack = new ItemStack(Items.BOOK);
		stack.set(net.minecraft.component.DataComponentTypes.CUSTOM_NAME,
				Text.literal("Ваша цена").formatted(Formatting.LIGHT_PURPLE, Formatting.BOLD));
		stack.set(net.minecraft.component.DataComponentTypes.LORE,
				new net.minecraft.component.type.LoreComponent(java.util.List.of(
						Text.literal("ЛКМ — каталог цен (без предметов у вас)").formatted(Formatting.GRAY),
						Text.literal("Или 1 шт. в инвентаре + зелёный/красный ±1").formatted(Formatting.DARK_GRAY),
						Text.literal("С вашего инвентаря ничего не снимается").formatted(Formatting.DARK_GRAY)
				)));
		return stack;
	}

	public static ItemStack countButton(boolean plus) {
		ItemStack stack = new ItemStack(plus ? Items.LIME_DYE : Items.RED_DYE);
		stack.set(net.minecraft.component.DataComponentTypes.CUSTOM_NAME,
				Text.literal(plus ? "+1" : "−1").formatted(plus ? Formatting.GREEN : Formatting.RED, Formatting.BOLD));
		return stack;
	}

	public static ItemStack backButton() {
		ItemStack stack = new ItemStack(Items.BARRIER);
		stack.set(net.minecraft.component.DataComponentTypes.CUSTOM_NAME,
				Text.literal("Назад").formatted(Formatting.RED));
		return stack;
	}

	public static ItemStack pricePresetInfo(int page) {
		ItemStack stack = new ItemStack(Items.PAPER);
		int total = ru.isnix.market.PricePresets.totalPages();
		stack.set(net.minecraft.component.DataComponentTypes.CUSTOM_NAME,
				Text.literal("Цена · стр. " + (page + 1) + "/" + total).formatted(Formatting.WHITE));
		stack.set(net.minecraft.component.DataComponentTypes.LORE,
				new net.minecraft.component.type.LoreComponent(java.util.List.of(
						Text.literal("Клик — выбрать цену").formatted(Formatting.GRAY),
						Text.literal("Предметы из списка не выдаются").formatted(Formatting.DARK_GRAY),
						Text.literal("Стрелки — листать").formatted(Formatting.DARK_GRAY)
				)));
		return stack;
	}
}
