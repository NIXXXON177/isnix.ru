package ru.isnix.messages.mixin;

import com.mojang.authlib.GameProfile;
import net.minecraft.server.MinecraftServer;
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

import java.util.Optional;

@Mixin(PlayerManager.class)
public class PlayerManagerMixin {
	@Shadow
	@Final
	private MinecraftServer server;

	@Inject(method = "checkCanJoin", at = @At("RETURN"), cancellable = true)
	private void isnix$customWhitelistKick(GameProfile profile, CallbackInfoReturnable<Optional<Text>> cir) {
		Optional<Text> result = cir.getReturnValue();
		if (result == null || result.isEmpty()) {
			return;
		}
		Text deny = result.get();
		if (!TextUtil.isNotWhitelistedMessage(deny)) {
			return;
		}
		cir.setReturnValue(Optional.of(MessagesConfig.get().whitelistKick(server)));
	}
}
