package ru.isnix.messages.mixin;

import net.minecraft.server.MinecraftServer;
import net.minecraft.server.PlayerConfigEntry;
import net.minecraft.server.PlayerManager;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Final;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.Shadow;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;
import ru.isnix.messages.MessagesConfig;
import ru.isnix.messages.TextUtil;

import java.net.SocketAddress;

@Mixin(PlayerManager.class)
public class PlayerManagerMixin {
	@Shadow
	@Final
	private MinecraftServer server;

	/** 1.21.11: checkCanJoin(SocketAddress, PlayerConfigEntry). null = вход разрешён. */
	@Inject(method = "checkCanJoin", at = @At("RETURN"), cancellable = true)
	private void isnix$customWhitelistKick(
			SocketAddress address,
			PlayerConfigEntry configEntry,
			CallbackInfoReturnable<Text> cir) {
		Text deny = cir.getReturnValue();
		if (deny == null) {
			return;
		}
		if (!TextUtil.isNotWhitelistedMessage(deny)) {
			return;
		}
		cir.setReturnValue(MessagesConfig.get().whitelistKick(server));
	}
}
