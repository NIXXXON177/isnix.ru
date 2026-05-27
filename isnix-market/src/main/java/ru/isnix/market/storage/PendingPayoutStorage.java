package ru.isnix.market.storage;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import net.minecraft.item.ItemStack;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import ru.isnix.market.IsnixMarketMod;
import ru.isnix.market.util.InventoryHelper;
import ru.isnix.market.util.ItemStackCodec;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

public class PendingPayoutStorage {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

	private final Path file;
	private final MinecraftServer server;

	public PendingPayoutStorage(MinecraftServer server) {
		this.server = server;
		this.file = server.getRunDirectory().toPath().resolve("config/isnix-market/pending-payouts.json");
	}

	public void add(UUID sellerUuid, ItemStack stack) {
		if (stack.isEmpty()) {
			return;
		}
		JsonObject root = readRoot();
		JsonArray players = root.has("players") ? root.getAsJsonArray("players") : new JsonArray();
		JsonObject entry = findPlayer(players, sellerUuid);
		if (entry == null) {
			entry = new JsonObject();
			entry.addProperty("uuid", sellerUuid.toString());
			entry.add("items", new JsonArray());
			players.add(entry);
			root.add("players", players);
		}
		entry.getAsJsonArray("items").add(ItemStackCodec.toJson(stack, server.getRegistryManager()));
		writeRoot(root);
	}

	public void deliverPending(ServerPlayerEntity player) {
		JsonObject root = readRoot();
		if (!root.has("players")) {
			return;
		}
		JsonArray players = root.getAsJsonArray("players");
		JsonObject entry = findPlayer(players, player.getUuid());
		if (entry == null || !entry.has("items")) {
			return;
		}
		var lookup = server.getRegistryManager();
		JsonArray items = entry.getAsJsonArray("items");
		List<ItemStack> stacks = new ArrayList<>();
		for (var el : items) {
			ItemStack stack = ItemStackCodec.fromJson(el.getAsJsonObject(), lookup);
			if (!stack.isEmpty()) {
				stacks.add(stack);
			}
		}
		if (stacks.isEmpty()) {
			return;
		}
		players.remove(entry);
		writeRoot(root);
		for (ItemStack stack : stacks) {
			InventoryHelper.giveOrDrop(player, stack);
		}
		player.sendMessage(
				Text.literal("Получена оплата с рынка за ваши лоты (" + stacks.size() + " стаков).")
						.formatted(Formatting.GOLD),
				false
		);
	}

	private JsonObject findPlayer(JsonArray players, UUID uuid) {
		String id = uuid.toString();
		for (var el : players) {
			JsonObject obj = el.getAsJsonObject();
			if (id.equals(obj.get("uuid").getAsString())) {
				return obj;
			}
		}
		return null;
	}

	public void load() {
		if (!Files.exists(file)) {
			return;
		}
	}

	public void save() {
		// payouts written on each add
	}

	private JsonObject readRoot() {
		try {
			if (!Files.exists(file)) {
				return new JsonObject();
			}
			JsonObject root = GSON.fromJson(Files.readString(file), JsonObject.class);
			return root != null ? root : new JsonObject();
		} catch (IOException e) {
			IsnixMarketMod.LOGGER.error("pending-payouts read", e);
			return new JsonObject();
		}
	}

	private void writeRoot(JsonObject root) {
		try {
			Files.createDirectories(file.getParent());
			Files.writeString(file, GSON.toJson(root));
		} catch (IOException e) {
			IsnixMarketMod.LOGGER.error("pending-payouts write", e);
		}
	}
}
