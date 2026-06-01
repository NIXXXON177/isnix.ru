package ru.isnix.modtools.mixin;

import net.minecraft.server.network.ServerPlayerEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import ru.isnix.modtools.FreezeManager;

@Mixin(ServerPlayerEntity.class)
public abstract class ServerPlayerEntityFreezeMixin {
	@Inject(method = "playerTick", at = @At("TAIL"))
	private void isnix$freezeTick(CallbackInfo ci) {
		FreezeManager.tickFrozen((ServerPlayerEntity) (Object) this);
	}
}
