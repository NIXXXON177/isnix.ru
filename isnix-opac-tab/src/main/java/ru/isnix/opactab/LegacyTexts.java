package ru.isnix.opactab;

import net.minecraft.text.MutableText;
import net.minecraft.text.Style;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

public final class LegacyTexts {
	private LegacyTexts() {
	}

	public static Text parse(String input) {
		if (input == null || input.isEmpty()) {
			return Text.empty();
		}
		MutableText text = Text.empty();
		Style style = Style.EMPTY;
		StringBuilder segment = new StringBuilder();
		for (int i = 0; i < input.length(); i++) {
			char ch = input.charAt(i);
			if ((ch == '§' || ch == '&') && i + 1 < input.length()) {
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
}
