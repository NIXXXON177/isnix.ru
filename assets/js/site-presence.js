;(function (global) {
	'use strict'

	var pulseTimer = null
	var PULSE_MS = 90000
	var failStreak = 0
	var backoffUntil = 0

	function stopPulse() {
		if (pulseTimer) {
			clearInterval(pulseTimer)
			pulseTimer = null
		}
	}

	function scheduleNextPulse() {
		stopPulse()
		var delay = PULSE_MS
		if (failStreak > 0) {
			delay = Math.min(600000, PULSE_MS * Math.pow(2, Math.min(failStreak, 4)))
		}
		pulseTimer = setTimeout(function () {
			pulseOnce().then(function () {
				scheduleNextPulse()
			})
		}, delay)
	}

	async function pulseOnce() {
		if (!global.IsnixAuth || !IsnixAuth.isReady()) return
		if (document.hidden) return
		if (Date.now() < backoffUntil) return
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
				backoffUntil = Date.now() + Math.min(600000, 30000 * failStreak)
			}
		} catch (_e) {
			failStreak++
			backoffUntil = Date.now() + Math.min(600000, 30000 * failStreak)
		}
	}

	function startPulse() {
		failStreak = 0
		backoffUntil = 0
		pulseOnce().then(function () {
			scheduleNextPulse()
		})
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
			if (!document.hidden) pulseOnce()
		})

		global.IsnixAuth.getSession().then(function (session) {
			if (session && session.user) startPulse()
		})
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init)
	} else {
		init()
	}
})(window)
