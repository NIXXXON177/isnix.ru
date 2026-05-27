;(function () {
	'use strict'

	var authMsg = document.getElementById('authMessage')
	var setupNotice = document.getElementById('authSetupNotice')
	var authPanels = document.getElementById('authPanels')
	var dashboard = document.getElementById('authDashboard')
	var whitelistPlayers = null
	var currentProfile = null
	var adminFilter = 'pending'
	var adminView = 'applications'
	var skinViewer = null
	var skinUpdateTimer = null
	var statusRefreshTimer = null
	var onSessionTimer = null
	var dashboardLoading = false
	var skinRequestId = 0

	function showMsg(text, ok) {
		if (!authMsg) return
		authMsg.textContent = text
		authMsg.className =
			'auth-message' + (ok ? ' auth-message--ok' : ' auth-message--err')
		authMsg.hidden = !text
	}

	function showConnectionNotice(text) {
		var box = document.getElementById('authConnectionNotice')
		var line = document.getElementById('authConnectionText')
		if (!box || !line) return
		if (!text) {
			box.hidden = true
			line.textContent = ''
			return
		}
		line.textContent = text
		box.hidden = false
	}

	function syncPasswordFormUsername(email) {
		var el = document.getElementById('passwordFormUsername')
		if (el) el.value = email || ''
	}

	function setAccountPageMode(loggedIn) {
		document.body.classList.toggle('account--logged-in', !!loggedIn)
		var title = document.getElementById('accountHeroTitle')
		var lead = document.getElementById('accountHeroLead')
		var hints = document.getElementById('accountHeroHints')
		if (title) {
			title.textContent = loggedIn ? 'Твой профиль' : 'Аккаунт'
		}
		if (lead) {
			lead.textContent = loggedIn
				? 'Профиль, заявки в вайтлист и настройки аккаунта.'
				: 'Войди или зарегистрируйся, чтобы подать заявку в вайтлист и следить за статусом.'
		}
		if (hints) hints.hidden = !loggedIn
	}

	function updateDashAvatar(nick) {
		var img = document.getElementById('dashAvatar')
		var fallback = document.getElementById('dashAvatarFallback')
		if (!img || !fallback) return
		var v = (nick || '').trim()
		if (v && IsnixAuth && IsnixAuth.MC_NICK_RE.test(v)) {
			img.src = 'https://ely.by/avatar/' + encodeURIComponent(v)
			img.onerror = function () {
				img.onerror = null
				img.src = 'https://mc-heads.net/avatar/' + encodeURIComponent(v) + '/48'
			}
			img.alt = v
			img.hidden = false
			fallback.hidden = true
		} else {
			img.hidden = true
			img.removeAttribute('src')
			fallback.hidden = false
			fallback.textContent = v ? v.charAt(0).toUpperCase() : '?'
		}
	}

	function getSkinSources(nick) {
		var safe = encodeURIComponent(nick)
		return [
			'https://ely.by/skins/' + safe + '.png',
			'https://skinsystem.ely.by/skins/' + safe,
			'https://mc-heads.net/skin/' + safe,
		]
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
		var profileNickEl = document.getElementById('profileNick')
		var appNickEl = document.getElementById('appNick')
		syncWhitelistSectionVisibility(
			(profileNickEl && profileNickEl.value) || (appNickEl && appNickEl.value) || '',
		)
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
		var nick = nickEl ? nickEl.value : ''
		updateNickHint(
			document.getElementById('profileNickHint'),
			nick,
		)
		syncWhitelistSectionVisibility(nick)
	}

	function updateWhitelistHint() {
		var nickEl = document.getElementById('appNick')
		var nick = nickEl ? nickEl.value : ''
		updateNickHint(document.getElementById('whitelistNickHint'), nick)
		syncWhitelistSectionVisibility(nick)
		syncWhitelistFormState(nick)
	}

	function syncWhitelistSectionVisibility(nick) {
		var section = document.getElementById('whitelist')
		if (!section) return
		if (IsnixAuth.isAdminProfile(currentProfile)) {
			section.hidden = false
			return
		}
		var profileNickEl = document.getElementById('profileNick')
		var baseNick = (nick || '').trim()
		if (!baseNick && profileNickEl) {
			baseNick = (profileNickEl.value || '').trim()
		}
		var inWhitelist = !!(
			baseNick &&
			IsnixAuth.MC_NICK_RE.test(baseNick) &&
			isOnWhitelist(baseNick)
		)
		section.hidden = inWhitelist
	}

	function syncWhitelistFormState(nick) {
		var form = document.getElementById('whitelistForm')
		var note = document.getElementById('whitelistStateNote')
		if (!form) return

		var v = (nick || '').trim()
		var blocked = !!(v && IsnixAuth.MC_NICK_RE.test(v) && isOnWhitelist(v))

		form
			.querySelectorAll('#appCallName, #appAge, #appReason, button[type="submit"]')
			.forEach(function (el) {
				el.disabled = blocked
			})

		if (!note) return
		if (blocked) {
			note.textContent =
				'Этот ник уже в whitelist. Заявку заполнять не нужно — можно заходить на сервер.'
			note.className = 'auth-hint auth-hint--ok'
			note.hidden = false
		} else {
			note.hidden = true
			note.textContent = ''
			note.className = 'auth-hint'
		}
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
			await refreshPlayerStatus()
			return true
		} catch (err) {
			showMsg(IsnixAuth.formatAuthError(err), false)
			return false
		} finally {
			if (formEl) setLoading(formEl, false)
		}
	}

	function disposeSkinViewer() {
		if (skinViewer) {
			try {
				skinViewer.dispose()
			} catch (_e) {
				/* ignore */
			}
			skinViewer = null
		}
	}

	async function updateSkinViewer(nick) {
		var canvas = document.getElementById('profileSkinCanvas')
		var placeholder = document.getElementById('profileSkinPlaceholder')
		if (!canvas || !placeholder || typeof skinview3d === 'undefined') {
			if (placeholder) placeholder.hidden = false
			return
		}
		if (!nick || !IsnixAuth.MC_NICK_RE.test(nick)) {
			disposeSkinViewer()
			canvas.hidden = true
			placeholder.hidden = false
			return
		}
		var reqId = ++skinRequestId
		placeholder.textContent = 'Загрузка скина…'
		placeholder.hidden = true
		canvas.hidden = false
		disposeSkinViewer()
		try {
			skinViewer = new skinview3d.SkinViewer({
				canvas: canvas,
				width: 220,
				height: 300,
			})
			var sources = getSkinSources(nick)
			var loaded = false
			for (var i = 0; i < sources.length; i++) {
				try {
					await Promise.resolve(skinViewer.loadSkin(sources[i]))
					loaded = true
					break
				} catch (_e) {
					/* try next source */
				}
			}
			if (reqId !== skinRequestId) return
			if (!loaded) {
				throw new Error('skin source unavailable')
			}
			skinViewer.controls.enableRotate = true
			skinViewer.controls.enableZoom = false
			skinViewer.animation = new skinview3d.WalkingAnimation()
			skinViewer.camera.position.y = 8
		} catch (_e) {
			if (reqId !== skinRequestId) return
			canvas.hidden = true
			placeholder.hidden = false
			placeholder.textContent = 'Не удалось загрузить скин (включая Ely.by)'
		}
	}

	function scheduleSkinUpdate() {
		clearTimeout(skinUpdateTimer)
		skinUpdateTimer = setTimeout(function () {
			var nickEl = document.getElementById('profileNick')
			updateSkinViewer(nickEl ? nickEl.value.trim() : '')
		}, 350)
	}

	function updateProfileMeta(profile, serverStatus) {
		var nameEl = document.getElementById('profileDisplayName')
		var nickLine = document.getElementById('profileNickDisplay')
		var wlBadge = document.getElementById('profileWlBadge')
		var onlineBadge = document.getElementById('profileOnlineBadge')
		var nick =
			profile && profile.minecraft_nick ? profile.minecraft_nick.trim() : ''
		var display =
			profile && profile.display_name ? profile.display_name.trim() : ''

		if (nameEl) nameEl.textContent = display || nick || 'Игрок'
		if (nickLine) {
			nickLine.textContent = nick ? nick : 'Ник не указан'
		}
		if (wlBadge) {
			if (!nick) {
				wlBadge.textContent = 'Укажи ник'
				wlBadge.className = 'profile-badge'
			} else if (isOnWhitelist(nick)) {
				wlBadge.textContent = '✓ В вайтлисте'
				wlBadge.className = 'profile-badge profile-badge--ok'
			} else {
				wlBadge.textContent = 'Нет в вайтлисте'
				wlBadge.className = 'profile-badge profile-badge--warn'
			}
		}
		if (onlineBadge) {
			if (!nick) {
				onlineBadge.textContent = 'Сервер'
				onlineBadge.className = 'profile-badge'
			} else if (serverStatus === null) {
				onlineBadge.textContent = 'Статус недоступен'
				onlineBadge.className = 'profile-badge profile-badge--off'
			} else if (!serverStatus) {
				onlineBadge.textContent = 'Статус…'
				onlineBadge.className = 'profile-badge'
			} else if (!serverStatus.online) {
				onlineBadge.textContent = 'Сервер офлайн'
				onlineBadge.className = 'profile-badge profile-badge--off'
			} else if (
				window.IsnixServer &&
				IsnixServer.isPlayerOnline(nick, serverStatus)
			) {
				onlineBadge.textContent = '● Онлайн на сервере'
				onlineBadge.className = 'profile-badge profile-badge--online'
			} else {
				onlineBadge.textContent = 'Не в сети'
				onlineBadge.className = 'profile-badge profile-badge--off'
			}
		}
	}

	async function refreshPlayerStatus(force) {
		if (!window.IsnixServer) return null
		var status = await IsnixServer.fetchStatus(!!force)
		updateProfileMeta(currentProfile, status === undefined ? null : status)
		return status
	}

	function switchAdminView(view) {
		adminView = view || 'applications'
		document.querySelectorAll('[data-admin-view]').forEach(function (btn) {
			btn.classList.toggle('active', btn.dataset.adminView === adminView)
		})
		var appsEl = document.getElementById('adminViewApplications')
		var serverEl = document.getElementById('adminViewServer')
		var usersEl = document.getElementById('adminViewUsers')
		if (appsEl) appsEl.hidden = adminView !== 'applications'
		if (serverEl) serverEl.hidden = adminView !== 'server'
		if (usersEl) usersEl.hidden = adminView !== 'users'
		if (adminView === 'applications') renderAdminApplications()
		else if (adminView === 'server') renderAdminServerList()
		else if (adminView === 'users') renderAdminUsersList()
	}

	function renderPlayerRow(nick, extraHtml) {
		var safe = escapeHtml(nick)
		var enc = encodeURIComponent(nick)
		return (
			'<div class="auth-player-row">' +
			'<img class="auth-player-head" src="https://ely.by/avatar/' +
			enc +
			'" width="32" height="32" alt="" loading="lazy" decoding="async" onerror="this.onerror=null;this.src=\'https://mc-heads.net/avatar/' +
			enc +
			'/32\'" />' +
			'<div class="auth-player-info"><strong>' +
			safe +
			'</strong>' +
			(extraHtml || '') +
			'</div></div>'
		)
	}

	async function renderAdminServerList() {
		var list = document.getElementById('adminServerList')
		if (!list) return
		list.innerHTML = '<p class="auth-muted">Загрузка…</p>'
		if (!window.IsnixServer) {
			list.innerHTML = '<p class="auth-muted">Статус сервера недоступен</p>'
			return
		}
		try {
			var status = await IsnixServer.fetchStatus(false)
			if (!status) {
				list.innerHTML = '<p class="auth-muted">Не удалось получить статус сервера</p>'
				return
			}
			if (!status.online) {
				list.innerHTML =
					'<p class="auth-muted">Сервер <strong>mc.isnix.ru</strong> сейчас офлайн</p>'
				return
			}
			if (!status.players.length) {
				list.innerHTML =
					'<p class="auth-muted">Сервер онлайн, игроков нет (' +
					status.count +
					(status.max != null ? ' / ' + status.max : '') +
					')</p>'
				return
			}
			var header =
				'<p class="auth-muted auth-admin-server-count">Онлайн: <strong>' +
				status.count +
				(status.max != null ? ' / ' + status.max : '') +
				'</strong></p>'
			list.innerHTML =
				header +
				status.players
					.map(function (n) {
						return renderPlayerRow(n, '')
					})
					.join('')
		} catch (err) {
			list.innerHTML =
				'<p class="auth-message auth-message--err">' +
				escapeHtml(err.message || 'Ошибка') +
				'</p>'
		}
	}

	async function renderAdminUsersList() {
		var list = document.getElementById('adminUsersList')
		if (!list) return
		list.innerHTML = '<p class="auth-muted">Загрузка…</p>'
		try {
			var profiles = await IsnixAuth.getAdminProfiles()
			var status = window.IsnixServer ? await IsnixServer.fetchStatus() : null
			if (!profiles.length) {
				list.innerHTML = '<p class="auth-muted">Пока никто не зарегистрировался</p>'
				return
			}
			list.innerHTML = profiles
				.map(function (p) {
					var nick = p.minecraft_nick || '—'
					var email = p.email || '—'
					var role =
						p.role === 'admin' && IsnixAuth.isAdminProfile(p)
							? '<span class="auth-status auth-status--bad">админ</span>'
							: ''
					var online =
						p.minecraft_nick &&
						status &&
						IsnixServer.isPlayerOnline(p.minecraft_nick, status)
							? '<span class="auth-status auth-status--ok">онлайн</span>'
							: ''
					var meta =
						'<p class="auth-muted">' +
						escapeHtml(email) +
						' · ' +
						formatDate(p.created_at) +
						'</p>'
					var tags =
						'<div class="auth-player-tags">' + role + online + '</div>'
					if (p.minecraft_nick && IsnixAuth.MC_NICK_RE.test(p.minecraft_nick)) {
						return renderPlayerRow(p.minecraft_nick, meta + tags)
					}
					return (
						'<article class="auth-app-card">' +
						'<strong>' +
						escapeHtml(nick) +
						'</strong> ' +
						tags +
						meta +
						'</article>'
					)
				})
				.join('')
		} catch (err) {
			list.innerHTML =
				'<p class="auth-message auth-message--err">' +
				escapeHtml(IsnixAuth.formatAuthError(err)) +
				'</p>'
		}
	}

	function startStatusPolling() {
		if (statusRefreshTimer) clearInterval(statusRefreshTimer)
		refreshPlayerStatus(false)
		statusRefreshTimer = setInterval(function () {
			refreshPlayerStatus(false)
			if (
				IsnixAuth.isAdminProfile(currentProfile) &&
				adminView === 'server'
			) {
				renderAdminServerList()
			}
		}, 300000)
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
		setAccountPageMode(false)
		if (setupNotice) setupNotice.hidden = false
		if (authPanels) authPanels.hidden = true
		if (dashboard) dashboard.hidden = true
	}

	function showGuest() {
		setAccountPageMode(false)
		if (setupNotice) setupNotice.hidden = true
		if (authPanels) authPanels.hidden = false
		if (dashboard) dashboard.hidden = true
		var wlSection = document.getElementById('whitelist')
		if (wlSection) wlSection.hidden = false
		disposeSkinViewer()
		if (statusRefreshTimer) {
			clearInterval(statusRefreshTimer)
			statusRefreshTimer = null
		}
	}

	function showDashboard(user, profile) {
		setAccountPageMode(true)
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
		syncPasswordFormUsername(user.email || '')
		updateDashAvatar(profile && profile.minecraft_nick ? profile.minecraft_nick : '')
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
			updateWhitelistHint()
			updateSkinViewer(profile.minecraft_nick ? profile.minecraft_nick.trim() : '')
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

	async function loadDashboard(session) {
		if (dashboardLoading) return
		dashboardLoading = true
		try {
			var userId = session.user.id
			var profile = null
			var profileErr = null
			var appsErr = null

			try {
				profile = await IsnixAuth.getProfile(userId)
			} catch (e) {
				profileErr = e
				profile = null
			}

			if (profile && session.user.email) {
				profile.email = profile.email || session.user.email
			} else if (!profile && session.user.email) {
				profile = {
					email: session.user.email,
					minecraft_nick: null,
					display_name: null,
					role: 'player',
				}
			}

			currentProfile = profile
			showDashboard(session.user, profile)
			showConnectionNotice('')

			if (profileErr) {
				showConnectionNotice(
					'Профиль не загрузился: ' +
						IsnixAuth.formatAuthError(profileErr) +
						' Нажми «Повторить загрузку».',
				)
			}

			await loadWhitelist()

			if (!profileErr) {
				await fillProfileForm(userId)
			}

			try {
				await renderApplications(userId)
			} catch (e) {
				appsErr = e
				var list = document.getElementById('applicationsList')
				if (list) {
					list.innerHTML =
						'<p class="auth-message auth-message--err">' +
						escapeHtml(IsnixAuth.formatAuthError(e)) +
						'</p>'
				}
			}

			if (profileErr && appsErr) {
				showConnectionNotice(
					'Нет связи с Supabase. Проверь интернет или подожди (у Supabase бывают техработы).',
				)
			}

			if (IsnixAuth.isAdminProfile(profile)) {
				switchAdminView(adminView)
			}
			updateProfileNickHint()
			updateWhitelistHint()
			updateSkinViewer(
				profile && profile.minecraft_nick ? profile.minecraft_nick.trim() : '',
			)
			updateDashAvatar(profile && profile.minecraft_nick ? profile.minecraft_nick : '')
			startStatusPolling()
		} finally {
			dashboardLoading = false
		}
	}

	function scheduleOnSession(session) {
		clearTimeout(onSessionTimer)
		onSessionTimer = setTimeout(function () {
			runOnSession(session)
		}, 80)
	}

	async function runOnSession(session) {
		if (!session || !session.user) {
			currentProfile = null
			dashboardLoading = false
			showConnectionNotice('')
			showGuest()
			return
		}

		try {
			await loadDashboard(session)
		} catch (err) {
			dashboardLoading = false
			showConnectionNotice(IsnixAuth.formatAuthError(err))
			showMsg(IsnixAuth.formatAuthError(err), false)
		}
	}

	async function init() {
		await loadWhitelist()

		var copyIpBtn = document.getElementById('accountCopyIp')
		if (copyIpBtn) {
			copyIpBtn.addEventListener('click', function () {
				var ip = 'mc.isnix.ru'
				function done(ok) {
					if (!ok) return
					copyIpBtn.classList.add('is-copied')
					copyIpBtn.textContent = 'Скопировано'
					setTimeout(function () {
						copyIpBtn.classList.remove('is-copied')
						copyIpBtn.textContent = ip
					}, 1600)
				}
				if (navigator.clipboard && navigator.clipboard.writeText) {
					navigator.clipboard.writeText(ip).then(function () {
						done(true)
					}).catch(function () {
						done(false)
					})
				} else {
					done(false)
				}
			})
		}

		if (!window.IsnixAuth || !IsnixAuth.isReady()) {
			showSetupNotice()
			return
		}

		document.querySelectorAll('.auth-tab').forEach(function (btn) {
			btn.addEventListener('click', function () {
				switchTab(btn.dataset.tab)
			})
		})

		document.querySelectorAll('[data-admin-view]').forEach(function (btn) {
			btn.addEventListener('click', function () {
				switchAdminView(btn.dataset.adminView)
			})
		})

		document.querySelectorAll('[data-admin-filter]').forEach(function (btn) {
			btn.addEventListener('click', function () {
				adminFilter = btn.dataset.adminFilter || 'pending'
				document.querySelectorAll('[data-admin-filter]').forEach(function (b) {
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
			profileNick.addEventListener('input', function () {
				updateProfileNickHint()
				scheduleSkinUpdate()
			})
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
					currentProfile = {
						email: session.user.email,
						minecraft_nick: nick || null,
						display_name: callName,
						role: currentProfile ? currentProfile.role : 'player',
					}
					await loadWhitelist()
					updateProfileNickHint()
					updateSkinViewer(nick)
					updateDashAvatar(nick)
					await refreshPlayerStatus()
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

		var passwordForm = document.getElementById('passwordForm')
		if (passwordForm) {
			passwordForm.addEventListener('submit', async function (e) {
				e.preventDefault()
				var p1 = document.getElementById('newPassword').value
				var p2 = document.getElementById('newPassword2').value
				if (p1 !== p2) {
					showMsg('Пароли не совпадают', false)
					return
				}
				setLoading(passwordForm, true)
				try {
					await IsnixAuth.updatePassword(p1)
					showMsg('Пароль обновлён', true)
					passwordForm.reset()
				} catch (err) {
					showMsg(IsnixAuth.formatAuthError(err), false)
				} finally {
					setLoading(passwordForm, false)
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
				if (ok) {
					appForm.reset()
					updateWhitelistHint()
				}
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

		var retryBtn = document.getElementById('authRetryBtn')
		if (retryBtn) {
			retryBtn.addEventListener('click', async function () {
				showConnectionNotice('')
				showMsg('', true)
				try {
					var session = await IsnixAuth.getSession()
					if (!session) {
						showGuest()
						return
					}
					dashboardLoading = false
					await loadDashboard(session)
				} catch (err) {
					showConnectionNotice(IsnixAuth.formatAuthError(err))
					showMsg(IsnixAuth.formatAuthError(err), false)
				}
			})
		}

		try {
			var session = await IsnixAuth.getSession()
			await runOnSession(session)
		} catch (err) {
			showMsg(IsnixAuth.formatAuthError(err), false)
			showGuest()
		}

		IsnixAuth.onAuthStateChange(scheduleOnSession)
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init)
	} else {
		init()
	}
})()
