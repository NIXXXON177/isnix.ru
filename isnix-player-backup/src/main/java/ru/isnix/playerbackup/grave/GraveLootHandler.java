package ru.isnix.playerbackup.grave;

import net.fabricmc.fabric.api.event.player.UseEntityCallback;
import net.minecraft.entity.Entity;
import net.minecraft.item.ItemStack;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.server.world.ServerWorld;
import net.minecraft.text.Text;
import net.minecraft.util.ActionResult;
import net.minecraft.util.Formatting;
import net.minecraft.util.Hand;
import ru.isnix.playerbackup.IsnixPlayerBackupMod;
import ru.isnix.playerbackup.OpAccess;

import java.util.List;
import java.util.Optional;

/**
 * ПКМ по гробу (ly-graves): админ получает вещи в шалкер(ы), могила исчезает.
 * Если хранилище не найдено — не блокируем обычный лут датапака graves.
 */
public final class GraveLootHandler {
	private GraveLootHandler() {
	}

	public static void register() {
		UseEntityCallback.EVENT.register((player, world, hand, entity, hitResult) -> {
			if (world.isClient()
					|| hand != Hand.MAIN_HAND
					|| !(player instanceof ServerPlayerEntity admin)
					|| !OpAccess.canUse(
							admin.getEntityWorld().getServer().getCommandSource().withEntity(admin))
					|| !LyGravesBridge.isGraveRelated(entity)) {
				return ActionResult.PASS;
			}

			var server = admin.getEntityWorld().getServer();
			Entity graveRoot = LyGravesBridge.resolveGraveRoot(entity, server);
			if (graveRoot == null) {
				return ActionResult.PASS;
			}

			Optional<Entity> storageOpt = LyGravesBridge.findStorageEntity(graveRoot, server);
			if (storageOpt.isEmpty() && entity.getCommandTags().contains(LyGravesBridge.MARKER_TAG)) {
				storageOpt = Optional.of(entity);
			}
			if (storageOpt.isEmpty()) {
				IsnixPlayerBackupMod.LOGGER.debug(
						"Grave storage not found at {} (clicked tags: {})",
						graveRoot.getBlockPos(),
						entity.getCommandTags());
				return ActionResult.PASS;
			}

			Entity storage = storageOpt.get();
			var lookup = admin.getRegistryManager();
			List<ItemStack> items = LyGravesBridge.extractItems(storage, lookup);
			items = mergeBackpackFallback(items, storage, graveRoot, server);
			items = ContainerFlatten.flatten(items, lookup);
			if (items.isEmpty()) {
				return ActionResult.PASS;
			}

			String nick = LyGravesBridge.resolveOwnerNick(server, graveRoot, storage);
			List<ItemStack> shulkers = GraveLootPacker.packIntoShulkers(items, nick);
			for (ItemStack box : shulkers) {
				admin.getInventory().offerOrDrop(box);
			}

			LyGravesBridge.clearGrave(graveRoot);

			int boxes = shulkers.size();
			int itemCount = items.size();
			admin.sendMessage(
					Text.literal("Могила ")
							.formatted(Formatting.GREEN)
							.append(Text.literal(nick).formatted(Formatting.GOLD))
							.append(Text.literal(" убрана. Шалкеров: ").formatted(Formatting.GREEN))
							.append(Text.literal(String.valueOf(boxes)).formatted(Formatting.WHITE))
							.append(Text.literal(" (стопок: " + itemCount + ")").formatted(Formatting.GRAY)),
					true);
			return ActionResult.SUCCESS;
		});
	}

	private static List<ItemStack> mergeBackpackFallback(
			List<ItemStack> items,
			Entity marker,
			Entity graveRoot,
			net.minecraft.server.MinecraftServer server) {
		if (items.stream().anyMatch(TravelersBackpackBridge::isBackpackItem)) {
			return items;
		}
		int gravesPlayerId = LyGravesBridge.readEntityScore(server, marker, "graves.marker.player.id");
		if (gravesPlayerId < 0 && graveRoot != null) {
			gravesPlayerId = LyGravesBridge.readEntityScore(server, graveRoot, "graves.grave.player.id");
		}
		if (gravesPlayerId < 0) {
			return items;
		}
		String nick = LyGravesBridge.resolveOwnerNick(server, graveRoot, marker);
		java.util.UUID ownerUuid = LyGravesBridge.resolveOwnerUuid(server, gravesPlayerId, nick);
		if (ownerUuid == null) {
			return items;
		}
		if (!(marker.getEntityWorld() instanceof ServerWorld world)) {
			return items;
		}
		var stored = TravelersBackpackBridge.readLatestBackpack(world, ownerUuid);
		if (stored.isEmpty()) {
			return items;
		}
		List<ItemStack> merged = new java.util.ArrayList<>(items);
		merged.add(stored.get().stack());
		TravelersBackpackBridge.deleteStoredBackpack(world, ownerUuid, stored.get().filename());
		return merged;
	}
}
