;(function () {
	'use strict'

	var SERVER_IP = 'mc.isnix.ru'

	function getPage() {
		return document.body.getAttribute('data-page') || 'home'
	}

	function fixNavHrefs() {
		var page = getPage()
		var onHome = page === 'home'
		document.querySelectorAll('.nav-links a[data-nav]').forEach(function (a) {
			var id = a.getAttribute('data-nav')
			if (!id) return
			a.href = onHome ? '#' + id : 'index.html#' + id
		})
		var joinHref = onHome ? '#join-server' : 'index.html#join-server'
		;['navJoinBtn', 'navJoinTop'].forEach(function (id) {
			var el = document.getElementById(id)
			if (el) el.href = joinHref
		})
	}

	function markActivePage() {
		var page = getPage()
		document.querySelectorAll('[data-page-link]').forEach(function (a) {
			var active = a.getAttribute('data-page-link') === page
			a.classList.toggle('active', active)
			if (active) a.setAttribute('aria-current', 'page')
			else a.removeAttribute('aria-current')
		})
	}

	function initCopyIp() {
		var btn = document.getElementById('siteCopyIp')
		if (!btn) return
		btn.addEventListener('click', function () {
			function done(ok) {
				if (!ok) return
				btn.classList.add('is-copied')
				btn.textContent = 'Скопировано'
				setTimeout(function () {
					btn.classList.remove('is-copied')
					btn.textContent = SERVER_IP
				}, 1600)
			}
			var copyFn =
				window.IsnixCompat && IsnixCompat.copyText
					? IsnixCompat.copyText(SERVER_IP)
					: null
			if (copyFn && typeof copyFn.then === 'function') {
				copyFn
					.then(function () {
						done(true)
					})
					.catch(function () {
						done(false)
					})
			} else if (navigator.clipboard && navigator.clipboard.writeText) {
				navigator.clipboard.writeText(SERVER_IP).then(function () {
					done(true)
				}).catch(function () {
					done(false)
				})
			} else {
				done(false)
			}
		})
	}

	function initSiteNav() {
		var nav = document.getElementById('siteNav')
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

		function toggleMenu() {
			if (!isMobileNav()) {
				closeMenu()
				return
			}
			setMenuOpen(!menu.classList.contains('is-open'))
		}

		var siteHeader = document.getElementById('siteHeader')
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

		menu.querySelectorAll('a, .nav-drawer-auth__logout').forEach(function (el) {
			el.addEventListener('click', function () {
				if (isMobileNav()) closeMenu()
			})
		})

		if (logo) {
			logo.addEventListener('click', function (e) {
				if (getPage() !== 'home') return
				var href = logo.getAttribute('href') || ''
				if (href.indexOf('index.html') !== -1) return
				e.preventDefault()
				closeMenu()
				if (window.IsnixCompat && IsnixCompat.scrollToTop) {
					IsnixCompat.scrollToTop(true)
				} else {
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

		if (window.IsnixCompat && IsnixCompat.onMatchMediaChange) {
			IsnixCompat.onMatchMediaChange(mqMobile, function () {
				if (!mqMobile.matches) closeMenu()
			})
		} else if (mqMobile.addEventListener) {
			mqMobile.addEventListener('change', function () {
				if (!mqMobile.matches) closeMenu()
			})
		}

		window.addEventListener('resize', function () {
			if (!isMobileNav()) closeMenu()
		})
	}

	function initNavScrollSpy() {
		if (typeof IntersectionObserver === 'undefined') return
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
				ids.forEach(function (key) {
					map[key].link.classList.toggle('active', key === id)
				})
			},
			{ rootMargin: '-40% 0px -45% 0px', threshold: [0, 0.1, 0.5] },
		)
		ids.forEach(function (id) {
			io.observe(map[id].el)
		})
	}

	fixNavHrefs()
	markActivePage()
	initCopyIp()
	initSiteNav()
	if (getPage() === 'home') initNavScrollSpy()
})()
