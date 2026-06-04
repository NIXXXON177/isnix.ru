package ru.isnix.guide;

import net.minecraft.server.network.ServerPlayerEntity;
import net.minecraft.text.ClickEvent;
import net.minecraft.text.Style;
import net.minecraft.text.Text;
import net.minecraft.util.Formatting;

import java.net.URI;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public final class GuideManager {
	private static final Logger LOGGER = LoggerFactory.getLogger("isnix_guide");
	private static GuideProgressStorage storage;

	private GuideManager() {
	}

	public static void bind(GuideProgressStorage progressStorage) {
		storage = progressStorage;
	}

	public static void onPlayerJoin(ServerPlayerEntity player) {
		if (storage == null) {
			return;
		}
		GuideProgressStorage.PlayerProgress progress = storage.of(player.getUuid());

		if (!progress.welcomeAdvancement) {
			if (AdvancementHelper.grant(player, "welcome")) {
				progress.welcomeAdvancement = true;
			}
		}

		if (GuideConfig.get().giveBookOnFirstJoin && !progress.bookGiven) {
			giveBook(player);
			progress.bookGiven = true;
			storage.save();
		}

		if (GuideConfig.get().joinGuideMessage) {
			player.sendMessage(joinHint(), false);
		}

		tryGrantOpac(player, progress);
	}

	public static void onServerTick(net.minecraft.server.MinecraftServer server, int intervalTicks) {
		if (storage == null || intervalTicks <= 0 || server.getTicks() % intervalTicks != 0) {
			return;
		}
		for (ServerPlayerEntity player : server.getPlayerManager().getPlayerList()) {
			tryGrantOpac(player, storage.of(player.getUuid()));
		}
	}

	public static void onListingCreated(ServerPlayerEntity seller) {
		if (storage == null) {
			return;
		}
		GuideProgressStorage.PlayerProgress progress = storage.of(seller.getUuid());
		if (progress.marketSeller) {
			return;
		}
		if (AdvancementHelper.grant(seller, "market_seller")) {
			progress.marketSeller = true;
			storage.save();
		}
	}

	public static void onPurchase(ServerPlayerEntity buyer) {
		if (storage == null) {
			return;
		}
		GuideProgressStorage.PlayerProgress progress = storage.of(buyer.getUuid());
		if (progress.marketBuyer) {
			return;
		}
		if (AdvancementHelper.grant(buyer, "market_buyer")) {
			progress.marketBuyer = true;
			storage.save();
		}
	}

	private static void tryGrantOpac(ServerPlayerEntity player, GuideProgressStorage.PlayerProgress progress) {
		if (progress.opacClaim) {
			return;
		}
		var server = player.getEntityWorld().getServer();
		if (server == null || !OpacClaimsBridge.hasAnyClaim(server, player.getUuid())) {
			return;
		}
		if (AdvancementHelper.grant(player, "opac_claim")) {
			progress.opacClaim = true;
			storage.save();
			player.sendMessage(
					Text.literal("Участок защищён — достижение «Свой участок» в меню Esc → Прогресс.")
							.formatted(Formatting.GREEN),
					false
			);
		}
	}

	private static void giveBook(ServerPlayerEntity player) {
		var book = GuideBook.create();
		if (!player.getInventory().insertStack(book)) {
			player.dropItem(book, false);
		}
		player.sendMessage(
				Text.literal("В инвентарь добавлен ")
						.append(Text.literal("Путеводитель ISTHISNIXXXON").formatted(Formatting.GOLD))
						.append(Text.literal(" — открой и читай. Полная версия: ")
								.formatted(Formatting.GRAY))
						.append(webLink()),
				false
		);
	}

	private static Text joinHint() {
		return Text.literal("Подсказки по серверу: книга в инвентаре, вкладка ")
				.formatted(Formatting.GRAY)
				.append(Text.literal("ISTHISNIXXXON").formatted(Formatting.GOLD))
				.append(Text.literal(" в достижениях (Esc). Сайт: ").formatted(Formatting.GRAY))
				.append(webLink());
	}

	private static Text webLink() {
		return Text.literal("isnix.ru/guide.html")
				.formatted(Formatting.AQUA, Formatting.UNDERLINE)
				.styled(style -> style.withClickEvent(new ClickEvent.OpenUrl(URI.create("https://isnix.ru/guide.html"))));
	}
}
