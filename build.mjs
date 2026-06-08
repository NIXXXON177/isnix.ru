// Минификация статики сайта: src/css → assets/css, src/js → assets/js.
// Имена файлов сохраняются, поэтому ссылки в HTML менять не нужно.
// Исходники лежат в src/ (читаемые), в assets/ кладётся минифицированный прод.
// Конфиги (auth-config.js / .example.js) НЕ собираются — они правятся вручную в assets/js.
import { build } from 'esbuild'
import { readdirSync, statSync } from 'node:fs'
import path from 'node:path'

const targets = [
	{ srcDir: 'src/css', outDir: 'assets/css', ext: '.css' },
	{ srcDir: 'src/js', outDir: 'assets/js', ext: '.js' },
]

function kb(p) {
	return (statSync(p).size / 1024).toFixed(1)
}

let totalBefore = 0
let totalAfter = 0

for (const { srcDir, outDir, ext } of targets) {
	const files = readdirSync(srcDir).filter((f) => f.endsWith(ext))
	const entryPoints = files.map((f) => path.join(srcDir, f))

	await build({
		entryPoints,
		outdir: outDir,
		// bundle: false — каждый файл минифицируется отдельно, импорты не резолвятся
		// (это самостоятельные скрипты с глобалами, не ES-модули).
		bundle: false,
		minify: true,
		legalComments: 'none',
		// target не задаём: esbuild сжимает, но не понижает синтаксис,
		// поэтому совместимость со старыми браузерами не меняется.
		logLevel: 'warning',
	})

	for (const f of files) {
		const before = Number(kb(path.join(srcDir, f)))
		const after = Number(kb(path.join(outDir, f)))
		totalBefore += before
		totalAfter += after
		const pct = before > 0 ? Math.round((1 - after / before) * 100) : 0
		console.log(`  ${outDir}/${f}: ${before}KB → ${after}KB (-${pct}%)`)
	}
}

const pct = totalBefore > 0 ? Math.round((1 - totalAfter / totalBefore) * 100) : 0
console.log(`\nИтого: ${totalBefore.toFixed(1)}KB → ${totalAfter.toFixed(1)}KB (-${pct}%)`)
