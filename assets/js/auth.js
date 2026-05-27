;(function (global) {
	'use strict'

	var MC_NICK_RE = /^[a-zA-Z0-9_]{3,16}$/
	var client = null

	/** Только эти email могут быть админами сайта (дублирует проверку в Supabase) */
	var SITE_ADMIN_EMAILS = [
		'kupryuhinsemen@gmail.com',
		'kudrasovn024@gmail.com',
		'1511vasilisa@gmail.com',
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
		return /Failed to fetch|NetworkError|ERR_CONNECTION|ERR_HTTP2|PING_FAILED|Load failed|fetch failed|Network request failed|ERR_NAME_NOT_RESOLVED|ERR_SSL|ERR_TIMED_OUT|CONNECTION_RESET|CONNECTION_TIMED_OUT|HTTP2_PING_FAILED/i.test(
			msg,
		)
	}

	function isMissingApplicantReplyColumn(err) {
		var msg = errorText(err)
		return /applicant_reply/i.test(msg) && /does not exist|42703/i.test(msg)
	}

	function sleep(ms) {
		return new Promise(function (resolve) {
			setTimeout(resolve, ms)
		})
	}

	/** Повтор только для GET; PATCH/POST при сбое не дублируем (иначе лавина запросов). */
	function fetchWithRetry(url, options) {
		var method = ((options && options.method) || 'GET').toUpperCase()
		var delays =
			method === 'GET' || method === 'HEAD' ? [0, 1200, 2800] : [0]
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
		var lastErr = null
		for (var i = 0; i < 2; i++) {
			try {
				return await fn()
			} catch (err) {
				lastErr = err
				if (!isNetworkError(err) || i >= 1) throw err
				await sleep(400)
			}
		}
		throw lastErr
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

	function formatAuthError(err) {
		if (!err) return 'Неизвестная ошибка'
		if (typeof err === 'string') return err
		var msg = errorText(err)
		if (isMissingApplicantReplyColumn(err)) {
			return 'В Supabase не выполнена миграция диалога. SQL Editor → вставь и запусти docs/supabase-whitelist-dialog.sql (или supabase-grants-fix.sql + dialog).'
		}
		if (err.code === '42501' || /permission denied for table/i.test(msg)) {
			return 'Нет доступа к таблице в Supabase. SQL Editor → запусти docs/supabase-grants-fix.sql, затем перезайди на сайт.'
		}
		if (isNetworkError(err)) {
			return (
				'Браузер не достучался до Supabase (' +
				(msg || 'сбой сети') +
				'). Попробуй другой браузер, отключи AdBlock/VPN, открой isnix.ru по HTTPS. Если не поможет — проект Supabase мог быть на паузе (Dashboard → Restore).'
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
		return msg || 'Ошибка авторизации'
	}

	async function getSession() {
		var sb = getClient()
		if (!sb) return null
		var res = await sb.auth.getSession()
		if (res.error) throw res.error
		return res.data.session
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
	}

	async function getProfile(userId) {
		var sb = getClient()
		if (!sb) return null
		return withNetworkRetry(async function () {
			var res = await sb
				.from('profiles')
				.select('minecraft_nick, display_name, email, role, created_at')
				.eq('id', userId)
				.maybeSingle()
			if (res.error) throw res.error
			return res.data
		})
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
	}

	var APP_SELECT_BASE =
		'id, minecraft_nick, call_name, age, reason, status, admin_note, created_at'
	var APP_SELECT_WITH_REPLY = APP_SELECT_BASE + ', applicant_reply'
	var APP_ADMIN_SELECT_BASE =
		'id, user_id, minecraft_nick, call_name, age, reason, status, admin_note, applicant_email, created_at'
	var APP_ADMIN_SELECT_WITH_REPLY = APP_ADMIN_SELECT_BASE + ', applicant_reply'

	async function queryApplications(sb, userId, withReply) {
		var fields = withReply ? APP_SELECT_WITH_REPLY : APP_SELECT_BASE
		var res = await sb
			.from('whitelist_applications')
			.select(fields)
			.eq('user_id', userId)
			.order('created_at', { ascending: false })
		if (res.error) throw res.error
		return res.data || []
	}

	async function queryAdminApplications(sb, status, withReply) {
		var fields = withReply ? APP_ADMIN_SELECT_WITH_REPLY : APP_ADMIN_SELECT_BASE
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
		return withNetworkRetry(async function () {
			try {
				return await queryApplications(sb, userId, true)
			} catch (err) {
				if (!isMissingApplicantReplyColumn(err)) throw err
				return await queryApplications(sb, userId, false)
			}
		})
	}

	async function submitApplication(userId, data) {
		var sb = getClient()
		if (!sb) throw new Error('Нет подключения')
		var nick = (data.minecraft_nick || '').trim()
		if (!MC_NICK_RE.test(nick)) {
			throw new Error('Ник: 3–16 символов, латиница, цифры и _')
		}
		var reason = (data.reason || '').trim()
		if (reason.length < 10) {
			throw new Error('Расскажи подробнее, зачем хочешь на сервер (мин. 10 символов)')
		}
		var res = await sb.from('whitelist_applications').insert({
			user_id: userId,
			minecraft_nick: nick,
			call_name: (data.call_name || '').trim() || null,
			age: (data.age || '').trim() || null,
			reason: reason,
		})
		if (res.error) throw res.error
	}

	async function getAdminApplications(status) {
		var sb = getClient()
		if (!sb) return []
		return withNetworkRetry(async function () {
			try {
				return await queryAdminApplications(sb, status, true)
			} catch (err) {
				if (!isMissingApplicantReplyColumn(err)) throw err
				return await queryAdminApplications(sb, status, false)
			}
		})
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
		if (res.error) throw res.error
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
		var sb = getClient()
		if (!sb) return null
		return withNetworkRetry(async function () {
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
				throw res.error
			}
			return res.data
		})
	}

	async function getAdminProfiles() {
		var sb = getClient()
		if (!sb) return []
		return withNetworkRetry(async function () {
			var res = await sb
				.from('profiles')
				.select('id, email, minecraft_nick, display_name, role, created_at')
				.order('created_at', { ascending: false })
			if (res.error) throw res.error
			return res.data || []
		})
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

	async function refreshNavAccountLink(session) {
		if (!session || !session.user) {
			updateNavAccountLink(null, null)
			return
		}
		try {
			var profile = await getProfile(session.user.id)
			if (profile && session.user.email) {
				profile.email = profile.email || session.user.email
			}
			updateNavAccountLink(session, profile)
		} catch (_e) {
			updateNavAccountLink(session, null)
		}
	}

	async function initNavAuth() {
		updateNavAccountLink(null, null)
		if (!isReady()) return
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
		getSession: getSession,
		signUp: signUp,
		signIn: signIn,
		signOut: signOut,
		getProfile: getProfile,
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
		updatePassword: updatePassword,
		getAdminProfiles: getAdminProfiles,
		onAuthStateChange: onAuthStateChange,
		formatAuthError: formatAuthError,
		MC_NICK_RE: MC_NICK_RE,
	}
})(window)
