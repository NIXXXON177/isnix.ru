;(function (global) {
	'use strict'

	var pulseTimer = null
	var PULSE_MS = 90000

	function stopPulse() {
		if (pulseTimer) {
			clearInterval(pulseTimer)
			pulseTimer = null
		}
	}

	async function pulseOnce() {
		if (!global.IsnixAuth || !IsnixAuth.isReady()) return
		if (document.hidden) return
		try {
			var session = await IsnixAuth.getSession()
			if (!session || !session.user) return
			await IsnixAuth.sitePresenceHeartbeat(IsnixAuth.detectSiteDevice())
		} catch (_e) {
			/* ignore */
		}
	}

	function startPulse() {
		stopPulse()
		pulseOnce()
		pulseTimer = setInterval(pulseOnce, PULSE_MS)
	}

	function init() {
		if (!global.IsnixAuth || !IsnixAuth.isReady()) return

		IsnixAuth.onAuthStateChange(function (session) {
			if (session && session.user) {
				startPulse()
			} else {
				stopPulse()
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
