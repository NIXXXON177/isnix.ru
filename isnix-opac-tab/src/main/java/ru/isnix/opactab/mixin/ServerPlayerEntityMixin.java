package ru.isnix.opactab.mixin;

import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.ModifyVariable;
import ru.isnix.opactab.PartyJoinMessages;

@Mixin(ServerPlayerEntity.class)
public class ServerPlayerEntityMixin {
	@ModifyVariable(
			method = "sendMessage(Lnet/minecraft/text/Text;Z)V",
			at = @At("HEAD"),
			argsOnly = true,
			ordinal = 0
	)
	private Text isnix$rewritePartyJoinMessage(Text message) {
		return PartyJoinMessages.rewrite((ServerPlayerEntity) (Object) this, message);
	}
}
