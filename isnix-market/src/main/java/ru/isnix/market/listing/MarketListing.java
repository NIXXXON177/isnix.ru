package ru.isnix.market.listing;

import com.google.gson.JsonObject;
import net.minecraft.item.ItemStack;
import net.minecraft.registry.RegistryWrapper;

import java.util.UUID;

public record MarketListing(
		UUID id,
		UUID sellerUuid,
		String sellerName,
		long createdAtEpochMs,
		ItemStack saleItem,
		ItemStack priceItem
) {
	public static MarketListing create(UUID sellerUuid, String sellerName, ItemStack sale, ItemStack price) {
		return new MarketListing(
				UUID.randomUUID(),
				sellerUuid,
				sellerName,
				System.currentTimeMillis(),
				sale.copy(),
				price.copy()
		);
	}

	public JsonObject toJson(RegistryWrapper.WrapperLookup lookup) {
		JsonObject json = new JsonObject();
		json.addProperty("id", id.toString());
		json.addProperty("sellerUuid", sellerUuid.toString());
		json.addProperty("sellerName", sellerName);
		json.addProperty("createdAt", createdAtEpochMs);
		json.add("saleItem", ru.isnix.market.util.ItemStackCodec.toJson(saleItem, lookup));
		json.add("priceItem", ru.isnix.market.util.ItemStackCodec.toJson(priceItem, lookup));
		return json;
	}

	public static MarketListing fromJson(JsonObject json, RegistryWrapper.WrapperLookup lookup) {
		return new MarketListing(
				UUID.fromString(json.get("id").getAsString()),
				UUID.fromString(json.get("sellerUuid").getAsString()),
				json.get("sellerName").getAsString(),
				json.get("createdAt").getAsLong(),
				ru.isnix.market.util.ItemStackCodec.fromJson(json.getAsJsonObject("saleItem"), lookup),
				ru.isnix.market.util.ItemStackCodec.fromJson(json.getAsJsonObject("priceItem"), lookup)
		);
	}

	public MarketListing withStacks(ItemStack sale, ItemStack price) {
		return new MarketListing(id, sellerUuid, sellerName, createdAtEpochMs, sale.copy(), price.copy());
	}
}
