;(function (global) {
	'use strict'

	/** Полифиллы и хелперы для Safari, Firefox, старых Android WebView, Samsung Internet */
	if (!Element.prototype.matches) {
		Element.prototype.matches =
			Element.prototype.msMatchesSelector ||
			Element.prototype.webkitMatchesSelector ||
			function (s) {
				var m = (this.document || this.ownerDocument).querySelectorAll(s)
				var i = m.length
				while (--i >= 0 && m.item(i) !== this) {}
				return i > -1
			}
	}

	if (!Element.prototype.closest) {
		Element.prototype.closest = function (selector) {
			var el = this
			while (el && el.nodeType === 1) {
				if (el.matches(selector)) return el
				el = el.parentElement || el.parentNode
			}
			return null
		}
	}

	if (!global.requestIdleCallback) {
		global.requestIdleCallback = function (cb, opts) {
			var timeout = (opts && opts.timeout) || 1
			var start = Date.now()
			return setTimeout(function () {
				cb({
					didTimeout: Date.now() - start >= timeout,
					timeRemaining: function () {
						return Math.max(0, 50 - (Date.now() - start))
					},
				})
			}, 1)
		}
		global.cancelIdleCallback =
			global.cancelIdleCallback ||
			function (id) {
				clearTimeout(id)
			}
	}

	if (!global.AbortController) {
		global.AbortController = function AbortControllerPolyfill() {
			this.signal = { aborted: false, onabort: null }
		}
		global.AbortController.prototype.abort = function () {
			if (this.signal.aborted) return
			this.signal.aborted = true
			if (typeof this.signal.onabort === 'function') {
				this.signal.onabort()
			}
		}
	}

	if (typeof Promise !== 'undefined' && !Promise.prototype.finally) {
		Promise.prototype.finally = function (fn) {
			var P = this.constructor
			return this.then(
				function (v) {
					return P.resolve(fn && fn()).then(function () {
						return v
					})
				},
				function (e) {
					return P.resolve(fn && fn()).then(function () {
						throw e
					})
				},
			)
		}
	}

	function onMatchMediaChange(mq, fn) {
		if (!mq || typeof fn !== 'function') return function () {}
		if (typeof mq.addEventListener === 'function') {
			mq.addEventListener('change', fn)
			return function () {
				mq.removeEventListener('change', fn)
			}
		}
		if (typeof mq.addListener === 'function') {
			mq.addListener(fn)
			return function () {
				mq.removeListener(fn)
			}
		}
		return function () {}
	}

	function copyText(text) {
		if (
			global.navigator &&
			global.navigator.clipboard &&
			typeof global.navigator.clipboard.writeText === 'function'
		) {
			return global.navigator.clipboard.writeText(text)
		}
		return new Promise(function (resolve, reject) {
			try {
				var ta = document.createElement('textarea')
				ta.value = text
				ta.setAttribute('readonly', 'readonly')
				ta.style.position = 'fixed'
				ta.style.top = '0'
				ta.style.left = '-9999px'
				ta.style.opacity = '0'
				document.body.appendChild(ta)
				ta.focus()
				ta.select()
				var ok = document.execCommand('copy')
				document.body.removeChild(ta)
				if (ok) resolve()
				else reject(new Error('copy failed'))
			} catch (err) {
				reject(err)
			}
		})
	}

	function scrollToTop(smooth) {
		try {
			global.scrollTo({
				top: 0,
				left: 0,
				behavior: smooth ? 'smooth' : 'auto',
			})
		} catch (_e) {
			global.scrollTo(0, 0)
		}
	}

	function supportsSelectorHas() {
		try {
			return CSS.supports('selector(:has(*))')
		} catch (_e) {
			return false
		}
	}

	function markCssSupport() {
		var root = document.documentElement
		if (!root) return
		if (supportsSelectorHas()) root.classList.add('css-has')
		else root.classList.add('no-css-has')
		if (CSS.supports('height', '100dvh')) root.classList.add('css-dvh')
		else root.classList.add('no-css-dvh')
	}

	if (document.documentElement) markCssSupport()
	else document.addEventListener('DOMContentLoaded', markCssSupport)

	global.IsnixCompat = {
		onMatchMediaChange: onMatchMediaChange,
		copyText: copyText,
		scrollToTop: scrollToTop,
		supportsSelectorHas: supportsSelectorHas,
	}
})(window)
