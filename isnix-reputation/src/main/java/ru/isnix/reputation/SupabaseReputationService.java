package ru.isnix.reputation;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class SupabaseReputationService {
	private static final Logger LOGGER = LoggerFactory.getLogger(IsnixReputationMod.MOD_ID);
	private static final HttpClient HTTP = HttpClient.newBuilder()
			.connectTimeout(Duration.ofSeconds(10))
			.build();
	private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor(r -> {
		var t = new Thread(r, "isnix-reputation-http");
		t.setDaemon(true);
		return t;
	});

	private SupabaseReputationService() {
	}

	public static ReputationScore fetchReputation(String nick) {
		if (!ReputationConfig.get().isReady() || nick == null || nick.isBlank()) {
			return ReputationScore.ZERO;
		}
		try {
			JsonObject body = new JsonObject();
			body.addProperty("p_nick", nick.trim());
			String response = postRpc("server_get_reputation", body.toString());
			JsonObject root = JsonParser.parseString(response).getAsJsonObject();
			return ReputationCache.parseRow(root);
		} catch (Exception e) {
			LOGGER.warn("fetchReputation {}: {}", nick, e.getMessage());
			return ReputationScore.ZERO;
		}
	}

	public static Map<String, ReputationScore> fetchReputations(List<String> nicks) {
		Map<String, ReputationScore> out = new HashMap<>();
		if (!ReputationConfig.get().isReady() || nicks == null || nicks.isEmpty()) {
			return out;
		}
		try {
			JsonObject body = new JsonObject();
			JsonArray arr = new JsonArray();
			for (String nick : nicks) {
				arr.add(nick.trim());
			}
			body.add("p_nicks", arr);
			String response = postRpc("server_get_reputations", body.toString());
			JsonObject root = JsonParser.parseString(response).getAsJsonObject();
			if (!root.has("players") || !root.get("players").isJsonArray()) {
				return out;
			}
			for (var el : root.getAsJsonArray("players")) {
				JsonObject row = el.getAsJsonObject();
				String nick = row.has("nick") ? row.get("nick").getAsString() : "";
				if (!nick.isBlank()) {
					out.put(nick.toLowerCase(Locale.ROOT), ReputationCache.parseRow(row));
				}
			}
		} catch (Exception e) {
			LOGGER.warn("fetchReputations: {}", e.getMessage());
		}
		return out;
	}

	public static CompletableFuture<VoteResult> voteAsync(String voterNick, String targetNick, int vote) {
		return CompletableFuture.supplyAsync(() -> vote(voterNick, targetNick, vote), EXECUTOR);
	}

	public static CompletableFuture<ReputationScore> fetchReputationAsync(String nick) {
		return CompletableFuture.supplyAsync(() -> fetchReputation(nick), EXECUTOR);
	}

	public static VoteResult vote(String voterNick, String targetNick, int vote) {
		if (!ReputationConfig.get().isReady()) {
			return VoteResult.error("disabled", ReputationConfig.get().voteErrorTarget);
		}
		try {
			JsonObject body = new JsonObject();
			body.addProperty("p_voter_nick", voterNick.trim());
			body.addProperty("p_target_nick", targetNick.trim());
			body.addProperty("p_vote", vote);
			String response = postRpc("server_rep_vote", body.toString());
			JsonObject root = JsonParser.parseString(response).getAsJsonObject();
			boolean ok = root.has("ok") && root.get("ok").getAsBoolean();
			if (ok) {
				String target = root.has("target_nick") ? root.get("target_nick").getAsString() : targetNick;
				ReputationScore score = fetchReputation(target);
				return VoteResult.success(target, score);
			}
			String error = root.has("error") ? root.get("error").getAsString() : "unknown";
			return VoteResult.error(error, messageForError(error));
		} catch (Exception e) {
			LOGGER.warn("vote {} -> {}: {}", voterNick, targetNick, e.getMessage());
			return VoteResult.error("network", ReputationConfig.get().voteErrorTarget);
		}
	}

	private static String messageForError(String code) {
		ReputationConfig cfg = ReputationConfig.get();
		return switch (code) {
			case "voter_not_linked" -> cfg.voteErrorNotLinked;
			case "self_vote" -> cfg.voteErrorSelf;
			case "cooldown" -> cfg.voteErrorCooldown;
			case "already_voted" -> cfg.voteErrorAlready;
			case "target_not_found" -> cfg.voteErrorTarget;
			default -> cfg.voteErrorTarget;
		};
	}

	private static String postRpc(String functionName, String jsonBody) throws Exception {
		ReputationConfig cfg = ReputationConfig.get();
		var request = HttpRequest.newBuilder()
				.uri(URI.create(cfg.supabaseUrl + "/rest/v1/rpc/" + functionName))
				.timeout(Duration.ofSeconds(15))
				.header("Content-Type", "application/json")
				.header("apikey", cfg.serviceRoleKey)
				.header("Authorization", "Bearer " + cfg.serviceRoleKey)
				.POST(HttpRequest.BodyPublishers.ofString(jsonBody))
				.build();
		var response = HTTP.send(request, HttpResponse.BodyHandlers.ofString());
		if (response.statusCode() < 200 || response.statusCode() >= 300) {
			throw new IllegalStateException("HTTP " + response.statusCode() + ": " + truncate(response.body(), 200));
		}
		return response.body();
	}

	private static String truncate(String s, int max) {
		if (s == null) {
			return "";
		}
		return s.length() <= max ? s : s.substring(0, max) + "…";
	}
}
