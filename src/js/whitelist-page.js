;(function () {
	'use strict'

	var msgEl = document.getElementById('whitelistMessage')
	var form = document.getElementById('publicWhitelistForm')
	var nickInput = document.getElementById('publicNick')
	var hintEl = document.getElementById('publicNickHint')
	var setupNotice = document.getElementById('whitelistSetupNotice')
	var successEl = document.getElementById('whitelistSuccess')

	function showMsg(text, ok) {
		if (window.IsnixToast) {
			if (!text) IsnixToast.hideAll()
			else IsnixToast.show(text, ok ? 'ok' : 'err')
		}
		if (!msgEl) return
		msgEl.textContent = text
		msgEl.className =
			'auth-message' + (ok ? ' auth-message--ok' : ' auth-message--err')
		msgEl.hidden = !text
	}

	function updateNickHint() {
		if (!hintEl || !window.IsnixAuth) return
		var v = nickInput ? nickInput.value.trim() : ''
		if (!v) {
			hintEl.textContent = ''
			hintEl.className = 'auth-hint'
			return
		}
		if (IsnixAuth.MC_NICK_RE.test(v)) {
			hintEl.textContent = 'Формат ника подходит'
			hintEl.className = 'auth-hint auth-hint--ok'
			return
		}
		hintEl.textContent = '3–16 символов: латиница, цифры и _'
		hintEl.className = 'auth-hint auth-hint--warn'
	}

	function setLoading(loading) {
		if (!form) return
		form.classList.toggle('is-loading', loading)
		var btn = form.querySelector('[type="submit"]')
		if (btn) btn.disabled = loading
	}

	function showSuccess(nick) {
		if (form) form.hidden = true
		if (successEl) {
			successEl.hidden = false
			var nickEl = document.getElementById('whitelistSuccessNick')
			if (nickEl) nickEl.textContent = nick
		}
	}

	async function init() {
		if (!window.IsnixAuth || !IsnixAuth.isReady()) {
			if (setupNotice) setupNotice.hidden = false
			return
		}
		if (setupNotice) setupNotice.hidden = true

		if (nickInput) {
			nickInput.addEventListener('input', updateNickHint)
			updateNickHint()
		}

		if (!form) return
		form.addEventListener('submit', async function (e) {
			e.preventDefault()
			var nick = nickInput ? nickInput.value.trim() : ''
			setLoading(true)
			showMsg('', true)
			try {
				await IsnixAuth.submitPublicApplication(nick)
				showSuccess(nick)
				showMsg(
					'Заявка отправлена. Обычно отвечаем в течение часа — следи за входом на сервер.',
					true,
				)
			} catch (err) {
				showMsg(IsnixAuth.formatAuthError(err), false)
			} finally {
				setLoading(false)
			}
		})
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init)
	} else {
		init()
	}
})()
