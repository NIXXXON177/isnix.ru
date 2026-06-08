;(function initShopSlider() {
	var vp = document.getElementById('shopSliderViewport')
	var track = document.getElementById('shopGrid')
	var prev = document.getElementById('shopSliderPrev')
	var next = document.getElementById('shopSliderNext')
	if (!vp || !track) return

	var mqReduce = window.matchMedia
		? window.matchMedia('(prefers-reduced-motion: reduce)')
		: null
	var currentOffset = 0
	var animFrameId = 0
	var dragging = false
	var dragStartX = 0
	var dragStartOffset = 0
	var TRACK_PAD = 8
	var ANIM_MS = 720

	function prefersReducedMotion() {
		return mqReduce && mqReduce.matches
	}

	function visibleCards() {
		return Array.prototype.filter.call(
			track.querySelectorAll('.shop-card'),
			function (card) {
				return !card.classList.contains('shop-card--hidden')
			},
		)
	}

	function maxOffset() {
		return Math.max(0, track.scrollWidth - vp.clientWidth)
	}

	function clampOffset(px) {
		return Math.max(0, Math.min(px, maxOffset()))
	}

	function cardOffset(card) {
		var left = card.offsetLeft - TRACK_PAD
		return clampOffset(left)
	}

	function cancelAnim() {
		if (animFrameId) {
			cancelAnimationFrame(animFrameId)
			animFrameId = 0
		}
	}

	function paintOffset(px) {
		track.classList.add('shop-slider-track--instant')
		track.style.transform =
			'translate3d(' + -px + 'px,0,0)'
	}

	function easeOutCubic(t) {
		return 1 - Math.pow(1 - t, 3)
	}

	function animateTo(targetPx) {
		cancelAnim()
		var to = clampOffset(targetPx)
		var from = currentOffset
		if (prefersReducedMotion() || Math.abs(from - to) < 1) {
			currentOffset = to
			paintOffset(to)
			updateShopSliderUi()
			return
		}
		var t0 = performance.now()
		function frame(now) {
			var p = Math.min(1, (now - t0) / ANIM_MS)
			var x = from + (to - from) * easeOutCubic(p)
			currentOffset = x
			paintOffset(x)
			updateShopSliderUi()
			if (p < 1) {
				animFrameId = requestAnimationFrame(frame)
			} else {
				animFrameId = 0
				currentOffset = to
				paintOffset(to)
				updateShopSliderUi()
			}
		}
		animFrameId = requestAnimationFrame(frame)
	}

	function setOffset(px, animate) {
		var target = clampOffset(px)
		if (animate) {
			animateTo(target)
			return
		}
		cancelAnim()
		currentOffset = target
		paintOffset(target)
		updateShopSliderUi()
	}

	function updateShopSliderUi() {
		var max = maxOffset()
		if (prev) prev.disabled = currentOffset <= 4
		if (next) next.disabled = currentOffset >= max - 4
		var fill = document.getElementById('shopSliderProgress')
		if (fill) {
			fill.style.width =
				(max < 1 ? 100 : (currentOffset / max) * 100) + '%'
		}
	}

	function activeCardIndex(cards) {
		if (!cards.length) return 0
		var idx = 0
		var best = Infinity
		for (var i = 0; i < cards.length; i++) {
			var d = Math.abs(cardOffset(cards[i]) - currentOffset)
			if (d < best) {
				best = d
				idx = i
			}
		}
		return idx
	}

	function goToCardIndex(index, animate) {
		var cards = visibleCards()
		if (!cards.length) return
		var i = Math.max(0, Math.min(index, cards.length - 1))
		setOffset(cardOffset(cards[i]), animate)
	}

	function stepCards(dir) {
		var cards = visibleCards()
		if (!cards.length) return
		goToCardIndex(activeCardIndex(cards) + dir, true)
	}

	function snapToNearest() {
		goToCardIndex(activeCardIndex(visibleCards()), true)
	}

	function endDrag() {
		if (!dragging) return
		dragging = false
		vp.classList.remove('is-dragging')
		snapToNearest()
	}

	if (prev) {
		prev.addEventListener('click', function () {
			stepCards(-1)
		})
	}
	if (next) {
		next.addEventListener('click', function () {
			stepCards(1)
		})
	}

	vp.addEventListener('pointerdown', function (e) {
		if (e.button !== 0) return
		if (e.target.closest('.shop-buy-btn')) return
		cancelAnim()
		dragging = true
		dragStartX = e.clientX
		dragStartOffset = currentOffset
		vp.classList.add('is-dragging')
		track.classList.add('shop-slider-track--instant')
		if (vp.setPointerCapture) {
			try {
				vp.setPointerCapture(e.pointerId)
			} catch (err) {}
		}
	})

	vp.addEventListener('pointermove', function (e) {
		if (!dragging) return
		var dx = dragStartX - e.clientX
		currentOffset = clampOffset(dragStartOffset + dx)
		paintOffset(currentOffset)
		updateShopSliderUi()
	})

	vp.addEventListener('pointerup', endDrag)
	vp.addEventListener('pointercancel', endDrag)

	window.addEventListener('resize', function () {
		setOffset(
			Math.min(currentOffset, maxOffset()),
			false,
		)
		requestAnimationFrame(snapToNearest)
	})

	vp.addEventListener('keydown', function (e) {
		if (e.key === 'ArrowLeft') {
			e.preventDefault()
			stepCards(-1)
		}
		if (e.key === 'ArrowRight') {
			e.preventDefault()
			stepCards(1)
		}
	})

	document.querySelectorAll('.shop-tab').forEach(function (tab) {
		tab.addEventListener('click', function () {
			document
				.querySelectorAll('.shop-tab')
				.forEach(function (t) {
					t.classList.remove('active')
				})
			tab.classList.add('active')
			var cat = tab.dataset.cat
			track.querySelectorAll('.shop-card').forEach(function (card) {
				var show = cat === 'all' || card.dataset.cat === cat
				card.classList.toggle('shop-card--hidden', !show)
			})
			dragging = false
			vp.classList.remove('is-dragging')
			requestAnimationFrame(function () {
				setOffset(0, false)
			})
		})
	})

	setOffset(0, false)
})()
