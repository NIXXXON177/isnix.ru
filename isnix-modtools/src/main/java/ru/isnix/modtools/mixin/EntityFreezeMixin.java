package ru.isnix.modtools.mixin;

import net.minecraft.entity.Entity;
import net.minecraft.server.network.ServerPlayerEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import ru.isnix.modtools.FreezeManager;
import ru.isnix.modtools.ModToolsConfig;
import ru.isnix.modtools.TextColors;

@Mixin(Entity.class)
public abstract class EntityFreezeMixin {
	@Inject(method = "setPos(DDD)V", at = @At("HEAD"), cancellable = true)
	private void isnix$blockSetPos(double x, double y, double z, CallbackInfo ci) {
		Entity self = (Entity) (Object) this;
		if (FreezeManager.shouldBlockEntityPositionChange(self, x, y, z)) {
			ci.cancel();
		}
	}

	@Inject(method = "requestTeleport(DDD)V", at = @At("HEAD"), cancellable = true)
	private void isnix$blockRequestTeleport(double destX, double destY, double destZ, CallbackInfo ci) {
		Entity self = (Entity) (Object) this;
		if (!(self instanceof ServerPlayerEntity player)) {
			return;
		}
		if (!FreezeManager.isFrozen(player) || FreezeManager.isInternalTeleport()) {
			return;
		}
		if (FreezeManager.shouldBlockEntityPositionChange(player, destX, destY, destZ)) {
			player.sendMessage(TextColors.parse(ModToolsConfig.get().frozenMessage), false);
			ci.cancel();
		}
	}
}
