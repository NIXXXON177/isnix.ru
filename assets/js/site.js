	const DA_URL = 'https://www.donationalerts.com/r/isthisnixxxon'
	const colorMap = {
		green: '#4ade80',
		gold: '#fbbf24',
		aqua: '#67e8f9',
		red: '#f87171',
		light_purple: '#c084fc',
		white: '#ffffff',
		yellow: '#fef08a',
	}

	function easeInOutQuint(t) {
		return t < 0.5
			? 16 * t * t * t * t * t
			: 1 - Math.pow(-2 * t + 2, 5) / 2
	}

	function getNick() {
		return (document.getElementById('playerNick').value || '').trim()
	}

	var nickWhitelistAbort = null
	var nickDebounceTimer = null
	var MC_NICK_RE = /^[a-zA-Z0-9_]{3,16}$/
	/** ╨Ю╤В╨╜╨╛╤Б╨╕╤В╨╡╨╗╤М╨╜╤Л╨╣ ╨┐╤Г╤В╤М ╤Б isnix.ru ╨╕╨╗╨╕ ╨┐╨╛╨╗╨╜╤Л╨╣ URL ╨┐╤А╨╛╨║╤Б╨╕ (╤Б╨╝. ╨┐╨╛╨┤╤Б╨║╨░╨╖╨║╤Г ╨┐╨╛╨┤ ╨┐╨╛╨╗╨╡╨╝ ╨╜╨╕╨║╨░). ╨Я╤А╤П╨╝╨░╤П ╤Б╤Б╤Л╨╗╨║╨░ ╨╜╨░ ╨┐╨░╨╜╨╡╨╗╤М ╤Е╨╛╤Б╤В╨╕╨╜╨│╨░ ╨╕╨╖ ╨▒╤А╨░╤Г╨╖╨╡╤А╨░ ╨╜╨╡ ╤А╨░╨▒╨╛╤В╨░╨╡╤В. */
	var WHITELIST_JSON_URL = 'whitelist.json'
	var whitelistPlayers = null
	var whitelistFetchedAt = 0
	var WHITELIST_MS = 120000
	var nickApprovedKey = null

	function normalizeWhitelistPlayers(j) {
		var raw
		if (j && Array.isArray(j.players)) raw = j.players
		else if (Array.isArray(j)) raw = j
		else return []
		var out = []
		for (var i = 0; i < raw.length; i++) {
			var e = raw[i]
			if (typeof e === 'string') out.push(e.trim())
			else if (e && typeof e.name === 'string') out.push(e.name.trim())
		}
		return out.filter(function (s) {
			return s.length > 0
		})
	}

	function canonicalNickFromWhitelist(v) {
		if (!whitelistPlayers || !v) return v
		var lv = v.toLowerCase()
		for (var i = 0; i < whitelistPlayers.length; i++) {
			var p = String(whitelistPlayers[i]).trim()
			if (p.toLowerCase() === lv) return p
		}
		return v
	}

	function isNickVerifiedForPurchase() {
		var v = getNick()
		if (!v || !MC_NICK_RE.test(v) || nickApprovedKey === null) return false
		return v.toLowerCase() === nickApprovedKey
	}

	function fetchWhitelistCheck(v) {
		var st = document.getElementById('nickStatus')
		if (nickWhitelistAbort) {
			nickWhitelistAbort.abort()
			nickWhitelistAbort = null
		}
		nickWhitelistAbort = new AbortController()
		var ac = nickWhitelistAbort
		nickApprovedKey = null
		st.textContent = 'тП│ ╨Я╤А╨╛╨▓╨╡╤А╤П╨╡╨╝ ╨▓╨░╨╣╤В╨╗╨╕╤Б╤ВтАж'
		st.className = 'nick-status checking'
		updateCustomPreview()

		function applyCheck(arr) {
			if (ac.signal.aborted) return
			var lv = v.toLowerCase()
			var canon = null
			for (var i = 0; i < arr.length; i++) {
				var p = String(arr[i]).trim()
				if (p.toLowerCase() === lv) {
					canon = p
					break
				}
			}
			if (canon) {
				nickApprovedKey = lv
				st.textContent = 'тЬЕ ╨Т ╨▓╨░╨╣╤В╨╗╨╕╤Б╤В╨╡: ' + canon
				st.className = 'nick-status ok'
			} else {
				nickApprovedKey = null
				st.textContent = 'тЭМ ╨Э╨╡╤В ╨▓ ╨▓╨░╨╣╤В╨╗╨╕╤Б╤В╨╡'
				st.className = 'nick-status invalid'
			}
			updateCustomPreview()
		}

		var now = Date.now()
		if (
			whitelistPlayers !== null &&
			now - whitelistFetchedAt < WHITELIST_MS
		) {
			applyCheck(whitelistPlayers)
			return
		}

		fetch(WHITELIST_JSON_URL, { signal: ac.signal, cache: 'no-store' })
			.then(function (r) {
				if (!r.ok) throw new Error('wl')
				return r.json()
			})
			.then(function (j) {
				var arr = normalizeWhitelistPlayers(j)
				whitelistPlayers = arr
				whitelistFetchedAt = Date.now()
				applyCheck(arr)
			})
			.catch(function (e) {
				if (e.name === 'AbortError') return
				if (ac.signal.aborted) return
				nickApprovedKey = null
				whitelistPlayers = null
				whitelistFetchedAt = 0
				st.textContent = 'тЪая╕П ╨Э╨╡╤В whitelist.json ╨╕╨╗╨╕ ╨╛╤И╨╕╨▒╨║╨░ ╨╖╨░╨│╤А╤Г╨╖╨║╨╕'
				st.className = 'nick-status empty'
				updateCustomPreview()
			})
	}

	function showToast(msg, ok = true) {
		const t = document.getElementById('toast')
		t.textContent = msg
		t.style.borderColor = ok ? 'var(--green-dark)' : 'rgba(248,113,113,.4)'
		t.classList.add('show')
		setTimeout(() => t.classList.remove('show'), 3200)
	}

	function buildDonationUrl(prefix, amount) {
		const nick = canonicalNickFromWhitelist(getNick())
		const comment = `╨Э╨╕╨║: ${nick} | ╨Я╤А╨╡╤Д╨╕╨║╤Б: [${prefix}]`
		const url = new URL(DA_URL)
		url.searchParams.set('comment', comment)
		if (amount) url.searchParams.set('amount', amount)
		return url.toString()
	}

	function openDonation(btn) {
		const nick = getNick()
		if (!nick) {
			showToast('тЪая╕П ╨б╨╜╨░╤З╨░╨╗╨░ ╨▓╨▓╨╡╨┤╨╕ ╨╜╨╕╨║ ╨▓ Minecraft!', false)
			document.getElementById('playerNick').focus()
			return
		}
		if (!isNickVerifiedForPurchase()) {
			showToast('тЪая╕П ╨Э╨╕╨║ ╨┤╨╛╨╗╨╢╨╡╨╜ ╨▒╤Л╤В╤М ╨▓ ╨▓╨░╨╣╤В╨╗╨╕╤Б╤В╨╡ (╨╖╨╡╨╗╤С╨╜╤Л╨╣ ╤Б╤В╨░╤В╤Г╤Б)', false)
			document.getElementById('playerNick').focus()
			return
		}
		const card = btn.closest('.shop-card')
		const prefix = card.dataset.prefix
		const amount = card.dataset.amount
		window.open(buildDonationUrl(prefix, amount), '_blank', 'noopener')
	}

	function buildBoldNickDonationUrl(nickCanon) {
		const comment = `╨Э╨╕╨║: ${nickCanon} | ╨г╤Б╨╗╤Г╨│╨░: ╨Ц╨╕╤А╨╜╤Л╨╣ ╨╜╨╕╨║`
		const url = new URL(DA_URL)
		url.searchParams.set('comment', comment)
		url.searchParams.set('amount', '150')
		return url.toString()
	}

	function openBoldNickModal() {
		const root = document.getElementById('boldNickModalRoot')
		const inp = document.getElementById('boldNickModalNick')
		if (!root || !inp) return
		inp.value = (document.getElementById('playerNick').value || '').trim()
		root.classList.add('is-open')
		root.setAttribute('aria-hidden', 'false')
		document.body.style.overflow = 'hidden'
		setTimeout(function () {
			inp.focus()
		}, 80)
	}

	function closeBoldNickModal() {
		const root = document.getElementById('boldNickModalRoot')
		if (!root) return
		root.classList.remove('is-open')
		root.setAttribute('aria-hidden', 'true')
		setTimeout(function () {
			document.body.style.overflow = ''
		}, 300)
	}

	function submitBoldNickPay() {
		const raw = (
			document.getElementById('boldNickModalNick').value || ''
		).trim()
		if (!raw) {
			showToast('тЪая╕П ╨Т╨▓╨╡╨┤╨╕╤В╨╡ ╨╜╨╕╨║ ╨▓ Minecraft!', false)
			document.getElementById('boldNickModalNick').focus()
			return
		}
		if (!MC_NICK_RE.test(raw)) {
			showToast('тЪая╕П ╨Э╨╕╨║: 3тАУ16 ╤Б╨╕╨╝╨▓╨╛╨╗╨╛╨▓, ╨╗╨░╤В╨╕╨╜╨╕╤Ж╨░, ╤Ж╨╕╤Д╤А╤Л ╨╕ _', false)
			document.getElementById('boldNickModalNick').focus()
			return
		}
		document.getElementById('playerNick').value = raw
		document.getElementById('customNick').value = raw
		const lv = raw.toLowerCase()
		const arr = whitelistPlayers
		if (arr && arr.length) {
			let canon = null
			for (let i = 0; i < arr.length; i++) {
				const p = String(arr[i]).trim()
				if (p.toLowerCase() === lv) {
					canon = p
					break
				}
			}
			const st = document.getElementById('nickStatus')
			if (!canon) {
				nickApprovedKey = null
				st.textContent = 'тЭМ ╨Э╨╡╤В ╨▓ ╨▓╨░╨╣╤В╨╗╨╕╤Б╤В╨╡'
				st.className = 'nick-status invalid'
				updateCustomPreview()
				showToast('тЪая╕П ╨Э╨╕╨║ ╨┤╨╛╨╗╨╢╨╡╨╜ ╨▒╤Л╤В╤М ╨▓ ╨▓╨░╨╣╤В╨╗╨╕╤Б╤В╨╡ (╨╖╨╡╨╗╤С╨╜╤Л╨╣ ╤Б╤В╨░╤В╤Г╤Б)', false)
				return
			}
			nickApprovedKey = lv
			st.textContent = 'тЬЕ ╨Т ╨▓╨░╨╣╤В╨╗╨╕╤Б╤В╨╡: ' + canon
			st.className = 'nick-status ok'
			updateCustomPreview()
			const nickCanon = canonicalNickFromWhitelist(raw)
			window.open(buildBoldNickDonationUrl(nickCanon), '_blank', 'noopener')
			closeBoldNickModal()
			return
		}
		nickApprovedKey = null
		fetchWhitelistCheck(raw)
		showToast(
			'тП│ ╨Ч╨░╨│╤А╤Г╨╢╨░╨╡╨╝ ╨▓╨░╨╣╤В╨╗╨╕╤Б╤ВтАж ╨Ъ╨╛╨│╨┤╨░ ╤Б╤В╨░╤В╤Г╤Б ╤Б╨▓╨╡╤А╤Е╤Г ╤Б╤В╨░╨╜╨╡╤В ╨╖╨╡╨╗╤С╨╜╤Л╨╝, ╨╜╨░╨╢╨╝╨╕╤В╨╡ ┬л╨Я╨╡╤А╨╡╨╣╤В╨╕ ╨║ ╨╛╨┐╨╗╨░╤В╨╡┬╗ ╨╡╤Й╤С ╤А╨░╨╖',
			true,
		)
	}

	;(function initBoldNickModal() {
		const root = document.getElementById('boldNickModalRoot')
		const backdrop = document.getElementById('boldNickModalBackdrop')
		if (!root || !backdrop) return
		backdrop.addEventListener('click', closeBoldNickModal)
		document.addEventListener('keydown', function (e) {
			if (e.key !== 'Escape') return
			if (!root.classList.contains('is-open')) return
			closeBoldNickModal()
		})
	})()

	function openCustomDonation() {
		const nick = (document.getElementById('customNick').value || '').trim()
		const prefix = (
			document.getElementById('customPrefix').value || ''
		).trim()
		if (!nick) {
			showToast('тЪая╕П ╨Т╨▓╨╡╨┤╨╕ ╨╜╨╕╨║!', false)
			document.getElementById('customNick').focus()
			return
		}
		if (!isNickVerifiedForPurchase()) {
			showToast('тЪая╕П ╨б╨╜╨░╤З╨░╨╗╨░ ╨┐╤А╨╛╨▓╨╡╤А╤М ╨╜╨╕╨║ ╨┐╨╛ ╨▓╨░╨╣╤В╨╗╨╕╤Б╤В╤Г', false)
			document.getElementById('playerNick').focus()
			return
		}
		if (!prefix) {
			showToast('тЪая╕П ╨Я╤А╨╕╨┤╤Г╨╝╨░╨╣ ╨┐╤А╨╡╤Д╨╕╨║╤Б!', false)
			document.getElementById('customPrefix').focus()
			return
		}
		const color = document.getElementById('customColor').value
		const comment = `╨Э╨╕╨║: ${canonicalNickFromWhitelist(nick)} | ╨Ъ╨░╤Б╤В╨╛╨╝╨╜╤Л╨╣ ╨┐╤А╨╡╤Д╨╕╨║╤Б: [${prefix}] | ╨ж╨▓╨╡╤В: ${color}`
		const url = new URL(DA_URL)
		url.searchParams.set('comment', comment)
		url.searchParams.set('amount', '299')
		window.open(url.toString(), '_blank', 'noopener')
	}

	// Sync nick + ╨┐╤А╨╛╨▓╨╡╤А╨║╨░ ╨┐╨╛ whitelist.json (debounced)
	document
		.getElementById('playerNick')
		.addEventListener('input', function () {
			var v = this.value.trim()
			document.getElementById('customNick').value = v
			clearTimeout(nickDebounceTimer)
			nickDebounceTimer = null
			if (nickWhitelistAbort) {
				nickWhitelistAbort.abort()
				nickWhitelistAbort = null
			}
			var st = document.getElementById('nickStatus')
			if (!v) {
				st.textContent = 'тЪая╕П ╨Т╨▓╨╡╨┤╨╕ ╨╜╨╕╨║ ╨┐╨╡╤А╨╡╨┤ ╨┐╨╛╨║╤Г╨┐╨║╨╛╨╣'
				st.className = 'nick-status empty'
				nickApprovedKey = null
				updateCustomPreview()
				return
			}
			if (!MC_NICK_RE.test(v)) {
				st.textContent = 'тЪая╕П ╨Э╨╕╨║: 3тАУ16 ╤Б╨╕╨╝╨▓╨╛╨╗╨╛╨▓, ╨╗╨░╤В╨╕╨╜╨╕╤Ж╨░, ╤Ж╨╕╤Д╤А╤Л ╨╕ _'
				st.className = 'nick-status invalid'
				nickApprovedKey = null
				updateCustomPreview()
				return
			}
			nickApprovedKey = null
			st.textContent = 'тП│ ╨Я╤А╨╛╨▓╨╡╤А╤П╨╡╨╝ ╨▓╨░╨╣╤В╨╗╨╕╤Б╤ВтАж'
			st.className = 'nick-status checking'
			updateCustomPreview()
			nickDebounceTimer = setTimeout(function () {
				fetchWhitelistCheck(v)
			}, 520)
		})

	function syncNick(el) {
		document.getElementById('playerNick').value = el.value
		document.getElementById('playerNick').dispatchEvent(new Event('input'))
	}

	function updateCustomPreview() {
		const prefix = (
			document.getElementById('customPrefix').value || ''
		).trim()
		const nick =
			(document.getElementById('customNick').value || '').trim() ||
			(document.getElementById('playerNick').value || '').trim()
		const color = document.getElementById('customColor').value
		const hex = colorMap[color] || '#4ade80'
		const tag = document.getElementById('customPreviewTag')
		const name = document.getElementById('customPreviewName')
		const btn = document.getElementById('customBuyBtn')
		tag.textContent = prefix ? `[${prefix}]` : '[╨Я╤А╨╡╤Д╨╕╨║╤Б]'
		tag.style.color = hex
		tag.style.textShadow = `0 0 14px ${hex}`
		name.textContent = nick || '╨Э╨╕╨║'
		btn.disabled = !prefix || !nick || !isNickVerifiedForPurchase()
	}

	;(function rulesSliderA11y() {
		const vp = document.getElementById('rulesSliderViewport')
		if (!vp) return
		const mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)')
		vp.addEventListener('keydown', e => {
			if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
			const step = Math.max(240, Math.round(vp.clientWidth * 0.82))
			vp.scrollBy({
				left: e.key === 'ArrowLeft' ? -step : step,
				behavior: mqReduce.matches ? 'auto' : 'smooth',
			})
			e.preventDefault()
		})
	})()

	const navBarEl = document.querySelector('nav')
	let anchorScrollAnimId = null

	function anchorHeaderPad() {
		return (navBarEl?.offsetHeight ?? 64) + 16
	}

	function scrollWindowSmoothTo(targetY) {
		const maxY = Math.max(
			0,
			document.documentElement.scrollHeight - window.innerHeight,
		)
		const y = Math.max(0, Math.min(targetY, maxY))

		if (anchorScrollAnimId !== null) {
			cancelAnimationFrame(anchorScrollAnimId)
			anchorScrollAnimId = null
		}

		const start = window.scrollY
		const delta = y - start
		if (Math.abs(delta) < 2) return

		const duration = Math.min(850, Math.max(380, Math.abs(delta) * 0.58))
		const t0 = performance.now()

		function tick(now) {
			const t = Math.min(1, (now - t0) / duration)
			window.scrollTo(0, start + delta * easeInOutQuint(t))
			if (t < 1) {
				anchorScrollAnimId = requestAnimationFrame(tick)
			} else {
				anchorScrollAnimId = null
				window.scrollTo(0, y)
			}
		}

		anchorScrollAnimId = requestAnimationFrame(() => {
			anchorScrollAnimId = requestAnimationFrame(tick)
		})
	}

	document.querySelectorAll('a[href^="#"]').forEach(a => {
		a.addEventListener('click', e => {
			const raw = a.getAttribute('href')
			if (!raw || raw === '#' || raw.length < 2) return
			let id
			try {
				id = decodeURIComponent(raw.slice(1))
			} catch {
				return
			}
			if (!id) return
			const el = document.getElementById(id)
			if (!el) return
			e.preventDefault()
			const targetTop =
				el.getBoundingClientRect().top + window.scrollY - anchorHeaderPad()
			scrollWindowSmoothTo(targetTop)
			history.replaceState(null, '', '#' + id)
		})
	})

	// ╨б╤В╨░╤В╤Г╤Б ╤Б╨╡╤А╨▓╨╡╤А╨░ (╤В╨░╨╣╨╝╨░╤Г╤В + ╨╖╨░╨┐╨░╤Б╨╜╨╛╨╣ API тАФ ╨╜╨░ ╤В╨╡╨╗╨╡╤Д╨╛╨╜╨░╤Е mcstatus ╨╕╨╜╨╛╨│╨┤╨░ ╨▒╨╗╨╛╨║╨╕╤А╤Г╤О╤В ╨╕╨╗╨╕ ╨┤╨╛╨╗╨│╨╛ ╨╛╤В╨▓╨╡╤З╨░╨╡╤В)
	;(function () {
		var PRIMARY = 'https://api.mcstatus.io/v2/status/java/mc.isnix.ru'
		var FALLBACK = 'https://api.mcsrvstat.us/2/mc.isnix.ru'
		var FETCH_MS = 10000
		var countEl = document.getElementById('serverOnlineCount')
		var dotEl = document.getElementById('serverOnlineDot')
		var badgeEl = document.getElementById('serverBadgeText')

		function parsePayload(d) {
			if (!d || typeof d.online !== 'boolean') return null
			var po =
				d.players && typeof d.players.online === 'number'
					? d.players.online
					: 0
			var pm =
				d.players && typeof d.players.max === 'number'
					? d.players.max
					: null
			return { online: d.online, onlinePlayers: po, maxPlayers: pm }
		}

		function applyStatus(parsed) {
			if (!parsed) {
				if (dotEl) {
					dotEl.classList.remove('is-on')
					dotEl.classList.add('is-off')
				}
				if (countEl) countEl.textContent = 'тАФ'
				if (badgeEl) badgeEl.textContent = '╨б╤В╨░╤В╤Г╤Б ╨╜╨╡╨┤╨╛╤Б╤В╤Г╨┐╨╡╨╜'
				return
			}
			if (!parsed.online) {
				if (dotEl) {
					dotEl.classList.remove('is-on')
					dotEl.classList.add('is-off')
				}
				if (countEl) countEl.textContent = '╨╛╤Д╨╗╨░╨╣╨╜'
				if (badgeEl) badgeEl.textContent = '╨б╨╡╤А╨▓╨╡╤А ╨╛╤Д╨╗╨░╨╣╨╜'
				return
			}
			if (dotEl) {
				dotEl.classList.add('is-on')
				dotEl.classList.remove('is-off')
			}
			var pm = parsed.maxPlayers != null ? parsed.maxPlayers : 'тАФ'
			if (countEl) countEl.textContent = parsed.onlinePlayers + ' / ' + pm
			if (badgeEl) badgeEl.textContent = '╨б╨╡╤А╨▓╨╡╤А ╨╛╨╜╨╗╨░╨╣╨╜'
		}

		function fetchJson(url) {
			var ctrl = new AbortController()
			var tid = setTimeout(function () {
				ctrl.abort()
			}, FETCH_MS)
			return fetch(url, { signal: ctrl.signal, cache: 'no-store' })
				.then(function (r) {
					clearTimeout(tid)
					if (!r.ok) throw new Error('http')
					return r.json()
				})
				.catch(function (err) {
					clearTimeout(tid)
					throw err
				})
		}

		function refresh() {
			fetchJson(PRIMARY)
				.then(function (d) {
					var p = parsePayload(d)
					if (!p) throw new Error('bad')
					return p
				})
				.catch(function () {
					return fetchJson(FALLBACK).then(function (d) {
						var p = parsePayload(d)
						if (!p) throw new Error('bad')
						return p
					})
				})
				.then(applyStatus)
				.catch(function () {
					applyStatus(null)
				})
		}

		refresh()
		setInterval(refresh, 60000)
	})()
	;(function initPagePreloader() {
		var el = document.getElementById('pagePreloader')
		if (!el) return

		var hintEl = document.getElementById('pagePreloaderHint')
		var progressEl = document.getElementById('pagePreloaderProgress')
		var progressWrap = document.getElementById('pagePreloaderProgressWrap')
		var hintMsgs = [
			'Подключение к миру…',
			'Загрузка ресурсов…',
			'Постройка чанков…',
			'Загрузка текстур…',
			'Подготовка ландшафта…',
			'Синхронизация с сервером…',
			'Почти готово…',
		]
		var MIN_SHOW_MS = 750
		var MAX_SHOW_MS = 5500
		var startedAt = performance.now()
		var hintIdx = 0
		var hintTimer = null
		var progressTimer = null
		var progressVal = 0
		var pageReady = false
		var fontsReady = !(document.fonts && document.fonts.ready)
		var finished = false
		var reduceMotion =
			typeof matchMedia !== 'undefined' &&
			matchMedia('(prefers-reduced-motion: reduce)').matches

		function setProgress(pct) {
			if (!progressEl) return
			var v = Math.max(0, Math.min(100, Math.round(pct)))
			progressEl.style.width = v + '%'
			if (progressWrap) progressWrap.setAttribute('aria-valuenow', String(v))
		}

		function tickProgress() {
			if (finished) return
			var cap = pageReady && fontsReady ? 94 : 82
			if (progressVal < cap) {
				progressVal += (cap - progressVal) * 0.14 + 2
				setProgress(progressVal)
			}
		}

		function swapHint() {
			if (!hintEl) return
			hintIdx = (hintIdx + 1) % hintMsgs.length
			var next = hintMsgs[hintIdx]
			if (reduceMotion) {
				hintEl.textContent = next
				return
			}
			hintEl.style.opacity = '0'
			setTimeout(function () {
				hintEl.textContent = next
				hintEl.style.opacity = '1'
			}, 200)
		}

		function stopTimers() {
			if (hintTimer) {
				clearInterval(hintTimer)
				hintTimer = null
			}
			if (progressTimer) {
				clearInterval(progressTimer)
				progressTimer = null
			}
		}

		function runHide() {
			stopTimers()
			setProgress(100)
			if (hintEl) hintEl.textContent = 'Добро пожаловать'
			el.classList.add('is-leaving')
			el.setAttribute('aria-busy', 'false')
			document.body.classList.remove('preloader-lock')
			setTimeout(function () {
				el.classList.add('is-done')
			}, 420)
			setTimeout(function () {
				if (el.parentNode) el.parentNode.removeChild(el)
			}, 920)
		}

		function tryFinish() {
			if (finished) return
			if (!pageReady || !fontsReady) return
			var elapsed = performance.now() - startedAt
			if (elapsed < MIN_SHOW_MS) {
				setTimeout(tryFinish, MIN_SHOW_MS - elapsed)
				return
			}
			finished = true
			requestAnimationFrame(function () {
				requestAnimationFrame(runHide)
			})
		}

		if (hintEl) {
			hintEl.textContent = hintMsgs[0]
			hintTimer = setInterval(swapHint, 2000)
		}
		setProgress(8)
		progressTimer = setInterval(tickProgress, 120)

		function markPageReady() {
			pageReady = true
			tryFinish()
		}

		if (document.readyState === 'complete') {
			markPageReady()
		} else {
			document.addEventListener('DOMContentLoaded', markPageReady, { once: true })
			window.addEventListener('load', markPageReady, { once: true })
		}

		if (document.fonts && document.fonts.ready) {
			document.fonts.ready
				.then(function () {
					fontsReady = true
					tryFinish()
				})
				.catch(function () {
					fontsReady = true
					tryFinish()
				})
		}

		setTimeout(function () {
			pageReady = true
			fontsReady = true
			tryFinish()
		}, MAX_SHOW_MS)
	})()
	;(function () {
		var grid = document.querySelector('#about .features-grid')
		var mq = window.matchMedia('(max-width:900px)')
		var reduce = window.matchMedia('(prefers-reduced-motion:reduce)')
		if (!grid) return
		function clearClones() {
			grid.querySelectorAll('.feat--marquee-clone').forEach(function (n) {
				n.remove()
			})
		}
		function apply() {
			clearClones()
			grid.classList.remove('is-marquee')
			if (!mq.matches || reduce.matches) return
			grid.classList.add('is-marquee')
			grid
				.querySelectorAll('.feat:not(.feat--marquee-clone)')
				.forEach(function (node) {
					var c = node.cloneNode(true)
					c.classList.add('feat--marquee-clone')
					c.setAttribute('aria-hidden', 'true')
					grid.appendChild(c)
				})
		}
		apply()
		mq.addEventListener('change', apply)
		reduce.addEventListener('change', apply)
	})()

	;(function initSiteNav() {
		var toggle = document.getElementById('navToggle')
		var menu = document.getElementById('navMenu')
		var logo = document.getElementById('navLogo')
		if (!toggle || !menu) return
		function closeMenu() {
			menu.classList.remove('is-open')
			toggle.setAttribute('aria-expanded', 'false')
			document.body.classList.remove('nav-open')
		}
		toggle.addEventListener('click', function () {
			var open = menu.classList.toggle('is-open')
			toggle.setAttribute('aria-expanded', open ? 'true' : 'false')
			document.body.classList.toggle('nav-open', open)
		})
		menu.querySelectorAll('a').forEach(function (a) {
			a.addEventListener('click', closeMenu)
		})
		if (logo) {
			logo.addEventListener('click', function (e) {
				e.preventDefault()
				closeMenu()
				window.scrollTo({ top: 0, behavior: 'smooth' })
			})
		}
	})()
	;(function initNavScrollSpy() {
		var links = document.querySelectorAll('.nav-links a[data-nav]')
		if (!links.length) return
		var map = {}
		links.forEach(function (link) {
			var id = link.getAttribute('data-nav')
			var el = document.getElementById(id)
			if (el) map[id] = { link: link, el: el }
		})
		var ids = Object.keys(map)
		if (!ids.length) return
		var io = new IntersectionObserver(
			function (entries) {
				var visible = entries
					.filter(function (e) {
						return e.isIntersecting
					})
					.sort(function (a, b) {
						return b.intersectionRatio - a.intersectionRatio
					})
				if (!visible.length) return
				var id = visible[0].target.id
				links.forEach(function (l) {
					l.classList.toggle('active', l.getAttribute('data-nav') === id)
				})
			},
			{ rootMargin: '-25% 0px -55% 0px', threshold: [0, 0.12, 0.35] },
		)
		ids.forEach(function (id) {
			io.observe(map[id].el)
		})
	})()
	;(function initSmoothAnchors() {
		var reduce =
			window.matchMedia &&
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		document.querySelectorAll('a[href^="#"]').forEach(function (a) {
			var href = a.getAttribute('href')
			if (!href || href === '#') return
			var target = document.querySelector(href)
			if (!target) return
			a.addEventListener('click', function (e) {
				e.preventDefault()
				target.scrollIntoView({
					behavior: reduce ? 'auto' : 'smooth',
					block: 'start',
				})
				if (history.replaceState) {
					history.replaceState(null, '', href)
				}
			})
		})
	})()

	const obs = new IntersectionObserver(
		e =>
			e.forEach(x => x.isIntersecting && x.target.classList.add('visible')),
		{ threshold: 0.08 },
	)
	document.querySelectorAll('.reveal').forEach(el => obs.observe(el))
;(function initIpCopy() {
	document.querySelectorAll(".ip-box").forEach(function (box) {
		var valEl = box.querySelector(".ip-val")
		var hintEl = box.querySelector(".ip-hint")
		if (!valEl || !hintEl || !navigator.clipboard) return
		var originalHint = hintEl.textContent
		function copyIp() {
			var ip = (valEl.textContent || "").trim()
			if (!ip) return
			navigator.clipboard.writeText(ip).then(function () {
				hintEl.textContent = "\u0421\u043a\u043e\u043f\u0438\u0440\u043e\u0432\u0430\u043d\u043e!"
				setTimeout(function () { hintEl.textContent = originalHint }, 2000)
			})
		}
		box.addEventListener("click", copyIp)
		box.addEventListener("keydown", function (e) {
			if (e.key === "Enter" || e.key === " ") { e.preventDefault(); copyIp() }
		})
	})
})()
