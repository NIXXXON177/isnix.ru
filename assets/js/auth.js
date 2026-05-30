;(function (global) {
	'use strict'

	var MC_NICK_RE = /^[a-zA-Z0-9_]{3,16}$/
	var client = null
	var sessionInflight = null
	var profileInflight = {}
	var profileMemCache = {}
	var PROFILE_MEM_TTL_MS = 90000
	var PROFILE_DISK_PREFIX = 'isnix_profile_ls_'
	var PROFILE_DISK_TTL_MS = 604800000
	var SUPABASE_BACKOFF_KEY = 'isnix_supabase_backoff_until'
	var SUPABASE_BACKOFF_MS = 300000
	var supabaseBackoffUntil = 0

	/** Только эти email могут быть админами сайта (дублирует проверку в Supabase) */
	var SITE_ADMIN_EMAILS = [
		'kupryuhinsemen@gmail.com',
		'kudrasovn024@gmail.com',
		'1511vasilisa@gmail.com',
		'nikenerdx@gmail.com',
	]

	function getConfig() {
		var c = global.ISNIX_AUTH || {}
		return {
			enabled: !!c.enabled,
			supabaseUrl: (c.supabaseUrl || '').trim(),
			supabaseAnonKey: (c.supabaseAnonKey || '').trim(),
		}
	}

	function isReady() {
		var c = getConfig()
		return (
			c.enabled &&
			c.supabaseUrl.length > 0 &&
			c.supabaseAnonKey.length > 0 &&
			typeof global.supabase !== 'undefined'
		)
	}

	function errorText(err) {
		if (!err) return ''
		if (typeof err === 'string') return err
		return String(
			err.message ||
				err.details ||
				err.hint ||
				err.code ||
				'',
		)
	}

	function isNetworkError(err) {
		var msg = errorText(err)
		if (/UNAUTHORIZED_INVALID_API_KEY|invalid api key|Invalid API key/i.test(msg)) {
			return false
		}
		return /Failed to fetch|NetworkError|NetworkError when attempting to fetch|CORS|cross-origin|ERR_CONNECTION|ERR_HTTP2|PING_FAILED|Load failed|fetch failed|Network request failed|ERR_NAME_NOT_RESOLVED|ERR_SSL|ERR_TIMED_OUT|CONNECTION_RESET|CONNECTION_TIMED_OUT|HTTP2_PING_FAILED|AbortError|aborted|не удалось выполнить запрос|NetworkError when attempting to fetch resource/i.test(
			msg,
		)
	}

	function readSupabaseBackoffUntil() {
		try {
			var t = parseInt(localStorage.getItem(SUPABASE_BACKOFF_KEY), 10)
			if (Number.isFinite(t) && t > Date.now()) return t
		} catch (_e) {
			/* ignore */
		}
		return 0
	}

	function noteSupabaseNetworkFailure(err) {
		if (!isNetworkError(err)) return
		supabaseBackoffUntil = Date.now() + SUPABASE_BACKOFF_MS
		try {
			localStorage.setItem(
				SUPABASE_BACKOFF_KEY,
				String(supabaseBackoffUntil),
			)
		} catch (_e) {
			/* ignore */
		}
	}

	function isSupabaseBackoffActive() {
		if (Date.now() < supabaseBackoffUntil) return true
		var stored = readSupabaseBackoffUntil()
		if (stored > Date.now()) {
			supabaseBackoffUntil = stored
			return true
		}
		return false
	}

	function clearSupabaseBackoff() {
		supabaseBackoffUntil = 0
		try {
			localStorage.removeItem(SUPABASE_BACKOFF_KEY)
		} catch (_e) {
			/* ignore */
		}
	}

	supabaseBackoffUntil = readSupabaseBackoffUntil()

	function isInvalidApiKeyError(err) {
		var msg = errorText(err)
		return /UNAUTHORIZED_INVALID_API_KEY|invalid api key|Invalid API key|UNAUTHORIZED_MISSING_API_KEY/i.test(
			msg,
		)
	}

	function isMissingApplicantReplyColumn(err) {
		var msg = errorText(err)
		return /applicant_reply/i.test(msg) && /does not exist|42703/i.test(msg)
	}

	function isMissingWhitelistFormV2Columns(err) {
		var msg = errorText(err)
		return (
			/read_rules|downloaded_modpack|referral_source/i.test(msg) &&
			/does not exist|42703|PGRST204/i.test(msg)
		)
	}

	function isMissingNotificationsTable(err) {
		var msg = errorText(err)
		return (
			/user_notifications|mark_notifications_read/i.test(msg) &&
			/does not exist|42703|42P01|PGRST205/i.test(msg)
		)
	}

	function isNotificationTriggerError(err) {
		var msg = errorText(err)
		return (
			/insert_user_notification|notify_whitelist|user_notifications|try_insert_user_notification/i.test(
				msg,
			) &&
			/does not exist|42703|42P01|PGRST205|permission denied|function/i.test(msg)
		)
	}

	var APPS_SCHEMA_CACHE_KEY = 'isnix_wl_apps_schema_v1'
	var SESSION_TIMEOUT_MS = 22000
	var sessionBackgroundRefresh = null

	function readAppsSchemaCache() {
		try {
			var v = localStorage.getItem(APPS_SCHEMA_CACHE_KEY)
			if (v === 'v2+reply' || v === 'fallback+reply' || v === 'fallback') {
				return v
			}
		} catch (_e) {
			/* ignore */
		}
		return null
	}

	function writeAppsSchemaCache(key) {
		if (!key) return
		try {
			localStorage.setItem(APPS_SCHEMA_CACHE_KEY, key)
		} catch (_e) {
			/* ignore */
		}
	}

	function applicationQueryCombos() {
		var cached = readAppsSchemaCache()
		if (cached === 'v2+reply') {
			return [{ reply: true, v2: true, key: 'v2+reply' }]
		}
		if (cached === 'fallback+reply') {
			return [{ reply: true, v2: false, key: 'fallback+reply' }]
		}
		if (cached === 'fallback') {
			return [{ reply: false, v2: false, key: 'fallback' }]
		}
		return [
			{ reply: true, v2: true, key: 'v2+reply' },
			{ reply: true, v2: false, key: 'fallback+reply' },
			{ reply: false, v2: false, key: 'fallback' },
		]
	}

	async function fetchApplicationsWithFallback(queryFn) {
		var combos = applicationQueryCombos()
		var lastErr = null
		for (var i = 0; i < combos.length; i++) {
			try {
				var data = await queryFn(combos[i].reply, combos[i].v2)
				writeAppsSchemaCache(combos[i].key)
				return data
			} catch (err) {
				lastErr = err
				if (isMissingWhitelistFormV2Columns(err) && combos[i].v2) continue
				if (isMissingApplicantReplyColumn(err) && combos[i].reply) continue
				throw err
			}
		}
		if (lastErr) throw lastErr
		return []
	}

	function validateWhitelistApplicationData(data) {
		var nick = (data.minecraft_nick || '').trim()
		if (!MC_NICK_RE.test(nick)) {
			throw new Error('Ник: 3–16 символов, латиница, цифры и _')
		}
		var ageNum = parseInt(String(data.age || '').trim(), 10)
		if (!Number.isFinite(ageNum) || ageNum < 12) {
			throw new Error('Укажи возраст: от 12 лет')
		}
		if (ageNum > 99) {
			throw new Error('Проверь возраст')
		}
		if (!data.read_rules) {
			throw new Error('Подтверди, что прочитал(а) правила сервера')
		}
		if (!data.downloaded_modpack) {
			throw new Error('Подтверди, что скачал(а) сборку с сайта')
		}
		var reason = (data.reason || '').trim()
		if (reason.length < 10) {
			throw new Error('Напиши немного о себе (минимум 10 символов)')
		}
		if (reason.length > 2000) {
			throw new Error('Текст «о себе» слишком длинный')
		}
		var referral = (data.referral_source || '').trim()
		if (referral.length > 200) {
			throw new Error('Поле «откуда узнали» — не больше 200 символов')
		}
		return {
			minecraft_nick: nick,
			call_name: (data.call_name || '').trim() || null,
			age: String(ageNum),
			reason: reason,
			read_rules: true,
			downloaded_modpack: true,
			referral_source: referral || null,
		}
	}

	function isMissingSitePresenceColumns(err) {
		var msg = errorText(err)
		return (
			/site_last_seen_at|site_device/i.test(msg) &&
			/does not exist|42703|PGRST204/i.test(msg)
		)
	}

	function sleep(ms) {
		return new Promise(function (resolve) {
			setTimeout(resolve, ms)
		})
	}

	/** Повтор только для GET; PATCH/POST при сбое не дублируем (иначе лавина запросов). */
	function fetchWithRetry(url, options) {
		var method = ((options && options.method) || 'GET').toUpperCase()
		var delays = method === 'GET' || method === 'HEAD' ? [0, 280] : [0]
		function attempt(i) {
			return global.fetch(url, options).catch(function (err) {
				if (!isNetworkError(err) || i >= delays.length - 1) {
					throw err
				}
				return sleep(delays[i + 1]).then(function () {
					return attempt(i + 1)
				})
			})
		}
		return attempt(0)
	}

	async function withNetworkRetry(fn) {
		try {
			return await fn()
		} catch (err) {
			if (!isNetworkError(err)) throw err
			await sleep(200)
			return await fn()
		}
	}

	function getClient() {
		if (!isReady()) return null
		if (!client) {
			client = global.supabase.createClient(
				getConfig().supabaseUrl,
				getConfig().supabaseAnonKey,
				{
					global: { fetch: fetchWithRetry },
				},
			)
		}
		return client
	}

	function networkHelpText() {
		return (
			'Сеть обрывает связь с Supabase — это не всегда AdBlock.\n\n' +
			'Без VPN попробуй по порядку:\n' +
			'1) Раздай интернет с телефона (точка доступа) и открой isnix.ru с ПК.\n' +
			'2) DNS в Windows: 1.1.1.1 и 1.0.0.1 (или 8.8.8.8).\n' +
			'3) Chrome/Edge → Настройки → Безопасность → выключи «Использовать безопасный DNS».\n' +
			'4) Временно отключи антивирус (Kaspersky, Dr.Web и др. рвут HTTPS).\n' +
			'5) Другой браузер (Firefox / Edge).\n' +
			'6) Бесплатно: приложение 1.1.1.1 (Cloudflare WARP) — не «VPN-сервис», часто снимает блокировку провайдера.\n\n' +
			'Проверка: открой в новой вкладке:\n' +
			(getConfig().supabaseUrl || 'https://ВАШ-ПРОЕКТ.supabase.co') +
			'/auth/v1/health\n' +
			'Должен появиться текст про apikey — если вкладка пустая или «сброс соединения», блокирует провайдер или ПК.'
		)
	}

	async function probeSupabaseReachability() {
		var c = getConfig()
		if (!c.supabaseUrl || !c.supabaseAnonKey) {
			return { ok: false, reason: 'no_config' }
		}
		var ctrl =
			typeof AbortController !== 'undefined' ? new AbortController() : null
		var tid = ctrl
			? setTimeout(function () {
					ctrl.abort()
				}, 10000)
			: null
		try {
			var res = await global.fetch(c.supabaseUrl + '/auth/v1/health', {
				method: 'GET',
				headers: { apikey: c.supabaseAnonKey },
				signal: ctrl ? ctrl.signal : undefined,
				mode: 'cors',
				cache: 'no-store',
			})
			if (tid) clearTimeout(tid)
			/* Любой HTTP-ответ = сеть до Supabase есть (401 без ключа тоже ок для проверки) */
			var reachable = res.status >= 200 && res.status < 600
			return {
				ok: reachable,
				status: res.status,
				reason: reachable ? 'ok' : 'http_' + res.status,
				healthUrl: c.supabaseUrl + '/auth/v1/health',
			}
		} catch (err) {
			if (tid) clearTimeout(tid)
			return {
				ok: false,
				reason: isNetworkError(err) ? 'blocked_or_offline' : 'error',
				err: err,
			}
		}
	}

	function formatAuthError(err) {
		if (!err) return 'Неизвестная ошибка'
		if (typeof err === 'string') return err
		var msg = errorText(err)
		if (isMissingApplicantReplyColumn(err)) {
			return 'В Supabase не выполнена миграция диалога. SQL Editor → вставь и запусти docs/supabase-whitelist-dialog.sql (или supabase-grants-fix.sql + dialog).'
		}
		if (isInvalidApiKeyError(err)) {
			return (
				'Неверный API-ключ Supabase. В GitHub → Settings → Secrets укажи SUPABASE_ANON_KEY: publishable (sb_publishable_…) или anon legacy (eyJ…) из Supabase → Settings → API Keys. Затем Actions → Deploy Pages → Run workflow.'
			)
		}
		if (err.code === '42501' || /permission denied for table/i.test(msg)) {
			return 'Нет доступа к таблице в Supabase. SQL Editor → запусти docs/supabase-grants-fix.sql, затем перезайди на сайт.'
		}
		if (isSessionTimeoutError(err)) {
			return (
				'Supabase отвечает слишком долго. Обнови страницу (Ctrl+F5) или нажми «Повторить загрузку». Если ты уже вошёл — подожди 10–20 секунд: сессия подтянется из браузера.'
			)
		}
		if (isNetworkError(err)) {
			return (
				'Соединение с Supabase сброшено (ERR_CONNECTION_RESET) — часто блокировщик, VPN или фильтр провайдера. Отключи AdBlock для isnix.ru и *.supabase.co, попробуй другую сеть или VPN. Проект Supabase не должен быть на паузе. Инструкция: github.com/NIXXXON177/isnix.ru/blob/main/docs/supabase-cors-troubleshooting.md'
			)
		}
		if (err.code === 'PGRST301' || /JWT|session/i.test(msg)) {
			return 'Сессия истекла — выйди и войди снова.'
		}
		if (
			/forbidden|not allowed/i.test(msg) &&
			!/permission denied for table/i.test(msg)
		) {
			return 'Нет прав на это действие. Проверь, что в Supabase у аккаунта role = admin и выполнен docs/supabase-whitelist-dialog.sql.'
		}
		if (/application_not_found_or_not_pending/i.test(msg)) {
			return 'Заявка уже обработана или не найдена — обнови страницу.'
		}
		if (/no_admin_message_yet/i.test(msg)) {
			return 'Сначала дождись вопроса от администрации.'
		}
		if (/reply_too_short/i.test(msg)) {
			return 'Ответ слишком короткий (минимум 3 символа).'
		}
		if (/Could not find the function|PGRST202/i.test(msg)) {
			return 'На сервере не включён диалог по заявкам. Выполни в Supabase SQL из docs/supabase-whitelist-dialog.sql.'
		}
		if (isNotificationTriggerError(err)) {
			return (
				'Сообщение не сохранилось из‑за уведомлений в Supabase. SQL Editor → выполни docs/supabase-fix-notify-safe.sql (и docs/supabase-whitelist-dialog.sql, если ещё не делал).'
			)
		}
		return msg || 'Ошибка авторизации'
	}

	function supabaseStorageKey() {
		var url = getConfig().supabaseUrl
		var m = url.match(/https:\/\/([^.]+)\.supabase\.co/)
		return m ? 'sb-' + m[1] + '-auth-token' : null
	}

	function parseStoredAuthPayload(raw) {
		if (!raw) return null
		try {
			var data = JSON.parse(raw)
			if (data && data.user && data.access_token) return data
			if (data && data.currentSession && data.currentSession.user) {
				return data.currentSession
			}
			if (Array.isArray(data) && data.length && data[0] && data[0].user) {
				return data[0]
			}
		} catch (_e) {
			return null
		}
		return null
	}

	function isStoredSessionValid(session) {
		if (!session || !session.user || !session.access_token) return false
		var exp = session.expires_at
		if (typeof exp === 'number' && exp * 1000 < Date.now() + 8000) {
			return false
		}
		return true
	}

	function readStoredSession() {
		if (!isReady()) return null
		try {
			var key = supabaseStorageKey()
			if (!key) return null
			var session = parseStoredAuthPayload(localStorage.getItem(key))
			return isStoredSessionValid(session) ? session : null
		} catch (_e) {
			return null
		}
	}

	function scheduleSessionBackgroundRefresh() {
		if (sessionBackgroundRefresh) return
		var sb = getClient()
		if (!sb) return
		sessionBackgroundRefresh = sb.auth
			.getSession()
			.then(function (res) {
				sessionBackgroundRefresh = null
				if (res.error) return null
				return res.data.session
			})
			.catch(function () {
				sessionBackgroundRefresh = null
				return null
			})
	}

	async function getSession(opts) {
		var sb = getClient()
		var stored = readStoredSession()
		if (!sb) return stored

		var preferCache = !opts || opts.preferCache !== false
		if (preferCache && stored) {
			scheduleSessionBackgroundRefresh()
			return stored
		}

		if (sessionInflight) return sessionInflight

		sessionInflight = new Promise(function (resolve) {
			var settled = false
			var tid = setTimeout(function () {
				if (settled) return
				settled = true
				sessionInflight = null
				resolve(readStoredSession())
			}, SESSION_TIMEOUT_MS)
			sb.auth
				.getSession()
				.then(function (res) {
					if (settled) return
					settled = true
					clearTimeout(tid)
					sessionInflight = null
					if (res.error) {
						resolve(readStoredSession())
						return
					}
					resolve(res.data.session)
				})
				.catch(function (err) {
					if (settled) return
					settled = true
					clearTimeout(tid)
					sessionInflight = null
					if (isNetworkError(err) || isSessionTimeoutError(err)) {
						resolve(readStoredSession())
						return
					}
					resolve(readStoredSession())
				})
		})
		return sessionInflight
	}

	function isSessionTimeoutError(err) {
		return /таймаут подключения к supabase/i.test(errorText(err))
	}

	function sitePresenceQueryDisabled() {
		try {
			return localStorage.getItem('isnix_skip_site_presence_cols') === '1'
		} catch (_e) {
			return false
		}
	}

	function disableSitePresenceQuery() {
		try {
			localStorage.setItem('isnix_skip_site_presence_cols', '1')
		} catch (_e) {
			/* ignore */
		}
	}

	async function signUp(email, password) {
		var sb = getClient()
		if (!sb) throw new Error('Аккаунты на сайте ещё не подключены')
		var redirectTo =
			global.location.origin +
			global.location.pathname.replace(/[^/]+$/, '') +
			'account.html'
		var res = await sb.auth.signUp({
			email: email,
			password: password,
			options: { emailRedirectTo: redirectTo },
		})
		if (res.error) throw res.error
		return res.data
	}

	async function signIn(email, password) {
		var sb = getClient()
		if (!sb) throw new Error('Аккаунты на сайте ещё не подключены')
		var res = await sb.auth.signInWithPassword({ email: email, password: password })
		if (res.error) throw res.error
		return res.data
	}

	async function signOut() {
		var sb = getClient()
		if (!sb) return
		var res = await sb.auth.signOut()
		if (res.error) throw res.error
		clearProfileMemCache()
	}

	var SITE_PRESENCE_ONLINE_MS = 120000

	function detectSiteDevice() {
		var ua = navigator.userAgent || ''
		if (
			/iPad|Tablet|PlayBook|Silk/i.test(ua) ||
			(navigator.maxTouchPoints > 1 &&
				global.matchMedia('(min-width: 768px) and (max-width: 1100px)').matches)
		) {
			return 'tablet'
		}
		if (
			/Android|iPhone|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua) ||
			global.matchMedia('(max-width: 767px)').matches
		) {
			return 'mobile'
		}
		return 'desktop'
	}

	function formatSiteDeviceLabel(device) {
		if (device === 'mobile') return 'Телефон'
		if (device === 'tablet') return 'Планшет'
		if (device === 'desktop') return 'ПК'
		return 'ПК'
	}

	function isSitePresenceOnline(profileOrSeenAt, device) {
		var seenAt =
			profileOrSeenAt && profileOrSeenAt.site_last_seen_at
				? profileOrSeenAt.site_last_seen_at
				: profileOrSeenAt
		if (!seenAt) return false
		var t = new Date(seenAt).getTime()
		if (isNaN(t)) return false
		return Date.now() - t < SITE_PRESENCE_ONLINE_MS
	}

	async function sitePresenceHeartbeat(device) {
		if (isSupabaseBackoffActive()) return false
		var sb = getClient()
		if (!sb) return false
		try {
			var res = await sb.rpc('site_presence_heartbeat', {
				p_device: device || detectSiteDevice(),
			})
			if (res.error) {
				if (
					res.error.code === 'PGRST202' ||
					/PGRST202|site_presence_heartbeat/i.test(res.error.message || '')
				) {
					return false
				}
				if (isNetworkError(res.error)) {
					noteSupabaseNetworkFailure(res.error)
					return false
				}
				return false
			}
			clearSupabaseBackoff()
			return true
		} catch (err) {
			if (isNetworkError(err)) noteSupabaseNetworkFailure(err)
			return false
		}
	}

	async function queryProfile(sb, userId, withSitePresence) {
		var fields = withSitePresence
			? 'minecraft_nick, display_name, email, role, created_at, site_last_seen_at, site_device'
			: 'minecraft_nick, display_name, email, role, created_at'
		return sb.from('profiles').select(fields).eq('id', userId).maybeSingle()
	}

	async function fetchProfileFromServer(userId) {
		if (isSupabaseBackoffActive()) {
			var hit = profileMemCache[userId]
			if (hit && hit.p) return hit.p
			var diskBackoff = readProfileDiskCache(userId)
			if (diskBackoff) return diskBackoff
			throw new Error('ERR_CONNECTION_RESET')
		}
		var sb = getClient()
		if (!sb) return null
		var withSite = !sitePresenceQueryDisabled()
		var res = await queryProfile(sb, userId, withSite)
		if (res.error && isMissingSitePresenceColumns(res.error)) {
			disableSitePresenceQuery()
			res = await queryProfile(sb, userId, false)
		}
		if (res.error) {
			noteSupabaseNetworkFailure(res.error)
			throw res.error
		}
		clearSupabaseBackoff()
		return res.data
	}

	async function getProfile(userId, opts) {
		if (!userId) return null
		var force = opts && opts.force
		var cached = profileMemCache[userId]
		if (!force && cached && Date.now() - cached.t < PROFILE_MEM_TTL_MS) {
			return cached.p
		}
		if (!force && isSupabaseBackoffActive()) {
			if (cached && cached.p) return cached.p
			var diskPaused = readProfileDiskCache(userId)
			if (diskPaused) {
				profileMemCache[userId] = { p: diskPaused, t: Date.now() }
				return diskPaused
			}
		}
		if (!force) {
			var disk = readProfileDiskCache(userId)
			if (disk) {
				profileMemCache[userId] = { p: disk, t: Date.now() }
			}
		}
		if (profileInflight[userId]) return profileInflight[userId]
		profileInflight[userId] = fetchProfileFromServer(userId)
			.then(function (data) {
				delete profileInflight[userId]
				if (data) {
					profileMemCache[userId] = { p: data, t: Date.now() }
					writeProfileDiskCache(userId, data)
				}
				return data
			})
			.catch(function (err) {
				delete profileInflight[userId]
				if (isNetworkError(err) || isSessionTimeoutError(err)) {
					var fallback = readProfileDiskCache(userId)
					if (fallback) {
						profileMemCache[userId] = { p: fallback, t: Date.now() }
						return fallback
					}
				}
				throw err
			})
		return profileInflight[userId]
	}

	function profileDiskKey(userId) {
		return PROFILE_DISK_PREFIX + userId
	}

	function readProfileDiskCache(userId) {
		if (!userId) return null
		try {
			var raw = localStorage.getItem(profileDiskKey(userId))
			if (!raw) return null
			var o = JSON.parse(raw)
			if (!o || !o.p || Date.now() - o.t > PROFILE_DISK_TTL_MS) return null
			o.p.id = userId
			return o.p
		} catch (_e) {
			return null
		}
	}

	function writeProfileDiskCache(userId, profile) {
		if (!userId || !profile) return
		try {
			localStorage.setItem(
				profileDiskKey(userId),
				JSON.stringify({ p: profile, t: Date.now() }),
			)
		} catch (_e) {
			/* ignore */
		}
	}

	function clearProfileMemCache(userId) {
		if (userId) {
			delete profileMemCache[userId]
			try {
				localStorage.removeItem(profileDiskKey(userId))
			} catch (_e) {
				/* ignore */
			}
			return
		}
		profileMemCache = {}
	}

	function isAdminProfile(profile) {
		if (!profile || profile.role !== 'admin') return false
		var email = (profile.email || '').trim().toLowerCase()
		return SITE_ADMIN_EMAILS.indexOf(email) !== -1
	}

	async function isCurrentUserAdmin() {
		var session = await getSession()
		if (!session || !session.user) return false
		var profile = await getProfile(session.user.id)
		return isAdminProfile(profile)
	}

	async function updateProfile(userId, fields) {
		var sb = getClient()
		if (!sb) throw new Error('Нет подключения')
		var payload = {}
		if (fields.minecraft_nick !== undefined) {
			payload.minecraft_nick = fields.minecraft_nick || null
		}
		if (fields.display_name !== undefined) {
			payload.display_name = fields.display_name || null
		}
		var res = await sb.from('profiles').update(payload).eq('id', userId)
		if (res.error) throw res.error
		clearProfileMemCache(userId)
	}

	var APP_SELECT_BASE =
		'id, minecraft_nick, call_name, age, reason, read_rules, downloaded_modpack, referral_source, status, admin_note, created_at'
	var APP_SELECT_WITH_REPLY = APP_SELECT_BASE + ', applicant_reply'
	var APP_SELECT_FALLBACK =
		'id, minecraft_nick, call_name, age, reason, status, admin_note, created_at'
	var APP_SELECT_WITH_REPLY_FALLBACK = APP_SELECT_FALLBACK + ', applicant_reply'
	var APP_ADMIN_SELECT_BASE =
		'id, user_id, minecraft_nick, call_name, age, reason, read_rules, downloaded_modpack, referral_source, status, admin_note, applicant_email, created_at'
	var APP_ADMIN_SELECT_WITH_REPLY = APP_ADMIN_SELECT_BASE + ', applicant_reply'
	var APP_ADMIN_SELECT_FALLBACK =
		'id, user_id, minecraft_nick, call_name, age, reason, status, admin_note, applicant_email, created_at'
	var APP_ADMIN_SELECT_WITH_REPLY_FALLBACK =
		APP_ADMIN_SELECT_FALLBACK + ', applicant_reply'

	function applicationSelectFields(withReply, withV2, admin) {
		if (admin) {
			if (withV2) {
				return withReply ? APP_ADMIN_SELECT_WITH_REPLY : APP_ADMIN_SELECT_BASE
			}
			return withReply
				? APP_ADMIN_SELECT_WITH_REPLY_FALLBACK
				: APP_ADMIN_SELECT_FALLBACK
		}
		if (withV2) {
			return withReply ? APP_SELECT_WITH_REPLY : APP_SELECT_BASE
		}
		return withReply ? APP_SELECT_WITH_REPLY_FALLBACK : APP_SELECT_FALLBACK
	}

	async function queryApplications(sb, userId, withReply, withV2) {
		var fields = applicationSelectFields(withReply, withV2 !== false, false)
		var res = await sb
			.from('whitelist_applications')
			.select(fields)
			.eq('user_id', userId)
			.order('created_at', { ascending: false })
		if (res.error) throw res.error
		return res.data || []
	}

	async function queryAdminApplications(sb, status, withReply, withV2) {
		var fields = applicationSelectFields(withReply, withV2 !== false, true)
		var q = sb
			.from('whitelist_applications')
			.select(fields)
			.order('created_at', { ascending: false })
		if (status) q = q.eq('status', status)
		var res = await q
		if (res.error) throw res.error
		return res.data || []
	}

	async function getApplications(userId) {
		var sb = getClient()
		if (!sb) return []
		return fetchApplicationsWithFallback(function (withReply, withV2) {
			return queryApplications(sb, userId, withReply, withV2)
		})
	}

	async function submitApplication(userId, data) {
		var sb = getClient()
		if (!sb) throw new Error('Нет подключения')
		var payload = validateWhitelistApplicationData(data)
		var row = {
			user_id: userId,
			minecraft_nick: payload.minecraft_nick,
			call_name: payload.call_name,
			age: payload.age,
			reason: payload.reason,
			read_rules: payload.read_rules,
			downloaded_modpack: payload.downloaded_modpack,
			referral_source: payload.referral_source,
		}
		var res = await sb.from('whitelist_applications').insert(row)
		if (res.error && isMissingWhitelistFormV2Columns(res.error)) {
			res = await sb.from('whitelist_applications').insert({
				user_id: userId,
				minecraft_nick: payload.minecraft_nick,
				call_name: payload.call_name,
				age: payload.age,
				reason: payload.reason,
			})
		}
		if (res.error) throw res.error
	}

	async function getAdminApplications(status) {
		var sb = getClient()
		if (!sb) return []
		return fetchApplicationsWithFallback(function (withReply, withV2) {
			return queryAdminApplications(sb, status, withReply, withV2)
		})
	}

	async function getNotifications(userId, limit) {
		if (isSupabaseBackoffActive()) return []
		var sb = getClient()
		if (!sb) return []
		var res = await sb
			.from('user_notifications')
			.select('id, kind, title, body, href, application_id, read_at, created_at')
			.eq('user_id', userId)
			.order('created_at', { ascending: false })
			.limit(limit || 40)
		if (res.error) {
			if (isMissingNotificationsTable(res.error)) return []
			noteSupabaseNetworkFailure(res.error)
			throw res.error
		}
		clearSupabaseBackoff()
		return res.data || []
	}

	async function markNotificationsRead(ids) {
		var sb = getClient()
		if (!sb || !ids || !ids.length) return
		var res = await sb.rpc('mark_notifications_read', { p_ids: ids })
		if (res.error) {
			if (isMissingNotificationsTable(res.error)) return
			throw res.error
		}
	}

	async function sendAdminApplicationMessage(id, adminNote) {
		var sb = getClient()
		if (!sb) throw new Error('Нет подключения')
		var msg = (adminNote || '').trim()
		if (msg.length < 3) {
			throw new Error('Напиши сообщение игроку (минимум 3 символа)')
		}
		var res = await sb.rpc('send_whitelist_admin_message', {
			p_application_id: id,
			p_message: msg,
		})
		if (res.error) {
			var rpcMsg = errorText(res.error)
			if (
				/PGRST202|Could not find the function|send_whitelist_admin_message/i.test(
					rpcMsg,
				)
			) {
				var direct = await sb
					.from('whitelist_applications')
					.update({ admin_note: msg })
					.eq('id', id)
					.eq('status', 'pending')
					.select('id')
				if (direct.error) throw direct.error
				if (!direct.data || !direct.data.length) {
					throw new Error('application_not_found_or_not_pending')
				}
				return
			}
			throw res.error
		}
	}

	async function submitApplicantReply(id, reply) {
		var sb = getClient()
		if (!sb) throw new Error('Нет подключения')
		var res = await sb.rpc('submit_whitelist_applicant_reply', {
			p_application_id: id,
			p_reply: (reply || '').trim(),
		})
		if (res.error) throw res.error
	}

	async function moderateApplication(id, status, adminNote) {
		var sb = getClient()
		if (!sb) throw new Error('Нет подключения')
		if (status !== 'approved' && status !== 'rejected') {
			throw new Error('Неверный статус')
		}
		var payload = { status: status }
		if (adminNote !== undefined) {
			payload.admin_note = (adminNote || '').trim() || null
		}
		var res = await sb
			.from('whitelist_applications')
			.update(payload)
			.eq('id', id)
			.eq('status', 'pending')
			.select('id')
		if (res.error) throw res.error
		if (!res.data || !res.data.length) {
			throw new Error(
				'Не удалось одобрить или отклонить: нет прав (admin в Supabase) или заявка уже обработана. Обнови страницу.',
			)
		}
	}

	async function updatePassword(newPassword) {
		var sb = getClient()
		if (!sb) throw new Error('Нет подключения')
		if ((newPassword || '').length < 6) {
			throw new Error('Новый пароль — минимум 6 символов')
		}
		var res = await sb.auth.updateUser({ password: newPassword })
		if (res.error) throw res.error
	}

	async function getPlayerStats(userId) {
		if (isSupabaseBackoffActive()) return null
		var sb = getClient()
		if (!sb) return null
		var res = await sb
			.from('player_stats')
			.select('total_play_seconds, session_started_at, minecraft_nick, updated_at')
			.eq('user_id', userId)
			.maybeSingle()
		if (res.error) {
			if (
				res.code === 'PGRST205' ||
				res.code === '42P01' ||
				/player_stats/i.test(res.message || '')
			) {
				return null
			}
			noteSupabaseNetworkFailure(res.error)
			throw res.error
		}
		clearSupabaseBackoff()
		return res.data
	}

	async function getAdminProfiles() {
		var sb = getClient()
		if (!sb) return []
		var fieldsWithSite =
			'id, email, minecraft_nick, display_name, role, created_at, site_last_seen_at, site_device'
		var fieldsBase =
			'id, email, minecraft_nick, display_name, role, created_at'
		var res = await sb
			.from('profiles')
			.select(fieldsWithSite)
			.order('created_at', { ascending: false })
		if (res.error && isMissingSitePresenceColumns(res.error)) {
			res = await sb
				.from('profiles')
				.select(fieldsBase)
				.order('created_at', { ascending: false })
		}
		if (res.error) throw res.error
		return res.data || []
	}

	function onAuthStateChange(callback) {
		var sb = getClient()
		if (!sb) return function () {}
		var sub = sb.auth.onAuthStateChange(function (_event, session) {
			callback(session)
		})
		return function () {
			sub.data.subscription.unsubscribe()
		}
	}

	var PROFILE_CACHE_TTL_MS = 300000
	var navDrawerLogoutBound = false

	function readNavProfileCache(userId) {
		try {
			var raw = sessionStorage.getItem('isnix_profile_' + userId)
			if (!raw) return null
			var o = JSON.parse(raw)
			if (!o || !o.p || Date.now() - o.t > PROFILE_CACHE_TTL_MS) return null
			return o.p
		} catch (_e) {
			return null
		}
	}

	function clearNavProfileCaches() {
		try {
			var keys = []
			for (var i = 0; i < sessionStorage.length; i++) {
				var k = sessionStorage.key(i)
				if (k && k.indexOf('isnix_profile_') === 0) keys.push(k)
			}
			keys.forEach(function (k) {
				sessionStorage.removeItem(k)
			})
		} catch (_e) {
			/* ignore */
		}
	}

	var ELY_SKIN_BASE = 'https://skinsystem.ely.by/skins/'

	function elySkinUrl(nick) {
		return ELY_SKIN_BASE + encodeURIComponent((nick || '').trim()) + '.png'
	}

	function mcHeadAvatarFallbackUrl(nick, size) {
		return (
			'https://mc-heads.net/avatar/' +
			encodeURIComponent((nick || '').trim()) +
			'/' +
			(size || 48)
		)
	}

	/** Обрезка лица из PNG скина Ely.by (64×64) в контейнере .ely-head-wrap */
	function applyElyHeadToImg(img, nick, sizePx) {
		if (!img) return
		var s = Math.max(8, Number(sizePx) || 48)
		var nickTrim = (nick || '').trim()
		var wrap = img.parentElement
		if (wrap) wrap.classList.add('ely-head-wrap')
		var scale = s / 8
		var skinDim = 64 * scale
		img.classList.add('ely-head-from-skin')
		img.src = elySkinUrl(nickTrim)
		img.style.width = skinDim + 'px'
		img.style.height = skinDim + 'px'
		img.style.marginLeft = -8 * scale + 'px'
		img.style.marginTop = -8 * scale + 'px'
		img.onerror = function () {
			img.onerror = null
			img.classList.remove('ely-head-from-skin')
			img.style.width = s + 'px'
			img.style.height = s + 'px'
			img.style.marginLeft = ''
			img.style.marginTop = ''
			img.src = mcHeadAvatarFallbackUrl(nickTrim, s)
		}
	}

	function mcHeadAvatarUrl(nick, size) {
		return elySkinUrl(nick)
	}

	function closeMobileNavMenu() {
		var menu = document.getElementById('navMenu')
		var backdrop = document.getElementById('navBackdrop')
		var toggle = document.getElementById('navToggle')
		if (menu) menu.classList.remove('is-open')
		if (backdrop) backdrop.classList.remove('is-visible')
		document.documentElement.classList.remove('nav-open')
		document.body.classList.remove('nav-open')
		if (toggle) {
			toggle.setAttribute('aria-expanded', 'false')
			toggle.setAttribute('aria-label', 'Открыть меню')
		}
		if (menu) menu.setAttribute('aria-hidden', 'true')
		if (backdrop) backdrop.setAttribute('aria-hidden', 'true')
	}

	function updateNavDrawerAuth(session, profile) {
		var authWrap = document.getElementById('navDrawerAuth')
		var loginEl = document.getElementById('navDrawerLogin')
		var userEl = document.getElementById('navDrawerUser')
		var logoutBtn = document.getElementById('navDrawerLogout')
		var nickEl = document.getElementById('navDrawerNick')
		var emailEl = document.getElementById('navDrawerEmail')
		var avatarImg = document.getElementById('navDrawerAvatar')
		var avatarFb = document.getElementById('navDrawerAvatarFb')
		if (!loginEl && !userEl) return

		var loggedIn = isReady() && session && session.user
		if (authWrap) {
			authWrap.classList.toggle('nav-drawer-auth--user', !!loggedIn)
			authWrap.classList.toggle('nav-drawer-auth--guest', !loggedIn)
		}
		if (!loggedIn) {
			if (loginEl) {
				loginEl.hidden = false
				loginEl.style.display = ''
			}
			if (userEl) {
				userEl.hidden = true
				userEl.style.display = 'none'
			}
			if (logoutBtn) logoutBtn.hidden = true
			return
		}

		if (loginEl) {
			loginEl.hidden = true
			loginEl.style.display = 'none'
		}
		if (userEl) {
			userEl.hidden = false
			userEl.style.display = ''
		}
		if (logoutBtn) logoutBtn.hidden = false

		var email =
			(profile && profile.email) || session.user.email || '—'
		var nick =
			profile && profile.minecraft_nick
				? String(profile.minecraft_nick).trim()
				: ''

		if (emailEl) emailEl.textContent = email
		if (nickEl) {
			nickEl.textContent = nick || 'Профиль'
		}

		if (userEl) {
			var admin = isAdminProfile(profile)
			userEl.classList.toggle('nav-drawer-auth__user--admin', admin)
			userEl.href = admin ? 'account.html#admin' : 'account.html'
		}

		if (avatarImg && avatarFb) {
			if (nick && MC_NICK_RE.test(nick)) {
				applyElyHeadToImg(avatarImg, nick, 40)
				avatarImg.alt = nick
				avatarImg.hidden = false
				avatarFb.hidden = true
			} else {
				avatarImg.hidden = true
				avatarImg.removeAttribute('src')
				avatarFb.hidden = false
				avatarFb.textContent = (email.charAt(0) || '?').toUpperCase()
			}
		}
	}

	function updateNavAccountLink(session, profile) {
		var el = document.getElementById('navAccountBtn')
		if (!el) return
		if (!isReady()) {
			el.textContent = 'Аккаунт'
			el.setAttribute('href', 'account.html')
			el.classList.remove('nav-btn--admin')
			return
		}
		if (session && session.user) {
			el.textContent = isAdminProfile(profile) ? 'Админ' : 'Кабинет'
			el.setAttribute('href', isAdminProfile(profile)
				? 'account.html#admin'
				: 'account.html')
			el.classList.toggle('nav-btn--admin', isAdminProfile(profile))
		} else {
			el.textContent = 'Вход'
			el.setAttribute('href', 'account.html')
			el.classList.remove('nav-btn--admin')
		}
	}

	function applyNavAuthUi(session, profile) {
		updateNavAccountLink(session, profile)
		updateNavDrawerAuth(session, profile)
	}

	async function refreshNavAccountLink(session) {
		if (!session || !session.user) {
			applyNavAuthUi(null, null)
			return
		}

		var quick = readNavProfileCache(session.user.id)
		if (quick) {
			quick.email = quick.email || session.user.email
			applyNavAuthUi(session, quick)
		} else {
			applyNavAuthUi(session, { email: session.user.email })
		}

		try {
			var profile = await getProfile(session.user.id)
			if (profile && session.user.email) {
				profile.email = profile.email || session.user.email
			}
			try {
				sessionStorage.setItem(
					'isnix_profile_' + session.user.id,
					JSON.stringify({ p: profile, t: Date.now() }),
				)
			} catch (_e) {
				/* ignore */
			}
			applyNavAuthUi(session, profile)
		} catch (_e) {
			applyNavAuthUi(session, { email: session.user.email })
		}
	}

	function bindNavDrawerLogout() {
		if (navDrawerLogoutBound) return
		var btn = document.getElementById('navDrawerLogout')
		if (!btn) return
		navDrawerLogoutBound = true
		btn.addEventListener('click', async function () {
			if (!isReady()) return
			btn.disabled = true
			try {
				await signOut()
				clearNavProfileCaches()
				applyNavAuthUi(null, null)
				closeMobileNavMenu()
				if (document.body.getAttribute('data-page') === 'account') {
					window.location.reload()
				}
			} catch (err) {
				global.alert(formatAuthError(err))
			} finally {
				btn.disabled = false
			}
		})
	}

	async function initNavAuth() {
		bindNavDrawerLogout()
		if (!isReady()) {
			applyNavAuthUi(null, null)
			return
		}
		var stored = readStoredSession()
		if (stored && stored.user) {
			var quick = readNavProfileCache(stored.user.id)
			applyNavAuthUi(stored, quick || { email: stored.user.email })
		} else {
			applyNavAuthUi(null, null)
		}
		try {
			var session = await getSession()
			await refreshNavAccountLink(session)
		} catch (_e) {
			/* ignore */
		}
		onAuthStateChange(function (session) {
			refreshNavAccountLink(session)
		})
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initNavAuth)
	} else {
		initNavAuth()
	}

	global.IsnixAuth = {
		getConfig: getConfig,
		isReady: isReady,
		getClient: getClient,
		readStoredSession: readStoredSession,
		getSession: getSession,
		signUp: signUp,
		signIn: signIn,
		signOut: signOut,
		getProfile: getProfile,
		getProfileDiskCache: readProfileDiskCache,
		getPlayerStats: getPlayerStats,
		isAdminProfile: isAdminProfile,
		isCurrentUserAdmin: isCurrentUserAdmin,
		updateProfile: updateProfile,
		getApplications: getApplications,
		getAdminApplications: getAdminApplications,
		sendAdminApplicationMessage: sendAdminApplicationMessage,
		submitApplicantReply: submitApplicantReply,
		moderateApplication: moderateApplication,
		submitApplication: submitApplication,
		validateWhitelistApplicationData: validateWhitelistApplicationData,
		getNotifications: getNotifications,
		markNotificationsRead: markNotificationsRead,
		updatePassword: updatePassword,
		getAdminProfiles: getAdminProfiles,
		onAuthStateChange: onAuthStateChange,
		formatAuthError: formatAuthError,
		probeSupabaseReachability: probeSupabaseReachability,
		networkHelpText: networkHelpText,
		detectSiteDevice: detectSiteDevice,
		formatSiteDeviceLabel: formatSiteDeviceLabel,
		isSitePresenceOnline: isSitePresenceOnline,
		sitePresenceHeartbeat: sitePresenceHeartbeat,
		isSupabaseBackoffActive: isSupabaseBackoffActive,
		clearSupabaseBackoff: clearSupabaseBackoff,
		SITE_PRESENCE_ONLINE_MS: SITE_PRESENCE_ONLINE_MS,
		MC_NICK_RE: MC_NICK_RE,
		elySkinUrl: elySkinUrl,
		applyElyHeadToImg: applyElyHeadToImg,
		mcHeadAvatarFallbackUrl: mcHeadAvatarFallbackUrl,
		mcHeadAvatarUrl: mcHeadAvatarUrl,
	}
})(window)
