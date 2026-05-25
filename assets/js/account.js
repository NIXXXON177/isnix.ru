;(function () {
	'use strict'

	var authMsg = document.getElementById('authMessage')
	var setupNotice = document.getElementById('authSetupNotice')
	var authPanels = document.getElementById('authPanels')
	var dashboard = document.getElementById('authDashboard')
	var whitelistPlayers = null
	var currentProfile = null
	var adminFilter = 'pending'

	function showMsg(text, ok) {
		if (!authMsg) return
		authMsg.textContent = text
		authMsg.className =
			'auth-message' + (ok ? ' auth-message--ok' : ' auth-message--err')
		authMsg.hidden = !text
	}

	function setLoading(form, loading) {
		if (!form) return
		form.classList.toggle('auth-form--loading', loading)
		form.querySelectorAll('button, input, textarea').forEach(function (el) {
			el.disabled = loading
		})
	}

	function statusLabel(status) {
		if (status === 'approved') return 'Одобрено'
		if (status === 'rejected') return 'Отклонено'
		return 'На рассмотрении'
	}

	function statusClass(status) {
		if (status === 'approved') return 'auth-status auth-status--ok'
		if (status === 'rejected') return 'auth-status auth-status--bad'
		return 'auth-status auth-status--pending'
	}

	function formatDate(iso) {
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

	function escapeHtml(s) {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
	}

	async function loadWhitelist() {
		try {
			var r = await fetch('whitelist.json', { cache: 'no-store' })
			if (!r.ok) return
			var j = await r.json()
			var raw = Array.isArray(j) ? j : j.players || []
			whitelistPlayers = raw
				.map(function (e) {
					return typeof e === 'string' ? e : e && e.name
				})
				.filter(Boolean)
				.map(function (s) {
					return String(s).trim().toLowerCase()
				})
		} catch (_e) {
			whitelistPlayers = null
		}
	}

	function isOnWhitelist(nick) {
		if (!whitelistPlayers) return false
		return whitelistPlayers.indexOf(nick.toLowerCase()) !== -1
	}

	function hasPendingApplication(apps) {
		if (!apps || !apps.length) return false
		return apps.some(function (a) {
			return a.status === 'pending'
		})
	}

	function updateNickHint(hintEl, nick) {
		if (!hintEl) return
		var v = (nick || '').trim()
		if (!v) {
			hintEl.textContent = ''
			hintEl.className = 'auth-hint'
			return
		}
		if (isOnWhitelist(v)) {
			hintEl.textContent = '✅ Этот ник в вайтлисте — можно заходить на сервер'
			hintEl.className = 'auth-hint auth-hint--ok'
		} else if (IsnixAuth && IsnixAuth.MC_NICK_RE.test(v)) {
			hintEl.textContent = 'Ника нет в вайтлисте — после сохранения откроется заявка'
			hintEl.className = 'auth-hint auth-hint--warn'
		} else {
			hintEl.textContent = 'Ник: 3–16 символов, латиница, цифры и _'
			hintEl.className = 'auth-hint auth-hint--warn'
		}
	}

	function updateProfileNickHint() {
		var nickEl = document.getElementById('profileNick')
		updateNickHint(
			document.getElementById('profileNickHint'),
			nickEl ? nickEl.value : '',
		)
	}

	function updateWhitelistHint() {
		var nickEl = document.getElementById('appNick')
		updateNickHint(document.getElementById('whitelistNickHint'), nickEl ? nickEl.value : '')
	}

	function openWhitelistModal(nick, callName) {
		var root = document.getElementById('whitelistModalRoot')
		if (!root) return
		var label = document.getElementById('whitelistModalNickLabel')
		var modalNick = document.getElementById('modalAppNick')
		var modalCall = document.getElementById('modalAppCallName')
		var modalReason = document.getElementById('modalAppReason')
		if (label) label.textContent = nick
		if (modalNick) modalNick.value = nick
		if (modalCall) modalCall.value = callName || ''
		root.classList.add('is-open')
		root.setAttribute('aria-hidden', 'false')
		document.body.style.overflow = 'hidden'
		if (modalReason) {
			setTimeout(function () {
				modalReason.focus()
			}, 100)
		}
	}

	function closeWhitelistModal() {
		var root = document.getElementById('whitelistModalRoot')
		if (!root) return
		root.classList.remove('is-open')
		root.setAttribute('aria-hidden', 'true')
		document.body.style.overflow = ''
	}

	async function maybeOpenWhitelistModal(userId, nick, callName, apps) {
		if (!nick || !IsnixAuth.MC_NICK_RE.test(nick)) return false
		if (IsnixAuth.isAdminProfile(currentProfile)) return false
		await loadWhitelist()
		if (isOnWhitelist(nick)) return false
		var list = apps
		if (!list) {
			try {
				list = await IsnixAuth.getApplications(userId)
			} catch (_e) {
				list = []
			}
		}
		if (hasPendingApplication(list)) return false
		openWhitelistModal(nick, callName)
		return true
	}

	async function submitWhitelistApplication(session, data, formEl) {
		var nick = (data.minecraft_nick || '').trim()
		if (isOnWhitelist(nick)) {
			showMsg('Этот ник уже в вайтлисте — можно заходить на сервер', true)
			return false
		}
		if (formEl) setLoading(formEl, true)
		try {
			await IsnixAuth.submitApplication(session.user.id, data)
			showMsg('Заявка отправлена. Обычно отвечаем в течение часа.', true)
			await renderApplications(session.user.id)
			updateWhitelistHint()
			updateProfileNickHint()
			return true
		} catch (err) {
			showMsg(IsnixAuth.formatAuthError(err), false)
			return false
		} finally {
			if (formEl) setLoading(formEl, false)
		}
	}

	function switchTab(tab) {
		document.querySelectorAll('.auth-tab').forEach(function (btn) {
			var active = btn.dataset.tab === tab
			btn.classList.toggle('active', active)
			btn.setAttribute('aria-selected', active ? 'true' : 'false')
		})
		document.querySelectorAll('.auth-tab-panel').forEach(function (panel) {
			panel.hidden = panel.id !== 'authTab-' + tab
		})
	}

	function showSetupNotice() {
		if (setupNotice) setupNotice.hidden = false
		if (authPanels) authPanels.hidden = true
		if (dashboard) dashboard.hidden = true
	}

	function showGuest() {
		if (setupNotice) setupNotice.hidden = true
		if (authPanels) authPanels.hidden = false
		if (dashboard) dashboard.hidden = true
	}

	function showDashboard(user, profile) {
		if (setupNotice) setupNotice.hidden = true
		if (authPanels) authPanels.hidden = true
		if (dashboard) dashboard.hidden = false
		currentProfile = profile || null
		var isAdmin = IsnixAuth && IsnixAuth.isAdminProfile(profile)
		var wrap = document.querySelector('.auth-wrap')
		if (wrap) wrap.classList.toggle('auth-wrap--wide', isAdmin)
		var badge = document.getElementById('adminRoleBadge')
		if (badge) badge.hidden = !isAdmin
		var adminPanel = document.getElementById('adminPanel')
		if (adminPanel) adminPanel.hidden = !isAdmin
		var emailEl = document.getElementById('dashEmail')
		if (emailEl) emailEl.textContent = user.email || '—'
	}

	async function renderApplications(userId) {
		var list = document.getElementById('applicationsList')
		if (!list || !window.IsnixAuth) return []
		list.innerHTML = '<p class="auth-muted">Загрузка…</p>'
		try {
			var apps = await IsnixAuth.getApplications(userId)
			if (!apps.length) {
				list.innerHTML =
					'<p class="auth-muted">Заявок пока нет. Заполни форму ниже.</p>'
				return apps
			}
			list.innerHTML = apps
				.map(function (app) {
					var note =
						app.admin_note && app.status === 'rejected'
							? '<p class="auth-app-note">' +
								escapeHtml(app.admin_note) +
								'</p>'
							: ''
					return (
						'<article class="auth-app-card">' +
						'<div class="auth-app-head">' +
						'<strong>' +
						escapeHtml(app.minecraft_nick) +
						'</strong>' +
						'<span class="' +
						statusClass(app.status) +
						'">' +
						statusLabel(app.status) +
						'</span>' +
						'</div>' +
						'<p class="auth-muted">' +
						formatDate(app.created_at) +
						'</p>' +
						'<p>' +
						escapeHtml(app.reason) +
						'</p>' +
						note +
						'</article>'
					)
				})
				.join('')
			return apps
		} catch (err) {
			list.innerHTML =
				'<p class="auth-message auth-message--err">' +
				escapeHtml(IsnixAuth.formatAuthError(err)) +
				'</p>'
			return []
		}
	}

	async function fillProfileForm(userId) {
		try {
			var profile = await IsnixAuth.getProfile(userId)
			if (!profile) return
			var nick = document.getElementById('profileNick')
			var name = document.getElementById('profileCallName')
			if (nick && profile.minecraft_nick) nick.value = profile.minecraft_nick
			if (name && profile.display_name) name.value = profile.display_name
			var appNick = document.getElementById('appNick')
			if (appNick && profile.minecraft_nick && !appNick.value) {
				appNick.value = profile.minecraft_nick
			}
			updateProfileNickHint()
		} catch (_e) {
			/* ignore */
		}
	}

	async function renderAdminApplications() {
		var list = document.getElementById('adminApplicationsList')
		if (!list || !window.IsnixAuth || !IsnixAuth.isAdminProfile(currentProfile)) return
		list.innerHTML = '<p class="auth-muted">Загрузка…</p>'
		try {
			var apps = await IsnixAuth.getAdminApplications(
				adminFilter === 'pending' ? 'pending' : null,
			)
			if (!apps.length) {
				list.innerHTML =
					'<p class="auth-muted">Нет заявок в этом разделе.</p>'
				return
			}
			list.innerHTML = apps
				.map(function (app) {
					var onWl = isOnWhitelist(app.minecraft_nick)
					var wlHint = onWl
						? '<p class="auth-hint auth-hint--ok">Уже в whitelist.json</p>'
						: ''
					var meta =
						'<p class="auth-muted">' +
						formatDate(app.created_at) +
						(app.applicant_email
							? ' · ' + escapeHtml(app.applicant_email)
							: '') +
						(app.call_name
							? '<br>Обращение: ' + escapeHtml(app.call_name)
							: '') +
						(app.age ? ' · возраст: ' + escapeHtml(app.age) : '') +
						'</p>'
					var actions =
						app.status === 'pending'
							? '<div class="auth-admin-actions">' +
								'<textarea class="auth-admin-note" data-note-for="' +
								app.id +
								'" rows="2" placeholder="Комментарий (необязательно)"></textarea>' +
								'<div class="auth-admin-btns">' +
								'<button type="button" class="auth-submit auth-admin-approve" data-id="' +
								app.id +
								'">Одобрить</button>' +
								'<button type="button" class="auth-submit auth-submit--ghost auth-admin-reject" data-id="' +
								app.id +
								'">Отклонить</button>' +
								'</div>' +
								'</div>'
							: app.admin_note
								? '<p class="auth-app-note">' +
									escapeHtml(app.admin_note) +
									'</p>'
								: ''
					return (
						'<article class="auth-app-card auth-app-card--admin">' +
						'<div class="auth-app-head">' +
						'<strong>' +
						escapeHtml(app.minecraft_nick) +
						'</strong>' +
						'<span class="' +
						statusClass(app.status) +
						'">' +
						statusLabel(app.status) +
						'</span>' +
						'</div>' +
						meta +
						'<p>' +
						escapeHtml(app.reason) +
						'</p>' +
						wlHint +
						actions +
						'</article>'
					)
				})
				.join('')
			bindAdminActions(list)
		} catch (err) {
			list.innerHTML =
				'<p class="auth-message auth-message--err">' +
				escapeHtml(IsnixAuth.formatAuthError(err)) +
				'</p>'
		}
	}

	function bindAdminActions(list) {
		list.querySelectorAll('.auth-admin-approve').forEach(function (btn) {
			btn.addEventListener('click', function () {
				handleModerate(btn.dataset.id, 'approved')
			})
		})
		list.querySelectorAll('.auth-admin-reject').forEach(function (btn) {
			btn.addEventListener('click', function () {
				handleModerate(btn.dataset.id, 'rejected')
			})
		})
	}

	async function handleModerate(id, status) {
		var noteEl = document.querySelector('[data-note-for="' + id + '"]')
		var note = noteEl ? noteEl.value : ''
		try {
			await IsnixAuth.moderateApplication(id, status, note)
			showMsg(
				status === 'approved'
					? 'Заявка одобрена. Добавь ник на сервер.'
					: 'Заявка отклонена.',
				true,
			)
			await loadWhitelist()
			await renderAdminApplications()
			var session = await IsnixAuth.getSession()
			if (session) await renderApplications(session.user.id)
		} catch (err) {
			showMsg(IsnixAuth.formatAuthError(err), false)
		}
	}

	async function onSession(session) {
		if (!session || !session.user) {
			currentProfile = null
			showGuest()
			return
		}
		var profile = null
		try {
			profile = await IsnixAuth.getProfile(session.user.id)
		} catch (_e) {
			profile = null
		}
		if (profile && session.user.email) {
			profile.email = profile.email || session.user.email
		}
		showDashboard(session.user, profile)
		await fillProfileForm(session.user.id)
		await renderApplications(session.user.id)
		if (IsnixAuth.isAdminProfile(profile)) {
			await renderAdminApplications()
		}
		updateProfileNickHint()
		updateWhitelistHint()
	}

	async function init() {
		await loadWhitelist()

		if (!window.IsnixAuth || !IsnixAuth.isReady()) {
			showSetupNotice()
			return
		}

		document.querySelectorAll('.auth-tab').forEach(function (btn) {
			btn.addEventListener('click', function () {
				switchTab(btn.dataset.tab)
			})
		})

		document.querySelectorAll('.auth-admin-tab').forEach(function (btn) {
			btn.addEventListener('click', function () {
				adminFilter = btn.dataset.adminFilter || 'pending'
				document.querySelectorAll('.auth-admin-tab').forEach(function (b) {
					b.classList.toggle('active', b === btn)
				})
				renderAdminApplications()
			})
		})

		var loginForm = document.getElementById('loginForm')
		if (loginForm) {
			loginForm.addEventListener('submit', async function (e) {
				e.preventDefault()
				setLoading(loginForm, true)
				showMsg('', true)
				try {
					await IsnixAuth.signIn(
						document.getElementById('loginEmail').value.trim(),
						document.getElementById('loginPassword').value,
					)
					showMsg('Вы вошли в аккаунт', true)
				} catch (err) {
					showMsg(IsnixAuth.formatAuthError(err), false)
				} finally {
					setLoading(loginForm, false)
				}
			})
		}

		var regForm = document.getElementById('registerForm')
		if (regForm) {
			regForm.addEventListener('submit', async function (e) {
				e.preventDefault()
				var p1 = document.getElementById('regPassword').value
				var p2 = document.getElementById('regPassword2').value
				if (p1 !== p2) {
					showMsg('Пароли не совпадают', false)
					return
				}
				if (p1.length < 6) {
					showMsg('Пароль — минимум 6 символов', false)
					return
				}
				setLoading(regForm, true)
				showMsg('', true)
				try {
					var data = await IsnixAuth.signUp(
						document.getElementById('regEmail').value.trim(),
						p1,
					)
					if (data.session) {
						showMsg('Аккаунт создан', true)
					} else {
						showMsg(
							'Письмо отправлено на почту — подтверди регистрацию и войди',
							true,
						)
						switchTab('login')
					}
				} catch (err) {
					showMsg(IsnixAuth.formatAuthError(err), false)
				} finally {
					setLoading(regForm, false)
				}
			})
		}

		var logoutBtn = document.getElementById('logoutBtn')
		if (logoutBtn) {
			logoutBtn.addEventListener('click', async function () {
				await IsnixAuth.signOut()
				showMsg('Вы вышли', true)
				showGuest()
			})
		}

		var profileForm = document.getElementById('profileForm')
		var profileNick = document.getElementById('profileNick')
		if (profileNick) {
			profileNick.addEventListener('input', updateProfileNickHint)
		}
		if (profileForm) {
			profileForm.addEventListener('submit', async function (e) {
				e.preventDefault()
				var session = await IsnixAuth.getSession()
				if (!session) return
				var nick = document.getElementById('profileNick').value.trim()
				var callName = document.getElementById('profileCallName').value.trim()
				if (nick && !IsnixAuth.MC_NICK_RE.test(nick)) {
					showMsg('Ник Minecraft: 3–16 символов, латиница, цифры и _', false)
					return
				}
				setLoading(profileForm, true)
				try {
					await IsnixAuth.updateProfile(session.user.id, {
						minecraft_nick: nick || null,
						display_name: callName,
					})
					await loadWhitelist()
					updateProfileNickHint()
					var appNickEl = document.getElementById('appNick')
					var appCallEl = document.getElementById('appCallName')
					if (appNickEl && nick) appNickEl.value = nick
					if (appCallEl && callName) appCallEl.value = callName
					updateWhitelistHint()

					if (nick && isOnWhitelist(nick)) {
						showMsg(
							'Профиль сохранён. Ты в вайтлисте — можно заходить на сервер!',
							true,
						)
					} else if (nick) {
						var apps = await IsnixAuth.getApplications(session.user.id)
						var opened = await maybeOpenWhitelistModal(
							session.user.id,
							nick,
							callName,
							apps,
						)
						if (opened) {
							showMsg('Профиль сохранён. Заполни заявку в вайтлист.', true)
						} else if (hasPendingApplication(apps)) {
							showMsg('Профиль сохранён. Заявка уже на рассмотрении.', true)
						} else {
							showMsg('Профиль сохранён', true)
						}
					} else {
						showMsg('Профиль сохранён', true)
					}
				} catch (err) {
					showMsg(IsnixAuth.formatAuthError(err), false)
				} finally {
					setLoading(profileForm, false)
				}
			})
		}

		var appForm = document.getElementById('whitelistForm')
		if (appForm) {
			var appNick = document.getElementById('appNick')
			if (appNick) {
				appNick.addEventListener('input', updateWhitelistHint)
			}
			appForm.addEventListener('submit', async function (e) {
				e.preventDefault()
				var session = await IsnixAuth.getSession()
				if (!session) return
				var ok = await submitWhitelistApplication(
					session,
					{
						minecraft_nick: document.getElementById('appNick').value.trim(),
						call_name: document.getElementById('appCallName').value.trim(),
						age: document.getElementById('appAge').value.trim(),
						reason: document.getElementById('appReason').value.trim(),
					},
					appForm,
				)
				if (ok) appForm.reset()
			})
		}

		var modalForm = document.getElementById('whitelistModalForm')
		if (modalForm) {
			modalForm.addEventListener('submit', async function (e) {
				e.preventDefault()
				var session = await IsnixAuth.getSession()
				if (!session) return
				var ok = await submitWhitelistApplication(
					session,
					{
						minecraft_nick: document.getElementById('modalAppNick').value.trim(),
						call_name: document.getElementById('modalAppCallName').value.trim(),
						age: document.getElementById('modalAppAge').value.trim(),
						reason: document.getElementById('modalAppReason').value.trim(),
					},
					modalForm,
				)
				if (ok) {
					modalForm.reset()
					closeWhitelistModal()
				}
			})
		}

		var modalCancel = document.getElementById('whitelistModalCancel')
		if (modalCancel) {
			modalCancel.addEventListener('click', closeWhitelistModal)
		}
		var modalBackdrop = document.getElementById('whitelistModalBackdrop')
		if (modalBackdrop) {
			modalBackdrop.addEventListener('click', closeWhitelistModal)
		}
		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape') closeWhitelistModal()
		})

		try {
			var session = await IsnixAuth.getSession()
			await onSession(session)
		} catch (err) {
			showMsg(IsnixAuth.formatAuthError(err), false)
			showGuest()
		}

		IsnixAuth.onAuthStateChange(onSession)
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init)
	} else {
		init()
	}
})()
