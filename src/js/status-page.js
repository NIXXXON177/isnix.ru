;(function () {
	'use strict'

	var host = 'mc.isnix.ru'

	function el(id) {
		return document.getElementById(id)
	}

	function setBadge(online) {
		var badge = el('statusBadge')
		if (!badge) return
		badge.textContent = online ? 'Онлайн' : 'Оффлайн'
		badge.classList.toggle('status-badge--on', online)
		badge.classList.toggle('status-badge--off', !online)
	}

	function renderPlayers(list) {
		var box = el('statusPlayers')
		if (!box) return
		box.innerHTML = ''
		if (!list || !list.length) {
			var empty = document.createElement('p')
			empty.className = 'status-players__empty'
			empty.textContent = 'Сейчас никого нет в списке или сервер пуст.'
			box.appendChild(empty)
			return
		}
		list.forEach(function (name) {
			var chip = document.createElement('span')
			chip.className = 'status-players__chip'
			chip.textContent = name
			box.appendChild(chip)
		})
	}

	function render(status, stale) {
		var countEl = el('statusCount')
		var maxEl = el('statusMax')
		var hostEl = el('statusHost')
		var updatedEl = el('statusUpdated')
		if (!status) {
			setBadge(false)
			if (countEl) countEl.textContent = '—'
			if (maxEl) maxEl.textContent = ''
			if (hostEl) hostEl.textContent = host
			if (updatedEl) updatedEl.textContent = 'Не удалось получить данные. Попробуйте обновить.'
			renderPlayers([])
			return
		}
		setBadge(status.online)
		if (hostEl) hostEl.textContent = status.host || host
		if (countEl) countEl.textContent = String(status.count)
		if (maxEl) {
			maxEl.textContent =
				status.max != null && status.max > 0 ? ' / ' + status.max : ''
		}
		renderPlayers(status.players)
		if (updatedEl) {
			var t = new Date().toLocaleTimeString('ru-RU', {
				hour: '2-digit',
				minute: '2-digit',
			})
			updatedEl.textContent =
				(stale ? 'Кэш · ' : 'Обновлено ') + t + ' · NeoForge 1.21.1'
		}
	}

	async function load(force) {
		var btn = el('statusRefresh')
		if (btn) btn.disabled = true
		try {
			if (!window.IsnixServer || !IsnixServer.fetchStatus) {
				render(null, false)
				return
			}
			var before = IsnixServer.fetchStatus
			var status = await IsnixServer.fetchStatus(!!force)
			render(status, !force && status)
		} catch (_e) {
			render(null, false)
		} finally {
			if (btn) btn.disabled = false
		}
	}

	function initCopy() {
		var btn = el('statusCopyIp')
		if (!btn) return
		btn.addEventListener('click', function () {
			var copyFn =
				window.IsnixCompat && IsnixCompat.copyText
					? IsnixCompat.copyText(host)
					: null
			if (copyFn && typeof copyFn.then === 'function') {
				copyFn.then(function () {
					btn.textContent = 'Скопировано'
					setTimeout(function () {
						btn.textContent = 'Скопировать IP'
					}, 1600)
				})
			} else if (navigator.clipboard) {
				navigator.clipboard.writeText(host).then(function () {
					btn.textContent = 'Скопировано'
					setTimeout(function () {
						btn.textContent = 'Скопировать IP'
					}, 1600)
				})
			}
		})
	}

	document.addEventListener('DOMContentLoaded', function () {
		initCopy()
		load(false)
		var refresh = el('statusRefresh')
		if (refresh) refresh.addEventListener('click', function () { load(true) })
		setInterval(function () { load(false) }, 90000)
	})
})()
