package ru.isnix.modtools.mixin;

import net.minecraft.network.packet.c2s.play.PlayerInputC2SPacket;
import net.minecraft.network.packet.c2s.play.PlayerMoveC2SPacket;
import net.minecraft.network.packet.c2s.play.VehicleMoveC2SPacket;
import net.minecraft.server.network.ServerPlayNetworkHandler;
import net.minecraft.server.network.ServerPlayerEntity;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;
import ru.isnix.modtools.FreezeManager;
import ru.isnix.modtools.ModToolsConfig;
import ru.isnix.modtools.TextColors;

@Mixin(ServerPlayNetworkHandler.class)
public abstract class ServerPlayNetworkHandlerMixin {
	@Shadow
	public ServerPlayerEntity player;

	/** С 1.21 WASD идёт отдельным пакетом — без этого игрок продолжает ходить. */
	@Inject(method = "onPlayerInput", at = @At("HEAD"), cancellable = true)
	private void isnix$blockInputWhenFrozen(PlayerInputC2SPacket packet, CallbackInfo ci) {
		if (FreezeManager.isFrozen(player)) {
			ci.cancel();
		}
	}

	@Inject(method = "onPlayerMove", at = @At("HEAD"), cancellable = true)
	private void isnix$blockMoveWhenFrozen(PlayerMoveC2SPacket packet, CallbackInfo ci) {
		if (!FreezeManager.isFrozen(player)) {
			return;
		}
		// Поворот обрабатываем сами: vanilla при pending teleport (после requestTeleport)
		// отбрасывает все PlayerMove, включая look-only.
		if (packet.changesLook()) {
			FreezeManager.applyLookFromPacket(player, packet);
		}
		if (packet.changesPosition()) {
			ci.cancel();
			FreezeManager.repositionFrozen(player);
		} else if (packet.changesLook()) {
			ci.cancel();
		}
	}

	@Inject(method = "onVehicleMove", at = @At("HEAD"), cancellable = true)
	private void isnix$blockVehicleWhenFrozen(VehicleMoveC2SPacket packet, CallbackInfo ci) {
		if (FreezeManager.isFrozen(player)) {
			ci.cancel();
			FreezeManager.snapToAnchor(player);
		}
	}

	@Inject(method = "executeCommand", at = @At("HEAD"), cancellable = true)
	private void isnix$blockCommandWhenFrozen(String command, CallbackInfo ci) {
		if (!FreezeManager.shouldBlockCommand(player, command)) {
			return;
		}
		player.sendMessage(TextColors.parse(ModToolsConfig.get().frozenCommandBlocked), false);
		ci.cancel();
	}
}
