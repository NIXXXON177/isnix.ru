package ru.isnix.modtools;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.reflect.TypeToken;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.network.ServerPlayerEntity;
import java.io.IOException;
import java.util.ArrayList;
import java.lang.reflect.Type;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

public final class ModerationStorage {
	private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
	private static final Type MUTE_MAP = new TypeToken<Map<String, TimedEntry>>() {}.getType();
	private static final Type FREEZE_MAP = new TypeToken<Map<String, FreezeEntry>>() {}.getType();

	private Path path;
	private Map<String, TimedEntry> chatMutes = new HashMap<>();
	private Map<String, TimedEntry> voiceMutes = new HashMap<>();
	private Map<String, FreezeEntry> frozen = new HashMap<>();

	public void bind(MinecraftServer server) {
		path = statePath(server);
		load();
		migrateLegacyStateFile(server);
	}

	private static Path statePath(MinecraftServer server) {
		return server.getRunDirectory().resolve("config").resolve("isnix-modtools-state.json");
	}

	/** Старые установки писали в корень сервера. */
	private void migrateLegacyStateFile(MinecraftServer server) {
		if (path == null) {
			return;
		}
		try {
			Path legacy = server.getRunDirectory().resolve("isnix-modtools-state.json");
			if (Files.isRegularFile(legacy) && !Files.isRegularFile(path)) {
				Path parent = path.getParent();
				if (parent != null) {
					Files.createDirectories(parent);
				}
				Files.move(legacy, path);
				IsnixModToolsMod.LOGGER.info("Перенесён isnix-modtools-state.json → config/");
			}
		} catch (IOException e) {
			IsnixModToolsMod.LOGGER.warn("migrate state: {}", e.getMessage());
		}
	}

	public void load() {
		if (path == null || !Files.isRegularFile(path)) {
			return;
		}
		try {
			StorageFile file = GSON.fromJson(Files.readString(path), StorageFile.class);
			if (file != null) {
				if (file.chatMutes != null) {
					chatMutes = file.chatMutes;
				}
				if (file.voiceMutes != null) {
					voiceMutes = file.voiceMutes;
				}
				if (file.frozen != null) {
					frozen = file.frozen;
				}
			}
		} catch (IOException e) {
			IsnixModToolsMod.LOGGER.warn("state load: {}", e.getMessage());
		}
	}

	public void save() {
		save(null);
	}

	public void save(MinecraftServer server) {
		if (path == null && server != null) {
			path = statePath(server);
		}
		if (path == null) {
			return;
		}
		try {
			Path parent = path.getParent();
			if (parent != null) {
				Files.createDirectories(parent);
			}
			StorageFile file = new StorageFile();
			file.chatMutes = chatMutes;
			file.voiceMutes = voiceMutes;
			file.frozen = frozen;
			Files.writeString(path, GSON.toJson(file));
		} catch (IOException e) {
			IsnixModToolsMod.LOGGER.warn("state save: {}", e.getMessage());
		}
	}

	public void pruneExpired(MinecraftServer server) {
		long now = System.currentTimeMillis();
		boolean changed = false;
		for (Map.Entry<String, TimedEntry> e : new ArrayList<>(voiceMutes.entrySet())) {
			if (e.getValue().untilEpochMs <= now) {
				String name = e.getValue().playerName;
				if (name != null && !name.isBlank()) {
					LuckPermsCommandBridge.unmuteVoice(server, name);
				}
			}
		}
		changed |= pruneTimed(chatMutes, now);
		changed |= pruneTimed(voiceMutes, now);
		if (changed) {
			save();
		}
	}

	private static boolean pruneTimed(Map<String, TimedEntry> map, long now) {
		boolean changed = false;
		for (var it = map.entrySet().iterator(); it.hasNext(); ) {
			if (it.next().getValue().untilEpochMs <= now) {
				it.remove();
				changed = true;
			}
		}
		return changed;
	}

