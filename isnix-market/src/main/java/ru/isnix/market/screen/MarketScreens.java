package ru.isnix.market.screen;

import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.screen.SimpleNamedScreenHandlerFactory;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

public final class MarketScreens {
	private MarketScreens() {
	}

	public static void openMarket(ServerPlayerEntity player, int page) {
		player.openHandledScreen(new SimpleNamedScreenHandlerFactory(
				(syncId, inv, p) -> new MarketScreenHandler(syncId, inv, page, player),
				Text.literal("Рынок ISNIX").formatted(Formatting.DARK_GREEN)
		));
	}

	public static void openCreate(ServerPlayerEntity player) {
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

	public static boolean isDecorStack(ItemStack stack) {
		if (stack.isEmpty()) {
			return false;
		}
		var item = stack.getItem();
		return item == Items.GRAY_STAINED_GLASS_PANE
				|| item == Items.LIME_STAINED_GLASS_PANE
				|| item == Items.WRITABLE_BOOK
				|| item == Items.BOOK
				|| item == Items.LIME_DYE
				|| item == Items.RED_DYE
				|| item == Items.ARROW
				|| item == Items.SPECTRAL_ARROW
				|| item == Items.EMERALD
				|| item == Items.BARRIER
				|| item == Items.PAPER;
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
