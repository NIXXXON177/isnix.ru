#!/usr/bin/env python3
"""Общие функции SFTP для whitelist.json (Play2GO)."""
from __future__ import annotations

import os
import sys
from typing import Tuple

try:
    import paramiko
except ImportError:
    print("Нужен paramiko: pip install paramiko", file=sys.stderr)
    sys.exit(1)


def connect_sftp() -> Tuple[paramiko.SFTPClient, paramiko.Transport]:
    host = os.environ.get("SFTP_HOST", "").strip()
    user = os.environ.get("SFTP_USER", "").strip()
    password = os.environ.get("SFTP_PASSWORD", "")
    port_s = (os.environ.get("SFTP_PORT") or "2022").strip()
    remote = (os.environ.get("REMOTE_PATH") or "whitelist.json").strip()

    if not host or not user:
        raise RuntimeError("Задай SFTP_HOST и SFTP_USER")
    if password == "":
        raise RuntimeError("Задай SFTP_PASSWORD")

    port = int(port_s)
    transport = paramiko.Transport((host, port))
    try:
        transport.connect(username=user, password=password)
    except paramiko.AuthenticationException as e:
        raise RuntimeError("SFTP: неверный логин или пароль") from e

    sftp = paramiko.SFTPClient.from_transport(transport)
    if sftp is None:
        transport.close()
        raise RuntimeError("SFTP: не удалось открыть сессию")
    return sftp, transport


def download_whitelist(local_path: str = "whitelist.json") -> str:
    remote = (os.environ.get("REMOTE_PATH") or "whitelist.json").strip()
    sftp, transport = connect_sftp()
    try:
        sftp.get(remote, local_path)
    finally:
        sftp.close()
        transport.close()
    return local_path


def upload_whitelist(local_path: str = "whitelist.json") -> None:
    remote = (os.environ.get("REMOTE_PATH") or "whitelist.json").strip()
    sftp, transport = connect_sftp()
    try:
        sftp.put(local_path, remote)
    finally:
        sftp.close()
        transport.close()
