;(function (global) {
	'use strict'

	var pulseTimer = null
	var pulseInFlight = false
	var pulseStarted = false
	var PULSE_MS = 120000
	var failStreak = 0
	var backoffUntil = 0

	function stopPulse() {
		pulseStarted = false
		if (pulseTimer) {
			clearTimeout(pulseTimer)
			pulseTimer = null
		}
	}

	function scheduleNextPulse() {
		if (!pulseStarted) return
		if (pulseTimer) clearTimeout(pulseTimer)
		var delay = PULSE_MS
		if (failStreak > 0) {
			delay = Math.min(600000, PULSE_MS * Math.pow(2, Math.min(failStreak, 4)))
		}
		if (
			global.IsnixAuth &&
			IsnixAuth.isSupabaseBackoffActive &&
			IsnixAuth.isSupabaseBackoffActive()
		) {
			delay = Math.max(delay, 300000)
		}
		pulseTimer = setTimeout(function () {
			pulseOnce().finally(function () {
				scheduleNextPulse()
			})
		}, delay)
	}

	async function pulseOnce() {
		if (pulseInFlight) return
		if (!global.IsnixAuth || !IsnixAuth.isReady()) return
		if (document.hidden) return
		if (Date.now() < backoffUntil) return
		if (
			IsnixAuth.isSupabaseBackoffActive &&
			IsnixAuth.isSupabaseBackoffActive()
		) {
			return
		}
		pulseInFlight = true
		try {
			var session = await IsnixAuth.getSession()
			if (!session || !session.user) return
			var ok = await IsnixAuth.sitePresenceHeartbeat(
				IsnixAuth.detectSiteDevice(),
			)
			if (ok) {
				failStreak = 0
				backoffUntil = 0
			} else {
				failStreak++
				backoffUntil = Date.now() + Math.min(600000, 45000 * failStreak)
			}
		} catch (_e) {
			failStreak++
			backoffUntil = Date.now() + Math.min(600000, 45000 * failStreak)
		} finally {
			pulseInFlight = false
		}
	}

	function startPulse() {
		if (pulseStarted) return
		pulseStarted = true
		failStreak = 0
		backoffUntil = 0
		deferAccountTask(function () {
			pulseOnce()
		}, 8000)
		scheduleNextPulse()
	}

	function deferAccountTask(fn, delayMs) {
		setTimeout(fn, delayMs)
	}

	function init() {
		if (!global.IsnixAuth || !IsnixAuth.isReady()) return

		IsnixAuth.onAuthStateChange(function (session) {
			if (session && session.user) {
				startPulse()
			} else {
				stopPulse()
				failStreak = 0
				backoffUntil = 0
			}
		})

		document.addEventListener('visibilitychange', function () {
			if (document.hidden) return
			if (
				IsnixAuth.isSupabaseBackoffActive &&
				IsnixAuth.isSupabaseBackoffActive()
			) {
				return
			}
			deferAccountTask(pulseOnce, 2000)
		})

		global.IsnixAuth.getSession()
			.then(function (session) {
				if (session && session.user) startPulse()
			})
			.catch(function () {
				/* ignore */
			})
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init)
	} else {
		init()
	}
})(window)
