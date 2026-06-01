package ru.isnix.market.screen;

public enum MarketSortMode {
	NEWEST("Новые"),
	PRICE_ASC("Дешевле"),
	PRICE_DESC("Дороже"),
	SELLER("Продавец");

	private final String label;

	MarketSortMode(String label) {
		this.label = label;
	}

	public String label() {
		return label;
	}

	public MarketSortMode next() {
		return switch (this) {
			case NEWEST -> PRICE_ASC;
			case PRICE_ASC -> PRICE_DESC;
			case PRICE_DESC -> SELLER;
			case SELLER -> NEWEST;
		};
	}
}
