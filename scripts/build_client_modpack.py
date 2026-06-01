#!/usr/bin/env python3
"""
Собирает downloads/ISTHISNIXXXONmods.zip — только моды для клиента игрока.

- PLAYER_REQUIRED_FROM_SERVER — jar с сервера (версия 1:1), без которых нельзя
  нормально играть: Fabric API, Voice Chat, OPAC, styled-chat, isnix-chat и deps.
- CLIENT_ONLY_PATTERNS — оптимизация, карты, UI; берутся из архивов, не из mods/ сервера.

НЕ включаем: EasyAuth, TAB, GrimAC, isnix-market, trade (server-only), FastRTP,
FallingTree и прочий QoL, который работает только на стороне сервера.

Запуск: python scripts/build_client_modpack.py
"""
from __future__ import annotations

import json
import os
import shutil
import zipfile
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_ZIP = ROOT / "downloads" / "ISTHISNIXXXONmods.zip"
STAGING = ROOT / "build" / "client-modpack-staging"
LEGACY_ZIP = ROOT / "ISTHISNIXXXON FABRIC 1.21.1.zip"
CURRENT_ZIP = ROOT / "downloads" / "ISTHISNIXXXONmods.zip"

# Точные имена на сервере — только то, что игроку нужно в папке mods клиента
PLAYER_REQUIRED_FROM_SERVER = [
	"fabric-api-0.116.12+1.21.1.jar",
	"fabric-language-kotlin-1.13.11+kotlin.2.3.21.jar",
	"architectury-13.0.8-fabric.jar",
	"cloth-config-15.0.140-fabric.jar",
	"collective-1.21.1-8.22.jar",
	"jamlib-fabric-1.3.6+1.21.1.jar",
	"ForgeConfigAPIPort-v21.1.6-1.21.1-Fabric.jar",
	"open-parties-and-claims-fabric-1.21.1-0.26.3.jar",
	"styled-chat-2.6.1+1.21.jar",
	"voicechat-fabric-1.21.1-2.6.17.jar",
	"isnix-chat-1.0.0.jar",
	"Female-Gender-Mod-fabric-3.2.1+1.21.jar",
]

# Только клиент: FPS, карты, HUD, звук — не тянем из server/mods/
CLIENT_ONLY_PATTERNS = [
	"BetterF3",
	"ImmediatelyFast",
	"InventoryProfilesNext",
	"Jade-",
	"MouseTweaks",
	"PresenceFootsteps",
	"appleskin",
	"dynamic-fps",
	"emi-",
	"libIPN",
	"modernfix",
	"modmenu",
	"sodium-fabric",
	"sound-physics-remastered",
	"shulkerboxtooltip",
	"xaeroworldmap",
	"xaerominimap",
	"iris-fabric",
	"tl_skin_cape",
	"lithium-fabric",
	"ferritecore",
]

MANIFEST = {
	"name": "ISTHISNIXXXON Client Modpack",
	"minecraft": "1.21.1",
	"loader": "Fabric",
	"java": "21",
	"launcher": "ElyPrismLauncher (recommended)",
	"version": "2.1.0-client",
	"built": None,
	"mods_count": 0,
	"note": (
		"Player client only: required parity mods + client UX (Sodium, Xaero, etc.). "
		"Server-only (EasyAuth, TAB, trade, FallingTree, isnix-market, admin) excluded."
	),
}


def load_env_and_connect():
	import paramiko

	env_file = ROOT / "server-sftp.env"
	if env_file.is_file():
		for line in env_file.read_text(encoding="utf-8").splitlines():
			line = line.strip()
			if not line or line.startswith("#") or "=" not in line:
				continue
			k, _, v = line.partition("=")
			k, v = k.strip(), v.strip().strip('"').strip("'")
			if k and k not in os.environ:
				os.environ[k] = v

	host = os.environ.get("SFTP_HOST", "c11.play2go.cloud").strip()
	user = os.environ.get("SFTP_USER", "").strip()
	password = os.environ.get("SFTP_PASSWORD", "")
	port = int(os.environ.get("SFTP_PORT", "2022"))
	if not user or not password:
		raise SystemExit("Нужен server-sftp.env с SFTP_USER и SFTP_PASSWORD")

	transport = paramiko.Transport((host, port))
	transport.connect(username=user, password=password)
	sftp = paramiko.SFTPClient.from_transport(transport)
	assert sftp is not None
	base = os.environ.get("REMOTE_BASE", ".").strip() or "."
	if base in (".", "auto", "detect"):
		for cand in [".", "/", "/home/container"]:
			try:
				sftp.listdir(cand)
				base = cand
				break
			except OSError:
				continue
	return transport, sftp, base


