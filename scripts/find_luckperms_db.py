#!/usr/bin/env python3
import os
import sys
from pathlib import Path

try:
    import paramiko
except ImportError:
    sys.exit("pip install paramiko")

ROOT = Path(__file__).resolve().parents[1]
ENV = ROOT / "server-sftp.env"


def load_env() -> None:
    if not ENV.is_file():
        return
    for line in ENV.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def main() -> None:
    load_env()
    host = os.environ.get("SFTP_HOST", "c11.play2go.cloud")
    port = int(os.environ.get("SFTP_PORT", "2022"))
    transport = paramiko.Transport((host, port))
    transport.connect(username=os.environ["SFTP_USER"], password=os.environ["SFTP_PASSWORD"])
    sftp = paramiko.SFTPClient.from_transport(transport)
    assert sftp is not None
    try:
        paths = [
            "config/luckperms/luckperms-h2-v2.mv.db",
            "config/luckperms/luckperms-h2-v2.trace.db",
            "config/luckperms/luckperms-h2.mv.db",
        ]
        for p in paths:
            try:
                st = sftp.stat(p)
                print(f"OK {p} {st.st_size}")
            except OSError:
                print(f"NO {p}")
        print("--- config/luckperms ---")
        for name in sftp.listdir("config/luckperms"):
            try:
                st = sftp.stat(f"config/luckperms/{name}")
                print(name, st.st_size)
            except OSError:
                print(name, "?")
    finally:
        sftp.close()
        transport.close()


if __name__ == "__main__":
    main()
