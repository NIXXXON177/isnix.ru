package ru.isnix.guide;

import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.WrittenBookContentComponent;
import net.minecraft.item.ItemStack;
import net.minecraft.item.Items;
import net.minecraft.text.RawFilteredPair;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

import java.util.List;

public final class GuideBook {
	private static final Formatting BODY = Formatting.BLACK;
	private static final Formatting TITLE = Formatting.DARK_GREEN;

	private GuideBook() {
	}

	public static ItemStack create() {
		ItemStack stack = new ItemStack(Items.WRITTEN_BOOK);
		stack.set(
				DataComponentTypes.CUSTOM_NAME,
				Text.literal("Путеводитель")
						.styled(s -> s.withItalic(false).withBold(true).withColor(TITLE))
		);
		stack.set(
				DataComponentTypes.WRITTEN_BOOK_CONTENT,
				new WrittenBookContentComponent(
						RawFilteredPair.of("Путеводитель"),
						"ISTHISNIXXXON",
						1,
						pages(),
						true
				)
		);
		return stack;
	}

	private static List<RawFilteredPair<Text>> pages() {
		return List.of(
				page("""
						ISTHISNIXXXON

						Сервер с Create.
						Без доната.

						1.21.11 Fabric
						mc.isnix.ru

						isnix.ru/guide.html
						"""),
				page("""
						СБОРКА

						Скачай ZIP на isnix.ru
						Импорт в ElyPrismLauncher.

						Свои моды не ставь.
						"""),
				page("""
						REI (рецепты)

						Поиск внизу экрана.

						@create — мод Create
						Ctrl+O — скрыть список
						R — рецепт предмета
						"""),
				page("""
						ЧАТ

						Рядом — локальный чат.
						! в начале — всем.

						Голос: Voice Chat,
						клавиша в Управлении.
						"""),
				page("""
						OPAC (приват)

						Клавиша ' — меню.
						claim — защита базы.
						/clantag — тег клана
						"""),
				page("""
						ТОРГОВЛЯ

						/trade ник — обмен
						/sell — рынок
						/sell list — лот
						Цена — ресурсами.
						"""),
				page("""
						CREATE

						Шестерни, конвейеры,
						поезда.

						Старт: андезит +
						вода-колесо.

						Farmer's Delight.
						"""),
				page("""
						ЕЩЁ

						/guidebook — книга
						Esc — Прогресс —
						ISTHISNIXXXON

						Вайтлист:
						isnix.ru/account
						""")
		);
	}

	private static RawFilteredPair<Text> page(String raw) {
		return RawFilteredPair.of(
				Text.literal(raw.stripTrailing()).styled(s -> s.withColor(BODY).withItalic(false))
		);
	}
}
