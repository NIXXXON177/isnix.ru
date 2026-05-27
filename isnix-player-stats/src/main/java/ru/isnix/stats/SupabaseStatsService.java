package ru.isnix.stats;

import com.google.gson.JsonObject;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class SupabaseStatsService {
	private static final Logger LOGGER = LoggerFactory.getLogger(IsnixPlayerStatsMod.MOD_ID);
	private static final HttpClient HTTP = HttpClient.newBuilder()
			.connectTimeout(Duration.ofSeconds(10))
			.build();
	private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor(r -> {
		var t = new Thread(r, "isnix-player-stats");
		t.setDaemon(true);
		return t;
	});

	private SupabaseStatsService() {
	}

	public static void onPlayerJoin(String nick) {
		callRpc("server_record_player_join", nick);
	}

	public static void onPlayerQuit(String nick) {
		callRpc("server_record_player_quit", nick);
	}

	/** Сохранить накопленное время в БД, не выкидывая игрока (quit + join). */
	public static void flushSession(String nick) {
		var config = StatsConfig.get();
		if (!config.isReady() || nick == null || nick.isBlank()) {
			return;
		}
		final String playerNick = nick.trim();
		EXECUTOR.execute(() -> {
			invokeRpc(config, "server_record_player_quit", playerNick);
			invokeRpc(config, "server_record_player_join", playerNick);
		});
	}

	private static void callRpc(String functionName, String nick) {
		var config = StatsConfig.get();
		if (!config.isReady()) {
			return;
		}
		if (nick == null || nick.isBlank()) {
			return;
		}
		final String playerNick = nick.trim();
		EXECUTOR.execute(() -> invokeRpc(config, functionName, playerNick));
	}

	private static void invokeRpc(StatsConfig config, String functionName, String nick) {
		try {
			var body = new JsonObject();
			body.addProperty("p_nick", nick);
			var url = config.supabaseUrl + "/rest/v1/rpc/" + functionName;
			var request = HttpRequest.newBuilder()
					.uri(URI.create(url))
					.timeout(Duration.ofSeconds(15))
					.header("Content-Type", "application/json")
					.header("apikey", config.serviceRoleKey)
					.header("Authorization", "Bearer " + config.serviceRoleKey)
					.POST(HttpRequest.BodyPublishers.ofString(body.toString()))
					.build();
			var response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
			if (response.statusCode() >= 200 && response.statusCode() < 300) {
				LOGGER.debug("Supabase {}: OK для {}", functionName, nick);
				return;
			}
			LOGGER.warn(
					"Supabase {} для {}: HTTP {} — {}",
					functionName,
					nick,
					response.statusCode(),
					truncate(response.body(), 200));
		} catch (Exception e) {
			LOGGER.warn("Supabase {} для {}: {}", functionName, nick, e.getMessage());
		}
	}

	private static String truncate(String s, int max) {
		if (s == null) {
			return "";
		}
		return s.length() <= max ? s : s.substring(0, max) + "…";
	}
}
