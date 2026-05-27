package ru.isnix.market.util;

import com.google.gson.JsonObject;
import com.mojang.serialization.JsonOps;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.RegistryOps;
import net.minecraft.registry.RegistryWrapper;

public final class ItemStackCodec {
	private ItemStackCodec() {
	}

	public static JsonObject toJson(ItemStack stack, RegistryWrapper.WrapperLookup lookup) {
		if (stack == null || stack.isEmpty()) {
			return new JsonObject();
		}
		return ItemStack.CODEC.encodeStart(RegistryOps.of(JsonOps.INSTANCE, lookup), stack.copy())
				.result()
				.filter(el -> el.isJsonObject())
				.map(el -> el.getAsJsonObject())
				.orElseGet(JsonObject::new);
	}

	public static ItemStack fromJson(JsonObject json, RegistryWrapper.WrapperLookup lookup) {
		if (json == null || json.isEmpty()) {
			return ItemStack.EMPTY;
		}
		return ItemStack.CODEC.parse(RegistryOps.of(JsonOps.INSTANCE, lookup), json)
				.result()
				.orElse(ItemStack.EMPTY);
	}
}
