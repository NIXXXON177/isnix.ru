package ru.isnix.messages;

import net.minecraft.server.MinecraftServer;
import net.minecraft.text.MutableText;
import net.minecraft.text.Style;
import net.minecraft.text.Text;
import net.minecraft.text.TextContent;
import net.minecraft.text.TranslatableTextContent;
import net.minecraft.util.Formatting;

import java.util.List;

public final class TextUtil {
	private TextUtil() {
	}

	public static Text fromLegacyLines(MinecraftServer server, List<String> lines) {
		if (lines == null || lines.isEmpty()) {
			return Text.empty();
		}
		MutableText result = Text.empty();
		boolean first = true;
		for (String line : lines) {
			if (!first) {
				result.append(Text.literal("\n"));
			}
			first = false;
			if (line == null || line.isEmpty()) {
				continue;
			}
			result.append(parseLegacyLine(line));
		}
		return result;
	}

	private static MutableText parseLegacyLine(String input) {
		MutableText text = Text.empty();
		Style style = Style.EMPTY;
		StringBuilder segment = new StringBuilder();
		for (int i = 0; i < input.length(); i++) {
			char ch = input.charAt(i);
			if (ch == '§' && i + 1 < input.length()) {
				if (!segment.isEmpty()) {
					text.append(Text.literal(segment.toString()).setStyle(style));
					segment.setLength(0);
				}
				Formatting formatting = Formatting.byCode(input.charAt(++i));
				if (formatting == Formatting.RESET) {
					style = Style.EMPTY;
				} else if (formatting != null) {
					style = style.withFormatting(formatting);
				}
			} else {
				segment.append(ch);
			}
		}
		if (!segment.isEmpty()) {
			text.append(Text.literal(segment.toString()).setStyle(style));
		}
		return text;
	}

	public static boolean isNotWhitelistedMessage(Text text) {
		if (text == null) {
			return false;
		}
		TextContent content = text.getContent();
		if (content instanceof TranslatableTextContent translatable) {
			return "multiplayer.disconnect.not_whitelisted".equals(translatable.getKey());
		}
		String plain = text.getString().toLowerCase();
		return plain.contains("not whitelisted") || plain.contains("не в белом списке");
	}

	public static boolean isServerShutdownMessage(Text text) {
		if (text == null) {
			return false;
		}
		TextContent content = text.getContent();
		if (content instanceof TranslatableTextContent translatable) {
			return "multiplayer.disconnect.server_shutdown".equals(translatable.getKey());
		}
		String plain = text.getString().toLowerCase();
		return plain.contains("server shutdown") || plain.contains("перезапуск");
	}
}
