#!/usr/bin/env python3
"""
Заливка AutoModpack на сервер Play2GO (SFTP).

AutoModpack раздаёт игрокам ровно набор из automodpack/host-modpack/mods/ —
это наш клиентский набор (64 мода, без серверных LuckPerms/TAB/EasyAuth и без
самого AutoModpack). Клиенты при заходе сами докачивают обновления.

Чтобы перезапуск произошёл строго по команде, серверный jar заливается
ВЫКЛЮЧЕННЫМ (mods/...jar.disabled). Активация — переименованием в .jar
(scripts/deploy_automodpack.py --activate) и рестартом сервера.

  python scripts/deploy_automodpack.py            # залить host-modpack + выключенный jar
  python scripts/deploy_automodpack.py --activate # снять .disabled (включить мод)
  python scripts/deploy_automodpack.py --deactivate

Пароль — только в server-sftp.env (в .gitignore).
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

try:
    import paramiko
except ImportError:
    print("Установите paramiko: python -m pip install paramiko", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
ENV_FILE = ROOT / "server-sftp.env"
CLIENT_STAGING = ROOT / "build" / "client-modpack-staging"
AUTOMODPACK_JAR = ROOT / "build" / "automodpack" / "automodpack-mc1.21.11-fabric-4.0.5.jar"
REMOTE_HOST_MODS = "automodpack/host-modpack/main/mods"
REMOTE_MODS = "mods"


def load_env(path: Path) -> None:
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def connect():
    load_env(ENV_FILE)
    host = os.environ.get("SFTP_HOST", "c11.play2go.cloud").strip()
    user = os.environ.get("SFTP_USER", "").strip()
    password = os.environ.get("SFTP_PASSWORD", "")
    port = int(os.environ.get("SFTP_PORT", "2022"))
    base = os.environ.get("REMOTE_BASE", ".").strip() or "."
    if not user or not password:
        print("Задайте SFTP_USER/SFTP_PASSWORD в server-sftp.env", file=sys.stderr)
        sys.exit(1)
    transport = paramiko.Transport((host, port))
    transport.connect(username=user, password=password)
    sftp = paramiko.SFTPClient.from_transport(transport)
    assert sftp is not None
    if base in (".", "auto", "detect"):
        for cand in (".", "/", "/home/container"):
            try:
                sftp.listdir(cand)
                base = cand
                break
            except OSError:
                continue
    return transport, sftp, base


def rpath(base: str, rel: str) -> str:
    rel = rel.replace("\\", "/").lstrip("/")
    if base in (".", "/"):
        return rel
    return f"{base.rstrip('/')}/{rel}"


def ensure_dir(sftp, base: str, rel: str) -> None:
    parts = rel.strip("/").split("/")
    cur = ""
    for p in parts:
        cur = f"{cur}/{p}" if cur else p
        full = rpath(base, cur)
        try:
            sftp.stat(full)
        except FileNotFoundError:
            sftp.mkdir(full)


def remote_size(sftp, path: str) -> int | None:
    try:
        return sftp.stat(path).st_size
    except FileNotFoundError:
        return None


def find_remote_automodpack(sftp, base: str) -> list[str]:
    out = []
    for name in sftp.listdir(rpath(base, REMOTE_MODS)):
        low = name.lower()
        if low.startswith("automodpack") and (low.endswith(".jar") or low.endswith(".jar.disabled")):
            out.append(name)
    return out


def cmd_deploy(sftp, base: str) -> None:
    jars = sorted(p for p in CLIENT_STAGING.glob("*.jar") if "automodpack" not in p.name.lower())
    if not jars:
        print(f"Нет модов в {CLIENT_STAGING}", file=sys.stderr)
        sys.exit(2)
    ensure_dir(sftp, base, REMOTE_HOST_MODS)
    print(f"=== host-modpack: {len(jars)} модов -> {REMOTE_HOST_MODS}/ ===")
    up = skip = 0
    for j in jars:
        dst = rpath(base, f"{REMOTE_HOST_MODS}/{j.name}")
        if remote_size(sftp, dst) == j.stat().st_size:
            skip += 1
            continue
        sftp.put(str(j), dst)
        up += 1
        print(f"  + {j.name}")
    print(f"host-modpack: залито {up}, пропущено (уже есть) {skip}")

    if not AUTOMODPACK_JAR.is_file():
        print(f"Нет {AUTOMODPACK_JAR}", file=sys.stderr)
        sys.exit(3)
    dst = rpath(base, f"{REMOTE_MODS}/{AUTOMODPACK_JAR.name}.disabled")
    sftp.put(str(AUTOMODPACK_JAR), dst)
    print(f"=== сервер: {AUTOMODPACK_JAR.name}.disabled (ВЫКЛЮЧЕН до рестарта) ===")
    print("\nГотово. Активация: python scripts/deploy_automodpack.py --activate, затем рестарт сервера.")


def cmd_toggle(sftp, base: str, activate: bool) -> None:
    found = find_remote_automodpack(sftp, base)
    if not found:
        print("AutoModpack jar не найден в mods/ — сначала деплой.", file=sys.stderr)
        sys.exit(4)
    for name in found:
        src = rpath(base, f"{REMOTE_MODS}/{name}")
        if activate and name.endswith(".disabled"):
            dst = rpath(base, f"{REMOTE_MODS}/{name[:-len('.disabled')]}")
            sftp.rename(src, dst)
            print(f"ВКЛЮЧЁН: {name} -> {name[:-len('.disabled')]}")
        elif not activate and name.endswith(".jar"):
            dst = rpath(base, f"{REMOTE_MODS}/{name}.disabled")
            sftp.rename(src, dst)
            print(f"ВЫКЛЮЧЕН: {name} -> {name}.disabled")
        else:
            print(f"без изменений: {name}")
    print("\nПрименится после рестарта сервера.")


def main() -> None:
    ap = argparse.ArgumentParser(description="Деплой AutoModpack на Play2GO")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--activate", action="store_true", help="Снять .disabled (включить мод)")
    g.add_argument("--deactivate", action="store_true", help="Вернуть .disabled (выключить мод)")
    args = ap.parse_args()
    transport, sftp, base = connect()
    try:
        if args.activate:
            cmd_toggle(sftp, base, activate=True)
        elif args.deactivate:
            cmd_toggle(sftp, base, activate=False)
        else:
            cmd_deploy(sftp, base)
    finally:
        sftp.close()
        transport.close()


if __name__ == "__main__":
    main()
