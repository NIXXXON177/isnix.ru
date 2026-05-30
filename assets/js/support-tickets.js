;(function (window) {
	'use strict'

	var MAX_EVIDENCE_FILES = 5
	var MAX_EVIDENCE_BYTES = 25 * 1024 * 1024

	var supportReady = false
	var adminSupportLoaded = false
	var adminSupportFilter = 'open'

	function escapeHtml(s) {
		if (s == null) return ''
		return String(s)
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
	}

	function formatDate(iso) {
		if (!iso) return '—'
		try {
			return new Date(iso).toLocaleString('ru-RU', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
			})
		} catch (_e) {
			return iso
		}
	}

	function showMsg(text, ok) {
		if (window.IsnixAccount && IsnixAccount.showMsg) {
			IsnixAccount.showMsg(text, ok)
			return
		}
		var el = document.getElementById('authMessage')
		if (!el) return
		el.textContent = text
		el.className = 'auth-message' + (ok ? ' auth-message--ok' : ' auth-message--err')
		el.hidden = !text
	}

	function categoryLabel(cat) {
		var map = {
			player_report: 'Жалоба на игрока',
			bug: 'Баг / дюп',
			account: 'Аккаунт / вход',
			other: 'Другое',
		}
		return map[cat] || cat
	}

	function statusLabel(st) {
		var map = {
			open: 'Ожидает ответа',
			waiting_user: 'Ждём твоего ответа',
			waiting_admin: 'На рассмотрении',
			closed: 'Закрыто',
		}
		return map[st] || st
	}

	function statusClass(st) {
		if (st === 'closed') return 'auth-badge auth-badge--muted'
		if (st === 'waiting_user') return 'auth-badge auth-badge--warn'
		return 'auth-badge auth-badge--pending'
	}

	function renderAttachmentsHtml(attachments) {
		if (!attachments || !attachments.length) return ''
		return (
			'<div class="support-attachments">' +
			'<p class="auth-dialog__label">Доказательства</p>' +
			'<ul class="support-attachments__list">' +
			attachments
				.map(function (a) {
					var name = escapeHtml(a.file_name || 'файл')
					var url = a.signed_url || a.evidence_url || ''
					if (!url) {
						return '<li>' + name + '</li>'
					}
					var safeUrl = escapeHtml(url)
					var isImg = (a.mime_type || '').indexOf('image/') === 0
					var isVid = (a.mime_type || '').indexOf('video/') === 0
					var preview = isImg
						? '<a href="' +
							safeUrl +
							'" target="_blank" rel="noopener"><img class="support-attachments__thumb" src="' +
							safeUrl +
							'" alt="" loading="lazy" /></a>'
						: isVid
							? '<video class="support-attachments__video" src="' +
								safeUrl +
								'" controls preload="metadata"></video>'
							: ''
					return (
						'<li class="support-attachments__item">' +
						preview +
						'<a href="' +
						safeUrl +
						'" target="_blank" rel="noopener noreferrer">' +
						name +
						'</a></li>'
					)
				})
				.join('') +
			'</ul></div>'
		)
	}

	async function loadAttachmentsForTicket(ticketId) {
		if (!window.IsnixAuth || !IsnixAuth.getSupportAttachments) return []
		return IsnixAuth.getSupportAttachments(ticketId)
	}

	function renderMessages(messages) {
		if (!messages.length) return ''
		return messages
			.map(function (m) {
				var mod = m.is_staff ? 'auth-dialog--admin' : 'auth-dialog--user'
				var lab = m.is_staff ? 'Администрация' : 'Ты'
				return (
					'<div class="auth-dialog ' +
					mod +
					'">' +
					'<p class="auth-dialog__label">' +
					escapeHtml(lab) +
					' · ' +
					escapeHtml(formatDate(m.created_at)) +
					'</p>' +
					'<p class="auth-dialog__body">' +
					escapeHtml(m.body) +
					'</p></div>'
				)
			})
			.join('')
	}

	async function loadMessages(ticketId) {
		if (!window.IsnixAuth || !IsnixAuth.getSupportMessages) return []
		return IsnixAuth.getSupportMessages(ticketId)
	}

	async function renderPlayerSupport() {
		var list = document.getElementById('supportTicketsList')
		var setup = document.getElementById('supportSetupNotice')
		if (!list) return

		if (!window.IsnixAuth || !IsnixAuth.getSupportTickets) {
			list.innerHTML =
				'<p class="auth-muted">Обращения пока не подключены на сервере.</p>'
			return
		}

		list.innerHTML = '<p class="auth-muted">Загрузка…</p>'
		try {
			var tickets = await IsnixAuth.getSupportTickets(false)
			if (setup) setup.hidden = tickets.length > 0 || true
			if (!tickets.length) {
				list.innerHTML =
					'<p class="auth-muted">Обращений пока нет. Создай новое ниже — администрация ответит в этом же диалоге.</p>'
				return
			}
			var html = ''
			for (var i = 0; i < tickets.length; i++) {
				var t = tickets[i]
				var msgs = await loadMessages(t.id)
				var attachments = await loadAttachmentsForTicket(t.id)
				var meta = ''
				if (t.offender_nick) {
					meta += '<p class="auth-muted">Нарушитель: <strong>' + escapeHtml(t.offender_nick) + '</strong></p>'
				}
				if (t.evidence_url) {
					meta +=
						'<p class="auth-muted">Доп. ссылка: <a href="' +
						escapeHtml(t.evidence_url) +
						'" target="_blank" rel="noopener noreferrer">открыть</a></p>'
				}
				meta += renderAttachmentsHtml(attachments)
				var replyForm =
					t.status === 'waiting_user'
						? '<form class="auth-app-reply-form" data-ticket-id="' +
							t.id +
							'">' +
							'<label class="auth-dialog__label" for="support-reply-' +
							t.id +
							'">Твой ответ администрации</label>' +
							'<textarea id="support-reply-' +
							t.id +
							'" class="auth-admin-note" rows="4" maxlength="4000" required placeholder="Ответь на вопрос…"></textarea>' +
							'<button type="submit" class="auth-submit">Отправить</button></form>'
						: t.status === 'open'
							? '<p class="auth-hint">Ожидай первого ответа администрации.</p>'
							: ''
				html +=
					'<article class="auth-app-card" id="support-ticket-' +
					t.id +
					'">' +
					'<div class="auth-app-head">' +
					'<strong>' +
					escapeHtml(t.subject) +
					'</strong>' +
					'<span class="' +
					statusClass(t.status) +
					'">' +
					escapeHtml(statusLabel(t.status)) +
					'</span></div>' +
					'<p class="auth-muted">' +
					escapeHtml(categoryLabel(t.category)) +
					' · ' +
					escapeHtml(formatDate(t.updated_at)) +
					'</p>' +
					meta +
					renderMessages(msgs) +
					replyForm +
					'</article>'
			}
			list.innerHTML = html
			list.querySelectorAll('.auth-app-reply-form[data-ticket-id]').forEach(function (form) {
				form.addEventListener('submit', async function (e) {
					e.preventDefault()
					var tid = form.getAttribute('data-ticket-id')
					var ta = form.querySelector('textarea')
					try {
						await IsnixAuth.addSupportMessage(tid, ta ? ta.value : '')
						showMsg('Ответ отправлен.', true)
						await renderPlayerSupport()
					} catch (err) {
						showMsg(IsnixAuth.formatAuthError(err), false)
					}
				})
			})
		} catch (err) {
			list.innerHTML =
				'<p class="auth-message auth-message--err">' +
				escapeHtml(IsnixAuth.formatAuthError(err)) +
				'</p>'
		}
	}

	async function renderAdminSupport() {
		var list = document.getElementById('adminSupportList')
		if (!list || !window.IsnixAuth) return
		list.innerHTML = '<p class="auth-muted">Загрузка…</p>'
		try {
			var tickets = await IsnixAuth.getSupportTickets(true)
			var filtered = tickets.filter(function (t) {
				if (adminSupportFilter === 'all') return true
				return t.status !== 'closed'
			})
			if (!filtered.length) {
				list.innerHTML = '<p class="auth-muted">Нет обращений в этом разделе.</p>'
				return
			}
			var html = ''
			for (var i = 0; i < filtered.length; i++) {
				var t = filtered[i]
				var msgs = await loadMessages(t.id)
				var attachments = await loadAttachmentsForTicket(t.id)
				var meta =
					'<p class="auth-muted">ID: ' +
					escapeHtml(t.id.slice(0, 8)) +
					'… · ' +
					escapeHtml(formatDate(t.created_at)) +
					'</p>'
				if (t.offender_nick) {
					meta += '<p class="auth-muted">Нарушитель: ' + escapeHtml(t.offender_nick) + '</p>'
				}
				if (t.evidence_url) {
					meta +=
						'<p class="auth-muted">Доп. ссылка: <a href="' +
						escapeHtml(t.evidence_url) +
						'" target="_blank" rel="noopener">открыть</a></p>'
				}
				meta += renderAttachmentsHtml(attachments)
				var actions =
					t.status !== 'closed'
						? '<div class="auth-admin-actions">' +
							renderMessages(msgs) +
							'<label class="auth-dialog__label" for="admin-support-' +
							t.id +
							'">Ответ игроку</label>' +
							'<textarea id="admin-support-' +
							t.id +
							'" class="auth-admin-note" rows="4" maxlength="4000" placeholder="Ответ по правилам, пункт нарушения…"></textarea>' +
							'<div class="auth-admin-btns">' +
							'<button type="button" class="auth-submit auth-admin-support-reply" data-id="' +
							t.id +
							'">Отправить ответ</button>' +
							'<button type="button" class="auth-submit auth-submit--ghost auth-admin-support-close" data-id="' +
							t.id +
							'">Закрыть обращение</button>' +
							'</div></div>'
						: renderMessages(msgs)
				html +=
					'<article class="auth-app-card auth-app-card--admin">' +
					'<div class="auth-app-head"><strong>' +
					escapeHtml(t.subject) +
					'</strong><span class="' +
					statusClass(t.status) +
					'">' +
					escapeHtml(statusLabel(t.status)) +
					'</span></div>' +
					'<p class="auth-muted">' +
					escapeHtml(categoryLabel(t.category)) +
					'</p>' +
					meta +
					actions +
					'</article>'
			}
			list.innerHTML = html
			list.querySelectorAll('.auth-admin-support-reply').forEach(function (btn) {
				btn.addEventListener('click', async function () {
					var id = btn.getAttribute('data-id')
					var ta = document.getElementById('admin-support-' + id)
					try {
						await IsnixAuth.adminReplySupportTicket(id, ta ? ta.value : '')
						showMsg('Ответ отправлен игроку.', true)
						await renderAdminSupport()
					} catch (err) {
						showMsg(IsnixAuth.formatAuthError(err), false)
					}
				})
			})
			list.querySelectorAll('.auth-admin-support-close').forEach(function (btn) {
				btn.addEventListener('click', async function () {
					var id = btn.getAttribute('data-id')
					if (!confirm('Закрыть обращение?')) return
					try {
						await IsnixAuth.closeSupportTicket(id)
						showMsg('Обращение закрыто.', true)
						await renderAdminSupport()
					} catch (err) {
						showMsg(IsnixAuth.formatAuthError(err), false)
					}
				})
			})
		} catch (err) {
			list.innerHTML =
				'<p class="auth-message auth-message--err">' +
				escapeHtml(IsnixAuth.formatAuthError(err)) +
				'</p>'
		}
	}

	function bindCreateForm() {
		var form = document.getElementById('supportTicketForm')
		if (!form || form.dataset.bound) return
		form.dataset.bound = '1'
		form.addEventListener('submit', async function (e) {
			e.preventDefault()
			if (!window.IsnixAuth || !IsnixAuth.createSupportTicket) {
				showMsg('Обращения не подключены. SQL: docs/supabase-support-tickets.sql', false)
				return
			}
			var btn = form.querySelector('button[type="submit"]')
			if (btn) btn.disabled = true
			try {
				var ticketId = await IsnixAuth.createSupportTicket({
					category: document.getElementById('supportCategory').value,
					subject: document.getElementById('supportSubject').value,
					body: document.getElementById('supportBody').value,
					offender_nick: document.getElementById('supportOffender').value,
					evidence_url: document.getElementById('supportEvidence').value,
				})
				var fileInput = document.getElementById('supportEvidenceFiles')
				if (
					ticketId &&
					fileInput &&
					fileInput.files &&
					fileInput.files.length &&
					IsnixAuth.uploadSupportEvidenceFiles
				) {
					var up = await IsnixAuth.uploadSupportEvidenceFiles(
						ticketId,
						fileInput.files,
					)
					if (up.failed && up.failed.length) {
						showMsg(
							'Обращение создано, но часть файлов не загрузилась: ' +
								up.failed.join('; '),
							false,
						)
					} else if (up.uploaded > 0) {
						showMsg(
							'Обращение отправлено с ' + up.uploaded + ' файл(ами). Ожидай ответа.',
							true,
						)
					} else {
						showMsg('Обращение отправлено. Ожидай ответа в этом разделе.', true)
					}
				} else {
					showMsg('Обращение отправлено. Ожидай ответа в этом разделе.', true)
				}
				form.reset()
				await renderPlayerSupport()
				var section = document.getElementById('support')
				if (section) section.scrollIntoView({ behavior: 'smooth', block: 'start' })
			} catch (err) {
				showMsg(IsnixAuth.formatAuthError(err), false)
			} finally {
				if (btn) btn.disabled = false
			}
		})
	}

	function bindAdminFilters() {
		document.querySelectorAll('[data-support-filter]').forEach(function (btn) {
			if (btn.dataset.supportBound) return
			btn.dataset.supportBound = '1'
			btn.addEventListener('click', function () {
				adminSupportFilter = btn.getAttribute('data-support-filter') || 'open'
				document.querySelectorAll('[data-support-filter]').forEach(function (b) {
					b.classList.toggle('active', b === btn)
				})
				renderAdminSupport()
			})
		})
	}

	function onDashboard(userId, profile) {
		var section = document.getElementById('support')
		if (!section) return
		section.hidden = false
		bindCreateForm()
		renderPlayerSupport()
		if (window.IsnixAuth && IsnixAuth.isAdminProfile(profile)) {
			bindAdminFilters()
		}
		supportReady = true
	}

	function onAdminView(view) {
		if (view !== 'support') return
		if (!adminSupportLoaded) {
			adminSupportLoaded = true
			bindAdminFilters()
		}
		renderAdminSupport()
	}

	function onGuest() {
		var section = document.getElementById('support')
		if (section) section.hidden = true
	}

	window.IsnixSupportTickets = {
		onDashboard: onDashboard,
		onAdminView: onAdminView,
		onGuest: onGuest,
		refresh: renderPlayerSupport,
	}
})(window)
