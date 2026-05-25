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
	/** Относительный путь с isnix.ru или полный URL прокси (см. подсказку под полем ника). Прямая ссылка на панель хостинга из браузера не работает. */
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
		st.textContent = '⏳ Проверяем вайтлист…'
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
				st.textContent = '✅ В вайтлисте: ' + canon
				st.className = 'nick-status ok'
			} else {
				nickApprovedKey = null
				st.textContent = '❌ Нет в вайтлисте'
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
				st.textContent = '⚠️ Нет whitelist.json или ошибка загрузки'
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
		const comment = `Ник: ${nick} | Префикс: [${prefix}]`
		const url = new URL(DA_URL)
		url.searchParams.set('comment', comment)
		if (amount) url.searchParams.set('amount', amount)
		return url.toString()
	}

	function openDonation(btn) {
		const nick = getNick()
		if (!nick) {
			showToast('⚠️ Сначала введи ник в Minecraft!', false)
			document.getElementById('playerNick').focus()
			return
		}
		if (!isNickVerifiedForPurchase()) {
			showToast('⚠️ Ник должен быть в вайтлисте (зелёный статус)', false)
			document.getElementById('playerNick').focus()
			return
		}
		const card = btn.closest('.shop-card')
		const prefix = card.dataset.prefix
		const amount = card.dataset.amount
		window.open(buildDonationUrl(prefix, amount), '_blank', 'noopener')
	}

	const VK_URL = 'https://vk.com/isthisnixxxon'

	function openCreatorPrefix(btn) {
		const nick = getNick()
		if (!nick) {
			showToast('⚠️ Сначала введи ник в Minecraft!', false)
			document.getElementById('playerNick').focus()
			return
		}
		if (!isNickVerifiedForPurchase()) {
			showToast('⚠️ Ник должен быть в вайтлисте (зелёный статус)', false)
			document.getElementById('playerNick').focus()
			return
		}
		const card = btn.closest('.shop-card')
		const prefix = card.dataset.prefix
		const nickCanon = canonicalNickFromWhitelist(nick)
		const contentHint =
			prefix === 'YouTube'
				? 'Ссылка на канал и видео о сервере'
				: 'Ссылка на канал и стримы на сервере'
		const text = `Заявка на префикс [${prefix}]\nНик: ${nickCanon}\n${contentHint}: `
		if (navigator.clipboard && navigator.clipboard.writeText) {
			navigator.clipboard.writeText(text).then(function () {
				showToast(
					'Текст заявки скопирован — вставь в сообщение ВКонтакте',
					true,
				)
			})
		}
		window.open(VK_URL, '_blank', 'noopener')
	}

	function buildBoldNickDonationUrl(nickCanon) {
		const comment = `Ник: ${nickCanon} | Услуга: Жирный ник`
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
			showToast('⚠️ Введите ник в Minecraft!', false)
			document.getElementById('boldNickModalNick').focus()
			return
		}
		if (!MC_NICK_RE.test(raw)) {
			showToast('⚠️ Ник: 3–16 символов, латиница, цифры и _', false)
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
				st.textContent = '❌ Нет в вайтлисте'
				st.className = 'nick-status invalid'
				updateCustomPreview()
				showToast('⚠️ Ник должен быть в вайтлисте (зелёный статус)', false)
				return
			}
			nickApprovedKey = lv
			st.textContent = '✅ В вайтлисте: ' + canon
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
			'⏳ Загружаем вайтлист… Когда статус сверху станет зелёным, нажмите «Перейти к оплате» ещё раз',
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
			showToast('⚠️ Введи ник!', false)
			document.getElementById('customNick').focus()
			return
		}
		if (!isNickVerifiedForPurchase()) {
			showToast('⚠️ Сначала проверь ник по вайтлисту', false)
			document.getElementById('playerNick').focus()
			return
		}
		if (!prefix) {
			showToast('⚠️ Придумай префикс!', false)
			document.getElementById('customPrefix').focus()
			return
		}
		const color = document.getElementById('customColor').value
		const comment = `Ник: ${canonicalNickFromWhitelist(nick)} | Кастомный префикс: [${prefix}] | Цвет: ${color}`
		const url = new URL(DA_URL)
		url.searchParams.set('comment', comment)
		url.searchParams.set('amount', '299')
		window.open(url.toString(), '_blank', 'noopener')
	}

	// Sync nick + проверка по whitelist.json (debounced)
	var playerNickEl = document.getElementById('playerNick')
	if (playerNickEl) {
		playerNickEl.addEventListener('input', function () {
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
				st.textContent = '⚠️ Введи ник перед покупкой'
				st.className = 'nick-status empty'
				nickApprovedKey = null
				updateCustomPreview()
				return
			}
			if (!MC_NICK_RE.test(v)) {
				st.textContent = '⚠️ Ник: 3–16 символов, латиница, цифры и _'
				st.className = 'nick-status invalid'
				nickApprovedKey = null
				updateCustomPreview()
				return
			}
			nickApprovedKey = null
			st.textContent = '⏳ Проверяем вайтлист…'
			st.className = 'nick-status checking'
			updateCustomPreview()
			nickDebounceTimer = setTimeout(function () {
				fetchWhitelistCheck(v)
			}, 520)
		})
	}

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
		tag.textContent = prefix ? `[${prefix}]` : '[Префикс]'
		tag.style.color = hex
		tag.style.textShadow = `0 0 14px ${hex}`
		name.textContent = nick || 'Ник'
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

	const navBarEl =
		document.querySelector('.site-header') ||
		document.getElementById('siteNav') ||
		document.querySelector('.site-top')
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

	// Статус сервера — параллельные API, короткий таймаут, кэш
	;(function initServerStatus() {
		var HOST = 'mc.isnix.ru'
		var SOURCES = [
			'https://api.mcsrvstat.us/2/' + HOST,
			'https://api.mcstatus.io/v2/status/java/' + HOST,
		]
		var FETCH_MS = 4000
		var CACHE_KEY = 'isnix_server_status_v1'
		var CACHE_TTL_MS = 90000
		var countEl = document.getElementById('serverOnlineCount')
		var dotEl = document.getElementById('serverOnlineDot')
		var badgeEl = document.getElementById('serverBadgeText')
		var hasShown = false

		function parsePayload(d) {
			if (!d || typeof d.online !== 'boolean') return null
			var po = 0
			var pm = null
			if (d.players && typeof d.players === 'object') {
				if (typeof d.players.online === 'number') po = d.players.online
				if (typeof d.players.max === 'number') pm = d.players.max
			}
			return { online: d.online, onlinePlayers: po, maxPlayers: pm }
		}

		function readCache() {
			try {
				var raw = sessionStorage.getItem(CACHE_KEY)
				if (!raw) return null
				var box = JSON.parse(raw)
				if (!box || Date.now() - box.t > CACHE_TTL_MS) return null
				return box.data
			} catch (e) {
				return null
			}
		}

		function writeCache(data) {
			try {
				sessionStorage.setItem(
					CACHE_KEY,
					JSON.stringify({ t: Date.now(), data: data }),
				)
			} catch (e) {}
		}

		function applyStatus(parsed) {
			hasShown = true
			if (!parsed) {
				if (dotEl) {
					dotEl.classList.remove('is-on')
					dotEl.classList.add('is-off')
				}
				if (countEl) countEl.textContent = '—'
				if (badgeEl) badgeEl.textContent = 'Статус недоступен'
				return
			}
			if (!parsed.online) {
				if (dotEl) {
					dotEl.classList.remove('is-on')
					dotEl.classList.add('is-off')
				}
				if (countEl) countEl.textContent = 'офлайн'
				if (badgeEl) badgeEl.textContent = 'Сервер офлайн'
				return
			}
			if (dotEl) {
				dotEl.classList.add('is-on')
				dotEl.classList.remove('is-off')
			}
			var pm = parsed.maxPlayers != null ? parsed.maxPlayers : '—'
			if (countEl) countEl.textContent = parsed.onlinePlayers + ' / ' + pm
			if (badgeEl) badgeEl.textContent = 'Сервер онлайн'
		}

		function fetchJson(url) {
			var ctrl = new AbortController()
			var tid = setTimeout(function () {
				ctrl.abort()
			}, FETCH_MS)
			return fetch(url, {
				signal: ctrl.signal,
				cache: 'default',
				headers: { Accept: 'application/json' },
			})
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

		function fetchFirstOk() {
			return new Promise(function (resolve, reject) {
				var left = SOURCES.length
				var settled = false
				SOURCES.forEach(function (url) {
					fetchJson(url)
						.then(function (d) {
							var p = parsePayload(d)
							if (!p) throw new Error('bad')
							if (!settled) {
								settled = true
								resolve(p)
							}
						})
						.catch(function () {
							left--
							if (!settled && left <= 0) reject(new Error('all'))
						})
				})
			})
		}

		function refresh() {
			fetchFirstOk()
				.then(function (p) {
					writeCache(p)
					applyStatus(p)
				})
				.catch(function () {
					if (!hasShown) applyStatus(null)
				})
		}

		var cached = readCache()
		if (cached) applyStatus(cached)

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
		var nav = document.getElementById('siteNav') || document.querySelector('nav')
		var toggle = document.getElementById('navToggle')
		var menu = document.getElementById('navMenu')
		var backdrop = document.getElementById('navBackdrop')
		var logo = document.getElementById('navLogo')
		var mqMobile = window.matchMedia('(max-width: 1100px)')
		if (!toggle || !menu) return

		function isMobileNav() {
			return mqMobile.matches
		}

		function setMenuOpen(open) {
			var mobile = isMobileNav()
			var show = open && mobile
			menu.classList.toggle('is-open', show)
			if (show) menu.scrollTop = 0
			if (backdrop) backdrop.classList.toggle('is-visible', open && mobile)
			toggle.setAttribute('aria-expanded', open && mobile ? 'true' : 'false')
			toggle.setAttribute(
				'aria-label',
				open && mobile ? 'Закрыть меню' : 'Открыть меню',
			)
			if (mobile) {
				menu.setAttribute('aria-hidden', open ? 'false' : 'true')
				if (backdrop) {
					backdrop.setAttribute('aria-hidden', open ? 'false' : 'true')
				}
			} else {
				menu.setAttribute('aria-hidden', 'false')
				if (backdrop) backdrop.setAttribute('aria-hidden', 'true')
			}
			document.documentElement.classList.toggle('nav-open', open && mobile)
			document.body.classList.toggle('nav-open', open && mobile)
		}

		function closeMenu() {
			setMenuOpen(false)
		}

		function openMenu() {
			if (!isMobileNav()) return
			setMenuOpen(true)
		}

		function toggleMenu() {
			if (!isMobileNav()) {
				closeMenu()
				return
			}
			setMenuOpen(!menu.classList.contains('is-open'))
		}

		var siteHeader = document.querySelector('.site-header')
		if (nav || siteHeader) {
			function onNavScroll() {
				var scrolled = window.scrollY > 12
				if (nav) nav.classList.toggle('is-scrolled', scrolled)
				if (siteHeader) siteHeader.classList.toggle('is-scrolled', scrolled)
			}
			onNavScroll()
			window.addEventListener('scroll', onNavScroll, { passive: true })
		}

		toggle.addEventListener('click', function (e) {
			e.stopPropagation()
			toggleMenu()
		})

		if (backdrop) {
			backdrop.addEventListener('click', closeMenu)
		}

		menu.querySelectorAll('a').forEach(function (a) {
			a.addEventListener('click', function () {
				if (isMobileNav()) closeMenu()
			})
		})

		if (logo) {
			logo.addEventListener('click', function (e) {
				e.preventDefault()
				closeMenu()
				window.scrollTo({ top: 0, behavior: 'smooth' })
			})
		}

		var footerLogo = document.getElementById('footerLogo')
		if (footerLogo) {
			footerLogo.addEventListener('click', function (e) {
				var href = footerLogo.getAttribute('href')
				if (!href || href === '#') {
					e.preventDefault()
					window.scrollTo({ top: 0, behavior: 'smooth' })
				}
			})
		}

		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && menu.classList.contains('is-open')) {
				closeMenu()
				toggle.focus()
			}
		})

		mqMobile.addEventListener('change', function () {
			if (!mqMobile.matches) closeMenu()
		})

		window.addEventListener('resize', function () {
			if (!isMobileNav()) closeMenu()
		})
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
	document.querySelectorAll('.ip-box, .site-footer__ip').forEach(function (box) {
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
