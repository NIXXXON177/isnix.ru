;(function (global) {
	'use strict'

	var MC_NICK_RE = /^[a-zA-Z0-9_]{3,16}$/
	var LOGIN_RE = /^[a-zA-Z0-9_]{3,24}$/
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

	function normalizeLogin(login) {
		return String(login || '')
			.trim()
			.replace(/\s+/g, '')
			.toLowerCase()
	}

	function loginToTechEmail(login) {
		var l = normalizeLogin(login)
		if (!LOGIN_RE.test(l)) return null
		// Supabase Auth требует поле email, но мы используем технический идентификатор.
		return l + '@isnix.invalid'
	}

	/** Вход: логин → login@isnix.invalid; старые аккаунты — полный email в поле «Логин». */
	function resolveAuthEmail(input) {
		var v = String(input || '').trim()
		if (!v) return null
		if (v.indexOf('@') !== -1) {
			return v.toLowerCase()
		}
		return loginToTechEmail(v)
	}

	function getConfig() {
		var c = global.ISNIX_AUTH || {}
		return {
			enabled: !!c.enabled,
			supabaseUrl: (c.supabaseUrl || '').trim(),
			supabaseAnonKey: (c.supabaseAnonKey || '').trim(),
			elySkinProxyUrl: (c.elySkinProxyUrl || '').trim(),
		}
	}

	/** HTTPS-прокси скина (Worker / api.isnix.ru) — не *.supabase.co */
	function elySkinProxyBase() {
		var cfg = getConfig()
		var proxy = (cfg.elySkinProxyUrl || '').trim()
		if (proxy && !/\.supabase\.co/i.test(proxy)) {
			return proxy.replace(/\/?$/, '/')
		}
		var sup = cfg.supabaseUrl.replace(/\/$/, '')
		if (/\.workers\.dev$/i.test(sup) || /api\.isnix\.ru$/i.test(sup)) {
			return sup + '/ely/skin/'
		}
		return 'https://api.isnix.ru/ely/skin/'
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
			/read_rules|downloaded_modpack|referral_source|referred_by_nick/i.test(msg) &&
			/does not exist|42703|PGRST204/i.test(msg)
		)
	}

	function isMissingReferralSystem(err) {
		var msg = errorText(err)
		return (
			/referrals|get_my_referral_summary|referred_by_nick/i.test(msg) &&
			/does not exist|42703|PGRST204|42P01|PGRST202/i.test(msg)
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
		var referredBy = (data.referred_by_nick || '').trim()
		if (referredBy) {
			if (!MC_NICK_RE.test(referredBy)) {
				throw new Error('Ник пригласившего: 3–16 символов, латиница, цифры и _')
			}
			if (referredBy.toLowerCase() === nick.toLowerCase()) {
				throw new Error('Нельзя указать свой ник как пригласившего')
			}
		}
		return {
			minecraft_nick: nick,
			call_name: (data.call_name || '').trim() || null,
			age: String(ageNum),
			reason: reason,
			read_rules: true,
			downloaded_modpack: true,
			referral_source: referral || null,
			referred_by_nick: referredBy || null,
		}
	}

	function isMissingSitePresenceColumns(err) {
		var msg = errorText(err)
		return (
			/site_last_seen_at|site_device/i.test(msg) &&
			/does not exist|42703|PGRST204/i.test(msg)
		)
	}

	function isMissingPrefixColumns(err) {
		var msg = errorText(err)
		return (
			/minecraft_prefix|server_is_admin/i.test(msg) &&
			/does not exist|42703|PGRST204/i.test(msg)
		)
	}

	function sleep(ms) {
		return new Promise(function (resolve) {
			setTimeout(resolve, ms)
		})
	}

	/** Повтор только для GET; PATCH/POST при сбое не дублируем (иначе лавина запросов). */
	var FETCH_GET_TIMEOUT_MS = 20000

	function fetchWithRetry(url, options) {
		var method = ((options && options.method) || 'GET').toUpperCase()
		var delays = method === 'GET' || method === 'HEAD' ? [0, 280] : [0]
		var useTimeout =
			(method === 'GET' || method === 'HEAD') &&
			!(options && options.signal)

		function attempt(i) {
			var opts = options ? Object.assign({}, options) : {}
			var controller
			var timer
			if (useTimeout) {
				controller = new AbortController()
				opts.signal = controller.signal
				timer = setTimeout(function () {
					try {
						controller.abort()
					} catch (_abortErr) {
						/* ignore */
					}
				}, FETCH_GET_TIMEOUT_MS)
			}
			return global
				.fetch(url, opts)
				.finally(function () {
					if (timer) clearTimeout(timer)
				})
				.catch(function (err) {
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
			return 'Обращения на сайте ещё не включены. В Supabase SQL Editor выполни docs/supabase-support-tickets.sql (и docs/supabase-whitelist-dialog.sql для заявок).'
		}
		if (/support_tickets|PGRST205.*support/i.test(msg)) {
			return 'Таблица обращений не создана. Выполни в Supabase: docs/supabase-support-tickets.sql'
		}
		if (/subject_too_short/i.test(msg)) {
			return 'Тема обращения слишком короткая (минимум 3 символа).'
		}
		if (/body_too_short/i.test(msg)) {
			return 'Текст слишком короткий.'
		}
		if (/ticket_closed/i.test(msg)) {
			return 'Обращение уже закрыто.'
		}
		if (/ticket_not_closed/i.test(msg)) {
			return 'Удалить можно только закрытое обращение.'
		}
		if (/wait_for_admin/i.test(msg)) {
			return 'Дождись ответа администрации.'
		}
		if (/invalid_category/i.test(msg)) {
			return 'Выбери тип обращения из списка.'
		}
		if (/invalid_storage_path|support-evidence|Bucket not found/i.test(msg)) {
			return 'Загрузка файлов не настроена. В Supabase выполни docs/supabase-support-storage.sql'
		}
		if (/payload too large|413|file_size_limit/i.test(msg)) {
			return 'Файл слишком большой (максимум 25 МБ на файл).'
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

	function prefixMetaQueryDisabled() {
		try {
			return localStorage.getItem('isnix_skip_prefix_cols') === '1'
		} catch (_e) {
			return false
		}
	}

	function disablePrefixMetaQuery() {
		try {
			localStorage.setItem('isnix_skip_prefix_cols', '1')
		} catch (_e) {
			/* ignore */
		}
	}

	async function signUp(login, password) {
		var sb = getClient()
		if (!sb) throw new Error('Аккаунты на сайте ещё не подключены')
		var email = loginToTechEmail(login)
		if (!email) {
			throw new Error('Логин: 3–24 символа, латиница, цифры и _')
		}
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

	async function signIn(login, password) {
		var sb = getClient()
		if (!sb) throw new Error('Аккаунты на сайте ещё не подключены')
		var email = resolveAuthEmail(login)
		if (!email) {
			throw new Error('Логин: 3–24 символа, латиница, цифры и _')
		}
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

	async function queryProfile(sb, userId, withSitePresence, withPrefixMeta) {
		var fields = 'login, minecraft_nick, display_name, email, role, created_at'
		if (withSitePresence) {
			fields += ', site_last_seen_at, site_device'
		}
		if (withPrefixMeta) {
			fields += ', minecraft_prefix, server_is_admin'
		}
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
		var withPrefix = !prefixMetaQueryDisabled()
		var res = await queryProfile(sb, userId, withSite, withPrefix)
		if (res.error && isMissingSitePresenceColumns(res.error)) {
			disableSitePresenceQuery()
			withSite = false
			res = await queryProfile(sb, userId, false, withPrefix)
		}
		if (res.error && isMissingPrefixColumns(res.error)) {
			disablePrefixMetaQuery()
			res = await queryProfile(sb, userId, withSite, false)
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
		return !!(profile && profile.role === 'admin')
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
		if (fields.login !== undefined) {
			payload.login = fields.login || null
		}
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
		'id, minecraft_nick, call_name, age, reason, read_rules, downloaded_modpack, referral_source, referred_by_nick, status, admin_note, created_at'
	var APP_SELECT_WITH_REPLY = APP_SELECT_BASE + ', applicant_reply'
	var APP_SELECT_FALLBACK =
		'id, minecraft_nick, call_name, age, reason, status, admin_note, created_at'
	var APP_SELECT_WITH_REPLY_FALLBACK = APP_SELECT_FALLBACK + ', applicant_reply'
	var APP_ADMIN_SELECT_BASE =
		'id, user_id, minecraft_nick, call_name, age, reason, read_rules, downloaded_modpack, referral_source, referred_by_nick, status, admin_note, created_at'
	var APP_ADMIN_SELECT_WITH_REPLY = APP_ADMIN_SELECT_BASE + ', applicant_reply'
	var APP_ADMIN_SELECT_FALLBACK =
		'id, user_id, minecraft_nick, call_name, age, reason, status, admin_note, created_at'
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

	function applyAdminApplicationsFilter(q, filter) {
		if (filter === 'pending') {
			return q.eq('status', 'pending')
		}
		if (filter === 'awaiting_reply') {
			return q
				.eq('status', 'pending')
				.not('admin_note', 'is', null)
				.neq('admin_note', '')
				.is('applicant_reply', null)
		}
		return q
	}

	async function queryApplications(sb, userId, withReply, withV2, pageOpts) {
		var fields = applicationSelectFields(withReply, withV2 !== false, false)
		var q = sb
			.from('whitelist_applications')
			.select(
				fields,
				pageOpts && pageOpts.page ? { count: 'exact' } : undefined,
			)
			.eq('user_id', userId)
			.order('created_at', { ascending: false })
		if (pageOpts && pageOpts.page) {
			var page = Math.max(1, parseInt(pageOpts.page, 10) || 1)
			var pageSize = Math.min(
				20,
				Math.max(1, parseInt(pageOpts.pageSize, 10) || 5),
			)
			var from = (page - 1) * pageSize
			var to = from + pageSize - 1
			var res = await q.range(from, to)
			if (res.error) throw res.error
			return {
				applications: res.data || [],
				total: res.count == null ? (res.data || []).length : res.count,
				page: page,
				pageSize: pageSize,
			}
		}
		var res = await q
		if (res.error) throw res.error
		return res.data || []
	}

	async function queryAdminApplications(sb, filter, withReply, withV2, pageOpts) {
		var fields = applicationSelectFields(withReply, withV2 !== false, true)
		var q = sb
			.from('whitelist_applications')
			.select(
				fields,
				pageOpts && pageOpts.page ? { count: 'exact' } : undefined,
			)
			.order('created_at', { ascending: false })
		q = applyAdminApplicationsFilter(q, filter || 'pending')
		if (pageOpts && pageOpts.page) {
			var page = Math.max(1, parseInt(pageOpts.page, 10) || 1)
			var pageSize = Math.min(
				20,
				Math.max(1, parseInt(pageOpts.pageSize, 10) || 5),
			)
			var from = (page - 1) * pageSize
			var to = from + pageSize - 1
			var res = await q.range(from, to)
			if (res.error) throw res.error
			return {
				applications: res.data || [],
				total: res.count == null ? (res.data || []).length : res.count,
				page: page,
				pageSize: pageSize,
			}
		}
		var res = await q
		if (res.error) throw res.error
		return res.data || []
	}

	async function getApplications(userId, opts) {
		var sb = getClient()
		if (!sb) {
			return opts && opts.page
				? { applications: [], total: 0, page: 1, pageSize: 5 }
				: []
		}
		return fetchApplicationsWithFallback(function (withReply, withV2) {
			return queryApplications(sb, userId, withReply, withV2, opts)
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
			referred_by_nick: payload.referred_by_nick,
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

	async function getAdminApplications(filter, opts) {
		var sb = getClient()
		if (!sb) {
			return opts && opts.page
				? { applications: [], total: 0, page: 1, pageSize: 5 }
				: []
		}
		return fetchApplicationsWithFallback(function (withReply, withV2) {
			return queryAdminApplications(sb, filter, withReply, withV2, opts)
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

	async function getReferralsForApplications(applicationIds) {
		var sb = getClient()
		var map = {}
		if (!sb || !applicationIds || !applicationIds.length) return map
		var res = await sb
			.from('referrals')
			.select('id, application_id, referrer_nick, referred_nick, status, rewarded_at')
			.in('application_id', applicationIds)
		if (res.error) {
			if (isMissingReferralSystem(res.error)) return map
			throw res.error
		}
		;(res.data || []).forEach(function (row) {
			if (row && row.application_id) map[row.application_id] = row
		})
		return map
	}

	async function markReferralRewardedByApplication(applicationId) {
		var sb = getClient()
		if (!sb) throw new Error('Нет подключения')
		var res = await sb.rpc('admin_mark_referral_rewarded_by_application', {
			p_application_id: applicationId,
		})
		if (res.error) {
			if (isMissingReferralSystem(res.error)) {
				throw new Error(
					'Рефералка не настроена — выполни docs/supabase-referral-admin-reward.sql в Supabase',
				)
			}
			throw res.error
		}
	}

	async function getReferralSummary() {
		var sb = getClient()
		if (!sb) {
			return { ok: false, pending: 0, qualified: 0, rewarded: 0, total: 0 }
		}
		var res = await sb.rpc('get_my_referral_summary')
		if (res.error) {
			if (isMissingReferralSystem(res.error)) {
				return { ok: false, missing: true }
			}
			throw res.error
		}
		return res.data || { ok: false }
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

	function isMissingReputationRpc(err) {
		var msg = errorText(err)
		return (
			/server_get_reputation|rep_cast_vote|player_reputation/i.test(msg) ||
			(err && (err.code === 'PGRST202' || err.code === '42883'))
		)
	}

	async function getReputation(minecraftNick) {
		var nick = (minecraftNick || '').trim()
		if (!nick || isSupabaseBackoffActive()) return null
		var sb = getClient()
		if (!sb) return null
		var res = await sb.rpc('server_get_reputation', { p_nick: nick })
		if (res.error) {
			if (isMissingReputationRpc(res.error)) return null
			noteSupabaseNetworkFailure(res.error)
			throw res.error
		}
		clearSupabaseBackoff()
		return res.data
	}

	async function castReputationVote(targetNick, vote) {
		var nick = (targetNick || '').trim()
		if (!nick) throw new Error('Укажи ник игрока')
		if (vote !== 1 && vote !== -1) throw new Error('Некорректная оценка')
		var sb = getClient()
		if (!sb) throw new Error('Нет подключения')
		var res = await sb.rpc('rep_cast_vote', {
			p_target_nick: nick,
			p_vote: vote,
		})
		if (res.error) {
			if (isMissingReputationRpc(res.error)) {
				throw new Error(
					'Рейтинг ещё не настроен в базе — выполни docs/supabase-player-reputation.sql в Supabase.',
				)
			}
			throw res.error
		}
		var data = res.data
		if (data && data.ok === false) {
			var code = data.error || 'unknown'
			var msg =
				code === 'self_vote'
					? 'Нельзя голосовать за себя.'
					: code === 'cooldown'
						? 'Вы уже меняли оценку недавно — подождите 7 дней.'
						: code === 'already_voted'
							? 'Вы уже поставили такую оценку.'
							: code === 'target_not_found'
								? 'Игрок не найден или не привязал ник на isnix.ru.'
								: 'Не удалось отправить оценку.'
			throw new Error(msg)
		}
		return data
	}

	function isMissingSupportTables(err) {
		var msg = errorText(err)
		return (
			err &&
			(err.code === 'PGRST205' ||
				err.code === '42P01' ||
				/support_tickets|support_messages|support_attachments/i.test(msg))
		)
	}

	async function attachReporterProfilesToTickets(tickets) {
		if (!tickets || !tickets.length) return tickets
		var sb = getClient()
		if (!sb) return tickets
		var ids = []
		var seen = {}
		tickets.forEach(function (t) {
			if (t.user_id && !seen[t.user_id]) {
				seen[t.user_id] = true
				ids.push(t.user_id)
			}
		})
		if (!ids.length) return tickets
		var res = await sb
			.from('profiles')
			.select('id, login, minecraft_nick, email, display_name')
			.in('id', ids)
		if (res.error) return tickets
		var map = {}
		;(res.data || []).forEach(function (p) {
			map[p.id] = p
		})
		return tickets.map(function (t) {
			var p = map[t.user_id] || {}
			return Object.assign({}, t, {
				reporter_minecraft_nick: p.minecraft_nick || null,
				reporter_email: null,
				reporter_display_name: p.display_name || null,
			})
		})
	}

	async function getSupportTickets(opts) {
		var asAdmin = false
		var filter = 'active'
		var page = 1
		var pageSize = 5
		if (typeof opts === 'boolean') {
			asAdmin = opts
			filter = asAdmin ? 'open' : 'active'
		} else if (opts && typeof opts === 'object') {
			asAdmin = !!opts.asAdmin
			filter = opts.filter || (asAdmin ? 'open' : 'active')
			page = Math.max(1, parseInt(opts.page, 10) || 1)
			pageSize = Math.min(20, Math.max(1, parseInt(opts.pageSize, 10) || 5))
		}
		var sb = getClient()
		if (!sb) throw new Error('Нет подключения')
		var from = (page - 1) * pageSize
		var to = from + pageSize - 1
		var q = sb
			.from('support_tickets')
			.select(
				'id, user_id, category, subject, offender_nick, evidence_url, status, created_at, updated_at',
				{ count: 'exact' },
			)
			.order('updated_at', { ascending: false })
			.range(from, to)
		if (!asAdmin) {
			var session = await getSession()
			if (!session) throw new Error('not_authenticated')
			q = q.eq('user_id', session.user.id)
		}
		if (filter === 'active' || filter === 'open') {
			q = q.neq('status', 'closed')
		} else if (filter === 'closed') {
			q = q.eq('status', 'closed')
		}
		var res = await q
		if (res.error) {
			if (isMissingSupportTables(res.error)) {
				return { tickets: [], total: 0, page: page, pageSize: pageSize }
			}
			throw res.error
		}
		var tickets = res.data || []
		if (asAdmin) {
			tickets = await attachReporterProfilesToTickets(tickets)
		}
		return {
			tickets: tickets,
			total: res.count == null ? tickets.length : res.count,
			page: page,
			pageSize: pageSize,
		}
	}

	async function getSupportMessages(ticketId) {
		var sb = getClient()
		if (!sb) throw new Error('Нет подключения')
		var res = await sb
			.from('support_messages')
			.select('id, ticket_id, author_id, body, is_staff, created_at')
			.eq('ticket_id', ticketId)
			.order('created_at', { ascending: true })
		if (res.error) {
			if (isMissingSupportTables(res.error)) return []
			throw res.error
		}
		return res.data || []
	}

	async function createSupportTicket(payload) {
		var sb = getClient()
		if (!sb) throw new Error('Нет подключения')
		var res = await sb.rpc('create_support_ticket', {
			p_category: payload.category,
			p_subject: payload.subject,
			p_body: payload.body,
			p_offender_nick: payload.offender_nick || null,
			p_evidence_url: payload.evidence_url || null,
		})
		if (res.error) throw res.error
		return res.data
	}

	async function addSupportMessage(ticketId, body) {
		var sb = getClient()
		if (!sb) throw new Error('Нет подключения')
		var res = await sb.rpc('add_support_message', {
			p_ticket_id: ticketId,
			p_body: (body || '').trim(),
		})
		if (res.error) throw res.error
	}

	async function adminReplySupportTicket(ticketId, body) {
		var sb = getClient()
		if (!sb) throw new Error('Нет подключения')
		var res = await sb.rpc('admin_reply_support_ticket', {
			p_ticket_id: ticketId,
			p_body: (body || '').trim(),
		})
		if (res.error) throw res.error
	}

	async function closeSupportTicket(ticketId) {
		var sb = getClient()
		if (!sb) throw new Error('Нет подключения')
		var res = await sb.rpc('close_support_ticket', {
			p_ticket_id: ticketId,
		})
		if (res.error) throw res.error
	}

	async function deleteSupportTicket(ticketId) {
		var sb = getClient()
		if (!sb) throw new Error('Нет подключения')
		var attachments = await getSupportAttachments(ticketId)
		var paths = (attachments || [])
			.map(function (a) {
				return a.storage_path
			})
			.filter(Boolean)
		if (paths.length) {
			var rm = await sb.storage.from(SUPPORT_EVIDENCE_BUCKET).remove(paths)
			if (rm.error && !/not found|404/i.test(errorText(rm.error))) {
				console.warn('support evidence remove:', rm.error)
			}
		}
		var res = await sb.rpc('delete_support_ticket', {
			p_ticket_id: ticketId,
		})
		if (res.error) throw res.error
	}

	var SUPPORT_EVIDENCE_BUCKET = 'support-evidence'
	var SUPPORT_EVIDENCE_MAX_FILES = 5
	var SUPPORT_EVIDENCE_MAX_BYTES = 25 * 1024 * 1024
	var SUPPORT_EVIDENCE_MIMES = {
		'image/jpeg': true,
		'image/png': true,
		'image/webp': true,
		'image/gif': true,
		'video/mp4': true,
		'video/webm': true,
		'video/quicktime': true,
	}
	var SUPPORT_EVIDENCE_EXT_MIME = {
		jpg: 'image/jpeg',
		jpeg: 'image/jpeg',
		png: 'image/png',
		webp: 'image/webp',
		gif: 'image/gif',
		mp4: 'video/mp4',
		m4v: 'video/mp4',
		webm: 'video/webm',
		mov: 'video/quicktime',
		qt: 'video/quicktime',
	}

	function inferEvidenceMime(file) {
		if (!file) return ''
		if (file.type && SUPPORT_EVIDENCE_MIMES[file.type]) return file.type
		var parts = String(file.name || '').split('.')
		var ext = parts.length > 1 ? parts.pop().toLowerCase() : ''
		return SUPPORT_EVIDENCE_EXT_MIME[ext] || file.type || ''
	}

	function isAllowedEvidenceFile(file) {
		var mime = inferEvidenceMime(file)
		return !!mime && SUPPORT_EVIDENCE_MIMES[mime]
	}

	function encodeStorageObjectPath(path) {
		return String(path || '')
			.split('/')
			.map(function (seg) {
				return encodeURIComponent(seg)
			})
			.join('/')
	}

	function xhrStorageUpload(url, file, headers, timeoutMs) {
		return new Promise(function (resolve, reject) {
			var xhr = new XMLHttpRequest()
			xhr.open('POST', url, true)
			xhr.timeout = timeoutMs || 300000
			Object.keys(headers).forEach(function (k) {
				if (headers[k] != null && headers[k] !== '') {
					xhr.setRequestHeader(k, headers[k])
				}
			})
			xhr.onload = function () {
				if (xhr.status >= 200 && xhr.status < 300) {
					try {
						resolve(xhr.responseText ? JSON.parse(xhr.responseText) : {})
					} catch (_e) {
						resolve({})
					}
					return
				}
				var msg = xhr.responseText || xhr.statusText || 'HTTP ' + xhr.status
				reject(new Error(msg))
			}
			xhr.onerror = function () {
				reject(new Error('Failed to fetch'))
			}
			xhr.ontimeout = function () {
				reject(new Error('Превышено время загрузки — попробуйте Wi‑Fi или файл поменьше'))
			}
			xhr.send(file)
		})
	}

	async function uploadEvidenceFileOnce(file, path, contentType) {
		var sb = getClient()
		var cfg = getConfig()
		if (!sb) throw new Error('Нет подключения')
		var session = await getSession()
		if (!session) throw new Error('not_authenticated')
		var base = (cfg.supabaseUrl || '').replace(/\/$/, '')
		var url =
			base +
			'/storage/v1/object/' +
			SUPPORT_EVIDENCE_BUCKET +
			'/' +
			encodeStorageObjectPath(path)
		try {
			return await xhrStorageUpload(
				url,
				file,
				{
					Authorization: 'Bearer ' + session.access_token,
					apikey: cfg.supabaseAnonKey,
					'Content-Type': contentType,
					'x-upsert': 'false',
					'cache-control': '3600',
				},
				300000,
			)
		} catch (xhrErr) {
			var up = await sb.storage.from(SUPPORT_EVIDENCE_BUCKET).upload(path, file, {
				cacheControl: '3600',
				upsert: false,
				contentType: contentType,
			})
			if (up.error) throw xhrErr || up.error
			return up.data
		}
	}

	async function uploadEvidenceFileWithRetry(file, path, contentType) {
		var lastErr = null
		var attempt
		for (attempt = 0; attempt < 3; attempt++) {
			try {
				return await uploadEvidenceFileOnce(file, path, contentType)
			} catch (err) {
				lastErr = err
				if (attempt < 2) {
					await new Promise(function (r) {
						setTimeout(r, 800 * (attempt + 1))
					})
				}
			}
		}
		throw lastErr
	}

	/** Подписанные URL Storage через api.isnix.ru — меньше предупреждений __cf_bm в консоли */
	function rewriteStorageSignedUrl(signedUrl) {
		if (!signedUrl) return signedUrl
		var proxyBase = (getConfig().supabaseUrl || '').replace(/\/$/, '')
		if (!proxyBase) return signedUrl
		try {
			var proxyHost = new URL(proxyBase).hostname
			if (/\.supabase\.co$/i.test(proxyHost)) return signedUrl
			var u = new URL(signedUrl)
			if (!/\.supabase\.co$/i.test(u.hostname)) return signedUrl
			var p = new URL(proxyBase)
			u.protocol = p.protocol
			u.host = p.host
			return u.toString()
		} catch (_e) {
			return signedUrl
		}
	}

	function sanitizeEvidenceFileName(name) {
		var base = String(name || 'file')
			.replace(/[/\\?%*:|"<>]/g, '_')
			.replace(/\s+/g, '_')
		if (base.length > 80) base = base.slice(-80)
		return base || 'file'
	}

	async function getSupportAttachments(ticketId) {
		var sb = getClient()
		if (!sb) throw new Error('Нет подключения')
		var res = await sb
			.from('support_attachments')
			.select('id, ticket_id, storage_path, file_name, mime_type, size_bytes, created_at')
			.eq('ticket_id', ticketId)
			.order('created_at', { ascending: true })
		if (res.error) {
			if (isMissingSupportTables(res.error)) return []
			throw res.error
		}
		var rows = res.data || []
		for (var i = 0; i < rows.length; i++) {
			var row = rows[i]
			if (!row.storage_path) continue
			try {
				var signed = await sb.storage
					.from(SUPPORT_EVIDENCE_BUCKET)
					.createSignedUrl(row.storage_path, 3600)
				if (signed.data && signed.data.signedUrl) {
					row.signed_url = rewriteStorageSignedUrl(signed.data.signedUrl)
				}
			} catch (_e) {
				/* ignore */
			}
		}
		return rows
	}

	async function uploadSupportEvidenceFiles(ticketId, fileList, options) {
		var sb = getClient()
		if (!sb) throw new Error('Нет подключения')
		var session = await getSession()
		if (!session) throw new Error('not_authenticated')
		var uid = session.user.id
		var onProgress = options && options.onProgress
		var uploaded = 0
		var failed = []
		var files = []
		var i
		for (i = 0; i < fileList.length && files.length < SUPPORT_EVIDENCE_MAX_FILES; i++) {
			files.push(fileList[i])
		}
		for (i = 0; i < files.length; i++) {
			var file = files[i]
			if (!file) continue
			if (typeof onProgress === 'function') {
				onProgress(i + 1, files.length, file.name)
			}
			if (file.size > SUPPORT_EVIDENCE_MAX_BYTES) {
				failed.push(file.name + ': больше 25 МБ')
				continue
			}
			if (!isAllowedEvidenceFile(file)) {
				failed.push(file.name + ': недопустимый тип (JPG, PNG, WebP, GIF, MP4, WebM, MOV)')
				continue
			}
			var contentType = inferEvidenceMime(file)
			var path =
				uid +
				'/' +
				ticketId +
				'/' +
				Date.now() +
				'-' +
				sanitizeEvidenceFileName(file.name)
			try {
				await uploadEvidenceFileWithRetry(file, path, contentType)
			} catch (err) {
				failed.push(file.name + ': ' + errorText(err))
				continue
			}
			var reg = await sb.rpc('register_support_attachment', {
				p_ticket_id: ticketId,
				p_storage_path: path,
				p_file_name: file.name,
				p_mime_type: contentType || null,
				p_size_bytes: file.size,
			})
			if (reg.error) {
				failed.push(file.name + ': ' + errorText(reg.error))
				continue
			}
			uploaded++
		}
		return { uploaded: uploaded, failed: failed }
	}

	var notificationsRealtimeChannel = null

	function subscribeUserNotifications(userId, onInsert) {
		var sb = getClient()
		if (!sb || !userId || typeof onInsert !== 'function') {
			return function () {}
		}
		if (notificationsRealtimeChannel) {
			try {
				sb.removeChannel(notificationsRealtimeChannel)
			} catch (_e) {
				/* ignore */
			}
			notificationsRealtimeChannel = null
		}
		notificationsRealtimeChannel = sb
			.channel('user_notifications:' + userId, {
				config: { private: false },
			})
			.on(
				'postgres_changes',
				{
					event: 'INSERT',
					schema: 'public',
					table: 'user_notifications',
					filter: 'user_id=eq.' + userId,
				},
				function (payload) {
					if (payload && payload.new) onInsert(payload.new)
				},
			)
			.subscribe()
		return function () {
			if (notificationsRealtimeChannel) {
				try {
					sb.removeChannel(notificationsRealtimeChannel)
				} catch (_e2) {
					/* ignore */
				}
				notificationsRealtimeChannel = null
			}
		}
	}

	async function getAdminProfiles() {
		var sb = getClient()
		if (!sb) return []
		var fieldsWithSite =
			'id, login, email, minecraft_nick, display_name, role, created_at, site_last_seen_at, site_device'
		var fieldsBase =
			'id, login, email, minecraft_nick, display_name, role, created_at'
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

	function elySkinUrl(nick) {
		return elySkinProxyBase() + encodeURIComponent((nick || '').trim()) + '.png'
	}

	function mcHeadAvatarFallbackUrl(nick, size) {
		return (
			'https://mc-heads.net/avatar/' +
			encodeURIComponent((nick || '').trim()) +
			'/' +
			(size || 48)
		)
	}

	function clearElyHeadBg(wrap) {
		if (!wrap) return
		wrap.classList.remove('ely-head-wrap--skin')
		wrap.style.backgroundImage = ''
		wrap.style.backgroundSize = ''
		wrap.style.backgroundPosition = ''
		wrap.style.backgroundRepeat = ''
		wrap.style.imageRendering = ''
	}

	function clearElyHeadCrop(img, sizePx) {
		var s = Math.max(8, Number(sizePx) || 48)
		var wrap = img.parentElement
		clearElyHeadBg(wrap)
		img.classList.remove('ely-head-from-skin')
		img.style.display = ''
		img.style.width = ''
		img.style.height = ''
		img.style.marginLeft = ''
		img.style.marginTop = ''
		img.removeAttribute('width')
		img.removeAttribute('height')
	}

	/** Лицо 8×8 из текстуры 64×64 через background (img width/height ломали кроп) */
	function applyElyHeadBg(wrap, img, url, sizePx, sheetSize) {
		var s = Math.max(8, Number(sizePx) || 48)
		var sheet = sheetSize >= 128 ? 128 : 64
		var scale = s / 8
		var dim = sheet * scale
		var offset = 8 * scale
		if (wrap) {
			wrap.classList.add('ely-head-wrap', 'ely-head-wrap--skin')
			wrap.style.backgroundImage = 'url(' + JSON.stringify(String(url)) + ')'
			wrap.style.backgroundSize = dim + 'px ' + dim + 'px'
			wrap.style.backgroundPosition = -offset + 'px ' + -offset + 'px'
			wrap.style.backgroundRepeat = 'no-repeat'
			wrap.style.imageRendering = 'pixelated'
		}
		img.classList.remove('ely-head-from-skin')
		img.style.display = 'none'
		img.removeAttribute('src')
	}

	var elySkinHasCache = Object.create(null)
	var elySkinProbeInflight = Object.create(null)

	function probeElySkinHas(nick) {
		var key = (nick || '').trim().toLowerCase()
		if (!key) return Promise.resolve(false)
		if (Object.prototype.hasOwnProperty.call(elySkinHasCache, key)) {
			return Promise.resolve(elySkinHasCache[key])
		}
		if (elySkinProbeInflight[key]) return elySkinProbeInflight[key]
		elySkinProbeInflight[key] = fetch(elySkinUrl(nick), {
			method: 'HEAD',
			mode: 'cors',
			cache: 'no-store',
		})
			.then(function (res) {
				var has = res.ok
				elySkinHasCache[key] = has
				delete elySkinProbeInflight[key]
				return has
			})
			.catch(function () {
				elySkinHasCache[key] = false
				delete elySkinProbeInflight[key]
				return false
			})
		return elySkinProbeInflight[key]
	}

	function applyMcHeadFallback(img, nickTrim, sizePx) {
		var s = Math.max(8, Number(sizePx) || 48)
		clearElyHeadCrop(img, s)
		img.onerror = null
		img.src = mcHeadAvatarFallbackUrl(nickTrim, s)
	}

	/** Ely.by если скин есть, иначе mc-heads (без лишних отменённых запросов) */
	function applyElyHeadToImg(img, nick, sizePx) {
		if (!img) return
		var s = Math.max(8, Number(sizePx) || 48)
		var nickTrim = (nick || '').trim()
		var wrap = img.parentElement
		if (wrap) wrap.classList.add('ely-head-wrap')
		var elyUrl = elySkinUrl(nickTrim)
		img.onerror = null
		clearElyHeadCrop(img, s)
		probeElySkinHas(nickTrim).then(function (has) {
			if (!img.isConnected) return
			if (!has) {
				applyMcHeadFallback(img, nickTrim, s)
				return
			}
			var probe = new Image()
			probe.onload = function () {
				if (!img.isConnected) return
				var sheet =
					probe.naturalWidth >= 128 || probe.naturalHeight >= 128 ? 128 : 64
				applyElyHeadBg(wrap, img, elyUrl, s, sheet)
			}
			probe.onerror = function () {
				applyMcHeadFallback(img, nickTrim, s)
			}
			probe.src = elyUrl
		})
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

		var label =
			(profile && profile.login) ||
			(profile && profile.email) ||
			session.user.email ||
			'—'
		var nick =
			profile && profile.minecraft_nick
				? String(profile.minecraft_nick).trim()
				: ''

		if (emailEl) emailEl.textContent = label
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
				avatarFb.textContent = (label.charAt(0) || '?').toUpperCase()
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
		getReputation: getReputation,
		castReputationVote: castReputationVote,
		isAdminProfile: isAdminProfile,
		isCurrentUserAdmin: isCurrentUserAdmin,
		updateProfile: updateProfile,
		getApplications: getApplications,
		getAdminApplications: getAdminApplications,
		sendAdminApplicationMessage: sendAdminApplicationMessage,
		submitApplicantReply: submitApplicantReply,
		moderateApplication: moderateApplication,
		getSupportTickets: getSupportTickets,
		getSupportMessages: getSupportMessages,
		createSupportTicket: createSupportTicket,
		addSupportMessage: addSupportMessage,
		adminReplySupportTicket: adminReplySupportTicket,
		closeSupportTicket: closeSupportTicket,
		deleteSupportTicket: deleteSupportTicket,
		getSupportAttachments: getSupportAttachments,
		uploadSupportEvidenceFiles: uploadSupportEvidenceFiles,
		submitApplication: submitApplication,
		getReferralSummary: getReferralSummary,
		getReferralsForApplications: getReferralsForApplications,
		markReferralRewardedByApplication: markReferralRewardedByApplication,
		validateWhitelistApplicationData: validateWhitelistApplicationData,
		getNotifications: getNotifications,
		markNotificationsRead: markNotificationsRead,
		subscribeUserNotifications: subscribeUserNotifications,
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
		elySkinProxyBase: elySkinProxyBase,
		applyElyHeadToImg: applyElyHeadToImg,
		mcHeadAvatarFallbackUrl: mcHeadAvatarFallbackUrl,
		mcHeadAvatarUrl: mcHeadAvatarUrl,
	}
})(window)
