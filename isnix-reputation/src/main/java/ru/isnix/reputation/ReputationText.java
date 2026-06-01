package ru.isnix.reputation;

import net.minecraft.text.MutableText;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

public final class ReputationText {
	private ReputationText() {
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
}
