package ru.isnix.graveguard;

import net.fabricmc.fabric.api.entity.event.v1.ServerLivingEntityEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.fabricmc.fabric.api.event.player.UseEntityCallback;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.ActionResult;

public final class GraveGuardEvents {
	private GraveGuardEvents() {
	}

	public static void register() {
		ServerLivingEntityEvents.AFTER_DEATH.register((entity, damageSource) -> {
			if (entity instanceof ServerPlayerEntity player) {
				GraveGuardManager.onPlayerDeath(player);
			}
		});

		ServerLivingEntityEvents.ALLOW_DAMAGE.register((entity, source, amount) -> {
			if (!(entity instanceof ServerPlayerEntity player)) {
				return true;
			}
			return !GraveGuardManager.shouldBlockDamage(player, source);
		});

		UseEntityCallback.EVENT.register((player, world, hand, entity, hitResult) -> {
			if (world.isClient() || !(player instanceof ServerPlayerEntity serverPlayer)) {
				return ActionResult.PASS;
			}
			if (!GraveGuardConfig.get().enabled || !GraveEntityDetector.isGraveEntity(entity)) {
				return ActionResult.PASS;
			}
			if (!GraveGuardManager.isEligible(serverPlayer)) {
				return ActionResult.PASS;
			}
			if (!GraveEntityDetector.isOwnedBy(serverPlayer, entity)) {
				return ActionResult.PASS;
			}
			GraveGuardManager.extendLootZone(serverPlayer);
			GraveGuardManager.grantProtection(
					serverPlayer,
					true,
					GraveGuardConfig.get().protectAllDamageInLootZone);
			return ActionResult.PASS;
		});

		ServerTickEvents.END_SERVER_TICK.register(GraveGuardManager::tick);

		ServerPlayConnectionEvents.DISCONNECT.register((handler, server) ->
				GraveGuardManager.onLogout(handler.player));
	}
}
