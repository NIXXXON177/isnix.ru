/**
 * api.isnix.ru (или *.workers.dev):
 *   /ely/skin/{nick}.png — PNG скина Ely.by по HTTPS (без mixed content)
 *   /* — прокси Supabase → yfrlgeztbaebdapdnefy.supabase.co
 */
const SUPABASE_HOST = 'yfrlgeztbaebdapdnefy.supabase.co'
const ALLOWED_ORIGINS = ['https://isnix.ru', 'https://www.isnix.ru']

export default {
	async fetch(request, env) {
		const host = env.SUPABASE_HOST || SUPABASE_HOST
		const origin = request.headers.get('Origin') || ''
		const allowOrigin = ALLOWED_ORIGINS.includes(origin)
			? origin
			: ALLOWED_ORIGINS[0]

		if (request.method === 'OPTIONS') {
			const requested = request.headers.get('Access-Control-Request-Headers')
			return new Response(null, {
				status: 204,
				headers: corsHeaders(allowOrigin, requested),
			})
		}

		const url = new URL(request.url)
		if (url.pathname.startsWith('/ely/skin/')) {
			return proxyElySkin(url, allowOrigin, request.method)
		}

		const target = new URL(request.url)
		target.protocol = 'https:'
		target.hostname = host

		const headers = new Headers(request.headers)
		headers.set('Host', host)

		const proxied = new Request(target.toString(), {
			method: request.method,
			headers,
			body:
				request.method !== 'GET' && request.method !== 'HEAD'
					? request.body
					: undefined,
			redirect: 'follow',
		})

		const response = await fetch(proxied)
		const out = new Headers(response.headers)
		for (const [k, v] of Object.entries(corsHeaders(allowOrigin, null))) {
			out.set(k, v)
		}

		return new Response(response.body, {
			status: response.status,
			statusText: response.statusText,
			headers: out,
		})
	},
}

async function proxyElySkin(url, allowOrigin, method) {
	if (url.pathname.length <= '/ely/skin/'.length) {
		return new Response('Missing nickname', { status: 400 })
	}

	const nick = decodeURIComponent(
		url.pathname.slice('/ely/skin/'.length).replace(/\.png$/i, ''),
	).trim()
	if (!nick) {
		return new Response('Missing nickname', { status: 400 })
	}

	const texRes = await fetch(
		`https://skinsystem.ely.by/textures/${encodeURIComponent(nick)}?version=2`,
	)
	if (!texRes.ok || texRes.status === 204) {
		return elySkinMiss(allowOrigin)
	}

	const texBody = await texRes.text()
	if (!texBody || !texBody.trim()) {
		return elySkinMiss(allowOrigin)
	}

	let data
	try {
		data = JSON.parse(texBody)
	} catch (_e) {
		return elySkinMiss(allowOrigin)
	}

	const raw = data && data.SKIN && data.SKIN.url
	if (!raw) {
		return elySkinMiss(allowOrigin)
	}

	if (method === 'HEAD') {
		return new Response(null, {
			status: 200,
			headers: {
				'Access-Control-Allow-Origin': allowOrigin,
				'Cache-Control': 'public, max-age=3600',
			},
		})
	}

	const skinUrl = String(raw).replace(/^http:\/\//i, 'https://')
	const skinRes = await fetch(skinUrl)
	if (!skinRes.ok) {
		return new Response(null, {
			status: skinRes.status,
			headers: { 'Access-Control-Allow-Origin': allowOrigin },
		})
	}

	const out = new Headers(skinRes.headers)
	out.set('Content-Type', 'image/png')
	out.set('Cache-Control', 'public, max-age=3600')
	out.set('Access-Control-Allow-Origin', allowOrigin)

	return new Response(skinRes.body, { status: 200, headers: out })
}

const DEFAULT_ALLOW_HEADERS =
	'accept-profile, apikey, authorization, content-profile, content-type, prefer, range, x-client-info, x-retry-count, x-supabase-api-version, x-upsert'

function elySkinMiss(allowOrigin) {
	return new Response(null, {
		status: 404,
		headers: {
			'Access-Control-Allow-Origin': allowOrigin,
			'Cache-Control': 'public, max-age=300',
		},
	})
}

function corsHeaders(allowOrigin, requestHeaders) {
	return {
		'Access-Control-Allow-Origin': allowOrigin,
		'Access-Control-Allow-Headers': requestHeaders || DEFAULT_ALLOW_HEADERS,
		'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
		'Access-Control-Max-Age': '86400',
	}
}
