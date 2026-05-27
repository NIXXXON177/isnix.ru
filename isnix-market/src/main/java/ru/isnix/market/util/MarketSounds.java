package ru.isnix.market.util;

import net.minecraft.registry.RegistryKeys;
import net.minecraft.registry.entry.RegistryEntry;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.sound.SoundCategory;
import net.minecraft.sound.SoundEvent;
import net.minecraft.sound.SoundEvents;
import net.minecraft.util.Identifier;
import ru.isnix.market.MarketConfig;

public final class MarketSounds {
	private MarketSounds() {
	}

	public static void playPurchase(ServerPlayerEntity player) {
		MarketConfig.MarketConfigData cfg = MarketConfig.get();
		SoundEvent sound = resolveSound(player, cfg.purchaseSound);
		ServerWorld world = player.getServerWorld();
		world.playSound(
				null,
				player.getBlockPos(),
				sound,
				SoundCategory.PLAYERS,
				cfg.purchaseSoundVolume,
				cfg.purchaseSoundPitch
		);
	}

	private static SoundEvent resolveSound(ServerPlayerEntity player, String idString) {
		try {
			Identifier id = Identifier.of(idString);
			RegistryEntry.Reference<SoundEvent> entry = player.getRegistryManager()
					.getOrThrow(RegistryKeys.SOUND_EVENT)
					.getEntry(id)
					.orElse(null);
			if (entry != null) {
				return entry.value();
			}
		} catch (Exception ignored) {
		}
		return SoundEvents.ENTITY_EXPERIENCE_ORB_PICKUP;
	}
}
