package ru.isnix.playerbackup;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import net.minecraft.component.DataComponentTypes;
import net.minecraft.component.type.BundleContentsComponent;
import net.minecraft.component.type.ContainerComponent;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.Registries;

import java.util.HashMap;
import java.util.Map;

/** JSON для ItemStack, включая содержимое шалкеров и bundle (рекурсивно). */
public final class ItemStackJson {
	private static final int MAX_DEPTH = 8;

	private ItemStackJson() {
	}

	public static JsonObject toJson(ItemStack stack) {
		return toJson(stack, 0);
	}

	public static void addTotals(Map<String, Integer> totals, ItemStack stack) {
		addTotals(totals, stack, 0);
	}

	private static void addTotals(Map<String, Integer> totals, ItemStack stack, int depth) {
		if (stack.isEmpty() || depth > MAX_DEPTH) {
			return;
		}
		String id = Registries.ITEM.getId(stack.getItem()).toString();
		totals.merge(id, stack.getCount(), Integer::sum);
		if (depth >= MAX_DEPTH) {
			return;
		}
		ContainerComponent container = stack.get(DataComponentTypes.CONTAINER);
		if (container != null) {
			for (ItemStack inner : container.iterateNonEmpty()) {
				addTotals(totals, inner, depth + 1);
			}
		}
		BundleContentsComponent bundle = stack.get(DataComponentTypes.BUNDLE_CONTENTS);
		if (bundle != null) {
			for (ItemStack inner : bundle.iterate()) {
				addTotals(totals, inner, depth + 1);
			}
		}
	}

	private static JsonObject toJson(ItemStack stack, int depth) {
		JsonObject o = new JsonObject();
		o.addProperty("id", Registries.ITEM.getId(stack.getItem()).toString());
		o.addProperty("count", stack.getCount());

		var customName = stack.get(DataComponentTypes.CUSTOM_NAME);
		if (customName != null) {
			o.addProperty("custom_name", customName.getString());
		}

		var lore = stack.get(DataComponentTypes.LORE);
		if (lore != null && !lore.lines().isEmpty()) {
			JsonArray lines = new JsonArray();
			for (var line : lore.lines()) {
				lines.add(line.getString());
			}
			o.add("lore", lines);
		}

		if (depth < MAX_DEPTH && BackupConfig.get().includeContainerContents) {
			ContainerComponent container = stack.get(DataComponentTypes.CONTAINER);
			if (container != null) {
				JsonArray contents = new JsonArray();
				for (ItemStack inner : container.iterateNonEmpty()) {
					contents.add(toJson(inner, depth + 1));
				}
				if (!contents.isEmpty()) {
					o.add("contents", contents);
				}
			}
			BundleContentsComponent bundle = stack.get(DataComponentTypes.BUNDLE_CONTENTS);
			if (bundle != null) {
				JsonArray bundleItems = new JsonArray();
				for (ItemStack inner : bundle.iterate()) {
					bundleItems.add(toJson(inner, depth + 1));
				}
				if (!bundleItems.isEmpty()) {
					o.add("bundle_contents", bundleItems);
				}
			}
		}

		return o;
	}

	public static JsonObject totalsToJson(Map<String, Integer> totals) {
		JsonObject o = new JsonObject();
		totals.entrySet().stream()
				.sorted((a, b) -> Integer.compare(b.getValue(), a.getValue()))
				.forEach(e -> o.addProperty(e.getKey(), e.getValue()));
		return o;
	}

	public static Map<String, Integer> emptyTotals() {
		return new HashMap<>();
	}
}
