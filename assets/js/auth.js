;(function (global) {
	'use strict'

	var MC_NICK_RE = /^[a-zA-Z0-9_]{3,16}$/
	var client = null

	/** Только эти email могут быть админами сайта (дублирует проверку в Supabase) */
	var SITE_ADMIN_EMAILS = [
		'kupryuhinsemen@gmail.com',
		'kudrasovn824@gmail.com',
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

	function getClient() {
		if (!isReady()) return null
		if (!client) {
			client = global.supabase.createClient(
				getConfig().supabaseUrl,
				getConfig().supabaseAnonKey,
			)
		}
		return client
	}

	function formatAuthError(err) {
		if (!err) return 'Неизвестная ошибка'
		if (typeof err === 'string') return err
		return err.message || 'Ошибка авторизации'
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
		var res = await sb
			.from('profiles')
			.select('minecraft_nick, display_name, email, role')
			.eq('id', userId)
			.maybeSingle()
		if (res.error) throw res.error
		return res.data
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

	async function getApplications(userId) {
		var sb = getClient()
		if (!sb) return []
		var res = await sb
			.from('whitelist_applications')
			.select(
				'id, minecraft_nick, call_name, age, reason, status, admin_note, created_at',
			)
			.eq('user_id', userId)
			.order('created_at', { ascending: false })
		if (res.error) throw res.error
		return res.data || []
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
		var q = sb
			.from('whitelist_applications')
			.select(
				'id, user_id, minecraft_nick, call_name, age, reason, status, admin_note, applicant_email, created_at',
			)
			.order('created_at', { ascending: false })
		if (status) q = q.eq('status', status)
		var res = await q
		if (res.error) throw res.error
		return res.data || []
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
		if (res.error) throw res.error
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
		isAdminProfile: isAdminProfile,
		isCurrentUserAdmin: isCurrentUserAdmin,
		updateProfile: updateProfile,
		getApplications: getApplications,
		getAdminApplications: getAdminApplications,
		moderateApplication: moderateApplication,
		submitApplication: submitApplication,
		onAuthStateChange: onAuthStateChange,
		formatAuthError: formatAuthError,
		MC_NICK_RE: MC_NICK_RE,
	}
})(window)
