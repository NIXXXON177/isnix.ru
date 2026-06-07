	const DA_URL = 'https://www.donationalerts.com/r/isthisnixxxon'

	function easeInOutQuint(t) {
		return t < 0.5
			? 16 * t * t * t * t * t
			: 1 - Math.pow(-2 * t + 2, 5) / 2
	}

	function buildDonationUrl(opts) {
		opts = opts || {}
		const url = new URL(DA_URL)
		if (opts.amount) url.searchParams.set('amount', String(opts.amount))
		let comment = opts.comment
		if (!comment && opts.kind === 'custom') {
			comment =
				'Ник: | Кастомный префикс: | Цвет: (зелёный, золотой, голубой, красный, фиолетовый, белый, жёлтый)'
		} else if (!comment && opts.kind === 'unban') {
			comment = 'Ник: | Заявка на разбан'
		} else if (!comment && opts.prefix) {
			comment = 'Ник: | Префикс: [' + opts.prefix + ']'
		}
		if (comment) url.searchParams.set('comment', comment)
		return url.toString()
	}

	function openDonation(btn) {
		const card = btn.closest('.shop-card')
		if (!card) return
		const prefix = card.dataset.prefix
		const amount = card.dataset.amount
		const kind = prefix === 'Разбан' ? 'unban' : 'prefix'
		window.open(
			buildDonationUrl({ prefix, amount, kind }),
			'_blank',
			'noopener',
		)
	}

	function openCustomDonation() {
		window.open(buildDonationUrl({ amount: '299', kind: 'custom' }), '_blank', 'noopener')
	}

	function openCreatorPrefix(btn) {
		const card = btn.closest('.shop-card')
		if (!card) return
		const prefix = card.dataset.prefix
		const contentHint =
			prefix === 'YouTube'
				? 'Ссылка на канал и видео о сервере'
				: 'Ссылка на канал и стримы на сервере'
		const text =
			'Заявка на префикс [' +
			prefix +
			']\nНик: \n' +
			contentHint +
			': '
		var copyFn =
			window.IsnixCompat && IsnixCompat.copyText
				? IsnixCompat.copyText(text)
				: navigator.clipboard && navigator.clipboard.writeText
					? navigator.clipboard.writeText(text)
					: null
		if (copyFn && typeof copyFn.then === 'function') {
			copyFn.then(function () {
				showToast(
					'Шаблон заявки скопирован — укажи ник и ссылку в личном кабинете',
					true,
				)
			})
		}
		window.open('account.html#whitelist', '_blank', 'noopener')
	}

	function closeBoldNickModal() {
		const root = document.getElementById('boldNickModalRoot')
		if (!root) return
		root.classList.remove('is-open')
		root.setAttribute('aria-hidden', 'true')
		document.body.style.overflow = ''
	}

	function submitBoldNickPay() {
		window.open(
			buildDonationUrl({
				amount: '150',
				comment: 'Ник: | Услуга: Жирный ник',
			}),
			'_blank',
			'noopener',
		)
		closeBoldNickModal()
	}

	function showToast(msg, ok = true) {
		if (typeof isnixShowToast === 'function') {
			isnixShowToast(msg, ok)
			return
		}
		const t = document.getElementById('toast')
		t.textContent = msg
		t.style.borderColor = ok ? 'var(--green-dark)' : 'rgba(248,113,113,.4)'
		t.classList.add('show')
		setTimeout(() => t.classList.remove('show'), 3200)
	}

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

	;(function initFooterLogo() {
		var footerLogo = document.getElementById('footerLogo')
		if (!footerLogo) return
		footerLogo.addEventListener('click', function (e) {
			var href = footerLogo.getAttribute('href')
			if (!href || href === '#') {
				e.preventDefault()
				window.scrollTo({ top: 0, behavior: 'smooth' })
			}
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

	const obs =
		typeof IntersectionObserver !== 'undefined'
			? new IntersectionObserver(
					e =>
						e.forEach(x => x.isIntersecting && x.target.classList.add('visible')),
					{ threshold: 0.08 },
				)
			: null
	if (obs) {
		document.querySelectorAll('.reveal').forEach(el => obs.observe(el))
	} else {
		document.querySelectorAll('.reveal').forEach(el => el.classList.add('visible'))
	}
;(function initIpCopy() {
	document.querySelectorAll('.ip-box, .site-footer__ip').forEach(function (box) {
		var valEl = box.querySelector(".ip-val")
		var hintEl = box.querySelector(".ip-hint")
		if (!valEl || !hintEl) return
		var originalHint = hintEl.textContent
		function copyIp() {
			var ip = (valEl.textContent || "").trim()
			if (!ip) return
			var copyFn =
				window.IsnixCompat && IsnixCompat.copyText
					? IsnixCompat.copyText(ip)
					: navigator.clipboard && navigator.clipboard.writeText
						? navigator.clipboard.writeText(ip)
						: null
			if (!copyFn || typeof copyFn.then !== 'function') return
			copyFn.then(function () {
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
