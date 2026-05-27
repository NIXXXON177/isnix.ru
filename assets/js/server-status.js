;(function (global) {
	'use strict'

	var HOST = 'mc.isnix.ru'
	var FETCH_MS = 5000
	var CACHE_KEY = 'isnix_server_status_v3'
	var CACHE_TTL_MS = 60000

	function readCache() {
		try {
			var raw = sessionStorage.getItem(CACHE_KEY)
			if (!raw) return null
			var box = JSON.parse(raw)
			if (!box || Date.now() - box.t > CACHE_TTL_MS) return null
			return box.data
		} catch (_e) {
			return null
		}
	}

	function writeCache(data) {
		try {
			sessionStorage.setItem(CACHE_KEY, JSON.stringify({ t: Date.now(), data: data }))
		} catch (_e) {
			/* ignore */
		}
	}

	function parseV3(data) {
		if (!data || typeof data.online !== 'boolean') return null
		var list = []
		if (data.players && Array.isArray(data.players.list)) {
			list = data.players.list.filter(Boolean).map(function (n) {
				return String(n).trim()
			})
		}
		return {
			online: data.online,
			host: HOST,
			count: data.players && typeof data.players.online === 'number' ? data.players.online : list.length,
			max: data.players && typeof data.players.max === 'number' ? data.players.max : null,
			players: list,
		}
	}

	async function fetchStatus(force) {
		if (!force) {
			var cached = readCache()
			if (cached) return cached
		}
		var ctrl = new AbortController()
		var tid = setTimeout(function () {
			ctrl.abort()
		}, FETCH_MS)
		try {
			var res = await fetch('https://api.mcsrvstat.us/3/' + HOST, {
				signal: ctrl.signal,
				headers: { Accept: 'application/json' },
			})
			clearTimeout(tid)
			if (!res.ok) throw new Error('http')
			var data = await res.json()
			var parsed = parseV3(data)
			if (parsed) writeCache(parsed)
			return parsed
		} catch (_e) {
			clearTimeout(tid)
			return readCache()
		}
	}

	function isPlayerOnline(nick, status) {
		if (!nick || !status || !status.online || !status.players) return false
		var low = nick.toLowerCase()
		return status.players.some(function (p) {
			return p.toLowerCase() === low
		})
	}

	global.IsnixServer = {
		HOST: HOST,
		fetchStatus: fetchStatus,
		isPlayerOnline: isPlayerOnline,
	}
})(window)
