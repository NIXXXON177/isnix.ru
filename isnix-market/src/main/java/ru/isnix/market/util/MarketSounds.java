package ru.isnix.market.util;

import net.minecraft.registry.RegistryKeys;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvent;
import net.minecraft.sound.SoundEvents;
import net.minecraft.util.Identifier;
import ru.isnix.market.MarketConfig;

public final class MarketSounds {
	private MarketSounds() {
	}

	/** Покупатель: короткий звук после удачной покупки. */
	public static void playPurchase(ServerPlayerEntity player) {
		MarketConfig.MarketConfigData cfg = MarketConfig.get();
		playToPlayer(
				player,
				cfg.purchaseSound,
				cfg.purchaseSoundVolume,
				cfg.purchaseSoundPitch);
	}

	/** Продавец онлайн: «перезвон» нотного блока, когда купили его лот. */
	public static void playSellerSale(ServerPlayerEntity seller) {
		MarketConfig.MarketConfigData cfg = MarketConfig.get();
		if (cfg.sellerSaleJingle) {
			playToPlayer(seller, "block.note_block.pling", cfg.sellerSaleSoundVolume, 1.0f);
			playToPlayer(seller, "block.note_block.chime", cfg.sellerSaleSoundVolume * 0.95f, 1.26f);
			playToPlayer(seller, "block.note_block.bell", cfg.sellerSaleSoundVolume, cfg.sellerSaleSoundPitch);
		} else {
			playToPlayer(
					seller,
					cfg.sellerSaleSound,
					cfg.sellerSaleSoundVolume,
					cfg.sellerSaleSoundPitch);
		}
	}

	private static void playToPlayer(
			ServerPlayerEntity player,
			String soundId,
			float volume,
			float pitch
	) {
		if (player == null || soundId == null || soundId.isBlank()) {
			return;
		}
		SoundEvent sound = resolveSound(player, soundId);
		player.playSoundToPlayer(sound, SoundCategory.PLAYERS, volume, pitch);
	}

	private static SoundEvent resolveSound(ServerPlayerEntity player, String idString) {
		try {
			Identifier id = Identifier.of(idString);
			var registry = player.getRegistryManager().get(RegistryKeys.SOUND_EVENT);
			SoundEvent sound = registry.get(id);
			if (sound != null) {
				return sound;
			}
		} catch (Exception ignored) {
		}
		return SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP;
	}
}
