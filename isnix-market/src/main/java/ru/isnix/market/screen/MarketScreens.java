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

	public static void openItemPicker(ServerPlayerEntity player, MarketSession.PickerTarget target, int page) {
		String title = target == MarketSession.PickerTarget.SALE
				? "Выберите товар"
				: "Выберите цену (ресурс)";
		player.openHandledScreen(new SimpleNamedScreenHandlerFactory(
				(syncId, inv, p) -> new ItemPickerScreenHandler(syncId, inv, target, page),
				Text.literal(title).formatted(Formatting.AQUA)
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
						Text.literal("Слева — товар, справа — цена").formatted(Formatting.GRAY),
						Text.literal("Книги — каталог · товар из инвентаря").formatted(Formatting.DARK_GRAY),
						Text.literal("Shift+клик из рюкзака — быстрый выбор").formatted(Formatting.DARK_GRAY)
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
				Text.literal("Каталог товара").formatted(Formatting.YELLOW, Formatting.BOLD));
		stack.set(net.minecraft.component.DataComponentTypes.LORE,
				new net.minecraft.component.type.LoreComponent(java.util.List.of(
						Text.literal("Любой предмет из игры").formatted(Formatting.GRAY),
						Text.literal("При выставлении спишется из инвентаря").formatted(Formatting.DARK_GRAY)
				)));
		return stack;
	}

	public static ItemStack pickPriceButton() {
		ItemStack stack = new ItemStack(Items.BOOK);
		stack.set(net.minecraft.component.DataComponentTypes.CUSTOM_NAME,
				Text.literal("Каталог цены").formatted(Formatting.LIGHT_PURPLE, Formatting.BOLD));
		stack.set(net.minecraft.component.DataComponentTypes.LORE,
				new net.minecraft.component.type.LoreComponent(java.util.List.of(
						Text.literal("Любой ресурс за который продаёте").formatted(Formatting.GRAY),
						Text.literal("Из инвентаря не забирается").formatted(Formatting.DARK_GRAY)
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

	public static ItemStack pickerInfo(MarketSession.PickerTarget target, int page) {
		ItemStack stack = new ItemStack(Items.PAPER);
		int total = ItemCatalog.totalPages();
		stack.set(net.minecraft.component.DataComponentTypes.CUSTOM_NAME,
				Text.literal((target == MarketSession.PickerTarget.SALE ? "Товар" : "Цена")
						+ " · стр. " + (page + 1) + "/" + total).formatted(Formatting.WHITE));
		stack.set(net.minecraft.component.DataComponentTypes.LORE,
				new net.minecraft.component.type.LoreComponent(java.util.List.of(
						Text.literal("ЛКМ — 1 шт., ПКМ — стак").formatted(Formatting.GRAY),
						Text.literal("Стрелки — листать").formatted(Formatting.DARK_GRAY)
				)));
		return stack;
	}
}
