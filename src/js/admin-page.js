;(function () {
	'use strict'

	var APPS_PAGE_SIZE = 10
	var adminFilter = 'pending'
	var adminAppsPage = 1
	var currentProfile = null
	var whitelistPlayers = null
	var adminListBound = false
	var actionInFlight = {}

	var msgEl = document.getElementById('adminMessage')
	var loginPanel = document.getElementById('adminLoginPanel')
	var adminPanel = document.getElementById('adminPanel')
	var loginForm = document.getElementById('adminLoginForm')

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

	function escapeHtml(s) {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
	}

	function formatDate(iso) {
		if (!iso) return '—'
		try {
			return new Date(iso).toLocaleString('ru-RU', {
				day: 'numeric',
				month: 'short',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
			})
		} catch (_e) {
			return iso
		}
	}

	function statusLabel(status) {
		if (status === 'approved') return 'Одобрено'
		if (status === 'rejected') return 'Отклонено'
		return 'Ожидает'
	}

	function statusClass(status) {
		if (status === 'approved') return 'auth-status auth-status--ok'
		if (status === 'rejected') return 'auth-status auth-status--bad'
		return 'auth-status auth-status--pending'
	}

	function setLoading(form, loading) {
		if (!form) return
		form.classList.toggle('is-loading', loading)
		var btn = form.querySelector('[type="submit"]')
		if (btn) btn.disabled = loading
	}

	async function loadWhitelist() {
		if (whitelistPlayers) return
		try {
			var r = await fetch('whitelist.json', { cache: 'default' })
			if (!r.ok) return
			var j = await r.json()
			var raw = Array.isArray(j) ? j : j.players || []
			whitelistPlayers = raw
				.map(function (e) {
					if (typeof e === 'string' || typeof e === 'number') {
						return String(e).trim()
					}
					if (e && typeof e === 'object') {
						return (e.name || e.username || e.player || '').trim()
					}
					return ''
				})
				.filter(Boolean)
				.map(function (s) {
					return s.toLowerCase()
				})
		} catch (_e) {
			whitelistPlayers = null
		}
	}

	function isOnWhitelist(nick) {
		if (!whitelistPlayers || !nick) return false
		return whitelistPlayers.indexOf(String(nick).trim().toLowerCase()) !== -1
	}

	function renderCard(app) {
		var onWl = isOnWhitelist(app.minecraft_nick)
		var wlHint = onWl
			? '<p class="auth-hint auth-hint--ok">Уже в whitelist.json</p>'
			: '<p class="auth-hint">После одобрения ник попадёт на сервер (до ~5 мин)</p>'
		var actions =
			app.status === 'pending'
				? '<div class="auth-admin-actions">' +
					'<label class="auth-dialog__label" for="admin-note-' +
					app.id +
					'">Комментарий (необязательно)</label>' +
					'<textarea id="admin-note-' +
					app.id +
					'" class="auth-admin-note" data-note-for="' +
					app.id +
					'" rows="2" placeholder="Причина отклонения или заметка…">' +
					(app.admin_note ? escapeHtml(app.admin_note) : '') +
					'</textarea>' +
					'<div class="auth-admin-btns">' +
					'<button type="button" class="auth-submit auth-admin-approve" data-id="' +
					app.id +
					'">Одобрить</button>' +
					'<button type="button" class="auth-submit auth-submit--ghost auth-admin-reject" data-id="' +
					app.id +
					'">Отклонить</button>' +
					'</div></div>'
				: app.admin_note
					? '<p class="auth-app-note"><strong>Комментарий:</strong> ' +
						escapeHtml(app.admin_note) +
						'</p>'
					: ''
		return (
			'<article class="auth-app-card auth-app-card--admin">' +
			'<div class="auth-app-head">' +
			'<div class="auth-app-head__nick"><strong>' +
			escapeHtml(app.minecraft_nick) +
			'</strong>' +
			'<button type="button" class="auth-copy-nick" data-copy-nick="' +
			escapeHtml(app.minecraft_nick) +
			'">Копировать</button></div>' +
			'<span class="' +
			statusClass(app.status) +
			'">' +
			statusLabel(app.status) +
			'</span></div>' +
			'<p class="auth-muted">' +
			formatDate(app.created_at) +
			(app.user_id ? '' : ' · без аккаунта на сайте') +
			'</p>' +
			(wlHint || '') +
			(actions || '') +
			'</article>'
		)
	}

	async function renderApplications() {
		var list = document.getElementById('adminApplicationsList')
		if (!list || !window.IsnixAuth || !IsnixAuth.isAdminProfile(currentProfile)) {
			return
		}
		list.innerHTML = '<p class="auth-muted">Загрузка…</p>'
		try {
			var result = await IsnixAuth.getAdminApplications(adminFilter, {
				page: adminAppsPage,
				pageSize: APPS_PAGE_SIZE,
			})
			var apps = result.applications || []
			var total = result.total == null ? apps.length : result.total
			if (!apps.length) {
				list.innerHTML = '<p class="auth-muted">Нет заявок в этом разделе.</p>'
				return
			}
			list.innerHTML = apps.map(renderCard).join('')
			bindListActions(list)
		} catch (err) {
			list.innerHTML =
				'<p class="auth-message auth-message--err">' +
				escapeHtml(IsnixAuth.formatAuthError(err)) +
				'</p>'
		}
	}

	function bindListActions(list) {
		if (adminListBound) return
		adminListBound = true
		list.addEventListener('click', function (e) {
			var copyBtn = e.target.closest('.auth-copy-nick')
			var okBtn = e.target.closest('.auth-admin-approve')
			var noBtn = e.target.closest('.auth-admin-reject')
			if (copyBtn) {
				e.preventDefault()
				var nick = copyBtn.getAttribute('data-copy-nick') || ''
				var copyFn =
					window.IsnixCompat && IsnixCompat.copyText
						? IsnixCompat.copyText(nick)
						: navigator.clipboard
							? navigator.clipboard.writeText(nick)
							: null
				if (copyFn && typeof copyFn.then === 'function') {
					copyFn.then(function () {
						showMsg('Ник скопирован: ' + nick, true)
					})
				}
			} else if (okBtn) {
				e.preventDefault()
				handleModerate(okBtn.dataset.id, 'approved', okBtn)
			} else if (noBtn) {
				e.preventDefault()
				handleModerate(noBtn.dataset.id, 'rejected', noBtn)
			}
		})
	}

	async function handleModerate(id, status, btn) {
		if (!id || actionInFlight[id]) return
		var noteEl = document.querySelector('[data-note-for="' + id + '"]')
		var note = noteEl ? noteEl.value : ''
		actionInFlight[id] = true
		if (btn) btn.disabled = true
		try {
			await IsnixAuth.moderateApplication(id, status, note)
			showMsg(
				status === 'approved'
					? 'Заявка одобрена — ник в очереди на сервер.'
					: 'Заявка отклонена.',
				true,
			)
			await loadWhitelist()
			await renderApplications()
		} catch (err) {
			showMsg(IsnixAuth.formatAuthError(err), false)
		} finally {
			delete actionInFlight[id]
			if (btn) btn.disabled = false
		}
	}

	function showGuest() {
		if (loginPanel) loginPanel.hidden = false
		if (adminPanel) adminPanel.hidden = true
	}

	function showAdmin(session, profile) {
		currentProfile = profile
		if (loginPanel) loginPanel.hidden = true
		if (adminPanel) adminPanel.hidden = false
		var logoutBtn = document.getElementById('adminLogoutBtn')
		if (logoutBtn) logoutBtn.hidden = false
		renderApplications()
	}

	async function enterAdmin(session) {
		if (!session || !session.user) {
			showGuest()
			return
		}
		try {
			var profile = await IsnixAuth.getProfile(session.user.id)
			if (!IsnixAuth.isAdminProfile(profile)) {
				await IsnixAuth.signOut()
				showMsg('Этот аккаунт не администратор.', false)
				showGuest()
				return
			}
			showAdmin(session, profile)
		} catch (err) {
			showMsg(IsnixAuth.formatAuthError(err), false)
			showGuest()
		}
	}

	function bindFilters() {
		document.querySelectorAll('[data-admin-filter]').forEach(function (btn) {
			btn.addEventListener('click', function () {
				adminFilter = btn.getAttribute('data-admin-filter') || 'pending'
				adminAppsPage = 1
				document.querySelectorAll('[data-admin-filter]').forEach(function (b) {
					b.classList.toggle('active', b === btn)
				})
				renderApplications()
			})
		})
	}

	async function init() {
		var setupNotice = document.getElementById('adminSetupNotice')
		if (!window.IsnixAuth || !IsnixAuth.isReady()) {
			if (setupNotice) setupNotice.hidden = false
			showGuest()
			return
		}
		if (setupNotice) setupNotice.hidden = true

		bindFilters()
		loadWhitelist()

		if (loginForm) {
			loginForm.addEventListener('submit', async function (e) {
				e.preventDefault()
				var login = document.getElementById('adminLogin').value
				var password = document.getElementById('adminPassword').value
				setLoading(loginForm, true)
				showMsg('', true)
				try {
					await IsnixAuth.signIn(login, password)
					var session = await IsnixAuth.getSession()
					await enterAdmin(session)
				} catch (err) {
					showMsg(IsnixAuth.formatAuthError(err), false)
				} finally {
					setLoading(loginForm, false)
				}
			})
		}

		var logoutBtn = document.getElementById('adminLogoutBtn')
		if (logoutBtn) {
			logoutBtn.addEventListener('click', async function () {
				await IsnixAuth.signOut()
				currentProfile = null
				showGuest()
				showMsg('Выход выполнен', true)
			})
		}

		try {
			var session = await IsnixAuth.getSession()
			await enterAdmin(session)
		} catch (_e) {
			showGuest()
		}

		if (window.IsnixAuth && IsnixAuth.onAuthStateChange) {
			IsnixAuth.onAuthStateChange(function (session) {
				if (session) enterAdmin(session)
				else showGuest()
			})
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init)
	} else {
		init()
	}
})()
