#!/usr/bin/env python3
"""Залить все isnix-*.jar из build/server-modpack-1.21.11 на Play2GO + fast-rtp.json."""
from __future__ import annotations

import os
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
STAGING = ROOT / "build" / "server-modpack-1.21.11"
PUSH = ROOT / ".github" / "scripts" / "push_sftp.py"
SFTP = ROOT / "scripts" / "play2go_sftp.py"
ENV_FILE = ROOT / "server-sftp.env"


def load_env() -> None:
	if not ENV_FILE.is_file():
		print(f"Нет {ENV_FILE}", file=sys.stderr)
		sys.exit(1)
	for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
		line = line.strip()
		if not line or line.startswith("#") or "=" not in line:
			continue
		key, _, value = line.partition("=")
		key = key.strip()
		value = value.strip().strip('"').strip("'")
		if key and key not in os.environ:
			os.environ[key] = value


def push_jar(jar: Path) -> int:
	name = jar.name
	match = re.match(r"^(isnix-[a-z-]+)-", name)
	prefix = match.group(1) if match else name.replace(".jar", "")
	os.environ["LOCAL_FILE"] = str(jar.resolve())
	os.environ["REMOTE_PATH"] = f"mods/{name}"
	os.environ["CLEANUP_MOD_PREFIX"] = prefix
	print(f"=== {name} ===")
	return subprocess.call([sys.executable, str(PUSH)])


def push_config(local: Path, remote: str) -> int:
	print(f"=== {remote} ===")
	return subprocess.call([sys.executable, str(SFTP), "push", str(local), remote])


def main() -> None:
	load_env()
	# Только последняя версия каждого мода (в staging могут копиться старые jar).
	latest: dict[str, Path] = {}
	for jar in STAGING.glob("isnix-*.jar"):
		match = re.match(r"^(isnix-[a-z-]+)-", jar.name)
		prefix = match.group(1) if match else jar.stem
		prev = latest.get(prefix)
		if prev is None or jar.stat().st_mtime >= prev.stat().st_mtime:
			latest[prefix] = jar
	jars = sorted(latest.values(), key=lambda p: p.name)
	if not jars:
		print(f"Нет jar в {STAGING}. Сначала: python scripts/build_isnix_mods_12111.py", file=sys.stderr)
		sys.exit(1)

	failed: list[str] = []
	for jar in jars:
		if push_jar(jar) != 0:
			failed.append(jar.name)

	cfg = ROOT / "docs" / "config-samples" / "fast-rtp.json"
	if cfg.is_file() and push_config(cfg, "config/fast-rtp.json") != 0:
		failed.append("config/fast-rtp.json")

	if failed:
		print("FAILED:", ", ".join(failed), file=sys.stderr)
		sys.exit(1)
	print("ALL OK — перезапустите сервер в панели Play2GO.")


if __name__ == "__main__":
	main()
