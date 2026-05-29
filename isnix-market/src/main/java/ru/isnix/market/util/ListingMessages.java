package ru.isnix.market.util;

import net.minecraft.item.ItemStack;
import net.minecraft.text.MutableText;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

import java.util.UUID;

/** Сообщения в чат с коротким и полным ID лота. */
public final class ListingMessages {
	private ListingMessages() {
	}

	/** Короткий ID для чата (#a1b2c3d4). */
	public static String shortId(UUID id) {
		String hex = id.toString().replace("-", "");
		return "#" + hex.substring(0, 8);
	}

	public static MutableText idLine(UUID id) {
		return Text.literal("ID продажи: ")
				.formatted(Formatting.GOLD)
				.append(Text.literal(shortId(id)).formatted(Formatting.YELLOW, Formatting.BOLD))
				.append(Text.literal(" · ").formatted(Formatting.DARK_GRAY))
				.append(Text.literal(id.toString()).formatted(Formatting.DARK_GRAY));
	}

	public static Text listed(ItemStack sale, ItemStack price, UUID id) {
		return Text.literal("Лот выставлен: ")
				.formatted(Formatting.GREEN)
				.append(sale.toHoverableText())
				.append(Text.literal(" за ").formatted(Formatting.GRAY))
				.append(price.toHoverableText())
				.append(Text.literal("\n").formatted(Formatting.GRAY))
				.append(idLine(id));
	}

	public static Text cancelled(UUID id) {
		return Text.literal("Лот снят с продажи. Предмет возвращён в инвентарь.\n")
				.formatted(Formatting.YELLOW)
				.append(idLine(id));
	}

	public static Text purchased(UUID id) {
		return Text.literal("Покупка завершена.\n")
				.formatted(Formatting.GREEN)
				.append(idLine(id));
	}

	public static Text soldToBuyer(UUID id, ItemStack sale, ItemStack price) {
		return Text.literal("Продано: ")
				.formatted(Formatting.GOLD)
				.append(sale.toHoverableText())
				.append(Text.literal(" — оплата ").formatted(Formatting.GRAY))
				.append(price.toHoverableText())
				.append(Text.literal("\n").formatted(Formatting.GRAY))
				.append(idLine(id));
	}
}
