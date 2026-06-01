from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def svg(name, cls="icon"):
	return (
		f'<svg class="{cls}" aria-hidden="true" focusable="false">'
		f'<use href="assets/icons/sprite.svg#{name}"></use></svg>'
	)


ICON = {
	"🚀": svg("rocket"),
	"📦": svg("package"),
	"💡": svg("bulb"),
	"🔊": svg("volume"),
	"🎮": svg("gamepad"),
	"🛡️": svg("shield"),
	"🛡": svg("shield"),
	"🤝": svg("handshake"),
	"📋": svg("clipboard"),
	"👤": svg("user"),
	"✓": svg("check", "icon icon--sm"),
	"🌿": svg("leaf"),
	"🚫": svg("ban"),
	"🎤": svg("mic"),
	"🔒": svg("lock"),
	"🔄": svg("refresh"),
	"🛒": svg("cart"),
	"🎰": svg("dice"),
	"⚠️": svg("alert", "icon icon--inline"),
	"⚠": svg("alert", "icon icon--inline"),
	"🧙": svg("wizard", "icon icon--sm"),
	"⚡": svg("zap", "icon icon--sm"),
	"💛": svg("heart", "icon icon--sm"),
	"✨": svg("sparkles", "icon icon--sm"),
	"📺": svg("tv", "icon icon--sm"),
	"🎭": svg("mask", "icon icon--sm"),
	"🛟": svg("lifebuoy"),
	"📱": svg("smartphone"),
	"🤖": svg("android"),
	"🖥": svg("monitor"),
	"🔔": svg("bell"),
	"👍": svg("thumb-up", "icon icon--inline"),
	"👎": svg("thumb-down", "icon icon--inline"),
	"★": svg("star", "icon icon--inline"),
	"✅": svg("check-circle", "icon icon--inline"),
	"❌": svg("x-circle", "icon icon--inline"),
}

OPTS = ["🟢 ", "🟡 ", "🔵 ", "🔴 ", "🟣 ", "⚪ "]

for path in [ROOT / "index.html", ROOT / "how-to-play.html", ROOT / "account.html"]:
	text = path.read_text(encoding="utf-8")
	text = text.replace(
		"<em>💡</em>",
		f'<span class="htp-tip">{svg("bulb", "icon icon--sm")}<span>',
	)
	text = text.replace(
		"</em> Путь к папке",
		"</span> Путь к папке",
	)
	for em, rep in sorted(ICON.items(), key=lambda x: -len(x[0])):
		text = text.replace(em, rep)
	for prefix in OPTS:
		text = text.replace(prefix, "")
	check_svg = svg("check", "icon icon--sm")
	text = text.replace(
		f"<strong>{check_svg} В вайтлисте</strong>",
		f'<strong class="icon-label">{check_svg}<span>В вайтлисте</span></strong>',
	)
	path.write_text(text, encoding="utf-8")
	print("updated", path.name)
