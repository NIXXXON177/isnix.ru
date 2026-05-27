;(function () {
	'use strict'

	function esc(s) {
		return String(s || '')
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
	}

	function setText(id, text) {
		var el = document.getElementById(id)
		if (el) el.textContent = text
	}

	function setHtml(id, html) {
		var el = document.getElementById(id)
		if (el) el.innerHTML = html
	}

	function renderPlayers(players) {
		if (!players || !players.length) return '<p class="auth-muted">Игроков нет</p>'
		return (
			'<div class="auth-player-list">' +
			players
				.map(function (nick) {
					var safe = esc(nick)
					var enc = encodeURIComponent(nick)
					return (
						'<div class="auth-player-row">' +
						'<img class="auth-player-head" src="https://mc-heads.net/avatar/' +
						enc +
						'/32" width="32" height="32" alt="" loading="lazy" decoding="async" />' +
						'<div class="auth-player-info"><strong>' +
						safe +
						'</strong></div></div>'
					)
				})
				.join('') +
			'</div>'
		)
	}

	async function refresh(force) {
		if (!window.IsnixServer) {
			setText('statusState', 'Статус недоступен')
			setHtml('statusPlayers', '<p class="auth-muted">Нет модуля статуса сервера</p>')
			return
		}
		setText('statusState', 'Обновляем…')
		try {
			var st = await window.IsnixServer.fetchStatus(!!force)
			if (!st) {
				setText('statusState', 'Не удалось получить статус')
				setHtml('statusPlayers', '<p class="auth-muted">Попробуй позже</p>')
				return
			}
			if (!st.online) {
				setText('statusState', 'Сервер офлайн')
				setText('statusCount', 'офлайн')
				setHtml('statusPlayers', '<p class="auth-muted">Игроки недоступны</p>')
				return
			}
			var pm = st.max != null ? st.max : '—'
			setText('statusState', 'Сервер онлайн')
			setText('statusCount', String(st.count) + ' / ' + String(pm))
			setHtml('statusPlayers', renderPlayers(st.players || []))
		} catch (e) {
			setText('statusState', 'Ошибка обновления')
			setHtml('statusPlayers', '<p class="auth-muted">' + esc(e.message || 'Ошибка') + '</p>')
		}
	}

	var btn = document.getElementById('statusRefresh')
	if (btn) btn.addEventListener('click', function () { refresh(true) })

	refresh(false)
	setInterval(function () { refresh(false) }, 30000)
})()

