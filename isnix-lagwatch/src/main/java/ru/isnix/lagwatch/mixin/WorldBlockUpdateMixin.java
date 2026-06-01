package ru.isnix.lagwatch.mixin;

import net.minecraft.block.BlockState;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.util.math.BlockPos;
import net.minecraft.world.World;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
import ru.isnix.lagwatch.ChunkActivityTracker;

@Mixin(World.class)
public abstract class WorldBlockUpdateMixin {
	@Inject(
			method = "setBlockState(Lnet/minecraft/util/math/BlockPos;Lnet/minecraft/block/BlockState;II)Z",
			at = @At("HEAD"))
	private void isnix$trackBlockUpdate(
			BlockPos pos,
			BlockState state,
			int flags,
			int maxUpdateDepth,
			CallbackInfoReturnable<Boolean> cir) {
		World self = (World) (Object) this;
		if (!(self instanceof ServerWorld serverWorld)) {
			return;
		}
		BlockState current = self.getBlockState(pos);
		if (current == state) {
			return;
		}
		ChunkActivityTracker.recordBlockUpdate(serverWorld, pos);
	}
}
