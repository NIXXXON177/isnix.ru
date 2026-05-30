;(function (global) {
	'use strict'

	var SESSION_ASKED = 'isnix_push_prompt_asked'
	var SESSION_DISMISSED = 'isnix_push_prompt_dismissed'

	function isInstalledApp() {
		try {
			if (global.navigator && global.navigator.standalone) return true
			if (global.matchMedia) {
				if (global.matchMedia('(display-mode: standalone)').matches) return true
				if (global.matchMedia('(display-mode: fullscreen)').matches) return true
			}
		} catch (_e) {
			/* ignore */
		}
		return false
	}

	function supportsPush() {
		return typeof global.Notification !== 'undefined'
	}

	function getPermission() {
		if (!supportsPush()) return 'unsupported'
		return global.Notification.permission
	}

	function requestPermission() {
		if (!supportsPush()) return Promise.resolve('unsupported')
		if (global.Notification.permission === 'granted') {
			return Promise.resolve('granted')
		}
		if (global.Notification.permission === 'denied') {
			return Promise.resolve('denied')
		}
		return global.Notification.requestPermission()
	}

	function markSessionAsked() {
		try {
			sessionStorage.setItem(SESSION_ASKED, '1')
		} catch (_e) {
			/* ignore */
		}
	}

	function wasAskedThisSession() {
		try {
			return sessionStorage.getItem(SESSION_ASKED) === '1'
		} catch (_e2) {
			return false
		}
	}

	function markSessionDismissed() {
		try {
			sessionStorage.setItem(SESSION_DISMISSED, '1')
		} catch (_e) {
			/* ignore */
		}
	}

	function wasDismissedThisSession() {
		try {
			return sessionStorage.getItem(SESSION_DISMISSED) === '1'
		} catch (_e2) {
			return false
		}
	}

	function dispatchPermission(state) {
		try {
			global.dispatchEvent(
				new CustomEvent('isnix-push-permission', {
					detail: { state: state },
				}),
			)
		} catch (_e) {
			/* ignore */
		}
	}

	function ensureBanner() {
		var el = document.getElementById('isnixPushPrompt')
		if (el) return el

		el = document.createElement('div')
		el.id = 'isnixPushPrompt'
		el.className = 'isnix-push-prompt'
		el.setAttribute('role', 'dialog')
		el.setAttribute('aria-labelledby', 'isnixPushPromptTitle')
		el.hidden = true
		el.innerHTML =
			'<div class="isnix-push-prompt__inner">' +
			'<p id="isnixPushPromptTitle" class="isnix-push-prompt__title">Уведомления</p>' +
			'<p class="isnix-push-prompt__text" data-push-text></p>' +
			'<div class="isnix-push-prompt__actions">' +
			'<button type="button" class="isnix-push-prompt__btn isnix-push-prompt__btn--primary" data-push-allow>Разрешить</button>' +
			'<button type="button" class="isnix-push-prompt__btn isnix-push-prompt__btn--ghost" data-push-later>Позже</button>' +
			'</div></div>'

		document.body.appendChild(el)

		el.querySelector('[data-push-allow]').addEventListener('click', function () {
			requestPermission().then(function (state) {
				hideBanner()
				markSessionAsked()
				if (state === 'granted') {
					if (global.IsnixToast) {
						global.IsnixToast.show('Уведомления включены', 'ok')
					}
					dispatchPermission('granted')
				} else if (state === 'denied') {
					showDeniedBanner()
					dispatchPermission('denied')
				} else {
					dispatchPermission(state)
				}
			})
		})

		el.querySelector('[data-push-later]').addEventListener('click', function () {
			markSessionDismissed()
			markSessionAsked()
			hideBanner()
		})

		return el
	}

	function hideBanner() {
		var el = document.getElementById('isnixPushPrompt')
		if (el) el.hidden = true
	}

	function showBanner(mode) {
		var el = ensureBanner()
		var textEl = el.querySelector('[data-push-text]')
		var allowBtn = el.querySelector('[data-push-allow]')
		var laterBtn = el.querySelector('[data-push-later]')

		if (mode === 'denied') {
			if (textEl) {
				textEl.textContent =
					'Уведомления выключены. Включите их в настройках телефона для ярлыка ISNIX (Разрешения → Уведомления).'
			}
			if (allowBtn) allowBtn.hidden = true
			if (laterBtn) {
				laterBtn.hidden = false
				laterBtn.textContent = 'Понятно'
			}
		} else {
			if (textEl) {
				textEl.textContent =
					'Разрешите уведомления — сообщим об ответе по заявке в вайтлист, обращениях и сообщениях администрации.'
			}
			if (allowBtn) allowBtn.hidden = false
			if (laterBtn) {
				laterBtn.hidden = false
				laterBtn.textContent = 'Позже'
			}
		}

		el.hidden = false
	}

	function showDeniedBanner() {
		markSessionAsked()
		showBanner('denied')
	}

	function tryPrompt() {
		if (!isInstalledApp() || !supportsPush()) return

		var perm = getPermission()
		if (perm === 'granted') {
			hideBanner()
			return
		}

		if (wasAskedThisSession() || wasDismissedThisSession()) {
			return
		}

		if (perm === 'denied') {
			showDeniedBanner()
			return
		}

		showBanner('default')
		markSessionAsked()
	}

	var promptTimer = null

	function schedulePrompt() {
		if (promptTimer) global.clearTimeout(promptTimer)
		promptTimer = global.setTimeout(function () {
			promptTimer = null
			tryPrompt()
		}, 1200)
	}

	function init() {
		if (!isInstalledApp()) return
		schedulePrompt()
	}

	global.addEventListener('pageshow', function (ev) {
		if (!isInstalledApp() || !supportsPush()) return
		if (getPermission() === 'granted') {
			hideBanner()
			return
		}
		/* Новый заход в приложение (не возврат из кэша вкладки) */
		if (ev.persisted) return
		try {
			sessionStorage.removeItem(SESSION_ASKED)
			sessionStorage.removeItem(SESSION_DISMISSED)
		} catch (_e) {
			/* ignore */
		}
		schedulePrompt()
	})

	global.IsnixPushPrompt = {
		isInstalledApp: isInstalledApp,
		tryPrompt: tryPrompt,
		requestPermission: requestPermission,
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init)
	} else {
		init()
	}
})(window)
