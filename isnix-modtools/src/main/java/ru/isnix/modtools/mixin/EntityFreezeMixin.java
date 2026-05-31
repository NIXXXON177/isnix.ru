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
	@Inject(method = "requestTeleport(DDD)V", at = @At("HEAD"), cancellable = true)
	private void isnix$blockRequestTeleport(double destX, double destY, double destZ, CallbackInfo ci) {
		Entity self = (Entity) (Object) this;
		if (!(self instanceof ServerPlayerEntity player)) {
			return;
		}
		if (!FreezeManager.isFrozen(player) || FreezeManager.isInternalTeleport()) {
			return;
		}
		var pos = player.getPos();
		if (Math.abs(pos.x - destX) > 0.05 || Math.abs(pos.y - destY) > 0.05 || Math.abs(pos.z - destZ) > 0.05) {
			player.sendMessage(TextColors.parse(ModToolsConfig.get().frozenMessage), false);
			ci.cancel();
		}
	}
}
