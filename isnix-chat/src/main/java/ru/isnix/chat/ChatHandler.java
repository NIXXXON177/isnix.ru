package ru.isnix.chat;

import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.network.message.SignedMessage;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvents;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import net.minecraft.util.math.Vec3d;
import net.minecraft.network.message.MessageType;

import java.util.ArrayList;
import java.util.List;

public final class ChatHandler {
	private ChatHandler() {
	}

	/**
	 * @return true — пропустить ванильный чат; false — отменить (мы уже разослали)
	 */
	public static boolean handle(
			SignedMessage signedMessage,
			ServerPlayerEntity sender,
			MessageType.Parameters params) {
		String raw = signedMessage.getContent().getString();
		if (raw.isEmpty() || raw.charAt(0) == '/') {
			return true;
		}

		ChatConfig cfg = ChatConfig.get();
		boolean global = raw.startsWith(cfg.globalPrefix);
		String body = global
				? raw.substring(cfg.globalPrefix.length()).stripLeading()
				: raw;

		if (body.isEmpty()) {
			if (global) {
				sender.sendMessage(
						Text.literal("После «" + cfg.globalPrefix + "» напиши сообщение для всего сервера.")
								.formatted(Formatting.YELLOW),
						false);
			}
			return false;
		}

		MinecraftServer server = sender.getServer();
		if (server == null) {
			return true;
		}

		Text line = buildLine(sender, body, global, cfg);
		List<ServerPlayerEntity> recipients = global
				? server.getPlayerManager().getPlayerList()
				: nearbyPlayers(sender, cfg.localRadius);

		for (ServerPlayerEntity target : recipients) {
			target.sendMessage(line, false);
			if (global) {
				playGlobalSound(target, cfg);
			}
		}

		IsnixChatMod.LOGGER.info("[chat] {}", line.getString());
		return false;
	}

	private static List<ServerPlayerEntity> nearbyPlayers(ServerPlayerEntity sender, int radius) {
		double radiusSq = (double) radius * radius;
		Vec3d origin = sender.getPos();
		var world = sender.getWorld();
		List<ServerPlayerEntity> out = new ArrayList<>();

		for (ServerPlayerEntity other : sender.getServer().getPlayerManager().getPlayerList()) {
			if (other.getWorld() != world) {
				continue;
			}
			if (origin.squaredDistanceTo(other.getPos()) <= radiusSq) {
				out.add(other);
			}
		}
		return out;
	}

	/** Короткий звук подбора опыта — только у получателя глобального сообщения. */
	private static void playGlobalSound(ServerPlayerEntity player, ChatConfig cfg) {
		if (!cfg.globalSound) {
			return;
		}
		player.playSoundToPlayer(
				SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP,
				SoundCategory.PLAYERS,
				cfg.globalSoundVolume,
				cfg.globalSoundPitch);
	}

	private static Text buildLine(
			ServerPlayerEntity sender,
			String body,
			boolean global,
			ChatConfig cfg) {
		String tag = global ? cfg.globalTag : cfg.localTag;
		Formatting tagColor = global ? Formatting.GOLD : Formatting.GRAY;

		return Text.empty()
				.append(Text.literal(tag + " ").formatted(tagColor))
				.append(sender.getDisplayName())
				.append(Text.literal(" » ").formatted(Formatting.DARK_GRAY))
				.append(Text.literal(body).formatted(Formatting.WHITE));
	}
}
