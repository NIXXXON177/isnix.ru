package ru.isnix.playerbackup.grave;

import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.BundleContentsComponent;
import net.minecraft.component.type.ContainerComponent;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.RegistryWrapper;

import java.lang.reflect.Method;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/** Раскладывает вложенные контейнеры (рюкзак, шалкер, bundle) в плоский список стопок. */
public final class ContainerFlatten {
	private static boolean backpackChecked;
	private static boolean backpackAvailable;
	private static Method backpackFromStack;
	private static Method getStorage;
	private static Method getUpgrades;
	private static Method getTools;
	private static Method handlerGetSlots;
	private static Method handlerGetStackInSlot;

	private ContainerFlatten() {
	}

	public static List<ItemStack> flatten(List<ItemStack> items, RegistryWrapper.WrapperLookup lookup) {
		List<ItemStack> result = new ArrayList<>();
		Deque<ItemStack> pending = new ArrayDeque<>();
		for (ItemStack item : items) {
			if (item != null && !item.isEmpty()) {
				pending.addLast(item.copy());
			}
		}
		while (!pending.isEmpty()) {
			ItemStack stack = pending.removeFirst();
			if (TravelersBackpackBridge.isBackpackItem(stack)) {
				for (ItemStack inner : extractBackpackContents(stack)) {
					if (!inner.isEmpty()) {
						pending.addLast(inner);
					}
				}
				continue;
			}
			if (isShulker(stack)) {
				for (ItemStack inner : extractContainer(stack)) {
					if (!inner.isEmpty()) {
						pending.addLast(inner);
					}
				}
				continue;
			}
			if (isBundle(stack)) {
				for (ItemStack inner : extractBundle(stack)) {
					if (!inner.isEmpty()) {
						pending.addLast(inner);
					}
				}
				continue;
			}
			result.add(stack);
		}
		return result;
	}

	private static boolean isShulker(ItemStack stack) {
		ContainerComponent container = stack.get(DataComponentTypes.CONTAINER);
		return container != null && !container.stream().allMatch(ItemStack::isEmpty);
	}

	private static boolean isBundle(ItemStack stack) {
		BundleContentsComponent bundle = stack.get(DataComponentTypes.BUNDLE_CONTENTS);
		return bundle != null && !bundle.isEmpty();
	}

	private static List<ItemStack> extractContainer(ItemStack stack) {
		List<ItemStack> out = new ArrayList<>();
		ContainerComponent container = stack.get(DataComponentTypes.CONTAINER);
		if (container == null) {
			return out;
		}
		container.stream().filter(s -> !s.isEmpty()).forEach(s -> out.add(s.copy()));
		return out;
	}

	private static List<ItemStack> extractBundle(ItemStack stack) {
		List<ItemStack> out = new ArrayList<>();
		BundleContentsComponent bundle = stack.get(DataComponentTypes.BUNDLE_CONTENTS);
		if (bundle == null) {
			return out;
		}
		bundle.stream().filter(s -> !s.isEmpty()).forEach(s -> out.add(s.copy()));
		return out;
	}

	private static List<ItemStack> extractBackpackContents(ItemStack backpack) {
		List<ItemStack> out = new ArrayList<>();
		if (!ensureBackpackReflection()) {
			out.add(backpack.copy());
			return out;
		}
		try {
			Object wrapper = backpackFromStack.invoke(null, backpack);
			if (wrapper == null) {
				out.add(backpack.copy());
				return out;
			}
			collectHandlerStacks(getStorage.invoke(wrapper), out);
			collectHandlerStacks(getUpgrades.invoke(wrapper), out);
			collectHandlerStacks(getTools.invoke(wrapper), out);
		} catch (Throwable t) {
			out.clear();
			out.add(backpack.copy());
		}
		return out;
	}

	private static void collectHandlerStacks(Object handler, List<ItemStack> out) throws ReflectiveOperationException {
		if (handler == null) {
			return;
		}
		int slots = (int) handlerGetSlots.invoke(handler);
		for (int i = 0; i < slots; i++) {
			ItemStack slot = (ItemStack) handlerGetStackInSlot.invoke(handler, i);
			if (slot != null && !slot.isEmpty()) {
				out.add(slot.copy());
			}
		}
	}

	private static boolean ensureBackpackReflection() {
		if (backpackChecked) {
			return backpackAvailable;
		}
		backpackChecked = true;
		if (!TravelersBackpackBridge.isAvailable()) {
			backpackAvailable = false;
			return false;
		}
		try {
			Class<?> wrapperClass =
					Class.forName("com.tiviacz.travelersbackpack.inventory.BackpackWrapper");
			Class<?> handlerClass =
					Class.forName("com.tiviacz.travelersbackpack.inventory.handler.ItemStackHandler");
			backpackFromStack = wrapperClass.getMethod("fromStack", ItemStack.class);
			getStorage = wrapperClass.getMethod("getStorage");
			getUpgrades = wrapperClass.getMethod("getUpgrades");
			getTools = wrapperClass.getMethod("getTools");
			handlerGetSlots = handlerClass.getMethod("getSlots");
			handlerGetStackInSlot = handlerClass.getMethod("getStackInSlot", int.class);
			backpackAvailable = true;
		} catch (Throwable t) {
			backpackAvailable = false;
		}
		return backpackAvailable;
	}
}
