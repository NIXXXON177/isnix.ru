#!/usr/bin/env python3
"""Залить папку датапака на сервер (рекурсивно)."""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
	import paramiko
except ImportError:
	print("pip install paramiko", file=sys.stderr)
	sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / "server-sftp.env"


def load_env() -> None:
	if not ENV_FILE.is_file():
		return
	for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
		line = line.strip()
		if not line or line.startswith("#") or "=" not in line:
			continue
		key, _, value = line.partition("=")
		key = key.strip()
		value = value.strip().strip('"').strip("'")
		if key and key not in os.environ:
			os.environ[key] = value


def mkdirp(sftp: paramiko.SFTPClient, path: str) -> None:
	path = path.replace("\\", "/")
	parts = path.split("/")
	acc = ""
	for part in parts:
		if not part:
			continue
		acc = f"{acc}/{part}" if acc else part
		try:
			sftp.mkdir(acc)
		except OSError:
			pass


def main() -> None:
	parser = argparse.ArgumentParser()
	parser.add_argument("local_dir", help="Локальная папка датапака")
	parser.add_argument("remote_dir", help="Путь на сервере, напр. world/datapacks/my-pack")
	args = parser.parse_args()

	load_env()
	host = os.environ.get("SFTP_HOST", "").strip()
	user = os.environ.get("SFTP_USER", "").strip()
	password = os.environ.get("SFTP_PASSWORD", "")
	port = int(os.environ.get("SFTP_PORT", "2022"))
	if not host or not user:
		print("Задайте SFTP в server-sftp.env", file=sys.stderr)
		sys.exit(1)

	local = Path(args.local_dir)
	if not local.is_dir():
		print(f"Нет папки: {local}", file=sys.stderr)
		sys.exit(1)

	remote_base = args.remote_dir.replace("\\", "/").rstrip("/")

	transport = paramiko.Transport((host, port))
	transport.connect(username=user, password=password)
	sftp = paramiko.SFTPClient.from_transport(transport)
	assert sftp is not None

	for file in local.rglob("*"):
		if not file.is_file():
			continue
		rel = file.relative_to(local).as_posix()
		remote = f"{remote_base}/{rel}"
		mkdirp(sftp, os.path.dirname(remote))
		sftp.put(str(file), remote)
		print(f"OK {remote}")

	sftp.close()
	transport.close()


if __name__ == "__main__":
	main()
