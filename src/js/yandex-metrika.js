/** Яндекс.Метрика: только tag.js, без информера (плашки посещаемости на сайте). */
;(function (global) {
	'use strict'

	var cfg = global.ISNIX_METRIKA || {}
	var id = parseInt(cfg.counterId, 10)
	if (!id || id <= 0) return

	;(function (m, e, t, r, i, k, a) {
		m[i] =
			m[i] ||
			function () {
				;(m[i].a = m[i].a || []).push(arguments)
			}
		m[i].l = 1 * new Date()
		for (var j = 0; j < document.scripts.length; j++) {
			if (document.scripts[j].src === r) return
		}
		k = e.createElement(t)
		a = e.getElementsByTagName(t)[0]
		k.async = 1
		k.src = r
		a.parentNode.insertBefore(k, a)
	})(global, document, 'script', 'https://mc.yandex.ru/metrika/tag.js', 'ym')

	global.ym(id, 'init', {
		clickmap: cfg.clickmap !== false,
		trackLinks: cfg.trackLinks !== false,
		accurateTrackBounce: cfg.accurateTrackBounce !== false,
		webvisor: cfg.webvisor !== false,
		trackHash: cfg.trackHash !== false,
	})
})(window)
