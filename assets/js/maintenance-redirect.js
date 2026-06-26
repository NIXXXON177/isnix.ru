;(function () {
	var path = location.pathname.replace(/\/+$/, '')
	if (!path || path === '/index.html') return
	location.replace('/')
})()
