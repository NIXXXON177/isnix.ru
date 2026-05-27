;(function (global) {
	'use strict'

	var HOST = 'mc.isnix.ru'
	var FETCH_MS = 4500
	var CACHE_KEY = 'isnix_server_status_v4'
	var CACHE_TTL_MS = 90000
	var STALE_CACHE_MS = 600000
	var FAIL_BACKOFF_MS = 300000

	var inflight = null
	var lastNetworkFail = 0

	function readCache(allowStale) {
		try {
			var raw = sessionStorage.getItem(CACHE_KEY)
			if (!raw) return null
			var box = JSON.parse(raw)
			if (!box || !box.data) return null
			var age = Date.now() - box.t
			if (age <= CACHE_TTL_MS) return box.data
			if (allowStale && age <= STALE_CACHE_MS) return box.data
			return null
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

	function parsePlayers(data) {
		if (!data || typeof data.online !== 'boolean') return null
		var list = []
		if (data.players && Array.isArray(data.players.list)) {
			list = data.players.list.filter(Boolean).map(function (n) {
				return String(n).trim()
			})
		}
		var count =
			data.players && typeof data.players.online === 'number'
				? data.players.online
				: list.length
		var max =
			data.players && typeof data.players.max === 'number' ? data.players.max : null
		return {
			online: data.online,
			host: HOST,
			count: count,
			max: max,
			players: list,
		}
	}

	async function fetchJson(url, signal) {
		var res = await fetch(url, {
			signal: signal,
			headers: { Accept: 'application/json' },
		})
		if (!res.ok) throw new Error('http')
		return res.json()
	}

	async function fetchFromNetwork() {
		var ctrl = new AbortController()
		var tid = setTimeout(function () {
			ctrl.abort()
		}, FETCH_MS)
		var sources = [
			'https://api.mcsrvstat.us/3/' + HOST,
			'https://api.mcstatus.io/v2/status/java/' + HOST,
		]
		try {
			for (var i = 0; i < sources.length; i++) {
				try {
					var data = await fetchJson(sources[i], ctrl.signal)
					var parsed = parsePlayers(data)
					if (parsed) {
						clearTimeout(tid)
						return parsed
					}
				} catch (_e) {
					/* try next source */
				}
			}
			throw new Error('all sources failed')
		} finally {
			clearTimeout(tid)
		}
	}

	async function fetchStatus(force) {
		var now = Date.now()
		if (!force && inflight) return inflight

		if (!force) {
			var fresh = readCache(false)
			if (fresh) return fresh
			if (lastNetworkFail && now - lastNetworkFail < FAIL_BACKOFF_MS) {
				return readCache(true)
			}
		}

		inflight = (async function () {
			try {
				var parsed = await fetchFromNetwork()
				writeCache(parsed)
				lastNetworkFail = 0
				return parsed
			} catch (_e) {
				lastNetworkFail = Date.now()
				return readCache(true)
			} finally {
				inflight = null
			}
		})()

		return inflight
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
