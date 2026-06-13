package ru.isnix.playerbackup;

public enum SnapshotReason {
	PERIODIC("periodic"),
	QUIT("quit"),
	DEATH("death"),
	MANUAL("manual");

	private final String id;

	SnapshotReason(String id) {
		this.id = id;
	}

	public String id() {
		return id;
	}
}
