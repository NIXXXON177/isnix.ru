/**
 * Прокси Supabase: api.isnix.ru → yfrlgeztbaebdapdnefy.supabase.co
 * Деплой: см. README-ru.md (редактор в панели или wrangler deploy)
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

const DEFAULT_ALLOW_HEADERS =
	'accept-profile, apikey, authorization, content-profile, content-type, prefer, range, x-client-info, x-retry-count, x-supabase-api-version, x-upsert'

function corsHeaders(allowOrigin, requestHeaders) {
	return {
		'Access-Control-Allow-Origin': allowOrigin,
		'Access-Control-Allow-Headers': requestHeaders || DEFAULT_ALLOW_HEADERS,
		'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
		'Access-Control-Max-Age': '86400',
	}
}
