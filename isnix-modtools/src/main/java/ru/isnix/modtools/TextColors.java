package ru.isnix.modtools;

import net.minecraft.text.MutableText;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

public final class TextColors {
	private TextColors() {
	}

	public static MutableText parse(String raw) {
		if (raw == null || raw.isEmpty()) {
			return Text.empty();
		}
		MutableText out = Text.empty();
		StringBuilder segment = new StringBuilder();
		Formatting current = null;

		for (int i = 0; i < raw.length(); i++) {
			char c = raw.charAt(i);
			if ((c == '&' || c == '§') && i + 1 < raw.length()) {
				if (!segment.isEmpty()) {
					appendSegment(out, segment.toString(), current);
					segment.setLength(0);
				}
				Formatting next = Formatting.byCode(raw.charAt(i + 1));
				if (next != null) {
					current = next;
				}
				i++;
				continue;
			}
			segment.append(c);
		}
		if (!segment.isEmpty()) {
			appendSegment(out, segment.toString(), current);
		}
		return out;
	}

	private static void appendSegment(MutableText out, String text, Formatting formatting) {
		MutableText part = Text.literal(text);
		if (formatting != null) {
			part.formatted(formatting);
		}
		out.append(part);
	}

	public static String formatRemaining(long millisLeft) {
		long sec = Math.max(0, millisLeft / 1000);
		long days = sec / 86400;
		sec %= 86400;
		long hours = sec / 3600;
		sec %= 3600;
		long minutes = sec / 60;
		sec %= 60;
		if (days > 0) {
			return days + "д " + hours + "ч " + minutes + "м";
		}
		if (hours > 0) {
			return hours + "ч " + minutes + "м " + sec + "с";
		}
		if (minutes > 0) {
			return minutes + "м " + sec + "с";
		}
		return sec + "с";
	}
}
