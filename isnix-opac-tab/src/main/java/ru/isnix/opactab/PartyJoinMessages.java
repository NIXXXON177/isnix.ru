package ru.isnix.opactab;

import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.MutableText;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * OPAC: «[Клан] Ник joined the party!» — без префикса LuckPerms и без тега после ника.
 * Переписываем в «[Админ] Ник [Клан] joined the party!».
 */
public final class PartyJoinMessages {
	private static final Pattern OPAC_JOIN = Pattern.compile(
			"^(.+?) ([A-Za-z0-9_]{3,16}) joined the party!?$",
			Pattern.CASE_INSENSITIVE
	);
	private static final Pattern YOU_JOINED = Pattern.compile(
			"^You have joined (.+?)'s Party!?$",
			Pattern.CASE_INSENSITIVE
	);

	private PartyJoinMessages() {
	}

	public static Text rewrite(ServerPlayerEntity receiver, Text message) {
		if (message == null) {
			return message;
		}
		String plain = message.getString();
		if (plain.isEmpty()) {
			return message;
		}
		Matcher join = OPAC_JOIN.matcher(plain.trim());
		if (join.matches()) {
			String nick = join.group(2);
			var server = receiver.getServer();
			ServerPlayerEntity joined = PlayerDisplayFormat.findByNick(server, nick);
			if (joined == null) {
				return message;
			}
			MutableText out = Text.empty();
			out.append(PlayerDisplayFormat.withPrefixSuffixAndClan(joined));
			out.append(Text.literal(" joined the party!").formatted(Formatting.GRAY));
			return out;
		}
		Matcher self = YOU_JOINED.matcher(plain.trim());
		if (self.matches()) {
			MutableText out = Text.empty();
			out.append(Text.literal("You have joined ").formatted(Formatting.WHITE));
			out.append(PlayerDisplayFormat.withPrefixSuffixAndClan(receiver));
			out.append(Text.literal("'s Party!").formatted(Formatting.WHITE));
			return out;
		}
		return message;
	}
}