def pull_server_jars(sftp, base: str, dest: Path) -> list[str]:
	dest.mkdir(parents=True, exist_ok=True)
	pulled = []
	for name in PLAYER_REQUIRED_FROM_SERVER:
		remote = f"{base.rstrip('/')}/mods/{name}" if base != "/" else f"/mods/{name}"
		if base == ".":
			remote = f"mods/{name}"
		local = dest / name
		try:
			sftp.get(remote, str(local))
			pulled.append(name)
			print(f"  required: {name}")
		except OSError as e:
			print(f"  WARN pull failed {name}: {e}")
	return pulled


def mod_slug(filename: str) -> str:
	"""Грубый ключ мода для дедупликации (sound-physics, sodium, …)."""
	lower = filename.lower()
	for token in (
		"fabric-",
		"-fabric",
		"+mc",
		"+1.21",
		"-1.21",
		"_",
	):
		lower = lower.replace(token, "-")
	parts = [p for p in lower.split("-") if p and not p[0].isdigit()]
	return "-".join(parts[:3]) if parts else lower


def copy_matching_jars(src_zip: Path, dest: Path, patterns: list[str]) -> list[str]:
	if not src_zip.is_file():
		return []
	added = []
	with zipfile.ZipFile(src_zip, "r") as zf:
		for info in zf.infolist():
			if info.is_dir() or not info.filename.endswith(".jar"):
				continue
			base = Path(info.filename).name
			if any(p in base for p in patterns):
				if "(1)" in base and "fabric-language-kotlin" in base:
					continue
				slug = mod_slug(base)
				existing = list(dest.glob("*.jar"))
				for old in existing:
					if mod_slug(old.name) == slug:
						break
				else:
					out = dest / base
					out.write_bytes(zf.read(info.filename))
					added.append(base)
					print(f"  client: {base} ({src_zip.name})")
	return added


def write_modpack_txt(dest: Path, jars: list[str]) -> None:
	lines = [
		"ISTHISNIXXXON — клиентская сборка для игроков (Fabric 1.21.1)",
		f"Версия: {MANIFEST['version']}",
		f"Собрано: {MANIFEST['built']}",
		f"Модов: {len(jars)}",
		"",
		"Только моды для клиента: голосовой чат, OPAC, карты, FPS и HUD.",
		"QoL с сервера (FallingTree, /trade, FastRTP и т.д.) ставить не нужно —",
		"они работают на стороне сервера.",
		"",
		"Установка: ElyPrismLauncher → Добавить → Импортировать из ZIP",
		"или распаковать jar в папку mods инстанса 1.21.1 Fabric.",
		"",
		"Список модов:",
	]
	lines.extend(f"  - {j}" for j in sorted(jars))
	(dest / "MODPACK.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")


def build_zip(staging: Path, out: Path) -> list[str]:
	jars = sorted(p.name for p in staging.glob("*.jar"))
	out.parent.mkdir(parents=True, exist_ok=True)
	backup = out.with_suffix(".zip.bak")
	if out.is_file():
		shutil.copy2(out, backup)
		print(f"Backup: {backup}")

	write_modpack_txt(staging, jars)

	with zipfile.ZipFile(out, "w", compression=zipfile.ZIP_DEFLATED) as zf:
		zf.write(staging / "MODPACK.txt", "MODPACK.txt")
		for name in jars:
			zf.write(staging / name, name, compress_type=zipfile.ZIP_DEFLATED)
	return jars


def main() -> None:
	print("=== Сборка ISTHISNIXXXONmods.zip (только клиент игрока) ===\n")
	if STAGING.exists():
		shutil.rmtree(STAGING)
	STAGING.mkdir(parents=True)

	print("1) Обязательные моды с сервера (версия 1:1)...")
	transport, sftp, base = load_env_and_connect()
	try:
		pull_server_jars(sftp, base, STAGING)
	finally:
		sftp.close()
		transport.close()

	print("\n2) Клиентские моды (оптимизация, UI, карты)...")
	for src in (CURRENT_ZIP, LEGACY_ZIP):
		copy_matching_jars(src, STAGING, CLIENT_ONLY_PATTERNS)

	for bad in STAGING.glob("*kotlin*(1)*.jar"):
		bad.unlink()

	jars = build_zip(STAGING, OUT_ZIP)
	size_mb = OUT_ZIP.stat().st_size / (1024 * 1024)

	MANIFEST["built"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
	MANIFEST["mods_count"] = len(jars)
	manifest_path = ROOT / "docs" / "client-modpack-manifest.json"
	manifest_path.write_text(
		json.dumps(MANIFEST, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
	)

	print(f"\nOK: {OUT_ZIP}")
	print(f"    {len(jars)} mods, {size_mb:.1f} MiB")
	print(f"    manifest: {manifest_path}")


if __name__ == "__main__":
	main()
