;(function () {
	'use strict'

	var RETURN_KEY = 'isnix_after_login'
	var EVIDENCE_MAX_FILES = 5

	var guestEl = document.getElementById('appealsGuest')
	var dashEl = document.getElementById('appealsDashboard')
	var adminHint = document.getElementById('appealsAdminHint')
	var loginBtn = document.getElementById('appealsLoginBtn')

	function showMsg(text, ok) {
		if (window.IsnixToast) {
			if (!text) IsnixToast.hideAll()
			else IsnixToast.show(text, ok ? 'ok' : 'err')
		}
		var el = document.getElementById('appealsMessage')
		if (!el) return
		el.textContent = text
		el.className = 'auth-message' + (ok ? ' auth-message--ok' : ' auth-message--err')
		el.hidden = !text
	}

	function showGuest() {
		if (guestEl) guestEl.hidden = false
		if (dashEl) dashEl.hidden = true
		if (adminHint) adminHint.hidden = true
		if (window.IsnixSupportTickets) IsnixSupportTickets.onGuest()
	}

	function showDashboard(profile) {
		if (guestEl) guestEl.hidden = true
		if (dashEl) dashEl.hidden = false
		if (
			adminHint &&
			window.IsnixAuth &&
			IsnixAuth.isAdminProfile &&
			IsnixAuth.isAdminProfile(profile)
		) {
			adminHint.hidden = false
		}
		if (window.IsnixSupportTickets && IsnixSupportTickets.onAppealsPage) {
			IsnixSupportTickets.onAppealsPage()
		}
	}

	function bindLoginReturn() {
		if (!loginBtn) return
		loginBtn.addEventListener('click', function () {
			try {
				sessionStorage.setItem(RETURN_KEY, 'appeals.html')
			} catch (_e) {}
		})
	}

	function formatFileSize(bytes) {
		if (bytes < 1024) return bytes + ' Б'
		if (bytes < 1024 * 1024) return Math.round(bytes / 1024) + ' КБ'
		return (bytes / (1024 * 1024)).toFixed(1) + ' МБ'
	}

	function filesToDataTransfer(fileList) {
		var dt = new DataTransfer()
		var i
		for (i = 0; i < fileList.length && dt.files.length < EVIDENCE_MAX_FILES; i++) {
			if (fileList[i]) dt.items.add(fileList[i])
		}
		return dt
	}

	function mergeFileLists(existing, incoming) {
		var dt = new DataTransfer()
		var seen = Object.create(null)
		var i
		var f
		function add(file) {
			if (!file || dt.files.length >= EVIDENCE_MAX_FILES) return
			var key = file.name + ':' + file.size + ':' + file.lastModified
			if (seen[key]) return
			seen[key] = true
			dt.items.add(file)
		}
		for (i = 0; i < existing.length; i++) add(existing[i])
		for (i = 0; i < incoming.length; i++) add(incoming[i])
		return dt
	}

	function bindEvidenceDropzone() {
		var zone = document.getElementById('supportEvidenceDropzone')
		var input = document.getElementById('supportEvidenceFiles')
		var list = document.getElementById('supportEvidenceFileList')
		var form = document.getElementById('supportTicketForm')
		if (!zone || !input || zone.dataset.bound) return
		zone.dataset.bound = '1'

		function renderFileList() {
			if (!list) return
			var files = input.files
			if (!files || !files.length) {
				list.hidden = true
				list.innerHTML = ''
				return
			}
			list.hidden = false
			var html = ''
			var i
			for (i = 0; i < files.length; i++) {
				html +=
					'<li class="support-evidence-dropzone__item">' +
					'<span class="support-evidence-dropzone__name" title="' +
					escapeAttr(files[i].name) +
					'">' +
					escapeHtml(files[i].name) +
					'</span>' +
					'<span class="support-evidence-dropzone__meta">' +
					escapeHtml(formatFileSize(files[i].size)) +
					'</span>' +
					'<button type="button" class="support-evidence-dropzone__remove" data-evidence-remove="' +
					i +
					'" aria-label="Убрать файл">×</button>' +
					'</li>'
			}
			list.innerHTML = html
		}

		function escapeHtml(s) {
			return String(s)
				.replace(/&/g, '&amp;')
				.replace(/</g, '&lt;')
				.replace(/>/g, '&gt;')
				.replace(/"/g, '&quot;')
		}

		function escapeAttr(s) {
			return escapeHtml(s).replace(/'/g, '&#39;')
		}

		function applyFiles(dt) {
			input.files = dt.files
			renderFileList()
		}

		function addFiles(fileList) {
			if (!fileList || !fileList.length) return
			var dt = mergeFileLists(input.files, fileList)
			applyFiles(dt)
		}

		zone.addEventListener('click', function (e) {
			if (e.target.closest('[data-evidence-remove]')) return
			input.click()
		})

		zone.addEventListener('keydown', function (e) {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault()
				input.click()
			}
		})

		input.addEventListener('change', function () {
			var dt = filesToDataTransfer(input.files)
			applyFiles(dt)
		})

		;['dragenter', 'dragover'].forEach(function (ev) {
			zone.addEventListener(ev, function (e) {
				e.preventDefault()
				e.stopPropagation()
				zone.classList.add('is-dragover')
			})
		})

		zone.addEventListener('dragleave', function (e) {
			if (!zone.contains(e.relatedTarget)) {
				zone.classList.remove('is-dragover')
			}
		})

		zone.addEventListener('drop', function (e) {
			e.preventDefault()
			e.stopPropagation()
			zone.classList.remove('is-dragover')
			if (e.dataTransfer && e.dataTransfer.files) {
				addFiles(e.dataTransfer.files)
			}
		})

		if (list) {
			list.addEventListener('click', function (e) {
				var btn = e.target.closest('[data-evidence-remove]')
				if (!btn) return
				e.preventDefault()
				e.stopPropagation()
				var idx = parseInt(btn.getAttribute('data-evidence-remove'), 10)
				if (isNaN(idx)) return
				var dt = new DataTransfer()
				var i
				for (i = 0; i < input.files.length; i++) {
					if (i !== idx) dt.items.add(input.files[i])
				}
				applyFiles(dt)
			})
		}

		if (form) {
			form.addEventListener('reset', function () {
				window.setTimeout(renderFileList, 0)
			})
		}
	}

	async function onSession(session) {
		if (!session || !window.IsnixAuth) {
			showGuest()
			return
		}
		var profile = null
		try {
			profile = await IsnixAuth.getProfile(session.user.id)
		} catch (_e) {
			profile = null
		}
		showDashboard(profile)
	}

	async function init() {
		bindLoginReturn()
		bindEvidenceDropzone()

		if (!window.IsnixAuth || !IsnixAuth.isReady || !IsnixAuth.isReady()) {
			showMsg(
				'Аккаунты на сайте не подключены. Админу: docs/supabase-auth-setup.md',
				false,
			)
			showGuest()
			return
		}

		IsnixAuth.onAuthStateChange(function (session) {
			onSession(session)
		})

		try {
			var session = await IsnixAuth.getSession()
			await onSession(session)
		} catch (err) {
			showMsg(IsnixAuth.formatAuthError(err), false)
			showGuest()
		}
	}

	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', init)
	} else {
		init()
	}
})()
