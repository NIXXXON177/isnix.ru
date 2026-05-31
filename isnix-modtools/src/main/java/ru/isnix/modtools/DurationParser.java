package ru.isnix.modtools;

import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public final class DurationParser {
	private static final Pattern TOKEN = Pattern.compile("(\\d+)([smhdw])", Pattern.CASE_INSENSITIVE);

	private DurationParser() {
	}

	/**
	 * @return длительность в миллисекундах или -1 при ошибке
	 */
	public static long parseMillis(String input) {
		if (input == null || input.isBlank()) {
			return -1;
		}
		String s = input.trim().toLowerCase(Locale.ROOT);
		Matcher m = TOKEN.matcher(s);
		long total = 0;
		int lastEnd = 0;
		while (m.find()) {
			if (m.start() != lastEnd && lastEnd > 0) {
				return -1;
			}
			long amount = Long.parseLong(m.group(1));
			char unit = Character.toLowerCase(m.group(2).charAt(0));
			total += switch (unit) {
				case 's' -> amount * 1000L;
				case 'm' -> amount * 60_000L;
				case 'h' -> amount * 3_600_000L;
				case 'd' -> amount * 86_400_000L;
				case 'w' -> amount * 7L * 86_400_000L;
				default -> -1;
			};
			if (total < 0) {
				return -1;
			}
			lastEnd = m.end();
		}
		if (total <= 0 || lastEnd != s.length()) {
			return -1;
		}
		return total;
	}

	/** Формат для LuckPerms settemp: 1h30m */
	public static String toLuckPermsDuration(String input) {
		if (input == null || input.isBlank()) {
			return "";
		}
		return input.trim().toLowerCase(Locale.ROOT).replace(" ", "");
	}
}
