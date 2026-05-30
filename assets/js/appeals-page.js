;(function () {
	'use strict'

	var RETURN_KEY = 'isnix_after_login'

	var guestEl = document.getElementById('appealsGuest')
	var dashEl = document.getElementById('appealsDashboard')
	var adminHint = document.getElementById('appealsAdminHint')
	var loginBtn = document.getElementById('appealsLoginBtn')

	function showMsg(text, ok) {
		var el = document.getElementById('appealsMessage')
		if (!el) return
		el.textContent = text
		el.className = 'auth-message' + (ok ? ' auth-message--ok' : ' auth-message--err')
		el.hidden = !text
	}

	function showGuest() {
		if (guestEl) guestEl.hidden = false
		if (dashEl) dashEl.hidden = true
		if (adminHint) adminHint.hidden = true
		if (window.IsnixSupportTickets) IsnixSupportTickets.onGuest()
	}

	function showDashboard(profile) {
		if (guestEl) guestEl.hidden = true
		if (dashEl) dashEl.hidden = false
		if (
			adminHint &&
			window.IsnixAuth &&
			IsnixAuth.isAdminProfile &&
			IsnixAuth.isAdminProfile(profile)
		) {
			adminHint.hidden = false
		}
		if (window.IsnixSupportTickets && IsnixSupportTickets.onAppealsPage) {
			IsnixSupportTickets.onAppealsPage()
		}
	}

	function bindLoginReturn() {
		if (!loginBtn) return
		loginBtn.addEventListener('click', function () {
			try {
				sessionStorage.setItem(RETURN_KEY, 'appeals.html')
			} catch (_e) {}
		})
	}

	async function onSession(session) {
		if (!session || !window.IsnixAuth) {
			showGuest()
			return
		}
		var profile = null
		try {
			profile = await IsnixAuth.getProfile(session.user.id)
		} catch (_e) {
			profile = null
		}
		showDashboard(profile)
	}

	async function init() {
		bindLoginReturn()

		if (!window.IsnixAuth || !IsnixAuth.isReady || !IsnixAuth.isReady()) {
			showMsg(
				'Аккаунты на сайте не подключены. Админу: docs/supabase-auth-setup.md',
				false,
			)
			showGuest()
			return
		}

		IsnixAuth.onAuthStateChange(function (session) {
			onSession(session)
		})

		try {
			var session = await IsnixAuth.getSession()
			await onSession(session)
		} catch (err) {
			showMsg(IsnixAuth.formatAuthError(err), false)
			showGuest()
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init)
	} else {
		init()
	}
})()