	public void setChatMute(UUID uuid, String playerName, long untilMs, String actor, String reason) {
		chatMutes.put(uuid.toString(), TimedEntry.of(playerName, untilMs, actor, reason));
		save();
	}

	public void clearChatMute(UUID uuid) {
		if (chatMutes.remove(uuid.toString()) != null) {
			save();
		}
	}

	public void setVoiceMute(UUID uuid, String playerName, long untilMs, String actor, String reason) {
		voiceMutes.put(uuid.toString(), TimedEntry.of(playerName, untilMs, actor, reason));
		save();
	}

	public void clearVoiceMute(UUID uuid) {
		if (voiceMutes.remove(uuid.toString()) != null) {
			save();
		}
	}

	/** Снять запись voice-mute по нику (если UUID неизвестен). */
	public void clearVoiceMuteByName(String playerName) {
		if (playerName == null || playerName.isBlank()) {
			return;
		}
		boolean changed = false;
		for (var it = voiceMutes.entrySet().iterator(); it.hasNext(); ) {
			TimedEntry entry = it.next().getValue();
			if (entry != null && playerName.equalsIgnoreCase(entry.playerName)) {
				it.remove();
				changed = true;
			}
		}
		if (changed) {
			save();
		}
	}

	public TimedEntry getChatMute(UUID uuid) {
		return active(chatMutes.get(uuid.toString()));
	}

	public TimedEntry getVoiceMute(UUID uuid) {
		return active(voiceMutes.get(uuid.toString()));
	}

	private static TimedEntry active(TimedEntry entry) {
		if (entry == null) {
			return null;
		}
		if (entry.untilEpochMs <= System.currentTimeMillis()) {
			return null;
		}
		return entry;
	}

	public boolean isChatMuted(UUID uuid) {
		return getChatMute(uuid) != null;
	}

	public boolean isVoiceMuted(UUID uuid) {
		return getVoiceMute(uuid) != null;
	}

	public void freeze(ServerPlayerEntity player, String actor, String reason) {
		FreezeEntry entry = new FreezeEntry();
		entry.x = player.getX();
		entry.y = player.getY();
		entry.z = player.getZ();
		entry.yaw = player.getYaw();
		entry.pitch = player.getPitch();
		entry.world = player.getWorld().getRegistryKey().getValue().toString();
		entry.actor = actor;
		entry.reason = reason == null ? "" : reason;
		entry.playerName = player.getGameProfile().getName();
		frozen.put(player.getUuid().toString(), entry);
		player.setVelocity(0, 0, 0);
		save();
	}

	public void unfreeze(UUID uuid) {
		if (frozen.remove(uuid.toString()) != null) {
			FreezeManager.clearPlayer(uuid);
			save();
		}
	}

	public FreezeEntry getFreeze(UUID uuid) {
		return frozen.get(uuid.toString());
	}

	public boolean isFrozen(UUID uuid) {
		return frozen.containsKey(uuid.toString());
	}

	public static final class TimedEntry {
		public String playerName = "";
		public long untilEpochMs;
		public String actor = "";
		public String reason = "";

		static TimedEntry of(String playerName, long untilMs, String actor, String reason) {
			TimedEntry e = new TimedEntry();
			e.playerName = playerName;
			e.untilEpochMs = untilMs;
			e.actor = actor == null ? "" : actor;
			e.reason = reason == null ? "" : reason;
			return e;
		}

		long remainingMs() {
			return Math.max(0, untilEpochMs - System.currentTimeMillis());
		}
	}

	public static final class FreezeEntry {
		public String playerName = "";
		public double x;
		public double y;
		public double z;
		public float yaw;
		public float pitch;
		public String world = "";
		public String actor = "";
		public String reason = "";
	}

	private static final class StorageFile {
		Map<String, TimedEntry> chatMutes;
		Map<String, TimedEntry> voiceMutes;
		Map<String, FreezeEntry> frozen;
	}
}
