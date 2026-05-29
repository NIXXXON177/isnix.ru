#!/usr/bin/env python3
"""
Дополняет downloads/ISTHISNIXXXONmods.zip модами с сервера (server-remote/mods-pull).

Перед запуском скачайте jar с сервера:
  python scripts/play2go_sftp.py pull mods/FallingTree-1.21.1-1.21.1.11.jar
  (и другие — см. SHARED_MODS ниже)

Затем положите их в server-remote/mods-pull/ и:
  python scripts/update_client_modpack.py
"""
from __future__ import annotations

import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ZIP_PATH = ROOT / "downloads" / "ISTHISNIXXXONmods.zip"
PULL_DIR = ROOT / "server-remote" / "mods-pull"

# Моды с сервера, которые должны быть у игроков (имена могут отличаться — положите jar в mods-pull/)
SHARED_MODS_HINT = [
	"FallingTree",
	"trade",
	"doubledoors",
	"rightclickharvest",
	"fsit",
	"FastRTP",
	"ItemFrament",
	"Female-Gender",
	"collective",
	"architectury",
	"cloth-config",
	"ForgeConfigAPIPort",
	"jamlib",
	"open-parties-and-claims",
	"styled-chat",
]


def main() -> None:
	if not ZIP_PATH.is_file():
		print(f"Нет {ZIP_PATH}")
		return
	PULL_DIR.mkdir(parents=True, exist_ok=True)
	extra = list(PULL_DIR.glob("*.jar"))
	if not extra:
		print(f"Положите jar в {PULL_DIR} (см. SHARED_MODS в скрипте)")
		print("Подсказка: python scripts/play2go_sftp.py pull mods/<имя>.jar")
		print("  затем скопируйте в server-remote/mods-pull/")
		return

	with zipfile.ZipFile(ZIP_PATH, "a", compression=zipfile.ZIP_DEFLATED) as zf:
		existing = set(zf.namelist())
		for jar in extra:
			name = jar.name
			if name in existing:
				print(f"skip (уже в zip): {name}")
				continue
			zf.write(jar, arcname=name)
			print(f"added: {name}")
	print(f"OK -> {ZIP_PATH}")


if __name__ == "__main__":
	main()
