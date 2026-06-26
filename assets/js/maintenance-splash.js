;(function () {
	var hintEl = document.getElementById('pagePreloaderHint')
	var progressEl = document.getElementById('pagePreloaderProgress')
	var progressWrap = document.getElementById('pagePreloaderProgressWrap')
	var hints = [
		'ОБНОВЛЯЕМ СБОРКУ…',
		'Полировка интерфейса…',
		'Синхронизация модов…',
		'Проверяем конфиги…',
	]
	var hintIdx = 0
	var progressVal = 68

	function setProgress(pct) {
		if (!progressEl) return
		var v = Math.max(0, Math.min(100, Math.round(pct)))
		progressEl.style.width = v + '%'
		if (progressWrap) progressWrap.setAttribute('aria-valuenow', String(v))
	}

	setInterval(function () {
		hintIdx = (hintIdx + 1) % hints.length
		if (hintEl) hintEl.textContent = hints[hintIdx]
	}, 2800)

	setInterval(function () {
		progressVal += Math.random() * 3.2 - 1.4
		if (progressVal < 52) progressVal = 52
		if (progressVal > 82) progressVal = 82
		setProgress(progressVal)
	}, 1100)
})()
