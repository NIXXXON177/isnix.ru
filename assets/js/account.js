;(function () {
	'use strict'

	var authMsg = document.getElementById('authMessage')
	var setupNotice = document.getElementById('authSetupNotice')
	var authPanels = document.getElementById('authPanels')
	var dashboard = document.getElementById('authDashboard')
	var whitelistPlayers = null
	var cachedApplications = []
	var currentProfile = null
	var adminFilter = 'pending'
	var adminView = 'applications'
	var playerStats = null
	var playerStatsUserId = null
	var playerStatsTimer = null
	var statsRefreshTimer = null
	var cachedServerStatus = null
	var statusRefreshTimer = null
	var onSessionTimer = null
	var dashboardLoading = false
	var dashboardEnterPromise = null
	var dashboardEnterUserId = null
	var PROFILE_CACHE_TTL_MS = 300000
	var APPS_CACHE_TTL_MS = 120000
	var adminActionInFlight = {}
	var adminListDelegationBound = false
	var whitelistLoadPromise = null
	var adminListsLoaded = {
		applications: false,
		server: false,
		users: false,
	}

	function showMsg(text, ok) {
		if (!authMsg) return
		authMsg.textContent = text
		authMsg.className =
			'auth-message' + (ok ? ' auth-message--ok' : ' auth-message--err')
		authMsg.hidden = !text
	}

	function showProfileLoadError(err) {
		var base =
			'Профиль не загрузился: ' +
			IsnixAuth.formatAuthError(err) +
			' Нажми «Повторить загрузку».'
		showConnectionNotice(base)
		if (!IsnixAuth.probeSupabaseReachability) return
		IsnixAuth.probeSupabaseReachability().then(function (probe) {
			if (probe.ok) return
			if (probe.reason === 'blocked_or_offline') {
				showConnectionNotice(
					base +
						' Проверка: браузер не открывает Supabase (блокировщик, VPN или сеть). Отключи AdBlock для isnix.ru и *.supabase.co.',
				)
			} else if (probe.reason === 'no_config') {
				showConnectionNotice(
					'На сайте не подключён ключ Supabase. Нужен секрет SUPABASE_ANON_KEY и деплой Pages.',
				)
			}
		})
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

	function avatarUrl(nick, size) {
		return (
			'https://mc-heads.net/avatar/' +
			encodeURIComponent(nick) +
			'/' +
			(size || 48)
		)
	}

	function updateDashAvatar(nick) {
		var img = document.getElementById('dashAvatar')
		var fallback = document.getElementById('dashAvatarFallback')
		if (!img || !fallback) return
		var v = (nick || '').trim()
		if (v && IsnixAuth && IsnixAuth.MC_NICK_RE.test(v)) {
			img.src = avatarUrl(v, 48)
			img.onerror = function () {
				img.onerror = null
				img.src =
					'https://mc-heads.net/avatar/' + encodeURIComponent(v) + '/48'
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
		var wrap = img.closest('.account-user-bar__avatar-wrap')
		if (wrap) {
			wrap.classList.toggle(
				'is-showing-avatar',
				!img.hidden && !!img.getAttribute('src'),
			)
		}
	}

	function formatDurationSeconds(totalSeconds) {
		var s = Math.max(0, Math.floor(totalSeconds || 0))
		if (s < 60) return s + ' сек'
		var m = Math.floor(s / 60)
		s %= 60
		if (m < 60) {
			return m + ' мин' + (s ? ' ' + s + ' сек' : '')
		}
		var h = Math.floor(m / 60)
		m %= 60
		if (h < 24) {
			return h + ' ч' + (m ? ' ' + m + ' мин' : '')
		}
		var d = Math.floor(h / 24)
		h %= 24
		return d + ' д' + (h ? ' ' + h + ' ч' : '')
	}

	function formatSiteTenure(createdAtIso) {
		if (!createdAtIso) return '—'
		var start = new Date(createdAtIso).getTime()
		if (isNaN(start)) return '—'
		var seconds = Math.floor((Date.now() - start) / 1000)
		if (seconds < 60) return 'меньше минуты'
		return formatDurationSeconds(seconds)
	}

	function localSessionStorageKey(userId) {
		return 'isnix_mc_session_' + userId
	}

	function readLocalSessionStart(userId) {
		if (!userId) return null
		try {
			var raw = sessionStorage.getItem(localSessionStorageKey(userId))
			if (!raw) return null
			var n = parseInt(raw, 10)
			return isNaN(n) ? null : n
		} catch (_e) {
			return null
		}
	}

	function writeLocalSessionStart(userId, ts) {
		if (!userId) return
		try {
			sessionStorage.setItem(localSessionStorageKey(userId), String(ts))
		} catch (_e) {
			/* ignore */
		}
	}

	function clearLocalSessionStart(userId) {
		if (!userId) return
		try {
			sessionStorage.removeItem(localSessionStorageKey(userId))
		} catch (_e) {
			/* ignore */
		}
	}

	function getSessionStartMs(stats, userId, onlineOnServer) {
		if (stats && stats.session_started_at) {
			var fromDb = new Date(stats.session_started_at).getTime()
			if (!isNaN(fromDb)) return fromDb
		}
		if (!onlineOnServer) {
			clearLocalSessionStart(userId)
			return null
		}
		var local = readLocalSessionStart(userId)
		if (!local) {
			local = Date.now()
			writeLocalSessionStart(userId, local)
		}
		return local
	}

	function getLiveSessionSeconds(stats, userId, onlineOnServer) {
		var startMs = getSessionStartMs(stats, userId, onlineOnServer)
		if (!startMs) return 0
		return Math.max(0, Math.floor((Date.now() - startMs) / 1000))
	}

	function getDisplayTotalSeconds(stats, userId, onlineOnServer) {
		var base =
			stats && typeof stats.total_play_seconds === 'number'
				? stats.total_play_seconds
				: 0
		var sessionSec = getLiveSessionSeconds(stats, userId, onlineOnServer)
		if (sessionSec > 0) {
			return base + sessionSec
		}
		return stats && typeof stats.total_play_seconds === 'number' ? base : null
	}

	function renderPlayerStats(profile, stats, serverStatus) {
		var siteEl = document.getElementById('profileStatSite')
		var totalEl = document.getElementById('profileStatTotal')
		var sessionEl = document.getElementById('profileStatSession')
		var hintEl = document.getElementById('profileStatsHint')
		if (!siteEl || !totalEl || !sessionEl) return

		var userId = profile && profile.id ? profile.id : playerStatsUserId
		var nick =
			profile && profile.minecraft_nick ? profile.minecraft_nick.trim() : ''
		var onlineOnServer =
			nick &&
			serverStatus &&
			window.IsnixServer &&
			IsnixServer.isPlayerOnline(nick, serverStatus)

		if (siteEl) {
			if (profile && profile.created_at) {
				siteEl.textContent = formatSiteTenure(profile.created_at)
				siteEl.title = 'С ' + formatDate(profile.created_at)
			} else {
				siteEl.textContent = '—'
				siteEl.removeAttribute('title')
			}
		}

		var liveSec = getLiveSessionSeconds(stats, userId, onlineOnServer)
		var displayTotal = getDisplayTotalSeconds(stats, userId, onlineOnServer)

		if (totalEl) {
			if (displayTotal != null) {
				totalEl.textContent = formatDurationSeconds(displayTotal)
				if (liveSec > 0 && onlineOnServer) {
					totalEl.title =
						'Сохранено: ' +
						formatDurationSeconds(
							stats && typeof stats.total_play_seconds === 'number'
								? stats.total_play_seconds
								: 0,
						) +
						' · текущая сессия в сумме'
				} else {
					totalEl.removeAttribute('title')
				}
			} else {
				totalEl.textContent = '—'
				totalEl.removeAttribute('title')
			}
		}

		if (sessionEl) {
			if (!nick) {
				sessionEl.textContent = 'Укажи ник'
				sessionEl.className = 'profile-stats-value'
			} else if (onlineOnServer) {
				sessionEl.textContent = formatDurationSeconds(liveSec)
				sessionEl.className = 'profile-stats-value profile-stats-value--live'
			} else if (stats && stats.session_started_at) {
				sessionEl.textContent = 'Сессия не закрыта'
				sessionEl.className = 'profile-stats-value'
				sessionEl.title =
					'Выйди с сервера нормально — время добавится в «Всего в игре» в базе'
			} else {
				sessionEl.textContent = 'Не в сети'
				sessionEl.className = 'profile-stats-value'
				sessionEl.removeAttribute('title')
			}
		}

		if (hintEl) {
			var needHint = !stats
			hintEl.hidden = !needHint
			if (needHint) {
				hintEl.textContent =
					'Время в игре обновляет сервер. Пока данных нет — выполни docs/supabase-player-stats.sql и настрой отправку статистики с Play2GO.'
			}
		}
	}

	function stopPlayerStatsTicker() {
		if (playerStatsTimer) {
			clearInterval(playerStatsTimer)
			playerStatsTimer = null
		}
	}

	function startPlayerStatsTicker() {
		stopPlayerStatsTicker()
		playerStatsTimer = setInterval(function () {
			if (!currentProfile || !playerStatsUserId) return
			renderPlayerStats(currentProfile, playerStats, cachedServerStatus)
		}, 1000)
	}

	function scheduleStatsRefresh() {
		clearTimeout(statsRefreshTimer)
		statsRefreshTimer = setTimeout(function () {
			refreshPlayerStats(cachedServerStatus)
		}, 400)
	}

	async function refreshPlayerStats(serverStatus) {
		if (!playerStatsUserId || !window.IsnixAuth) return
		try {
			playerStats = await IsnixAuth.getPlayerStats(playerStatsUserId)
		} catch (_e) {
			playerStats = null
		}
		if (currentProfile) {
			currentProfile.id = playerStatsUserId
		}
		renderPlayerStats(currentProfile, playerStats, serverStatus)
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

	function profileFromSession(session) {
		return {
			id: session.user.id,
			email: session.user.email || null,
			minecraft_nick: null,
			display_name: null,
			role: 'player',
		}
	}

	function readProfileCache(userId) {
		try {
			var raw = sessionStorage.getItem('isnix_profile_' + userId)
			if (!raw) return null
			var o = JSON.parse(raw)
			if (!o || !o.p || Date.now() - o.t > PROFILE_CACHE_TTL_MS) return null
			o.p.id = userId
			return o.p
		} catch (_e) {
			return null
		}
	}

	function writeProfileCache(userId, profile) {
		if (!userId || !profile) return
		try {
			sessionStorage.setItem(
				'isnix_profile_' + userId,
				JSON.stringify({ p: profile, t: Date.now() }),
			)
		} catch (_e) {
			/* ignore */
		}
	}

	function readPlayerStatsCache(userId) {
		if (!userId) return null
		try {
			var raw = sessionStorage.getItem('isnix_player_stats_' + userId)
			if (!raw) return null
			var o = JSON.parse(raw)
			if (!o || !o.s || Date.now() - o.t > PROFILE_CACHE_TTL_MS) return null
			return o.s
		} catch (_e) {
			return null
		}
	}

	function writePlayerStatsCache(userId, stats) {
		if (!userId || !stats) return
		try {
			sessionStorage.setItem(
				'isnix_player_stats_' + userId,
				JSON.stringify({ s: stats, t: Date.now() }),
			)
		} catch (_e) {
			/* ignore */
		}
	}

	function readAppsCache(userId) {
		try {
			var raw = sessionStorage.getItem('isnix_apps_' + userId)
			if (!raw) return null
			var o = JSON.parse(raw)
			if (!o || !Array.isArray(o.a) || Date.now() - o.t > APPS_CACHE_TTL_MS) {
				return null
			}
			return o.a
		} catch (_e) {
			return null
		}
	}

	function writeAppsCache(userId, apps) {
		if (!userId || !apps) return
		try {
			sessionStorage.setItem(
				'isnix_apps_' + userId,
				JSON.stringify({ a: apps, t: Date.now() }),
			)
		} catch (_e) {
			/* ignore */
		}
	}

	function clearAppsCaches() {
		try {
			var keys = []
			for (var i = 0; i < sessionStorage.length; i++) {
				var k = sessionStorage.key(i)
				if (k && k.indexOf('isnix_apps_') === 0) keys.push(k)
			}
			keys.forEach(function (k) {
				sessionStorage.removeItem(k)
			})
		} catch (_e) {
			/* ignore */
		}
	}

	function clearProfileCaches() {
		try {
			var keys = []
			for (var i = 0; i < sessionStorage.length; i++) {
				var k = sessionStorage.key(i)
				if (
					k &&
					(k.indexOf('isnix_profile_') === 0 ||
						k.indexOf('isnix_player_stats_') === 0)
				) {
					keys.push(k)
				}
			}
			keys.forEach(function (k) {
				sessionStorage.removeItem(k)
			})
		} catch (_e) {
			/* ignore */
		}
	}

	function applyDashboardProfile(profile, session) {
		if (!profile || !session || !session.user) return
		profile.id = session.user.id
		if (!profile.email) profile.email = session.user.email
		currentProfile = profile
		playerStatsUserId = session.user.id
		applyProfileToForm(profile)
		updateDashAvatar(profile.minecraft_nick ? profile.minecraft_nick : '')
		updateProfileMeta(profile, cachedServerStatus)
		renderPlayerStats(profile, playerStats, cachedServerStatus)
		updateProfileNickHint()
		updateWhitelistHint()
		var isAdmin = IsnixAuth && IsnixAuth.isAdminProfile(profile)
		var wrap = document.querySelector('.auth-wrap')
		if (wrap) wrap.classList.toggle('auth-wrap--wide', isAdmin)
		var badge = document.getElementById('adminRoleBadge')
		if (badge) badge.hidden = !isAdmin
		var adminPanel = document.getElementById('adminPanel')
		if (adminPanel) adminPanel.hidden = !isAdmin
	}

	function showDashboardShell(session, profile) {
		showDashboard(session.user, profile)
		showConnectionNotice('')
		var list = document.getElementById('applicationsList')
		if (list) {
			list.innerHTML = '<p class="auth-muted">Загрузка заявок…</p>'
		}
	}

	function escapeHtml(s) {
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
	}

	function loadWhitelist() {
		if (whitelistPlayers) return Promise.resolve()
		if (whitelistLoadPromise) return whitelistLoadPromise
		whitelistLoadPromise = fetchWhitelistInner()
		return whitelistLoadPromise
	}

	async function fetchWhitelistInner() {
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
						return (
							e.name ||
							e.username ||
							e.player ||
							''
						).trim()
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
		var profileNickEl = document.getElementById('profileNick')
		var appNickEl = document.getElementById('appNick')
		syncWhitelistSectionVisibility(
			(profileNickEl && profileNickEl.value) || (appNickEl && appNickEl.value) || '',
		)
	}

	function isOnWhitelist(nick) {
		if (!whitelistPlayers || !nick) return false
		return whitelistPlayers.indexOf(String(nick).trim().toLowerCase()) !== -1
	}

	function hasApprovedApplication(apps, nick) {
		if (!apps || !apps.length || !nick) return false
		var low = String(nick).trim().toLowerCase()
		return apps.some(function (a) {
			return (
				a.status === 'approved' &&
				a.minecraft_nick &&
				String(a.minecraft_nick).trim().toLowerCase() === low
			)
		})
	}

	function whitelistAccessGranted(nick) {
		if (!nick || !IsnixAuth || !IsnixAuth.MC_NICK_RE.test(nick)) return false
		return isOnWhitelist(nick) || hasApprovedApplication(cachedApplications, nick)
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
		if (whitelistAccessGranted(v)) {
			hintEl.textContent = isOnWhitelist(v)
				? '✅ Этот ник в вайтлисте — можно заходить на сервер'
				: '✅ Заявка одобрена — можно заходить на сервер'
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
		var hide = !!(
			baseNick &&
			IsnixAuth.MC_NICK_RE.test(baseNick) &&
			whitelistAccessGranted(baseNick)
		)
		section.hidden = hide
		var okBanner = document.getElementById('profileWhitelistOk')
		if (okBanner) {
			okBanner.hidden = !hide
			if (hide) {
				okBanner.textContent = isOnWhitelist(baseNick)
					? 'Этот ник уже в вайтлисте — заявку заполнять не нужно, можно заходить на сервер.'
					: 'Заявка одобрена — заявку заполнять не нужно, можно заходить на сервер.'
			}
		}
	}

	function syncWhitelistFormState(nick) {
		var form = document.getElementById('whitelistForm')
		var note = document.getElementById('whitelistStateNote')
		if (!form) return

		var v = (nick || '').trim()
		var blocked = !!(v && IsnixAuth.MC_NICK_RE.test(v) && whitelistAccessGranted(v))

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
		if (whitelistAccessGranted(nick)) return false
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
		if (whitelistAccessGranted(nick)) {
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

	function deferAccountTask(fn, delayMs) {
		var run = function () {
			try {
				fn()
			} catch (_e) {
				/* ignore */
			}
		}
		if (typeof requestIdleCallback === 'function') {
			requestIdleCallback(run, { timeout: delayMs || 1200 })
		} else {
			setTimeout(run, delayMs || 200)
		}
	}

	function updateSiteDeviceBadge(profile) {
		var siteBadge = document.getElementById('profileSiteBadge')
		if (!siteBadge || !window.IsnixAuth) return
		var label = IsnixAuth.formatSiteDeviceLabel(IsnixAuth.detectSiteDevice())
		siteBadge.textContent = 'Сайт: ' + label
		siteBadge.hidden = false
		siteBadge.className = 'profile-badge profile-badge--site'
		if (profile && IsnixAuth.isSitePresenceOnline(profile)) {
			siteBadge.title = 'Активность на isnix.ru учтена'
		} else {
			siteBadge.title = 'Сейчас с ' + label.toLowerCase()
		}
	}

	function sitePresenceAdminTag(profile) {
		if (!window.IsnixAuth || !IsnixAuth.isSitePresenceOnline(profile)) return ''
		return (
			'<span class="auth-status auth-status--site">сайт · ' +
			escapeHtml(IsnixAuth.formatSiteDeviceLabel(profile.site_device)) +
			'</span>'
		)
	}

	function updateProfileMeta(profile, serverStatus) {
		var nameEl = document.getElementById('profileDisplayName')
		var nickLine = document.getElementById('profileNickDisplay')
		var wlBadge = document.getElementById('profileWlBadge')
		var onlineBadge = document.getElementById('profileOnlineBadge')
		updateSiteDeviceBadge(profile)
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
			} else if (whitelistAccessGranted(nick)) {
				wlBadge.textContent = isOnWhitelist(nick)
					? '✓ В вайтлисте'
					: '✓ Одобрено'
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
		if (status !== undefined) cachedServerStatus = status
		updateProfileMeta(currentProfile, status === undefined ? null : status)
		await refreshPlayerStats(status === undefined ? null : status)
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
		if (!IsnixAuth || !IsnixAuth.isAdminProfile(currentProfile)) return
		if (adminView === 'applications') {
			if (!adminListsLoaded.applications) {
				adminListsLoaded.applications = true
				renderAdminApplications()
			}
		} else if (adminView === 'server') {
			if (!adminListsLoaded.server) {
				adminListsLoaded.server = true
				renderAdminServerList()
			}
		} else if (adminView === 'users') {
			if (!adminListsLoaded.users) {
				adminListsLoaded.users = true
				renderAdminUsersList()
			}
		}
	}

	function playerNick(entry) {
		if (entry == null) return ''
		if (typeof entry === 'string' || typeof entry === 'number') {
			return String(entry).trim()
		}
		if (typeof entry === 'object') {
			return (
				entry.name_clean ||
				entry.name_raw ||
				entry.name ||
				entry.username ||
				''
			).trim()
		}
		return ''
	}

	function renderPlayerRow(nick, extraHtml) {
		var name = playerNick(nick)
		if (!name) return ''
		var safe = escapeHtml(name)
		var enc = encodeURIComponent(name)
		return (
			'<div class="auth-player-row">' +
			'<img class="auth-player-head" src="' +
			avatarUrl(name, 32) +
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
		if (!window.IsnixAuth || !IsnixAuth.isAdminProfile(currentProfile)) {
			list.innerHTML = ''
			return
		}
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
					.filter(Boolean)
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
		if (!window.IsnixAuth || !IsnixAuth.isAdminProfile(currentProfile)) {
			list.innerHTML = ''
			return
		}
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
					var role = IsnixAuth.isAdminProfile(p)
						? '<span class="auth-status auth-status--bad">админ</span>'
						: '<span class="auth-status auth-status--pending">игрок</span>'
					var mcOnline =
						p.minecraft_nick &&
						status &&
						IsnixServer.isPlayerOnline(p.minecraft_nick, status)
							? '<span class="auth-status auth-status--ok">MC</span>'
							: ''
					var siteTag = sitePresenceAdminTag(p)
					var meta =
						'<p class="auth-muted">' +
						escapeHtml(email) +
						' · ' +
						formatDate(p.created_at) +
						'</p>'
					var tags =
						'<div class="auth-player-tags">' +
						role +
						mcOnline +
						siteTag +
						'</div>'
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
		deferAccountTask(function () {
			refreshPlayerStatus(false)
		}, 800)
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
		dashboardEnterUserId = null
		dashboardEnterPromise = null
		dashboardLoading = false
		stopPlayerStatsTicker()
		playerStats = null
		playerStatsUserId = null
		cachedServerStatus = null
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
		if (user && user.id) {
			playerStatsUserId = user.id
			if (currentProfile) currentProfile.id = user.id
		}
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
		var cached = readAppsCache(userId)
		if (cached) {
			cachedApplications = cached
			paintApplicationsList(cached)
		} else {
			list.innerHTML = '<p class="auth-muted">Загрузка…</p>'
		}
		try {
			var apps = await IsnixAuth.getApplications(userId)
			cachedApplications = apps
			writeAppsCache(userId, apps)
			paintApplicationsList(apps)
			return apps
		} catch (err) {
			if (!cached) {
				cachedApplications = []
				list.innerHTML =
					'<p class="auth-message auth-message--err">' +
					escapeHtml(IsnixAuth.formatAuthError(err)) +
					'</p>'
			}
			return cached || []
		}
	}

	function applyProfileToForm(profile) {
		if (!profile) return
		var nick = document.getElementById('profileNick')
		var name = document.getElementById('profileCallName')
		if (nick && profile.minecraft_nick) nick.value = profile.minecraft_nick
		if (name && profile.display_name) name.value = profile.display_name
		var appNick = document.getElementById('appNick')
		if (appNick && profile.minecraft_nick && !appNick.value) {
			appNick.value = profile.minecraft_nick
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
					var applicantBlock = app.applicant_reply
						? '<div class="auth-dialog auth-dialog--user">' +
							'<p class="auth-dialog__label">Ответ игрока</p>' +
							'<p class="auth-dialog__body">' +
							escapeHtml(app.applicant_reply) +
							'</p></div>'
						: ''
					var prevAdminMsg =
						app.admin_note && app.status === 'pending'
							? '<div class="auth-dialog auth-dialog--admin">' +
								'<p class="auth-dialog__label">Уже отправлено игроку</p>' +
								'<p class="auth-dialog__body">' +
								escapeHtml(app.admin_note) +
								'</p></div>'
							: ''
					var noteValue = app.admin_note ? escapeHtml(app.admin_note) : ''
					var actions =
						app.status === 'pending'
							? '<div class="auth-admin-actions">' +
								prevAdminMsg +
								applicantBlock +
								'<label class="auth-dialog__label" for="admin-note-' +
								app.id +
								'">Сообщение игроку (диалог)</label>' +
								'<textarea id="admin-note-' +
								app.id +
								'" class="auth-admin-note" data-note-for="' +
								app.id +
								'" rows="4" placeholder="Задай вопрос: возраст, опыт, почему именно наш сервер…">' +
								noteValue +
								'</textarea>' +
								'<div class="auth-admin-btns">' +
								'<button type="button" class="auth-submit auth-submit--ghost auth-admin-message" data-id="' +
								app.id +
								'">Отправить сообщение</button>' +
								'<button type="button" class="auth-submit auth-admin-approve" data-id="' +
								app.id +
								'">Одобрить</button>' +
								'<button type="button" class="auth-submit auth-submit--ghost auth-admin-reject" data-id="' +
								app.id +
								'">Отклонить</button>' +
								'</div>' +
								'<p class="auth-hint">Сначала «Отправить сообщение» — игрок ответит в кабинете. Потом одобри или отклони.</p>' +
								'</div>'
							: app.admin_note
								? '<p class="auth-app-note"><strong>Комментарий:</strong> ' +
									escapeHtml(app.admin_note) +
									'</p>' +
									(applicantBlock || '')
								: applicantBlock || ''
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
			ensureAdminListDelegation()
		} catch (err) {
			list.innerHTML =
				'<p class="auth-message auth-message--err">' +
				escapeHtml(IsnixAuth.formatAuthError(err)) +
				'</p>'
		}
	}

	function ensureAdminListDelegation() {
		if (adminListDelegationBound) return
		var list = document.getElementById('adminApplicationsList')
		if (!list) return
		adminListDelegationBound = true
		list.addEventListener('click', function (e) {
			var msgBtn = e.target.closest('.auth-admin-message')
			var okBtn = e.target.closest('.auth-admin-approve')
			var noBtn = e.target.closest('.auth-admin-reject')
			if (msgBtn) {
				e.preventDefault()
				handleAdminMessage(msgBtn.dataset.id, msgBtn)
			} else if (okBtn) {
				e.preventDefault()
				handleModerate(okBtn.dataset.id, 'approved', okBtn)
			} else if (noBtn) {
				e.preventDefault()
				handleModerate(noBtn.dataset.id, 'rejected', noBtn)
			}
		})
	}

	function bindApplicantReplyForms(list) {
		if (!list) return
		list.querySelectorAll('.auth-app-reply-form').forEach(function (form) {
			form.addEventListener('submit', function (e) {
				e.preventDefault()
				var appId = form.getAttribute('data-reply-app')
				var ta = form.querySelector('textarea')
				handleApplicantReply(appId, ta ? ta.value : '')
			})
		})
	}

	function renderApplicationsHtml(apps) {
		if (!apps.length) {
			return '<p class="auth-muted">Заявок пока нет. Заполни форму ниже.</p>'
		}
		return apps
			.map(function (app) {
				var decision =
					app.status === 'approved'
						? '✅ Одобрено'
						: app.status === 'rejected'
							? '❌ Отклонено'
							: '⏳ На рассмотрении'
				var adminMsg = app.admin_note
					? '<div class="auth-dialog auth-dialog--admin">' +
						'<p class="auth-dialog__label">Сообщение от администрации</p>' +
						'<p class="auth-dialog__body">' +
						escapeHtml(app.admin_note) +
						'</p></div>'
					: ''
				var applicantMsg = app.applicant_reply
					? '<div class="auth-dialog auth-dialog--user">' +
						'<p class="auth-dialog__label">Твой ответ</p>' +
						'<p class="auth-dialog__body">' +
						escapeHtml(app.applicant_reply) +
						'</p></div>'
					: ''
				var replyForm =
					app.status === 'pending' && app.admin_note && !app.applicant_reply
						? '<form class="auth-app-reply-form" data-reply-app="' +
							app.id +
							'">' +
							'<label class="auth-dialog__label" for="reply-' +
							app.id +
							'">Ответить администрации</label>' +
							'<textarea id="reply-' +
							app.id +
							'" class="auth-admin-note" rows="3" maxlength="2000" required placeholder="Ответь на вопрос админа…"></textarea>' +
							'<button type="submit" class="auth-submit">Отправить ответ</button>' +
							'</form>'
						: ''
				var note =
					app.status !== 'pending' && app.admin_note
						? '<p class="auth-app-note"><strong>Решение:</strong> ' +
							escapeHtml(app.admin_note) +
							'</p>'
						: ''
				var timeline =
					'<ul class="auth-muted" style="margin:0.5rem 0 0.75rem;padding-left:1.1rem">' +
					'<li>Заявка отправлена — ' +
					escapeHtml(formatDate(app.created_at)) +
					'</li>' +
					'<li>Статус: <strong>' +
					escapeHtml(decision) +
					'</strong></li>' +
					'</ul>'
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
					timeline +
					'<p class="auth-app-reason"><strong>Заявка:</strong> ' +
					escapeHtml(app.reason) +
					'</p>' +
					adminMsg +
					applicantMsg +
					replyForm +
					note +
					'</article>'
				)
			})
			.join('')
	}

	function paintApplicationsList(apps) {
		var list = document.getElementById('applicationsList')
		if (!list) return
		list.innerHTML = renderApplicationsHtml(apps)
		bindApplicantReplyForms(list)
		syncWhitelistSectionVisibility(
			document.getElementById('profileNick')
				? document.getElementById('profileNick').value
				: '',
		)
	}

	function bootstrapFromLocalSession() {
		if (!window.IsnixAuth || !IsnixAuth.readStoredSession) return false
		var session = IsnixAuth.readStoredSession()
		if (!session || !session.user) return false

		var userId = session.user.id
		var profile = readProfileCache(userId) || profileFromSession(session)
		var quickStats = readPlayerStatsCache(userId)
		playerStats = quickStats
		playerStatsUserId = userId
		showDashboardShell(session, profile)
		applyDashboardProfile(profile, session)
		if (quickStats) {
			renderPlayerStats(profile, quickStats, cachedServerStatus)
		}
		startPlayerStatsTicker()
		loadWhitelist()

		var cachedApps = readAppsCache(userId)
		if (cachedApps) {
			cachedApplications = cachedApps
			paintApplicationsList(cachedApps)
		}

		cachedServerStatus = null
		if (window.IsnixServer) {
			IsnixServer.fetchStatus(false).then(function (status) {
				if (status !== undefined) {
					cachedServerStatus = status
					updateProfileMeta(currentProfile, status)
					renderPlayerStats(currentProfile, playerStats, status)
				}
			})
		}
		return true
	}

	async function handleApplicantReply(appId, text) {
		try {
			await IsnixAuth.submitApplicantReply(appId, text)
			showMsg('Ответ отправлен. Ожидай решения администрации.', true)
			var session = await IsnixAuth.getSession()
			if (session) await renderApplications(session.user.id)
		} catch (err) {
			showMsg(IsnixAuth.formatAuthError(err), false)
		}
	}

	function adminActionKey(kind, id) {
		return kind + ':' + id
	}

	function setAdminActionLoading(btn, loading) {
		if (!btn) return
		var wrap = btn.closest('.auth-admin-actions')
		if (!wrap) return
		wrap.querySelectorAll('button').forEach(function (b) {
			b.disabled = loading
		})
	}

	async function handleAdminMessage(id, btn) {
		var key = adminActionKey('msg', id)
		if (adminActionInFlight[key]) {
			showMsg('Уже отправляется… подожди.', false)
			return
		}
		var noteEl = document.querySelector('[data-note-for="' + id + '"]')
		var note = noteEl ? noteEl.value : ''
		adminActionInFlight[key] = true
		setAdminActionLoading(btn, true)
		try {
			await IsnixAuth.sendAdminApplicationMessage(id, note)
			showMsg(
				'Сообщение отправлено. Игрок увидит его в разделе «Мои заявки».',
				true,
			)
			await renderAdminApplications()
		} catch (err) {
			showMsg(IsnixAuth.formatAuthError(err), false)
		} finally {
			delete adminActionInFlight[key]
			setAdminActionLoading(btn, false)
		}
	}

	async function handleModerate(id, status, btn) {
		var key = adminActionKey('mod', id)
		if (adminActionInFlight[key]) {
			showMsg('Заявка уже обрабатывается… не жми кнопку повторно.', false)
			return
		}
		var noteEl = document.querySelector('[data-note-for="' + id + '"]')
		var note = noteEl ? noteEl.value : ''
		adminActionInFlight[key] = true
		setAdminActionLoading(btn, true)
		showMsg('Отправка… не закрывай страницу.', true)
		try {
			await IsnixAuth.moderateApplication(id, status, note)
			showMsg(
				status === 'approved'
					? 'Заявка одобрена. Добавь ник в whitelist на сервере.'
					: 'Заявка отклонена.',
				true,
			)
			await loadWhitelist()
			await renderAdminApplications()
			var session = await IsnixAuth.getSession()
			if (session) await renderApplications(session.user.id)
		} catch (err) {
			showMsg(IsnixAuth.formatAuthError(err), false)
		} finally {
			delete adminActionInFlight[key]
			setAdminActionLoading(btn, false)
		}
	}

	async function loadDashboard(session) {
		if (!session || !session.user) return
		var userId = session.user.id

		if (dashboardEnterPromise && dashboardEnterUserId === userId) {
			return dashboardEnterPromise
		}

		dashboardEnterUserId = userId
		dashboardEnterPromise = (async function () {
			dashboardLoading = true

			var quickProfile = readProfileCache(userId) || profileFromSession(session)
			var quickStats = readPlayerStatsCache(userId)
			playerStats = quickStats
			showDashboardShell(session, quickProfile)
			applyDashboardProfile(quickProfile, session)
			if (quickStats) {
				renderPlayerStats(quickProfile, quickStats, cachedServerStatus)
			}
			startPlayerStatsTicker()
			loadWhitelist()

			var profileErr = null

			Promise.all([
				IsnixAuth.getProfile(userId),
				IsnixAuth.getPlayerStats(userId).catch(function () {
					return null
				}),
			])
				.then(function (profileRes) {
					var profile = profileRes[0]
					playerStats = profileRes[1]
					writePlayerStatsCache(userId, playerStats)

					if (profile && session.user.email) {
						profile.email = profile.email || session.user.email
					} else if (!profile) {
						profile = profileFromSession(session)
					}
					writeProfileCache(userId, profile)
					applyDashboardProfile(profile, session)

					if (IsnixAuth.isAdminProfile(profile)) {
						deferAccountTask(function () {
							switchAdminView(adminView)
						}, 150)
					}
					deferAccountTask(function () {
						refreshPlayerStatus(false)
					}, 80)
					startStatusPolling()
				})
				.catch(function (e) {
					profileErr = e
					showProfileLoadError(e)
				})

			renderApplications(userId)
				.then(function () {
					updateProfileNickHint()
					updateWhitelistHint()
				})
				.catch(function (e) {
					var list = document.getElementById('applicationsList')
					if (list) {
						list.innerHTML =
							'<p class="auth-message auth-message--err">' +
							escapeHtml(IsnixAuth.formatAuthError(e)) +
							'</p>'
					}
					if (!profileErr) {
						showConnectionNotice(
							'Заявки: ' + IsnixAuth.formatAuthError(e),
						)
					}
				})
		})().finally(function () {
			dashboardLoading = false
			if (dashboardEnterUserId === userId) {
				dashboardEnterPromise = null
			}
		})

		return dashboardEnterPromise
	}

	function scheduleOnSession(session) {
		clearTimeout(onSessionTimer)
		onSessionTimer = setTimeout(function () {
			runOnSession(session)
		}, 0)
	}

	async function runOnSession(session) {
		if (!session || !session.user) {
			currentProfile = null
			dashboardLoading = false
			dashboardEnterUserId = null
			dashboardEnterPromise = null
			showConnectionNotice('')
			showGuest()
			return
		}

		if (
			dashboard &&
			!dashboard.hidden &&
			dashboardEnterUserId === session.user.id &&
			!dashboardLoading &&
			!dashboardEnterPromise
		) {
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
		loadWhitelist()

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

		ensureAdminListDelegation()

		var loginForm = document.getElementById('loginForm')
		if (loginForm) {
			loginForm.addEventListener('submit', async function (e) {
				e.preventDefault()
				setLoading(loginForm, true)
				showMsg('', true)
				try {
					var loginData = await IsnixAuth.signIn(
						document.getElementById('loginEmail').value.trim(),
						document.getElementById('loginPassword').value,
					)
					showMsg('Вы вошли в аккаунт', true)
					if (loginData && loginData.session) {
						await loadDashboard(loginData.session)
					}
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
						await loadDashboard(data.session)
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
				clearProfileCaches()
				clearAppsCaches()
				showMsg('Вы вышли', true)
				showGuest()
			})
		}

		var profileForm = document.getElementById('profileForm')
		var profileNick = document.getElementById('profileNick')
		if (profileNick) {
			profileNick.addEventListener('input', function () {
				updateProfileNickHint()
				syncWhitelistSectionVisibility(profileNick.value)
				scheduleStatsRefresh()
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
						id: session.user.id,
						email: session.user.email,
						minecraft_nick: nick || null,
						display_name: callName,
						role: currentProfile ? currentProfile.role : 'player',
						created_at: currentProfile ? currentProfile.created_at : null,
					}
					writeProfileCache(session.user.id, currentProfile)
					await loadWhitelist()
					updateProfileNickHint()
					updateDashAvatar(nick)
					renderPlayerStats(currentProfile, playerStats, cachedServerStatus)
					await refreshPlayerStatus()
					var appNickEl = document.getElementById('appNick')
					var appCallEl = document.getElementById('appCallName')
					if (appNickEl && nick) appNickEl.value = nick
					if (appCallEl && callName) appCallEl.value = callName
					updateWhitelistHint()

					if (nick && whitelistAccessGranted(nick)) {
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
					dashboardEnterUserId = null
					dashboardEnterPromise = null
					await loadDashboard(session)
				} catch (err) {
					showConnectionNotice(IsnixAuth.formatAuthError(err))
					showMsg(IsnixAuth.formatAuthError(err), false)
				}
			})
		}

		try {
			var booted = bootstrapFromLocalSession()
			if (!booted) showGuest()

			IsnixAuth.onAuthStateChange(scheduleOnSession)

			var session = await IsnixAuth.getSession()
			if (!session) {
				if (booted) showGuest()
				return
			}
			await runOnSession(session)
		} catch (err) {
			showMsg(IsnixAuth.formatAuthError(err), false)
			showGuest()
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init)
	} else {
		init()
	}
})()
