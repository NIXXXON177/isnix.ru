package ru.isnix.reputation;

public record ReputationScore(long likes, long dislikes, long score) {
	public static final ReputationScore ZERO = new ReputationScore(0, 0, 0);

	public boolean isEmpty() {
		return likes == 0 && dislikes == 0 && score == 0;
	}
}
