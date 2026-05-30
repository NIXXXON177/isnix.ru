package ru.isnix.opactab;

import net.minecraft.server.network.ServerPlayerEntity;

import java.util.Locale;
import java.util.Map;
import java.util.UUID;
public final class ClanTagFormatter {
	private static final Map<String, String> COLOR_NAMES = Map.ofEntries(
			Map.entry("black", "0"),
			Map.entry("dark_blue", "1"),
			Map.entry("dark_green", "2"),
			Map.entry("dark_aqua", "3"),
			Map.entry("dark_red", "4"),
			Map.entry("dark_purple", "5"),
			Map.entry("gold", "6"),
			Map.entry("gray", "7"),
			Map.entry("grey", "7"),
			Map.entry("dark_gray", "8"),
			Map.entry("dark_grey", "8"),
			Map.entry("blue", "9"),
			Map.entry("green", "a"),
			Map.entry("aqua", "b"),
			Map.entry("red", "c"),
			Map.entry("light_purple", "d"),
			Map.entry("yellow", "e"),
			Map.entry("white", "f")
	);

	private ClanTagFormatter() {
	}

	public static String formatForPlayer(ServerPlayerEntity player) {
		if (player == null || !OpacBridge.isAvailable() || !OpacBridge.hasParty(player)) {
			return "";
		}
		UUID ownerId = OpacBridge.getPartyOwnerId(player);
		if (ownerId == null) {
			return "";
		}
		String rawName = resolveTagText(player, ownerId);
		if (rawName == null || rawName.isEmpty()) {
			return "";
		}
		if (rawName.indexOf('&') >= 0 || rawName.indexOf('§') >= 0) {
			return rawName + ClanTagConfig.get().suffixReset;
		}
		ClanTagConfig.ClanStyle style = ClanTagConfig.styleFor(ownerId);
		if (style == null) {
			style = ClanTagConfig.ClanStyle.defaults();
		}
		String display = rawName;
		if (ClanTagConfig.get().wrapBrackets && !display.startsWith("[")) {
			display = "[" + display + "]";
		}
		StringBuilder out = new StringBuilder();
		appendStyleCodes(out, style);
		out.append(display);
		if (ClanTagConfig.get().suffixReset != null && !ClanTagConfig.get().suffixReset.isEmpty()) {
			out.append(ClanTagConfig.get().suffixReset);
		}
		return out.toString();
	}

	private static String resolveTagText(ServerPlayerEntity player, UUID ownerId) {
		ClanTagConfig.ClanStyle style = ClanTagConfig.styleFor(ownerId);
		if (style != null && style.tagText != null && !style.tagText.isBlank()) {
			return style.tagText.trim();
		}
		return OpacBridge.getPartyNameForPlayer(player);
	}

	static void appendStyleCodes(StringBuilder out, ClanTagConfig.ClanStyle style) {
		String colorCode = "7";
		if (style.color != null && !style.color.isBlank()) {
			colorCode = normalizeColor(style.color);
		}
		out.append('&').append(colorCode);
		if (style.bold) {
			out.append("&l");
		}
		if (style.italic) {
			out.append("&o");
		}
		if (style.underline) {
			out.append("&n");
		}
		if (style.strikethrough) {
			out.append("&m");
		}
	}

	private static String normalizeColor(String input) {
		String key = input.trim().toLowerCase(Locale.ROOT);
		if (COLOR_NAMES.containsKey(key)) {
			return COLOR_NAMES.get(key);
		}
		if (key.length() == 1 && key.matches("[0-9a-f]")) {
			return key;
		}
		if (key.startsWith("&") || key.startsWith("§")) {
			return String.valueOf(key.charAt(1));
		}
		return "7";
	}
}
