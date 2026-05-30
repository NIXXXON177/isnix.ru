package ru.isnix.selltest;

import net.fabricmc.fabric.api.client.event.lifecycle.v1.ClientTickEvents;
import net.minecraft.client.MinecraftClient;
import net.minecraft.client.gui.screen.Screen;
import net.minecraft.client.gui.screen.ingame.HandledScreen;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

public final class MarketScreenWatcher {
	private static Screen lastScreen;
	private static String lastHintKey = "";

	private MarketScreenWatcher() {
	}

	public static void register() {
		ClientTickEvents.END_CLIENT_TICK.register(MarketScreenWatcher::onTick);
	}

	private static void onTick(MinecraftClient client) {
		Screen current = client.currentScreen;
		if (current == lastScreen) {
			return;
		}
		lastScreen = current;
		if (!(current instanceof HandledScreen<?> handled) || client.player == null) {
			lastHintKey = "";
			return;
		}
		String title = handled.getTitle().getString();
		String hint = hintForTitle(title);
		if (hint.isEmpty()) {
			return;
		}
		String key = current.getClass().getName() + "|" + title;
		if (key.equals(lastHintKey)) {
			return;
		}
		lastHintKey = key;
		client.player.sendMessage(Text.literal(hint).formatted(Formatting.AQUA), true);
	}

	private static String hintForTitle(String title) {
		if (title.contains("Рынок ISNIX") || title.contains("Рынок")) {
			return "[sell-test] ЛКМ — купить · Shift+ПКМ — снять свой лот";
		}
		if (title.contains("Выставить лот")) {
			return "[sell-test] 1) Товар — клик по инвентарю · 2) Цена — ещё клик (ЛКМ 1 / ПКМ стак)";
		}
		return "";
	}
}
