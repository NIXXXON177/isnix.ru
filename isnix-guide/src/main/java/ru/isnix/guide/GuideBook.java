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
	private GuideBook() {
	}

	public static ItemStack create() {
		ItemStack stack = new ItemStack(Items.WRITTEN_BOOK);
		stack.set(
				DataComponentTypes.CUSTOM_NAME,
				Text.literal("Путеводитель ISTHISNIXXXON").styled(s -> s.withItalic(false).withColor(Formatting.GOLD))
		);
		stack.set(
				DataComponentTypes.WRITTEN_BOOK_CONTENT,
				new WrittenBookContentComponent(
						RawFilteredPair.of("Путеводитель ISTHISNIXXXON"),
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
						§6§lISTHISNIXXXON§r

						§7Уютный ванильный сервер с §fCreate§7, без доната и без монет.

						§eJava §f1.21.11§e, Fabric
						§eIP: §fmc.isnix.ru

						§8Полная версия: isnix.ru/guide.html
						"""),
				page("""
						§6§lСборка§r

						§7Скачай §fISTHISNIXXXONmods.zip§7 с сайта и импортируй в ElyPrismLauncher.

						§7Свои моды не добавляй — только сборка сервера.

						§eРецепты Create:§r REI (клавиша §fR§r), плюс ветка §fCreate§r в достижениях (Esc).
						"""),
				page("""
						§6§lЧат и голос§r

						§7Локальный чат — рядом с игроками.

						§7Глобально — §f!§7 в начале строки (см. правила).

						§7Голос: §fSimple Voice Chat§7 — настрой клавишу в управлении.
						"""),
				page("""
						§6§lУчасток (OPAC)§r

						§7Open Parties and Claims — приваты и кланы.

						§7Поставь §fclaim§7, чтобы защитить базу.

						§7Тег клана в TAB: §f/clantag§7 (см. справку мода).
						"""),
				page("""
						§6§lТорговля§r

						§f/trade <ник>§7 — обмен с игроком.

						§f/sell§7 — рынок лотов.
						§f/sell list§7 — выставить товар, цена §7только ресурсами§7.

						§7Покупка и продажа — через GUI рынка.
						"""),
				page("""
						§6§lCreate§r

						§7На сервере полный §fCreate Fly§7: шестерни, конвейеры, поезда.

						§7Старт: андезитовый сплав → вода-колесо → механизмы.

						§7Кухня §fFarmer's Delight§7 связана с Create (миксер, пила).

						§8Аддоны с Forge (CCA, Diesel) здесь не стоят.
						"""),
				page("""
						§6§lДостижения§r

						§7Вкладка §fISTHISNIXXXON§7 в меню достижений (Esc) — шаги по серверу.

						§7Ветка §fCreate§7 — отдельно, из мода Create.

						§7Сайт: аккаунт, вайтлист, поддержка — §fisnix.ru§7
						""")
		);
	}

	private static RawFilteredPair<Text> page(String raw) {
		return RawFilteredPair.of(Text.literal(raw.stripTrailing()));
	}
}
