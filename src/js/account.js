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
	var APPS_PAGE_SIZE = 5
	var playerAppsPage = 1
	var adminAppsPage = 1
	var adminView = 'applications'
	var playerStats = null
	var playerStatsUserId = null
	var playerReputation = null
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
	var cachedNotifications = []
	var notificationsPollTimer = null
	var notificationsRealtimeUnsub = null
	var notificationsRealtimeOk = false
	var seenNotificationIds = {}
	var NOTIFICATIONS_POLL_MS = 90000
	var NOTIFICATIONS_POLL_FAST_MS = 20000
	var notificationsUiBound = false
	var adminPendingPollTimer = null
	var ADMIN_PENDING_POLL_MS = 60000
	var AFTER_LOGIN_KEY = 'isnix_after_login'

	function consumeAfterLoginRedirect() {
		try {
			var url = sessionStorage.getItem(AFTER_LOGIN_KEY)
			if (!url || url.indexOf('appeals.html') === -1) return false
			sessionStorage.removeItem(AFTER_LOGIN_KEY)
			window.location.href = url
			return true
		} catch (_e) {
			return false
		}
	}

	function showMsg(text, ok) {
		if (window.IsnixToast) {
			if (!text) IsnixToast.hideAll()
			else IsnixToast.show(text, ok ? 'ok' : 'err')
		}
		if (!authMsg) return
		authMsg.textContent = text
		authMsg.className =
			'auth-message' + (ok ? ' auth-message--ok' : ' auth-message--err')
		authMsg.hidden = !text
	}

	function hasUsableProfileCache(userId) {
		var p =
			currentProfile ||
			(userId && readProfileCache(userId)) ||
			(userId &&
				window.IsnixAuth &&
				IsnixAuth.getProfileDiskCache &&
				IsnixAuth.getProfileDiskCache(userId))
		return !!(p && (p.minecraft_nick || p.display_name || p.login || p.email))
	}

	function showProfileLoadError(err, userId) {
		if (hasUsableProfileCache(userId)) {
			showConnectionNotice(
				'Сейчас не удалось обновить профиль с Supabase — на экране сохранённые данные. Заявки и ник могут подтянуться с задержкой.\n\n' +
					(IsnixAuth.networkHelpText ? IsnixAuth.networkHelpText() : ''),
			)
			return
		}
		var base =
			'Профиль не загрузился: ' + IsnixAuth.formatAuthError(err)
		if (!IsnixAuth.probeSupabaseReachability) {
			showConnectionNotice(base + '\n\nНажми «Повторить загрузку».')
			return
		}
		IsnixAuth.probeSupabaseReachability().then(function (probe) {
			if (probe.ok) {
				showConnectionNotice(
					base +
						'\n\nСвязь с api.isnix.ru в браузере есть, но профиль не загрузился — обнови страницу или попробуй позже.',
				)
				return
			}
			if (probe.reason === 'no_config') {
				showConnectionNotice(
					'На сайте не подключён ключ Supabase. Нужен секрет SUPABASE_ANON_KEY и деплой Pages.',
				)
				return
			}
			var help =
				window.IsnixAuth && IsnixAuth.networkHelpText
					? IsnixAuth.networkHelpText()
					: ''
			showConnectionNotice(base + '\n\n' + help)
		})
	}

	async function runConnectionDiagnostic() {
		if (!window.IsnixAuth || !IsnixAuth.probeSupabaseReachability) return
		showConnectionNotice('Проверяем связь с кабинетом…')
		try {
			var probe = await IsnixAuth.probeSupabaseReachability()
			if (probe.ok) {
				showConnectionNotice(
					'Связь есть (код ' +
						probe.status +
						'). Нажми «Повторить загрузку». Если профиль снова не грузится — SQL: docs/supabase-fix-connection.sql',
				)
				if (window.IsnixAuth.clearSupabaseBackoff) {
					IsnixAuth.clearSupabaseBackoff()
				}
				return
			}
			showConnectionNotice(
				'Браузер не достучался до api.isnix.ru (кабинет).\n\n' +
					(IsnixAuth.networkHelpText ? IsnixAuth.networkHelpText() : ''),
			)
		} catch (e) {
			showConnectionNotice(
				'Ошибка проверки: ' +
					IsnixAuth.formatAuthError(e) +
					'\n\n' +
					(IsnixAuth.networkHelpText ? IsnixAuth.networkHelpText() : ''),
			)
		}
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

	function syncPasswordFormUsername(username) {
		var el = document.getElementById('passwordFormUsername')
		if (el) el.value = username || ''
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
		if (window.IsnixAuth && IsnixAuth.elySkinUrl) {
			return IsnixAuth.elySkinUrl(nick)
		}
		if (window.IsnixAuth && IsnixAuth.elySkinProxyBase) {
			return IsnixAuth.elySkinProxyBase() + encodeURIComponent((nick || '').trim()) + '.png'
		}
		return (
			'https://sparkling-river-2d30.kudrasovn024.workers.dev/ely/skin/' +
			encodeURIComponent((nick || '').trim()) +
			'.png'
		)
	}

	function avatarFallbackUrl(nick, size) {
		if (window.IsnixAuth && IsnixAuth.mcHeadAvatarFallbackUrl) {
			return IsnixAuth.mcHeadAvatarFallbackUrl(nick, size)
		}
		return (
			'https://mc-heads.net/avatar/' +
			encodeURIComponent((nick || '').trim()) +
			'/' +
			(size || 48)
		)
	}

	function playerHeadHtml(name, size) {
		var s = size || 32
		var safe = escapeHtml(name)
		return (
			'<span class="ely-head-wrap auth-player-head-wrap" style="width:' +
			s +
			'px;height:' +
			s +
			'px">' +
			'<img class="auth-player-head" alt="" loading="eager" decoding="async" data-ely-nick="' +
			safe +
			'" data-ely-size="' +
			s +
			'" />' +
			'</span>'
		)
	}

	function hydratePlayerHeads(root) {
		if (!root || !window.IsnixAuth || !IsnixAuth.applyElyHeadToImg) return
		root.querySelectorAll('img[data-ely-nick]').forEach(function (img) {
			if (img.dataset.elyHydrated === '1') return
			img.dataset.elyHydrated = '1'
			IsnixAuth.applyElyHeadToImg(
				img,
				img.getAttribute('data-ely-nick'),
				Number(img.getAttribute('data-ely-size')) || 32,
			)
		})
	}

	function applyAvatarToElement(img, fallback, nick, size) {
		if (!img || !fallback) return
		var v = (nick || '').trim()
		var px = size || 48
		if (v && IsnixAuth && IsnixAuth.MC_NICK_RE.test(v)) {
			if (IsnixAuth.applyElyHeadToImg) {
				IsnixAuth.applyElyHeadToImg(img, v, px)
			} else {
				img.src = avatarUrl(v, px)
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

	function updateProfileHeroAvatar(nick) {
		applyAvatarToElement(
			document.getElementById('profileHeroAvatar'),
			document.getElementById('profileHeroAvatarFb'),
			nick,
			96,
		)
	}

	function updateProfileAvatars(nick) {
		updateProfileHeroAvatar(nick)
	}

	var ACCOUNT_MODE_KEY = 'isnix_account_mode'

	function resolveInitialAccountMode() {
		var h = (window.location.hash || '').replace(/^#/, '')
		if (h === 'admin-support' || h.indexOf('admin') === 0) return 'admin'
		try {
			var stored = sessionStorage.getItem(ACCOUNT_MODE_KEY)
			if (stored === 'admin' || stored === 'profile') return stored
		} catch (_e) {
			/* ignore */
		}
		return 'profile'
	}

	function setAccountMode(mode, opts) {
		opts = opts || {}
		var isAdmin = IsnixAuth && IsnixAuth.isAdminProfile(currentProfile)
		if (!isAdmin) mode = 'profile'
		mode = mode === 'admin' ? 'admin' : 'profile'

		var modeNav = document.getElementById('accountModeNav')
		var profileZone = document.getElementById('accountProfileZone')
		var adminZone = document.getElementById('accountAdminZone')
		var adminPanel = document.getElementById('adminPanel')

		if (modeNav) modeNav.hidden = !isAdmin
		if (profileZone) profileZone.hidden = isAdmin && mode === 'admin'
		if (adminZone) adminZone.hidden = !isAdmin || mode !== 'admin'
		if (adminPanel) adminPanel.hidden = !isAdmin

		document.querySelectorAll('[data-account-mode]').forEach(function (btn) {
			var on = btn.dataset.accountMode === mode
			btn.classList.toggle('active', on)
			btn.setAttribute('aria-selected', on ? 'true' : 'false')
		})

		var wrap = document.querySelector('.auth-wrap')
		if (wrap) wrap.classList.toggle('auth-wrap--wide', isAdmin && mode === 'admin')

		if (!opts.skipStore) {
			try {
				sessionStorage.setItem(ACCOUNT_MODE_KEY, mode)
			} catch (_e) {
				/* ignore */
			}
		}

		if (mode === 'admin' && isAdmin) {
			switchAdminView(adminView || 'applications')
		}
	}

	function initAccountModeNav() {
		var nav = document.getElementById('accountModeNav')
		if (!nav || nav.dataset.bound) return
		nav.dataset.bound = '1'
		nav.addEventListener('click', function (e) {
			var btn = e.target.closest('[data-account-mode]')
			if (!btn) return
			setAccountMode(btn.dataset.accountMode)
		})
	}

	function updateProfileWlStatusLine(profile) {
		var el = document.getElementById('profileWlStatusLine')
		if (!el) return
		if (IsnixAuth && IsnixAuth.isAdminProfile(profile || currentProfile)) {
			el.hidden = true
			return
		}
		var nick =
			profile && profile.minecraft_nick ? profile.minecraft_nick.trim() : ''
		if (!nick || !IsnixAuth || !IsnixAuth.MC_NICK_RE.test(nick)) {
			el.textContent =
				'Укажи ник Minecraft в настройках ниже, чтобы подать заявку в вайтлист.'
			el.className = 'profile-wl-status auth-hint auth-hint--warn'
			el.hidden = false
			return
		}
		if (whitelistAccessGranted(nick)) {
			el.textContent = 'Можно заходить на mc.isnix.ru — ты в вайтлисте.'
			el.className = 'profile-wl-status auth-hint auth-hint--ok'
			el.hidden = false
			return
		}
		if (hasPendingApplication(cachedApplications)) {
			el.textContent =
				'Заявка в вайтлист на рассмотрении — обычно отвечаем в течение часа.'
			el.className = 'profile-wl-status auth-hint'
			el.hidden = false
			return
		}
		el.textContent = 'Подай заявку в вайтлист ниже, чтобы зайти на сервер.'
		el.className = 'profile-wl-status auth-hint auth-hint--warn'
		el.hidden = false
	}

	function refreshProfileDashboardHints(profile) {
		updateProfileWlStatusLine(profile || currentProfile)
	}

	function showNotificationsUi() {
		var wrap = document.getElementById('notificationsWrap')
		if (wrap) wrap.hidden = false
	}

	function hideNotificationsUi() {
		var wrap = document.getElementById('notificationsWrap')
		if (wrap) wrap.hidden = true
		closeNotificationsModal()
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

	function parseRepData(data) {
		if (!data) return null
		if (typeof data === 'string') {
			try {
				data = JSON.parse(data)
			} catch (_e) {
				return null
			}
		}
		if (data.ok === false) return null
		return {
			score: Number(data.score) || 0,
			likes: Number(data.likes) || 0,
			dislikes: Number(data.dislikes) || 0,
			nick: data.nick || '',
		}
	}

	function renderPlayerReputation(profile, rep) {
		var block = document.getElementById('profileRepScoreBlock')
		var scoreEl = document.getElementById('profileRepScore')
		var metaEl = document.getElementById('profileRepMeta')
		var hintEl = document.getElementById('profileRepHint')
		var form = document.getElementById('repVoteForm')
		var nick =
			profile && profile.minecraft_nick ? profile.minecraft_nick.trim() : ''

		if (!hintEl) return

		if (!nick) {
			if (block) block.hidden = true
			if (form) form.hidden = true
			hintEl.hidden = false
			hintEl.textContent =
				'Укажи Minecraft-ник в настройках профиля — тогда появится рейтинг и можно ставить лайки и дизлайки.'
			return
		}

		if (rep === undefined) {
			if (block) block.hidden = true
			if (form) form.hidden = true
			hintEl.hidden = false
			hintEl.textContent = 'Загрузка рейтинга…'
			return
		}

		if (rep === null) {
			if (block) block.hidden = true
			if (form) form.hidden = true
			hintEl.hidden = false
			hintEl.textContent =
				'Рейтинг пока недоступен. Нужен SQL из docs/supabase-player-reputation.sql в Supabase.'
			return
		}

		hintEl.hidden = true
		if (block) block.hidden = false
		if (form) form.hidden = false
		if (scoreEl) {
			if (typeof isnixRepScoreHtml === 'function') {
				scoreEl.innerHTML = isnixRepScoreHtml(rep.score)
			} else {
				scoreEl.textContent = String(rep.score)
			}
			scoreEl.classList.toggle('profile-reputation-score__value--pos', rep.score > 0)
			scoreEl.classList.toggle('profile-reputation-score__value--neg', rep.score < 0)
		}
		if (metaEl) {
			if (typeof isnixRepMetaHtml === 'function') {
				metaEl.innerHTML = isnixRepMetaHtml(rep.likes, rep.dislikes || 0)
			} else {
				metaEl.textContent = rep.likes + (rep.dislikes > 0 ? ' / ' + rep.dislikes : '')
			}
		}
	}

	async function loadPlayerReputation(profile) {
		var nick =
			profile && profile.minecraft_nick ? profile.minecraft_nick.trim() : ''
		renderPlayerReputation(profile, undefined)
		if (!nick || !IsnixAuth || !IsnixAuth.getReputation) {
			renderPlayerReputation(profile, null)
			return
		}
		try {
			var raw = await IsnixAuth.getReputation(nick)
			playerReputation = parseRepData(raw)
			renderPlayerReputation(profile, playerReputation)
		} catch (_e) {
			renderPlayerReputation(profile, null)
		}
	}

	function setRepVoteMsg(text, ok) {
		var el = document.getElementById('profileRepVoteMsg')
		if (!el) return
		el.hidden = !text
		el.textContent = text || ''
		el.className =
			'auth-hint' + (ok ? ' auth-hint--ok' : text ? ' auth-hint--err' : '')
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
		var email = session && session.user ? session.user.email || '' : ''
		var login = null
		var m = String(email).match(/^([a-z0-9_]{3,24})@isnix\.invalid$/i)
		if (m) login = m[1].toLowerCase()
		return {
			id: session.user.id,
			email: session.user.email || null,
			login: login,
			minecraft_nick: null,
			display_name: null,
			role: 'player',
		}
	}

	function readProfileCache(userId) {
		try {
			var raw = sessionStorage.getItem('isnix_profile_' + userId)
			if (raw) {
				var o = JSON.parse(raw)
				if (o && o.p && Date.now() - o.t <= PROFILE_CACHE_TTL_MS) {
					o.p.id = userId
					return o.p
				}
			}
		} catch (_e) {
			/* ignore */
		}
		if (
			window.IsnixAuth &&
			IsnixAuth.getProfileDiskCache
		) {
			return IsnixAuth.getProfileDiskCache(userId)
		}
		return null
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

	function updatePlayerApplicationSections(profile) {
		var isAdmin = IsnixAuth && IsnixAuth.isAdminProfile(profile || currentProfile)
		var appsSection = document.getElementById('applications')
		var wlSection = document.getElementById('whitelist')
		if (appsSection) appsSection.hidden = isAdmin
		if (wlSection && isAdmin) wlSection.hidden = true
	}

	function applyDashboardProfile(profile, session) {
		if (!profile || !session || !session.user) return
		profile.id = session.user.id
		if (!profile.email) profile.email = session.user.email
		currentProfile = profile
		playerStatsUserId = session.user.id
		applyProfileToForm(profile)
		updateProfileAvatars(profile.minecraft_nick ? profile.minecraft_nick : '')
		updateProfileMeta(profile, cachedServerStatus)
		renderPlayerStats(profile, playerStats, cachedServerStatus)
		loadPlayerReputation(profile)
		renderReferralPanel(profile)
		updateProfileNickHint()
		updatePlayerApplicationSections(profile)
		updateWhitelistHint()
		refreshProfileDashboardHints(profile)
		var isAdmin = IsnixAuth && IsnixAuth.isAdminProfile(profile)
		setAccountMode(resolveInitialAccountMode(), { skipStore: true })
	}

	function showDashboardShell(session, profile) {
		showDashboard(session.user, profile)
		showConnectionNotice('')
		updatePlayerApplicationSections(profile)
		var list = document.getElementById('applicationsList')
		if (list && !(IsnixAuth && IsnixAuth.isAdminProfile(profile))) {
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

	function normalizeApplicationsList(data) {
		if (!data) return []
		if (data.applications && Array.isArray(data.applications)) {
			return data.applications
		}
		return Array.isArray(data) ? data : []
	}

	function hasPendingApplication(apps) {
		apps = normalizeApplicationsList(apps)
		if (!apps.length) return false
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
			var okMsg = isOnWhitelist(v)
				? 'Этот ник в вайтлисте — можно заходить на сервер'
				: 'Заявка одобрена — можно заходить на сервер'
			if (typeof isnixSetStatus === 'function') {
				isnixSetStatus(hintEl, okMsg, true)
			} else {
				hintEl.textContent = okMsg
			}
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
			section.hidden = true
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
		updateProfileWlStatusLine(currentProfile)
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
				list = normalizeApplicationsList(
					await IsnixAuth.getApplications(userId),
				)
			} catch (_e) {
				list = []
			}
		} else {
			list = normalizeApplicationsList(list)
		}
		if (hasPendingApplication(list)) return false
		openWhitelistModal(nick, callName)
		return true
	}

	function collectWhitelistFormData(isModal) {
		var nickEl = document.getElementById(isModal ? 'modalAppNick' : 'appNick')
		var ageEl = document.getElementById(isModal ? 'modalAppAge' : 'appAge')
		var callEl = document.getElementById(isModal ? 'modalAppCallName' : 'appCallName')
		var rulesEl = document.getElementById(isModal ? 'modalAppReadRules' : 'appReadRules')
		var packEl = document.getElementById(
			isModal ? 'modalAppDownloadedModpack' : 'appDownloadedModpack',
		)
		var refEl = document.getElementById(isModal ? 'modalAppReferral' : 'appReferral')
		var referredByEl = document.getElementById(
			isModal ? 'modalAppReferredBy' : 'appReferredBy',
		)
		var aboutEl = document.getElementById(isModal ? 'modalAppReason' : 'appReason')
		return {
			minecraft_nick: nickEl ? nickEl.value.trim() : '',
			age: ageEl ? ageEl.value : '',
			call_name: callEl ? callEl.value.trim() : '',
			read_rules: rulesEl ? rulesEl.checked : false,
			downloaded_modpack: packEl ? packEl.checked : false,
			referral_source: refEl ? refEl.value.trim() : '',
			referred_by_nick: referredByEl ? referredByEl.value.trim() : '',
			reason: aboutEl ? aboutEl.value.trim() : '',
		}
	}

	function applyReferralFromUrl() {
		var params = new URLSearchParams(window.location.search)
		var ref = (params.get('ref') || '').trim()
		if (!ref || !IsnixAuth || !IsnixAuth.MC_NICK_RE.test(ref)) return
		;['appReferredBy', 'modalAppReferredBy'].forEach(function (id) {
			var el = document.getElementById(id)
			if (el && !el.value.trim()) el.value = ref
		})
	}

	function buildReferralShareUrl(nick) {
		var base = window.location.origin + window.location.pathname
		return base + '?ref=' + encodeURIComponent(nick)
	}

	async function renderReferralPanel(profile) {
		var hint = document.getElementById('profileReferralHint')
		var linkWrap = document.getElementById('profileReferralLinkWrap')
		var statsWrap = document.getElementById('profileReferralStats')
		var countsEl = document.getElementById('profileReferralCounts')
		var linkInput = document.getElementById('profileReferralLink')
		var copyBtn = document.getElementById('profileReferralCopyBtn')
		if (!hint) return

		var nick = profile && profile.minecraft_nick ? profile.minecraft_nick.trim() : ''
		if (!nick || !IsnixAuth.MC_NICK_RE.test(nick)) {
			if (linkWrap) linkWrap.hidden = true
			if (statsWrap) statsWrap.hidden = true
			hint.hidden = false
			hint.textContent =
				'Укажи ник Minecraft в профиле — появится персональная ссылка для друга.'
			return
		}

		hint.hidden = true
		if (linkWrap) linkWrap.hidden = false
		if (linkInput) linkInput.value = buildReferralShareUrl(nick)

		if (copyBtn && !copyBtn.dataset.bound) {
			copyBtn.dataset.bound = '1'
			copyBtn.addEventListener('click', function () {
				var url = linkInput ? linkInput.value : ''
				copyTextToClipboard(url, { inputEl: linkInput })
					.then(function () {
						showMsg('Ссылка скопирована — отправь другу', true)
						var prev = copyBtn.textContent
						copyBtn.textContent = 'Скопировано'
						setTimeout(function () {
							copyBtn.textContent = prev
						}, 2000)
					})
					.catch(function () {
						if (linkInput) {
							linkInput.focus()
							linkInput.select()
						}
						showMsg(
							'Не удалось скопировать автоматически — выдели ссылку и нажми Ctrl+C',
							false,
						)
					})
			})
		}
		if (linkInput && !linkInput.dataset.boundSelect) {
			linkInput.dataset.boundSelect = '1'
			linkInput.addEventListener('click', function () {
				linkInput.select()
				try {
					linkInput.setSelectionRange(0, linkInput.value.length)
				} catch (_selErr) {
					/* ignore */
				}
			})
		}

		if (!window.IsnixAuth || !IsnixAuth.getReferralSummary) {
			if (statsWrap) statsWrap.hidden = true
			return
		}

		try {
			var summary = await IsnixAuth.getReferralSummary()
			if (summary && summary.missing) {
				if (statsWrap) statsWrap.hidden = true
				hint.hidden = false
				hint.textContent =
					'Счётчик рефералов временно недоступен — админ выполнит SQL в Supabase (docs/referral-system-ru.md). Ссылка для друга работает.'
				return
			}
			if (summary && summary.ok && statsWrap && countsEl) {
				statsWrap.hidden = false
				var q = summary.qualified || 0
				var p = summary.pending || 0
				var r = summary.rewarded || 0
				countsEl.textContent =
					'Одобрено друзей: ' +
					q +
					(p ? ' · на рассмотрении: ' + p : '') +
					(r ? ' · награда выдана: ' + r : '')
			}
		} catch (_e) {
			if (statsWrap) statsWrap.hidden = true
		}
	}

	function copyTextToClipboard(text, opts) {
		var value = String(text || '').trim()
		if (!value) return Promise.reject(new Error('Пусто'))
		opts = opts || {}

		function tryExecCommand(inputEl) {
			return new Promise(function (resolve, reject) {
				var ta = null
				try {
					if (inputEl && typeof inputEl.select === 'function') {
						inputEl.focus()
						inputEl.select()
						try {
							inputEl.setSelectionRange(0, value.length)
						} catch (_rangeErr) {
							/* ignore */
						}
					} else {
						ta = document.createElement('textarea')
						ta.value = value
						ta.setAttribute('readonly', 'readonly')
						ta.style.position = 'fixed'
						ta.style.top = '0'
						ta.style.left = '0'
						ta.style.width = '2em'
						ta.style.height = '2em'
						ta.style.opacity = '0'
						document.body.appendChild(ta)
						ta.focus()
						ta.select()
					}
					if (document.execCommand('copy')) resolve()
					else reject(new Error('copy failed'))
				} catch (err) {
					reject(err)
				} finally {
					if (ta && ta.parentNode) ta.parentNode.removeChild(ta)
				}
			})
		}

		function tryClipboardApi() {
			if (navigator.clipboard && navigator.clipboard.writeText) {
				return navigator.clipboard.writeText(value)
			}
			return Promise.reject(new Error('no clipboard api'))
		}

		var chain =
			window.IsnixCompat && IsnixCompat.copyText
				? IsnixCompat.copyText(value)
				: tryClipboardApi()

		return chain
			.catch(function () {
				return tryExecCommand(opts.inputEl)
			})
			.catch(function () {
				return tryExecCommand(null)
			})
	}

	function applicationAdminWarnings(app) {
		if (!app) return ''
		var items = []
		var age = parseInt(String(app.age || '').trim(), 10)
		if (!Number.isFinite(age) || age < 12) {
			items.push('Возраст не указан или меньше 12')
		}
		if (app.read_rules === false) items.push('Не отметил правила')
		if (app.downloaded_modpack === false) items.push('Не отметил сборку')
		if (!items.length) return ''
		return (
			'<ul class="auth-admin-warn">' +
			items
				.map(function (t) {
					return '<li>' + escapeHtml(t) + '</li>'
				})
				.join('') +
			'</ul>'
		)
	}

	function adminRejectTemplatesHtml(appId) {
		var templates = [
			{ label: 'Мало инфо', text: 'Мало информации о себе. Расскажи подробнее и подай заявку снова.' },
			{
				label: 'Возраст',
				text: 'Укажи реальный возраст (от 12 лет) в заявке или ответь в диалоге.',
			},
			{
				label: 'Правила',
				text: 'Нужно подтвердить, что прочитал правила и скачал сборку с сайта.',
			},
		]
		return (
			'<div class="auth-admin-templates">' +
			'<span class="auth-dialog__label">Шаблоны сообщения</span>' +
			'<div class="auth-admin-template-btns">' +
			templates
				.map(function (t) {
					return (
						'<button type="button" class="auth-admin-template" data-note-for="' +
						appId +
						'" data-template="' +
						escapeHtml(t.text) +
						'">' +
						escapeHtml(t.label) +
						'</button>'
					)
				})
				.join('') +
			'</div></div>'
		)
	}

	function filterAdminApplications(apps) {
		if (!apps || !apps.length) return []
		if (adminFilter === 'awaiting_reply') {
			return apps.filter(function (app) {
				return (
					app.status === 'pending' &&
					app.admin_note &&
					String(app.admin_note).trim() &&
					!app.applicant_reply
				)
			})
		}
		if (adminFilter === 'pending') {
			return apps.filter(function (app) {
				return app.status === 'pending'
			})
		}
		return apps
	}

	function setAdminPendingBadgeCount(n) {
		var badge = document.getElementById('adminAppsTabBadge')
		if (!badge) return
		if (n > 0) {
			badge.hidden = false
			badge.textContent = n > 9 ? '9+' : String(n)
		} else {
			badge.hidden = true
		}
	}

	function countPendingApplications(apps) {
		if (!apps || !apps.length) return 0
		var n = 0
		for (var i = 0; i < apps.length; i++) {
			if (apps[i].status === 'pending') n++
		}
		return n
	}

	async function refreshAdminPendingBadge() {
		if (!window.IsnixAuth || !IsnixAuth.isAdminProfile(currentProfile)) return
		try {
			var result = await IsnixAuth.getAdminApplications('pending', {
				page: 1,
				pageSize: 1,
			})
			var total =
				result && typeof result.total === 'number'
					? result.total
					: result && result.applications
						? result.applications.length
						: 0
			setAdminPendingBadgeCount(total)
		} catch (_e) {
			setAdminPendingBadgeCount(0)
		}
	}

	function renderListPagination(scope, page, pageSize, total) {
		var pages = Math.max(1, Math.ceil(total / pageSize))
		if (total <= pageSize) return ''
		var prev = page > 1 ? page - 1 : null
		var next = page < pages ? page + 1 : null
		var label =
			scope === 'admin-apps'
				? 'Страницы заявок'
				: scope === 'player-apps'
					? 'Страницы моих заявок'
					: 'Страницы'
		var html =
			'<nav class="support-pagination" aria-label="' +
			escapeHtml(label) +
			'" data-pagination-scope="' +
			escapeHtml(scope) +
			'">'
		html +=
			'<button type="button" class="support-pagination__btn" data-page="' +
			(prev || page) +
			'" data-scope="' +
			escapeHtml(scope) +
			'"' +
			(prev ? '' : ' disabled') +
			'>Назад</button>'
		html +=
			'<span class="support-pagination__info">Стр. ' +
			page +
			' из ' +
			pages +
			' · всего ' +
			total +
			'</span>'
		html +=
			'<button type="button" class="support-pagination__btn" data-page="' +
			(next || page) +
			'" data-scope="' +
			escapeHtml(scope) +
			'"' +
			(next ? '' : ' disabled') +
			'>Вперёд</button></nav>'
		return html
	}

	function bindListPagination(container, scope) {
		if (!container) return
		container
			.querySelectorAll(
				'.support-pagination__btn[data-scope="' +
					scope +
					'"]:not([disabled])',
			)
			.forEach(function (btn) {
				if (btn.dataset.appsPagBound) return
				btn.dataset.appsPagBound = '1'
				btn.addEventListener('click', function () {
					var p = parseInt(btn.getAttribute('data-page'), 10)
					if (!p || p < 1) return
					if (scope === 'admin-apps') {
						adminAppsPage = p
						renderAdminApplications()
					} else if (scope === 'player-apps') {
						playerAppsPage = p
						paintApplicationsList(cachedApplications)
					}
				})
			})
	}

	function stopAdminPendingPoll() {
		if (adminPendingPollTimer) {
			clearInterval(adminPendingPollTimer)
			adminPendingPollTimer = null
		}
		var badge = document.getElementById('adminAppsTabBadge')
		if (badge) badge.hidden = true
	}

	function startAdminPendingPoll() {
		stopAdminPendingPoll()
		if (!window.IsnixAuth || !IsnixAuth.isAdminProfile(currentProfile)) return
		refreshAdminPendingBadge()
		adminPendingPollTimer = setInterval(refreshAdminPendingBadge, ADMIN_PENDING_POLL_MS)
	}

	function applicationExtraMeta(app) {
		if (!app) return ''
		var bits = []
		if (app.age) bits.push('возраст: ' + escapeHtml(String(app.age)))
		if (app.read_rules) bits.push('правила OK')
		if (app.downloaded_modpack) bits.push('сборка OK')
		if (app.referred_by_nick) {
			bits.push('пригласил: ' + escapeHtml(app.referred_by_nick))
		}
		if (app.referral_source) {
			bits.push('откуда: ' + escapeHtml(app.referral_source))
		}
		return bits.length ? '<br>' + bits.join(' · ') : ''
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
			deferAccountTask(function () {
				refreshNotifications(session.user.id, true)
			}, 600)
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

	function stripMcFormatting(text) {
		if (!text) return ''
		return String(text)
			.replace(/[&§][0-9a-fk-or]/gi, '')
			.trim()
	}

	function isProfileAdminRole(profile) {
		if (!profile) return false
		if (window.IsnixAuth && IsnixAuth.isAdminProfile(profile)) return true
		return !!profile.server_is_admin
	}

	function updateProfileMeta(profile, serverStatus) {
		var nickTextEl = document.getElementById('profileNickText')
		var roleBadge = document.getElementById('profileRoleBadge')
		var prefixLine = document.getElementById('profilePrefixLine')
		var prefixTextEl = document.getElementById('profilePrefixText')
		var callLine = document.getElementById('profileCallNameDisplay')
		var wlBadge = document.getElementById('profileWlBadge')
		var onlineBadge = document.getElementById('profileOnlineBadge')
		updateSiteDeviceBadge(profile)
		var nick =
			profile && profile.minecraft_nick ? profile.minecraft_nick.trim() : ''
		var display =
			profile && profile.display_name ? profile.display_name.trim() : ''
		var isAdmin = isProfileAdminRole(profile)

		if (nickTextEl) nickTextEl.textContent = nick || '—'
		if (roleBadge) {
			roleBadge.textContent = isAdmin ? 'Админ' : 'Игрок'
			roleBadge.className =
				'profile-role-badge ' +
				(isAdmin ? 'profile-role-badge--admin' : 'profile-role-badge--player')
		}
		var prefix = stripMcFormatting(
			profile && profile.minecraft_prefix ? profile.minecraft_prefix : '',
		)
		if (prefixLine && prefixTextEl) {
			if (prefix) {
				prefixTextEl.textContent = prefix
				prefixLine.hidden = false
			} else if (isAdmin) {
				prefixTextEl.textContent = '[Админ]'
				prefixLine.hidden = false
			} else {
				prefixLine.hidden = true
			}
		}
		if (callLine) {
			if (display && nick && display.toLowerCase() !== nick.toLowerCase()) {
				callLine.textContent = 'Обращение: ' + display
				callLine.hidden = false
			} else if (display && !nick) {
				callLine.textContent = 'Обращение: ' + display
				callLine.hidden = false
			} else {
				callLine.hidden = true
			}
		}
		if (wlBadge) {
			if (!nick) {
				wlBadge.textContent = 'Укажи ник'
				wlBadge.className = 'profile-badge'
			} else if (whitelistAccessGranted(nick)) {
				wlBadge.textContent = isOnWhitelist(nick) ? 'В вайтлисте' : 'Одобрено'
				wlBadge.className = 'profile-badge profile-badge--ok'
			} else {
				wlBadge.textContent = 'Нет в вайтлисте'
				wlBadge.className = 'profile-badge profile-badge--warn'
			}
		}
		updateProfileWlStatusLine(profile)

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
		var supportEl = document.getElementById('adminViewSupport')
		if (appsEl) appsEl.hidden = adminView !== 'applications'
		if (serverEl) serverEl.hidden = adminView !== 'server'
		if (usersEl) usersEl.hidden = adminView !== 'users'
		if (supportEl) supportEl.hidden = adminView !== 'support'
		if (!IsnixAuth || !IsnixAuth.isAdminProfile(currentProfile)) return
		if (adminView === 'support' && window.IsnixSupportTickets) {
			IsnixSupportTickets.onAdminView('support')
			return
		}
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
		return (
			'<div class="auth-player-row">' +
			playerHeadHtml(name, 32) +
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
			hydratePlayerHeads(list)
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
					var login =
						p.login ||
						(p.email ? String(p.email).split('@')[0] : '') ||
						'—'
					var nick = p.minecraft_nick || ''
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
					var metaParts = [escapeHtml(formatDate(p.created_at))]
					if (nick) metaParts.unshift('MC: ' + escapeHtml(nick))
					var meta = '<p class="auth-muted">' + metaParts.join(' · ') + '</p>'
					var tags =
						'<div class="auth-player-tags">' +
						role +
						mcOnline +
						siteTag +
						'</div>'
					return (
						'<article class="auth-app-card">' +
						'<strong>' +
						escapeHtml(login) +
						'</strong> ' +
						tags +
						meta +
						'</article>'
					)
				})
				.join('')
			hydratePlayerHeads(list)
		} catch (err) {
			list.innerHTML =
				'<p class="auth-message auth-message--err">' +
				escapeHtml(IsnixAuth.formatAuthError(err)) +
				'</p>'
		}
	}

	function formatNotificationTime(iso) {
		if (!iso) return ''
		try {
			return new Date(iso).toLocaleString('ru-RU', {
				day: 'numeric',
				month: 'short',
				hour: '2-digit',
				minute: '2-digit',
			})
		} catch (_e) {
			return ''
		}
	}

	function unreadNotificationCount(list) {
		var n = 0
		for (var i = 0; i < list.length; i++) {
			if (!list[i].read_at) n++
		}
		return n
	}

	function maybeBrowserNotify(items) {
		if (!items || !items.length) return
		if (!('Notification' in window) || Notification.permission !== 'granted') {
			return
		}
		for (var i = 0; i < items.length; i++) {
			var it = items[i]
			if (!it || it.read_at || seenNotificationIds[it.id]) continue
			seenNotificationIds[it.id] = true
			try {
				var n = new Notification(it.title || 'ISTHISNIXXXON', {
					body: it.body || '',
					icon: 'favicon.svg',
					tag: it.id,
				})
				n.onclick = function () {
					window.focus()
					if (it.href) window.location.href = it.href
					n.close()
				}
			} catch (_e) {
				/* ignore */
			}
		}
	}

	function requestBrowserNotificationPermission() {
		if (!('Notification' in window)) {
			return Promise.resolve('unsupported')
		}
		if (Notification.permission === 'granted') {
			return Promise.resolve('granted')
		}
		if (Notification.permission === 'denied') {
			return Promise.resolve('denied')
		}
		return Notification.requestPermission()
	}

	function paintNotificationsList(list, emptyMessage) {
		var listEl = document.getElementById('notificationsList')
		var emptyEl = document.getElementById('notificationsEmpty')
		var badge = document.getElementById('notificationsBadge')
		if (!listEl) return
		list = list || []
		var unread = unreadNotificationCount(list)
		if (badge) {
			if (unread > 0) {
				badge.hidden = false
				badge.textContent = unread > 9 ? '9+' : String(unread)
			} else {
				badge.hidden = true
			}
		}
		if (!list.length) {
			listEl.innerHTML = ''
			if (emptyEl) {
				emptyEl.hidden = false
				emptyEl.textContent =
					emptyMessage || 'Пока нет уведомлений'
			}
			return
		}
		if (emptyEl) {
			emptyEl.hidden = true
			emptyEl.textContent = 'Пока нет уведомлений'
		}
		listEl.innerHTML = list
			.map(function (n) {
				var unreadCls = n.read_at ? '' : ' auth-notification--unread'
				var href = n.href || 'account.html#applications'
				return (
					'<button type="button" class="auth-notification' +
					unreadCls +
					'" data-notification-id="' +
					escapeHtml(n.id) +
					'" data-notification-href="' +
					escapeHtml(href) +
					'">' +
					'<span class="auth-notification__title">' +
					escapeHtml(n.title) +
					'</span>' +
					'<span class="auth-notification__body">' +
					escapeHtml(n.body) +
					'</span>' +
					'<span class="auth-notification__time">' +
					escapeHtml(formatNotificationTime(n.created_at)) +
					'</span></button>'
				)
			})
			.join('')
	}

	async function refreshNotifications(userId, notifyBrowser) {
		if (!userId || !window.IsnixAuth) return
		showNotificationsUi()
		try {
			var list = await IsnixAuth.getNotifications(userId)
			var prevIds = {}
			for (var i = 0; i < cachedNotifications.length; i++) {
				prevIds[cachedNotifications[i].id] = true
			}
			var freshUnread = []
			for (var j = 0; j < list.length; j++) {
				if (!list[j].read_at && !prevIds[list[j].id]) {
					freshUnread.push(list[j])
				}
			}
			cachedNotifications = list
			paintNotificationsList(list)
			if (notifyBrowser) maybeBrowserNotify(freshUnread)
		} catch (e) {
			paintNotificationsList(
				cachedNotifications,
				'Не удалось загрузить уведомления. Проверь сеть или выполни docs/supabase-notifications.sql в Supabase.',
			)
			if (
				window.IsnixAuth &&
				IsnixAuth.isSupabaseBackoffActive &&
				IsnixAuth.isSupabaseBackoffActive()
			) {
				showConnectionNotice(
					'Сеть обрывает связь с кабинетом (api.isnix.ru). Кабинет работает из кэша; включи VPN или Cloudflare WARP. Игра на mc.isnix.ru — без VPN. Повтор через несколько минут.',
				)
			}
		}
	}

	function mergeNotificationRow(row) {
		if (!row || !row.id) return
		var found = false
		for (var i = 0; i < cachedNotifications.length; i++) {
			if (cachedNotifications[i].id === row.id) {
				cachedNotifications[i] = row
				found = true
				break
			}
		}
		if (!found) {
			cachedNotifications = [row].concat(cachedNotifications)
		}
		paintNotificationsList(cachedNotifications)
	}

	function handleRealtimeNotification(row) {
		if (!row || !row.id) return
		var isNew = !seenNotificationIds[row.id] && !row.read_at
		mergeNotificationRow(row)
		if (isNew) {
			seenNotificationIds[row.id] = true
			maybeBrowserNotify([row])
			if (window.IsnixToast) {
				var hint = row.body ? ': ' + row.body : ''
				IsnixToast.show((row.title || 'Новое уведомление') + hint, 'info', 7000)
			}
		}
	}

	function stopNotificationsPoll() {
		if (notificationsPollTimer) {
			clearInterval(notificationsPollTimer)
			notificationsPollTimer = null
		}
		if (notificationsRealtimeUnsub) {
			notificationsRealtimeUnsub()
			notificationsRealtimeUnsub = null
		}
		notificationsRealtimeOk = false
		cachedNotifications = []
	}

	function startNotificationsPoll(userId) {
		if (notificationsPollTimer) {
			clearInterval(notificationsPollTimer)
			notificationsPollTimer = null
		}
		if (!userId) return
		var interval = notificationsRealtimeOk
			? NOTIFICATIONS_POLL_MS
			: NOTIFICATIONS_POLL_FAST_MS
		notificationsPollTimer = setInterval(function () {
			refreshNotifications(userId, true)
		}, interval)
	}

	function startNotificationsRealtime(userId) {
		if (
			!userId ||
			!window.IsnixAuth ||
			!IsnixAuth.subscribeUserNotifications
		) {
			return
		}
		if (notificationsRealtimeUnsub) {
			notificationsRealtimeUnsub()
			notificationsRealtimeUnsub = null
		}
		notificationsRealtimeOk = false
		notificationsRealtimeUnsub = IsnixAuth.subscribeUserNotifications(
			userId,
			handleRealtimeNotification,
		)
		window.setTimeout(function () {
			notificationsRealtimeOk = true
			startNotificationsPoll(userId)
		}, 4000)
	}

	function startNotifications(userId) {
		if (!userId) return
		refreshNotifications(userId, false)
		startNotificationsRealtime(userId)
		startNotificationsPoll(userId)
	}

	function bindPushPermissionListener() {
		if (window.__isnixPushPermBound) return
		window.__isnixPushPermBound = true
		window.addEventListener('isnix-push-permission', function (ev) {
			var state = ev && ev.detail && ev.detail.state
			if (state !== 'granted' || !window.IsnixAuth) return
			IsnixAuth.getSession()
				.then(function (session) {
					if (session && session.user) {
						return refreshNotifications(session.user.id, true)
					}
				})
				.catch(function () {})
		})
	}

	function positionNotificationsPopover() {
		var btn = document.getElementById('notificationsBtn')
		var pop = document.getElementById('notificationsPopover')
		if (!btn || !pop) return
		var rect = btn.getBoundingClientRect()
		var gap = 8
		var pad = 8
		var width = Math.min(360, window.innerWidth - pad * 2)
		var left = Math.min(
			Math.max(pad, rect.right - width),
			window.innerWidth - width - pad,
		)
		var top = rect.bottom + gap
		var maxHeight = Math.max(160, window.innerHeight - top - pad)
		pop.style.width = width + 'px'
		pop.style.left = left + 'px'
		pop.style.top = top + 'px'
		pop.style.maxHeight = maxHeight + 'px'
	}

	function openNotificationsModal() {
		var pop = document.getElementById('notificationsPopover')
		if (!pop) return
		paintNotificationsList(cachedNotifications)
		positionNotificationsPopover()
		pop.hidden = false
		pop.classList.add('is-open')
		pop.setAttribute('aria-hidden', 'false')
		var overlay = document.getElementById('notificationsOverlay')
		if (overlay) {
			overlay.hidden = false
			overlay.setAttribute('aria-hidden', 'false')
			overlay.classList.add('is-open')
		}
		var btn = document.getElementById('notificationsBtn')
		if (btn) btn.setAttribute('aria-expanded', 'true')
		window.requestAnimationFrame(function () {
			positionNotificationsPopover()
			try {
				pop.focus({ preventScroll: true })
			} catch (_focusErr) {
				/* ignore */
			}
		})
	}

	function closeNotificationsModal() {
		var pop = document.getElementById('notificationsPopover')
		if (pop) {
			pop.classList.remove('is-open')
			pop.setAttribute('aria-hidden', 'true')
			pop.hidden = true
		}
		var overlay = document.getElementById('notificationsOverlay')
		if (overlay) {
			overlay.classList.remove('is-open')
			overlay.setAttribute('aria-hidden', 'true')
			overlay.hidden = true
		}
		var btn = document.getElementById('notificationsBtn')
		if (btn) btn.setAttribute('aria-expanded', 'false')
	}

	function resolveNotificationsUserId(fallbackUserId) {
		if (fallbackUserId) return fallbackUserId
		if (currentProfile && currentProfile.id) return currentProfile.id
		return null
	}

	function bindNotificationsUi(userId) {
		if (notificationsUiBound) return
		var btn = document.getElementById('notificationsBtn')
		var listEl = document.getElementById('notificationsList')
		var markAll = document.getElementById('notificationsMarkAll')
		var closeBtn = document.getElementById('notificationsModalClose')
		var overlay = document.getElementById('notificationsOverlay')
		if (!btn) return
		notificationsUiBound = true
		btn.addEventListener('click', function (e) {
			e.preventDefault()
			e.stopPropagation()
			var pop = document.getElementById('notificationsPopover')
			if (pop && pop.classList.contains('is-open')) {
				closeNotificationsModal()
				return
			}
			openNotificationsModal()
			var uid = resolveNotificationsUserId(userId)
			var refresh = function (withBrowser) {
				if (!uid) return Promise.resolve()
				return refreshNotifications(uid, withBrowser)
			}
			requestBrowserNotificationPermission()
				.then(function () {
					return refresh(true)
				})
				.catch(function () {
					return refresh(false)
				})
		})
		if (closeBtn) {
			closeBtn.addEventListener('click', closeNotificationsModal)
		}
		if (overlay) {
			overlay.addEventListener('click', closeNotificationsModal)
		}
		window.addEventListener(
			'resize',
			function () {
				var pop = document.getElementById('notificationsPopover')
				if (pop && pop.classList.contains('is-open')) {
					positionNotificationsPopover()
				}
			},
			{ passive: true },
		)
		document.addEventListener('click', function (e) {
			var pop = document.getElementById('notificationsPopover')
			if (!pop || !pop.classList.contains('is-open')) return
			var wrap = document.getElementById('notificationsWrap')
			if (wrap && wrap.contains(e.target)) return
			if (overlay && e.target === overlay) return
			closeNotificationsModal()
		})
		if (markAll) {
			markAll.addEventListener('click', async function () {
				var uid = resolveNotificationsUserId(userId)
				if (!uid) return
				var ids = []
				for (var i = 0; i < cachedNotifications.length; i++) {
					if (!cachedNotifications[i].read_at) {
						ids.push(cachedNotifications[i].id)
					}
				}
				if (!ids.length) return
				try {
					await IsnixAuth.markNotificationsRead(ids)
					await refreshNotifications(uid, false)
				} catch (err) {
					showMsg(IsnixAuth.formatAuthError(err), false)
				}
			})
		}
		if (listEl) {
			listEl.addEventListener('click', async function (e) {
				var uid = resolveNotificationsUserId(userId)
				var item = e.target.closest('[data-notification-id]')
				if (!item) return
				var id = item.getAttribute('data-notification-id')
				var href = item.getAttribute('data-notification-href')
				try {
					await IsnixAuth.markNotificationsRead([id])
					if (uid) await refreshNotifications(uid, false)
				} catch (_err) {
					/* ignore */
				}
				closeNotificationsModal()
				if (href) window.location.href = href
			})
		}
		document.addEventListener('keydown', function (e) {
			if (e.key !== 'Escape') return
			var pop = document.getElementById('notificationsPopover')
			if (pop && pop.classList.contains('is-open')) {
				closeNotificationsModal()
			}
		})
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
		hideNotificationsUi()
		if (window.IsnixSupportTickets) IsnixSupportTickets.onGuest()
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
		stopNotificationsPoll()
		stopAdminPendingPoll()
	}

	function showDashboard(user, profile) {
		setAccountPageMode(true)
		if (setupNotice) setupNotice.hidden = true
		if (authPanels) authPanels.hidden = true
		if (dashboard) dashboard.hidden = false
		showNotificationsUi()
		currentProfile = profile || null
		if (user && user.id) {
			playerStatsUserId = user.id
			if (currentProfile) currentProfile.id = user.id
		}
		var isAdmin = IsnixAuth && IsnixAuth.isAdminProfile(profile)
		setAccountMode(resolveInitialAccountMode(), { skipStore: true })
		updatePlayerApplicationSections(profile)
		var emailEl = document.getElementById('dashEmail')
		var login =
			(profile && profile.login) ||
			(profile && profile.email ? String(profile.email).split('@')[0] : '') ||
			(user && user.email ? String(user.email).split('@')[0] : '')
		if (emailEl) emailEl.textContent = login || '—'
		// Для менеджеров паролей нужен autocomplete="username"
		syncPasswordFormUsername(login || '')
		updateProfileAvatars(profile && profile.minecraft_nick ? profile.minecraft_nick : '')
	}

	async function renderApplications(userId) {
		if (IsnixAuth && IsnixAuth.isAdminProfile(currentProfile)) {
			return []
		}
		var list = document.getElementById('applicationsList')
		if (!list || !window.IsnixAuth) return []
		var cached = readAppsCache(userId)
		if (cached) {
			cachedApplications = cached
			paintApplicationsList(cached)
			refreshProfileDashboardHints(currentProfile)
		} else {
			list.innerHTML = '<p class="auth-muted">Загрузка…</p>'
		}
		try {
			var apps = normalizeApplicationsList(
				await IsnixAuth.getApplications(userId),
			)
			cachedApplications = apps
			writeAppsCache(userId, apps)
			playerAppsPage = 1
			paintApplicationsList(apps)
			refreshProfileDashboardHints(currentProfile)
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

	function renderAdminReferralBlock(app) {
		if (!app.referred_by_nick) return ''
		var ref = app._referral
		var nickLine =
			'<p class="auth-referral-admin__nick">Пригласил: <strong>' +
			escapeHtml(app.referred_by_nick) +
			'</strong></p>'
		if (!ref) {
			return (
				'<div class="auth-referral-admin auth-referral-admin--warn">' +
				nickLine +
				'<p class="auth-hint">Запись реферала не создана (ник не найден на сайте или SQL не выполнен).</p>' +
				'</div>'
			)
		}
		if (ref.status === 'rejected') {
			return (
				'<div class="auth-referral-admin auth-referral-admin--warn">' +
				nickLine +
				'<p class="auth-hint">' +
				escapeHtml(ref.admin_note || 'Реферал отклонён') +
				'</p></div>'
			)
		}
		if (ref.status === 'rewarded') {
			return (
				'<div class="auth-referral-admin auth-referral-admin--ok">' +
				nickLine +
				'<p class="auth-hint auth-hint--ok">Награда пригласившему отмечена как выданная.</p>' +
				'</div>'
			)
		}
		if (ref.status === 'qualified' || (ref.status === 'pending' && app.status === 'approved')) {
			return (
				'<div class="auth-referral-admin">' +
				nickLine +
				'<p class="auth-hint">После выдачи префикса или лайка /rep — нажми кнопку ниже.</p>' +
				'<button type="button" class="auth-submit auth-submit--ghost auth-admin-referral-reward" data-app-id="' +
				escapeHtml(app.id) +
				'" data-referral-id="' +
				escapeHtml(ref.id) +
				'">Награда выдана</button>' +
				'</div>'
			)
		}
		if (ref.status === 'pending') {
			return (
				'<div class="auth-referral-admin">' +
				nickLine +
				'<p class="auth-hint">Реферал засчитается пригласившему после одобрения заявки.</p>' +
				'</div>'
			)
		}
		return (
			'<div class="auth-referral-admin">' +
			nickLine +
			'</div>'
		)
	}

	function renderAdminApplicationCard(app) {
		var onWl = isOnWhitelist(app.minecraft_nick)
		var wlHint = onWl
			? '<p class="auth-hint auth-hint--ok">Уже в whitelist.json — проверь перед одобрением</p>'
			: '<p class="auth-hint">После одобрения ник добавится на сервер автоматически (до ~5 мин)</p>'
		var warns = applicationAdminWarnings(app)
		var meta =
						'<p class="auth-muted">' +
						formatDate(app.created_at) +
						'' +
						(app.call_name
							? '<br>Обращение: ' + escapeHtml(app.call_name)
							: '') +
						applicationExtraMeta(app) +
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
								adminRejectTemplatesHtml(app.id) +
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
						'<div class="auth-app-head__nick">' +
						'<strong>' +
						escapeHtml(app.minecraft_nick) +
						'</strong>' +
						'<button type="button" class="auth-copy-nick" data-copy-nick="' +
						escapeHtml(app.minecraft_nick) +
						'">Копировать ник</button>' +
						'</div>' +
						'<span class="' +
						statusClass(app.status) +
						'">' +
						statusLabel(app.status) +
						'</span>' +
						'</div>' +
						meta +
						warns +
						renderAdminReferralBlock(app) +
						'<p class="auth-app-reason">' +
						escapeHtml(app.reason) +
						'</p>' +
						wlHint +
						actions +
			'</article>'
		)
	}

	async function renderAdminApplications() {
		var list = document.getElementById('adminApplicationsList')
		if (!list || !window.IsnixAuth || !IsnixAuth.isAdminProfile(currentProfile)) return
		list.innerHTML = '<p class="auth-muted">Загрузка…</p>'
		try {
			var result = await IsnixAuth.getAdminApplications(adminFilter, {
				page: adminAppsPage,
				pageSize: APPS_PAGE_SIZE,
			})
			var apps = result.applications || []
			var total = result.total == null ? apps.length : result.total
			var pages = Math.max(1, Math.ceil(total / APPS_PAGE_SIZE))
			if (adminAppsPage > pages) {
				adminAppsPage = pages
				return renderAdminApplications()
			}
			if (adminFilter === 'pending') {
				setAdminPendingBadgeCount(total)
			} else {
				deferAccountTask(refreshAdminPendingBadge, 0)
			}
			if (!apps.length) {
				list.innerHTML =
					'<p class="auth-muted">Нет заявок в этом разделе.</p>'
				return
			}
			var refMap = {}
			if (IsnixAuth.getReferralsForApplications) {
				try {
					refMap = await IsnixAuth.getReferralsForApplications(
						apps.map(function (a) {
							return a.id
						}),
					)
				} catch (_refErr) {
					refMap = {}
				}
			}
			apps.forEach(function (a) {
				a._referral = refMap[a.id] || null
			})
			var html = apps.map(renderAdminApplicationCard).join('')
			html += renderListPagination(
				'admin-apps',
				adminAppsPage,
				APPS_PAGE_SIZE,
				total,
			)
			list.innerHTML = html
			bindListPagination(list, 'admin-apps')
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
			var copyBtn = e.target.closest('.auth-copy-nick')
			var tplBtn = e.target.closest('.auth-admin-template')
			var msgBtn = e.target.closest('.auth-admin-message')
			var okBtn = e.target.closest('.auth-admin-approve')
			var noBtn = e.target.closest('.auth-admin-reject')
			var refRewardBtn = e.target.closest('.auth-admin-referral-reward')
			if (copyBtn) {
				e.preventDefault()
				var nick = copyBtn.getAttribute('data-copy-nick') || ''
				copyTextToClipboard(nick)
					.then(function () {
						showMsg('Ник скопирован: ' + nick, true)
					})
					.catch(function () {
						showMsg('Не удалось скопировать ник', false)
					})
			} else if (tplBtn) {
				e.preventDefault()
				var noteFor = tplBtn.getAttribute('data-note-for')
				var text = tplBtn.getAttribute('data-template') || ''
				var ta = noteFor
					? document.querySelector('[data-note-for="' + noteFor + '"]')
					: null
				if (ta) {
					ta.value = text
					ta.focus()
				}
			} else if (msgBtn) {
				e.preventDefault()
				handleAdminMessage(msgBtn.dataset.id, msgBtn)
			} else if (okBtn) {
				e.preventDefault()
				handleModerate(okBtn.dataset.id, 'approved', okBtn)
			} else if (noBtn) {
				e.preventDefault()
				handleModerate(noBtn.dataset.id, 'rejected', noBtn)
			} else if (refRewardBtn) {
				e.preventDefault()
				handleReferralReward(refRewardBtn.dataset.appId, refRewardBtn)
			}
		})
	}

	async function handleReferralReward(applicationId, btn) {
		if (!applicationId || !window.IsnixAuth) return
		if (
			!confirm(
				'Отметить, что награда пригласившему выдана (префикс, реп и т.д.)?',
			)
		) {
			return
		}
		setAdminActionLoading(btn, true)
		try {
			await IsnixAuth.markReferralRewardedByApplication(applicationId)
			showMsg('Реферал: награда отмечена как выданная', true)
			await renderAdminApplications()
		} catch (err) {
			showMsg(IsnixAuth.formatAuthError(err), false)
		} finally {
			setAdminActionLoading(btn, false)
		}
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
						? (typeof isnixStatusHtml === 'function'
							? isnixStatusHtml('Одобрено', true)
							: 'Одобрено')
						: app.status === 'rejected'
							? (typeof isnixStatusHtml === 'function'
								? isnixStatusHtml('Отклонено', false)
								: 'Отклонено')
							: 'На рассмотрении'
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
		cachedApplications = apps || []
		var total = cachedApplications.length
		if (!total) {
			playerAppsPage = 1
			list.innerHTML = renderApplicationsHtml([])
			bindApplicantReplyForms(list)
			syncWhitelistSectionVisibility(
				document.getElementById('profileNick')
					? document.getElementById('profileNick').value
					: '',
			)
			return
		}
		var pages = Math.max(1, Math.ceil(total / APPS_PAGE_SIZE))
		if (playerAppsPage > pages) playerAppsPage = pages
		var start = (playerAppsPage - 1) * APPS_PAGE_SIZE
		var slice = cachedApplications.slice(start, start + APPS_PAGE_SIZE)
		var html = renderApplicationsHtml(slice)
		html += renderListPagination(
			'player-apps',
			playerAppsPage,
			APPS_PAGE_SIZE,
			total,
		)
		list.innerHTML = html
		bindListPagination(list, 'player-apps')
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
			deferAccountTask(function () {
				IsnixServer.fetchStatus(false).then(function (status) {
					if (status !== undefined) {
						cachedServerStatus = status
						updateProfileMeta(currentProfile, status)
						renderPlayerStats(currentProfile, playerStats, status)
					}
				})
			}, 1200)
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
				'Сообщение отправлено. Игрок увидит его в заявках и в уведомлениях.',
				true,
			)
			await renderAdminApplications()
			refreshAdminPendingBadge()
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
					? 'Заявка одобрена. Ник поставлен в очередь на сервер (обычно до 5 минут).'
					: 'Заявка отклонена.',
				true,
			)
			await loadWhitelist()
			await renderAdminApplications()
			refreshAdminPendingBadge()
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
			if (consumeAfterLoginRedirect()) {
				dashboardLoading = false
				return
			}

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
						if (!profile.login) {
							var m = String(session.user.email).match(
								/^([a-z0-9_]{3,24})@isnix\.invalid$/i,
							)
							if (m) profile.login = m[1].toLowerCase()
						}
					} else if (!profile) {
						profile = profileFromSession(session)
					}
					writeProfileCache(userId, profile)
					applyDashboardProfile(profile, session)

					if (IsnixAuth.isAdminProfile(profile)) {
						startAdminPendingPoll()
						deferAccountTask(function () {
							if (window.location.hash === '#admin-support') {
								switchAdminView('support')
							} else {
								switchAdminView(adminView)
							}
						}, 150)
					}
					deferAccountTask(function () {
						refreshPlayerStatus(false)
					}, 80)
					startStatusPolling()
				})
				.catch(function (e) {
					profileErr = e
					showProfileLoadError(e, userId)
				})

			bindNotificationsUi(userId)
			bindPushPermissionListener()
			deferAccountTask(function () {
				startNotifications(userId)
			}, 400)

			if (!IsnixAuth.isAdminProfile(quickProfile)) {
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
			}
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
		if (window.location.hash === '#support') {
			window.location.replace('appeals.html')
			return
		}

		loadWhitelist()
		initAccountModeNav()

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
				adminAppsPage = 1
				document.querySelectorAll('[data-admin-filter]').forEach(function (b) {
					b.classList.toggle('active', b === btn)
				})
				renderAdminApplications()
			})
		})

		ensureAdminListDelegation()

		var loginLoginInput = document.getElementById('loginLogin')
		var loginLegacyHint = document.getElementById('loginLegacyHint')
		if (loginLoginInput && loginLegacyHint) {
			loginLoginInput.addEventListener('input', function () {
				loginLegacyHint.hidden = loginLoginInput.value.indexOf('@') === -1
			})
		}

		var loginForm = document.getElementById('loginForm')
		if (loginForm) {
			loginForm.addEventListener('submit', async function (e) {
				e.preventDefault()
				setLoading(loginForm, true)
				showMsg('', true)
				try {
					var loginData = await IsnixAuth.signIn(
						document.getElementById('loginLogin').value.trim(),
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
						document.getElementById('regLogin').value.trim(),
						p1,
					)
					if (data.session) {
						showMsg('Аккаунт создан', true)
						await loadDashboard(data.session)
					} else {
							showMsg('Аккаунт создан. Теперь войди по логину и паролю.', true)
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
						email: currentProfile && currentProfile.email ? currentProfile.email : null,
						login: currentProfile && currentProfile.login ? currentProfile.login : null,
						minecraft_nick: nick || null,
						display_name: callName,
						role: currentProfile ? currentProfile.role : 'player',
						created_at: currentProfile ? currentProfile.created_at : null,
					}
					writeProfileCache(session.user.id, currentProfile)
					await loadWhitelist()
					updateProfileNickHint()
					updateProfileAvatars(nick)
					renderPlayerStats(currentProfile, playerStats, cachedServerStatus)
					loadPlayerReputation(currentProfile)
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

		async function submitReputationVote(vote) {
			var repVoteForm = document.getElementById('repVoteForm')
			setRepVoteMsg('', true)
			var session = await IsnixAuth.getSession()
			if (!session) return
			var targetEl = document.getElementById('repTargetNick')
			var target = targetEl ? targetEl.value.trim() : ''
			if (!target) {
				setRepVoteMsg('Укажи ник игрока', false)
				return
			}
			if (!IsnixAuth.MC_NICK_RE.test(target)) {
				setRepVoteMsg('Ник: 3–16 символов, латиница, цифры и _', false)
				return
			}
			var ownNick =
				currentProfile && currentProfile.minecraft_nick
					? currentProfile.minecraft_nick.trim()
					: ''
			if (ownNick && ownNick.toLowerCase() === target.toLowerCase()) {
				setRepVoteMsg('Нельзя голосовать за себя', false)
				return
			}
			if (!ownNick) {
				setRepVoteMsg('Сначала укажи свой ник в профиле', false)
				return
			}
			var isLike = vote === 1
			if (repVoteForm) setLoading(repVoteForm, true)
			try {
				await IsnixAuth.castReputationVote(target, vote)
				var okText = (isLike ? 'Лайк' : 'Дизлайк') + ' отправлен игроку ' + target
				setRepVoteMsg(okText, true)
				showMsg(okText, true)
				if (targetEl) targetEl.value = ''
			} catch (err) {
				var msg = IsnixAuth.formatAuthError(err)
				setRepVoteMsg(msg, false)
				showMsg(msg, false)
			} finally {
				if (repVoteForm) setLoading(repVoteForm, false)
			}
		}

		var repVoteForm = document.getElementById('repVoteForm')
		if (repVoteForm) {
			repVoteForm.addEventListener('submit', function (e) {
				e.preventDefault()
				submitReputationVote(1)
			})
			repVoteForm.querySelectorAll('[data-rep-vote]').forEach(function (btn) {
				if (btn.type === 'submit') return
				btn.addEventListener('click', function () {
					var v = parseInt(btn.getAttribute('data-rep-vote'), 10)
					submitReputationVote(v === -1 ? -1 : 1)
				})
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
					collectWhitelistFormData(false),
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
					collectWhitelistFormData(true),
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

		var diagBtn = document.getElementById('authDiagBtn')
		if (diagBtn) {
			diagBtn.addEventListener('click', runConnectionDiagnostic)
		}

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
			applyReferralFromUrl()
			bindNotificationsUi(null)

			var booted = bootstrapFromLocalSession()
			if (!booted) showGuest()

			IsnixAuth.onAuthStateChange(scheduleOnSession)

			if (booted) {
				IsnixAuth.getSession()
					.then(function (session) {
						if (!session) {
							showGuest()
							return
						}
						return runOnSession(session)
					})
					.catch(function (err) {
						showConnectionNotice(IsnixAuth.formatAuthError(err))
					})
				return
			}

			var session = await IsnixAuth.getSession()
			if (!session) {
				showGuest()
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
