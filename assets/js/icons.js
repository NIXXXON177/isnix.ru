;(function (global) {
	'use strict'

	var SPRITE = 'assets/icons/sprite.svg'

	function esc(s) {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
	}

	function icon(name, className) {
		var c = 'icon' + (className ? ' ' + className : '')
		return (
			'<svg class="' +
			c +
			'" aria-hidden="true" focusable="false">' +
			'<use href="' +
			SPRITE +
			'#' +
			name +
			'"></use></svg>'
		)
	}

	function statusType(ok) {
		if (ok === false || ok === 'err') return 'x-circle'
		if (ok === 'warn') return 'alert'
		return 'check-circle'
	}

	function statusHtml(text, ok) {
		return (
			'<span class="status-line">' +
			icon(statusType(ok), 'icon--inline') +
			'<span>' +
			esc(text) +
			'</span></span>'
		)
	}

	function setStatus(el, text, ok) {
		if (!el) return
		el.innerHTML = statusHtml(text, ok)
	}

	function toastHtml(msg, ok) {
		var clean = String(msg).replace(/^[\s\u26a0\ufe0f\u2705\u274c\u2713\u2b50]+/u, '').trim()
		return statusHtml(clean, ok === false ? false : ok === 'warn' ? 'warn' : true)
	}

	function showToast(msg, ok) {
		var t = document.getElementById('toast')
		if (!t) return
		t.innerHTML = toastHtml(msg, ok)
		t.style.borderColor =
			ok === false ? 'rgba(248,113,113,.4)' : 'var(--green-dark)'
		t.classList.add('show')
		setTimeout(function () {
			t.classList.remove('show')
		}, 3200)
	}

	function repScoreHtml(score) {
		return icon('star', 'icon--inline') + esc(String(score))
	}

	function repMetaHtml(likes, dislikes) {
		return (
			icon('thumb-up', 'icon--inline') +
			esc(String(likes)) +
			' · ' +
			icon('thumb-down', 'icon--inline') +
			esc(String(dislikes || 0))
		)
	}

	global.isnixIcon = icon
	global.isnixStatusHtml = statusHtml
	global.isnixSetStatus = setStatus
	global.isnixToastHtml = toastHtml
	global.isnixShowToast = showToast
	global.isnixRepScoreHtml = repScoreHtml
	global.isnixRepMetaHtml = repMetaHtml
})(typeof window !== 'undefined' ? window : this)
