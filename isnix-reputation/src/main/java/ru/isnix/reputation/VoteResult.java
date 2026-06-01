package ru.isnix.reputation;

public record VoteResult(boolean ok, String errorCode, String message, String targetNick, ReputationScore score) {
	public static VoteResult success(String targetNick, ReputationScore score) {
		return new VoteResult(true, null, null, targetNick, score);
	}

	public static VoteResult error(String errorCode, String message) {
		return new VoteResult(false, errorCode, message, null, ReputationScore.ZERO);
	}
}
