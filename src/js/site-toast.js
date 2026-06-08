;(function (global) {
	'use strict'

	var host = null
	var timers = Object.create(null)
	var seq = 0

	function ensureHost() {
		if (host && host.parentNode) return host
		host = document.createElement('div')
		host.id = 'isnixToastHost'
		host.className = 'isnix-toast-host'
		host.setAttribute('aria-live', 'polite')
		host.setAttribute('aria-atomic', 'false')
		document.body.appendChild(host)
		return host
	}

	function removeToast(id) {
		var el = document.getElementById('isnix-toast-' + id)
		if (el) {
			el.classList.remove('isnix-toast--visible')
			setTimeout(function () {
				if (el.parentNode) el.parentNode.removeChild(el)
			}, 280)
		}
		if (timers[id]) {
			clearTimeout(timers[id])
			delete timers[id]
		}
	}

	/**
	 * @param {string} text
	 * @param {'ok'|'err'|'info'|'loading'} [type]
	 * @param {number} [durationMs] 0 = не скрывать автоматически
	 * @returns {number} id для hide()
	 */
	function show(text, type, durationMs) {
		if (!text) return 0
		var id = ++seq
		var t = type || 'info'
		var dur = durationMs === undefined ? (t === 'loading' ? 0 : 5200) : durationMs
		var box = ensureHost()
		var el = document.createElement('div')
		el.id = 'isnix-toast-' + id
		el.className = 'isnix-toast isnix-toast--' + t
		el.setAttribute('role', t === 'err' ? 'alert' : 'status')
		el.innerHTML =
			'<span class="isnix-toast__icon" aria-hidden="true"></span>' +
			'<span class="isnix-toast__text"></span>' +
			'<button type="button" class="isnix-toast__close" aria-label="Закрыть">×</button>'
		el.querySelector('.isnix-toast__text').textContent = text
		el.querySelector('.isnix-toast__close').addEventListener('click', function () {
			removeToast(id)
		})
		box.appendChild(el)
		requestAnimationFrame(function () {
			el.classList.add('isnix-toast--visible')
		})
		if (dur > 0) {
			timers[id] = setTimeout(function () {
				removeToast(id)
			}, dur)
		}
		return id
	}

	function hide(id) {
		if (id) removeToast(id)
	}

	function hideAll() {
		if (!host) return
		var nodes = host.querySelectorAll('.isnix-toast')
		for (var i = 0; i < nodes.length; i++) {
			var m = nodes[i].id.match(/^isnix-toast-(\d+)$/)
			if (m) removeToast(parseInt(m[1], 10))
		}
	}

	global.IsnixToast = {
		show: show,
		hide: hide,
		hideAll: hideAll,
	}
})(window)
