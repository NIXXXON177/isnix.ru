package ru.isnix.modtools.mixin;

import net.minecraft.entity.LivingEntity;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.util.math.Vec3d;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import ru.isnix.modtools.FreezeManager;

@Mixin(LivingEntity.class)
public abstract class LivingEntityFreezeMixin {
	@Inject(method = "travel", at = @At("HEAD"), cancellable = true)
	private void isnix$blockTravelWhenFrozen(Vec3d movementInput, CallbackInfo ci) {
		LivingEntity self = (LivingEntity) (Object) this;
		if (self instanceof ServerPlayerEntity player && FreezeManager.isFrozen(player)) {
			self.setVelocity(Vec3d.ZERO);
			ci.cancel();
		}
	}
}
