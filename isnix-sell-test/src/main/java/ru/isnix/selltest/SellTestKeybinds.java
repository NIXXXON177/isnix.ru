package ru.isnix.selltest;

import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.fabricmc.fabric.api.client.keybinding.v1.KeyBindingHelper;
import net.fabricmc.fabric.api.client.networking.v1.ClientPlayConnectionEvents;
import net.fabricmc.loader.api.FabricLoader;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.option.KeyBinding;
import net.minecraft.client.util.InputUtil;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;
import org.lwjgl.glfw.GLFW;

public final class SellTestKeybinds {
	private static KeyBinding openMarket;
	private static KeyBinding openList;
	private static KeyBinding openHelp;
	private static boolean warnedMissingMarket;

	private SellTestKeybinds() {
	}

	public static void register() {
		openMarket = KeyBindingHelper.registerKeyBinding(new KeyBinding(
				"key.isnix_sell_test.open_market",
				InputUtil.Type.KEYSYM,
				GLFW.GLFW_KEY_B,
				"key.category.isnix_sell_test"
		));
		openList = KeyBindingHelper.registerKeyBinding(new KeyBinding(
				"key.isnix_sell_test.open_list",
				InputUtil.Type.KEYSYM,
				GLFW.GLFW_KEY_N,
				"key.category.isnix_sell_test"
		));
		openHelp = KeyBindingHelper.registerKeyBinding(new KeyBinding(
				"key.isnix_sell_test.open_help",
				InputUtil.Type.KEYSYM,
				GLFW.GLFW_KEY_H,
				"key.category.isnix_sell_test"
		));

		ClientTickEvents.END_CLIENT_TICK.register(SellTestKeybinds::onTick);
		ClientPlayConnectionEvents.JOIN.register((handler, sender, client) -> {
			warnedMissingMarket = false;
			checkMarketMod(client);
		});
	}

	private static void onTick(MinecraftClient client) {
		if (client.player == null || client.getNetworkHandler() == null) {
			return;
		}
		while (openMarket.wasPressed()) {
			sendCommand(client, "sell");
		}
		while (openList.wasPressed()) {
			sendCommand(client, "sell list");
		}
		while (openHelp.wasPressed()) {
			sendCommand(client, "sell help");
		}
	}

	private static void sendCommand(MinecraftClient client, String command) {
		if (!FabricLoader.getInstance().isModLoaded("isnix_market")) {
			warnMissingMarket(client);
			return;
		}
		client.getNetworkHandler().sendChatCommand(command);
		client.player.sendMessage(
				Text.literal("[sell-test] → /" + command).formatted(Formatting.DARK_GRAY),
				true
		);
	}

	private static void checkMarketMod(MinecraftClient client) {
		if (client.player != null && !FabricLoader.getInstance().isModLoaded("isnix_market")) {
			warnMissingMarket(client);
		}
	}

	private static void warnMissingMarket(MinecraftClient client) {
		if (warnedMissingMarket || client.player == null) {
			return;
		}
		warnedMissingMarket = true;
		client.player.sendMessage(
				Text.literal("[sell-test] ").formatted(Formatting.RED)
						.append(Text.literal("Нет мода isnix-market в папке mods/. ")
								.formatted(Formatting.YELLOW))
						.append(Text.literal("Нужен isnix-market-1.2.6.jar (удали старые 1.2.x). ")
								.formatted(Formatting.GRAY))
						.append(Text.literal("На сервере — зайди на mc.isnix.ru (мод уже на хостинге).")
								.formatted(Formatting.GREEN)),
				false
		);
	}
}
