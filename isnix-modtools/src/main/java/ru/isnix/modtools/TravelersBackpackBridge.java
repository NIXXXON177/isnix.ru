package ru.isnix.modtools;

import net.minecraft.entity.player.PlayerEntity;
import net.minecraft.item.ItemStack;
import net.minecraft.server.network.ServerPlayerEntity;

import java.lang.reflect.Method;

/**
 * Открытие рюкзака другого игрока через Traveler's Backpack (без /tb access).
 * Jar TB не нужен при сборке — только на сервере в runtime.
 */
public final class TravelersBackpackBridge {
	private static final int VIEW_MODE = 2;

	private static boolean checked;
	private static boolean available;
	private static Method isWearingBackpack;
	private static Method getWearingBackpack;
	private static Method openAnotherPlayerBackpack;

	private TravelersBackpackBridge() {
	}

	public static boolean isAvailable() {
		ensureInitialized();
		return available;
	}

	private static void ensureInitialized() {
		if (checked) {
			return;
		}
		checked = true;
		try {
			Class<?> attachmentUtils = Class.forName("com.tiviacz.travelersbackpack.attachment.AttachmentUtils");
			isWearingBackpack = attachmentUtils.getMethod("isWearingBackpack", PlayerEntity.class);
			getWearingBackpack = attachmentUtils.getMethod("getWearingBackpack", PlayerEntity.class);

			Class<?> backpackContainer = Class.forName("com.tiviacz.travelersbackpack.inventory.BackpackContainer");
			openAnotherPlayerBackpack = backpackContainer.getMethod(
					"openAnotherPlayerBackpack",
					ServerPlayerEntity.class,
					ServerPlayerEntity.class,
					ItemStack.class,
					int.class);
			available = true;
		} catch (Throwable t) {
			available = false;
			IsnixModToolsMod.LOGGER.warn("Traveler's Backpack API недоступен: {}", t.toString());
		}
	}

	public enum OpenResult {
		OK,
		MOD_MISSING,
		ADMIN_NOT_PLAYER,
		TARGET_NO_BACKPACK,
		ERROR
	}

	/**
	 * Открыть GUI рюкзака цели для админа (как /tb access, но через наш API).
	 */
	public static OpenResult openBackpack(ServerPlayerEntity admin, ServerPlayerEntity target) {
		if (admin == null || target == null) {
			return OpenResult.ERROR;
		}
		if (!isAvailable()) {
			return OpenResult.MOD_MISSING;
		}
		try {
			boolean wearing = Boolean.TRUE.equals(isWearingBackpack.invoke(null, target));
			if (!wearing) {
				return OpenResult.TARGET_NO_BACKPACK;
			}
			ItemStack backpack = (ItemStack) getWearingBackpack.invoke(null, target);
			if (backpack == null || backpack.isEmpty()) {
				return OpenResult.TARGET_NO_BACKPACK;
			}
			openAnotherPlayerBackpack.invoke(null, admin, target, backpack, VIEW_MODE);
			return OpenResult.OK;
		} catch (Throwable t) {
			IsnixModToolsMod.LOGGER.warn(
					"openBackpack {} -> {}: {}",
					admin.getGameProfile().name(),
					target.getGameProfile().name(),
					t.toString());
			return OpenResult.ERROR;
		}
	}
}
