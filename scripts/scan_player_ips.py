#!/usr/bin/env python3
"""Scan Play2GO logs for player join IPs (local server-remote or SFTP)."""
from __future__ import annotations

import gzip
import io
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / "server-sftp.env"
NAMES = ("ChicagoX", "Chicagox", "afktapochek")
TARGETS = re.compile(r"(ChicagoX|Chicagox|afktapochek)", re.I)
INTERESTING = re.compile(
    r"logged in|lost connection|joined the game|Disconnecting", re.I
)
IP_IN_LINE = re.compile(r"\[/?(\d+\.\d+\.\d+\.\d+):\d+\]")


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


def iter_lines_from_bytes(data: bytes, gz: bool):
    if gz:
        text = gzip.decompress(data).decode("utf-8", errors="replace")
    else:
        text = data.decode("utf-8", errors="replace")
    yield from text.splitlines()


names_for_scan: list[str] = list(NAMES)


def scan_lines(lines, source: str, hits: list, ips: dict):
    for line in lines:
        if not TARGETS.search(line) or not INTERESTING.search(line):
            continue
        hits.append((source, line.strip()[:240]))
        m = IP_IN_LINE.search(line)
        nick = None
        for candidate in names_for_scan:
            if candidate.lower() in line.lower():
                nick = candidate.lower()
                break
        if m and nick:
            ips.setdefault(nick, set()).add(m.group(1))


def scan_local(log_dir: Path) -> tuple[list, dict]:
    hits: list = []
    ips: dict = {}
    if not log_dir.is_dir():
        return hits, ips
    for fp in sorted(log_dir.glob("*")):
        if fp.name != "latest.log" and not fp.name.endswith(".log.gz"):
            continue
        if fp.suffix == ".gz":
            with gzip.open(fp, "rt", encoding="utf-8", errors="replace") as f:
                scan_lines(f, fp.name, hits, ips)
        else:
            with fp.open("r", encoding="utf-8", errors="replace") as f:
                scan_lines(f, fp.name, hits, ips)
    return hits, ips


def scan_sftp() -> tuple[list, dict]:
    import paramiko

    load_env()
    host = os.environ.get("SFTP_HOST", "c11.play2go.cloud").strip()
    user = os.environ.get("SFTP_USER", "").strip()
    password = os.environ.get("SFTP_PASSWORD", "")
    port = int(os.environ.get("SFTP_PORT", "2022"))
    if not user or not password:
        print("No SFTP credentials", file=sys.stderr)
        return [], {}

    transport = paramiko.Transport((host, port))
    transport.connect(username=user, password=password)
    sftp = paramiko.SFTPClient.from_transport(transport)

    hits: list = []
    ips: dict = {}
    try:
        files = sftp.listdir("logs")
        pick = sorted(
            f
            for f in files
            if f == "latest.log"
            or (f.endswith(".log.gz") and (f.startswith("2026-06") or f.startswith("2026-05-3")))
        )
        for remote in pick:
            buf = io.BytesIO()
            try:
                sftp.getfo(f"logs/{remote}", buf)
            except OSError:
                continue
            buf.seek(0)
            raw = buf.read()
            scan_lines(
                iter_lines_from_bytes(raw, remote.endswith(".gz")),
                remote,
                hits,
                ips,
            )
    finally:
        sftp.close()
        transport.close()
    return hits, ips


def main() -> None:
    global TARGETS, names_for_scan
    names_for_scan = list(sys.argv[1:] if len(sys.argv) > 1 else NAMES)
    TARGETS = re.compile("|".join(re.escape(n) for n in names_for_scan), re.I)

    local_dir = ROOT / "server-remote" / "logs"
    hits, ips = scan_local(local_dir)
    if len(hits) < 3:
        sftp_hits, sftp_ips = scan_sftp()
        hits.extend(sftp_hits)
        for k, v in sftp_ips.items():
            ips.setdefault(k, set()).update(v)

    print(f"# hits: {len(hits)}")
    for source, line in hits[-80:]:
        print(f"{source}: {line}")

    print("\n# unique IPs per nick (from join/disconnect lines)")
    for nick in sorted(ips.keys()):
        print(f"{nick}: {', '.join(sorted(ips[nick])) or '—'}")


if __name__ == "__main__":
    main()
