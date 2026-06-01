package ru.isnix.market.trade;

import net.minecraft.item.ItemStack;
import net.minecraft.text.MutableText;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import ru.isnix.market.MarketConfig;
import ru.isnix.market.listing.MarketListing;

/**
 * Анти-скам: лимит «сколько предметов оплаты за 1 единицу товара».
 * 32 пороха за 32 палки → 1.0; 1 порох за 64 алмаза → 64 (блок).
 */
public final class MarketRatioGuard {
	public enum Level {
		OK,
		WARN_HIGH,
		WARN_LOW,
		BLOCK_HIGH,
		BLOCK_LOW
	}

	public record Check(Level level, double pricePerSaleItem) {
		public boolean blocked() {
			return level == Level.BLOCK_HIGH || level == Level.BLOCK_LOW;
		}

		public boolean suspicious() {
			return level == Level.WARN_HIGH || level == Level.WARN_LOW;
		}

		public boolean warnHigh() {
			return level == Level.WARN_HIGH;
		}

		public boolean blockHigh() {
			return level == Level.BLOCK_HIGH;
		}
	}

	private MarketRatioGuard() {
	}

	/** Предметов оплаты за 1 шт. товара (по количеству в лоте). */
	public static double pricePerSaleItem(ItemStack sale, ItemStack price) {
		if (sale.isEmpty() || price.isEmpty() || sale.getCount() < 1) {
			return 0;
		}
		return price.getCount() / (double) sale.getCount();
	}

	public static Check check(ItemStack sale, ItemStack price) {
		double ratio = pricePerSaleItem(sale, price);
		MarketConfig.MarketConfigData cfg = MarketConfig.get();
		if (!cfg.blockAbsurdRatios) {
			return new Check(Level.OK, ratio);
		}
		if (ratio > cfg.maxUnitPriceRatio) {
			return new Check(Level.BLOCK_HIGH, ratio);
		}
		if (ratio < cfg.minUnitPriceRatio) {
			return new Check(Level.BLOCK_LOW, ratio);
		}
		if (cfg.warnSuspiciousRatios && ratio > cfg.suspiciousMaxUnitPriceRatio) {
			return new Check(Level.WARN_HIGH, ratio);
		}
		if (cfg.warnSuspiciousRatios && ratio < cfg.suspiciousMinUnitPriceRatio) {
			return new Check(Level.WARN_LOW, ratio);
		}
		return new Check(Level.OK, ratio);
	}

	public static Check check(MarketListing listing) {
		return check(listing.saleItem(), listing.priceItem());
	}

	public static MutableText blockMessage(Check check) {
		var cfg = MarketConfig.get();
		return switch (check.level) {
			case BLOCK_HIGH -> Text.literal("Слишком дорого для покупателя: за 1 шт. товара просят больше ")
					.formatted(Formatting.RED)
					.append(Text.literal(String.format("%.1f", check.pricePerSaleItem)).formatted(Formatting.WHITE))
					.append(Text.literal(" предм. оплаты (макс. ").formatted(Formatting.RED))
					.append(Text.literal(String.valueOf((int) cfg.maxUnitPriceRatio)).formatted(Formatting.YELLOW))
					.append(Text.literal("). Измените цену.").formatted(Formatting.RED));
			case BLOCK_LOW -> Text.literal("Слишком дёшево: за 1 шт. товара меньше ")
					.formatted(Formatting.RED)
					.append(Text.literal(String.format("%.3f", check.pricePerSaleItem)).formatted(Formatting.WHITE))
					.append(Text.literal(" предм. оплаты (мин. ").formatted(Formatting.RED))
					.append(Text.literal(String.format("%.3f", cfg.minUnitPriceRatio)).formatted(Formatting.YELLOW))
					.append(Text.literal("). Возможна опечатка.").formatted(Formatting.RED));
			default -> Text.empty();
		};
	}

	public static MutableText warnMessage(Check check) {
		return switch (check.level) {
			case WARN_HIGH -> Text.literal("Подозрительно дорого: за 1 шт. — ")
					.formatted(Formatting.GOLD)
					.append(Text.literal(String.format("%.1f", check.pricePerSaleItem)).formatted(Formatting.YELLOW))
					.append(Text.literal(" предм. оплаты. Проверьте лот.").formatted(Formatting.GOLD));
			case WARN_LOW -> Text.literal("Подозрительно дёшево: за 1 шт. — ")
					.formatted(Formatting.GOLD)
					.append(Text.literal(String.format("%.3f", check.pricePerSaleItem)).formatted(Formatting.YELLOW))
					.append(Text.literal(" предм. оплаты.").formatted(Formatting.GOLD));
			default -> Text.empty();
		};
	}

	public static MutableText unitPriceHint(MarketListing listing) {
		int saleTotal = listing.saleItem().getCount();
		int perOne = MarketPricing.priceCountForSaleQuantity(1, saleTotal, listing.priceItem().getCount());
		return Text.empty()
				.append(Text.literal("За 1 шт.: ").formatted(Formatting.AQUA))
				.append(Text.literal(perOne + "× ").formatted(Formatting.WHITE))
				.append(listing.priceItem().getName());
	}
}
