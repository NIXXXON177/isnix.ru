;(function () {
	var path = location.pathname.replace(/\/+$/, '')
	if (!path || path === '/index.html') return
	if (/whitelist\.html$|admin\.html$|account\.html$/.test(path)) return
	location.replace('/')
})()
