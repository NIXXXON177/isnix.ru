#!/usr/bin/env python3
"""Find all login lines for given IPs in Play2GO logs."""
from __future__ import annotations

import gzip
import io
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / "server-sftp.env"
IPS = set(sys.argv[1:]) if len(sys.argv) > 1 else {"5.3.250.251", "95.73.5.246"}
IP_IN_LINE = re.compile(r"\[/?(\d+\.\d+\.\d+\.\d+):\d+\]")
INTERESTING = re.compile(r"logged in|joined the game|Disconnecting", re.I)


def load_env() -> None:
    if not ENV_FILE.is_file():
        return
    for line in ENV_FILE.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def main() -> None:
    import paramiko

    load_env()
    host = os.environ.get("SFTP_HOST", "c11.play2go.cloud").strip()
    user = os.environ["SFTP_USER"].strip()
    password = os.environ["SFTP_PASSWORD"]
    port = int(os.environ.get("SFTP_PORT", "2022"))

    transport = paramiko.Transport((host, port))
    transport.connect(username=user, password=password)
    sftp = paramiko.SFTPClient.from_transport(transport)

    by_ip: dict[str, list[str]] = {ip: [] for ip in IPS}
    try:
        for remote in sorted(sftp.listdir("logs")):
            if remote != "latest.log" and not (
                remote.endswith(".log.gz") and remote.startswith("2026-")
            ):
                continue
            buf = io.BytesIO()
            try:
                sftp.getfo(f"logs/{remote}", buf)
            except OSError:
                continue
            buf.seek(0)
            raw = buf.read()
            if remote.endswith(".gz"):
                text = gzip.decompress(raw).decode("utf-8", errors="replace")
            else:
                text = raw.decode("utf-8", errors="replace")
            for line in text.splitlines():
                if not INTERESTING.search(line):
                    continue
                m = IP_IN_LINE.search(line)
                if m and m.group(1) in IPS:
                    by_ip[m.group(1)].append(f"{remote}: {line.strip()[:220]}")
    finally:
        sftp.close()
        transport.close()

    for ip in sorted(IPS):
        lines = by_ip.get(ip, [])
        nicks = set()
        for ln in lines:
            if "logged in with entity" in ln or "joined the game" in ln:
                # PlayerName[/ip:port]
                part = ln.split("INFO]:", 1)[-1].strip()
                if "[" in part:
                    nicks.add(part.split("[", 1)[0].strip())
            elif "Disconnecting" in ln:
                part = ln.split("Disconnecting", 1)[1].strip()
                if part.startswith(" "):
                    nicks.add(part.split("(", 1)[0].strip())
        print(f"\n=== IP {ip} ({len(lines)} login-related lines) ===")
        print("Nicks seen:", ", ".join(sorted(nicks)) or "—")
        for ln in lines[-8:]:
            print(ln)


if __name__ == "__main__":
    main()
