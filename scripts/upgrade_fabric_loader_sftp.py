#!/usr/bin/env python3
"""
Обновляет Fabric Loader на Play2GO: новый fabric-server-launch.jar (MANIFEST → 0.18.4+)
и недостающие libraries/*.jar.

Перед запуском: сервер STOP.

  python scripts/upgrade_fabric_loader_sftp.py
  python scripts/upgrade_fabric_loader_sftp.py --loader 0.19.2
"""
from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
INSTALL_DIR = ROOT / "build" / "fabric-server-install"
INSTALLER = ROOT / "build" / "fabric-installer.jar"
SFTP = ROOT / "scripts" / "play2go_sftp.py"


def run_installer(mc: str, loader: str) -> None:
    INSTALL_DIR.mkdir(parents=True, exist_ok=True)
    if not INSTALLER.is_file():
        import urllib.request

        url = "https://maven.fabricmc.net/net/fabricmc/fabric-installer/1.0.3/fabric-installer-1.0.3.jar"
        print(f"Скачиваю {url}")
        urllib.request.urlretrieve(url, INSTALLER)
    cmd = [
        "java",
        "-jar",
        str(INSTALLER),
        "server",
        "-dir",
        str(INSTALL_DIR),
        "-mcversion",
        mc,
        "-loader",
        loader,
        "-downloadMinecraft",
    ]
    print(" ".join(cmd))
    r = subprocess.run(cmd, cwd=ROOT)
    if r.returncode != 0:
        sys.exit(r.returncode)


def sftp_push(local: Path, remote: str) -> None:
    r = subprocess.run(
        [sys.executable, str(SFTP), "push", str(local), remote],
        cwd=ROOT,
    )
    if r.returncode != 0:
        raise SystemExit(r.returncode)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mc", default="1.21.11")
    parser.add_argument("--loader", default="0.18.4", help="Минимум 0.18.4 для модпака")
    parser.add_argument("--skip-install", action="store_true", help="Не запускать fabric-installer")
    args = parser.parse_args()

    if not args.skip_install:
        run_installer(args.mc, args.loader)

    launch = INSTALL_DIR / "fabric-server-launch.jar"
    if not launch.is_file():
        print(f"Нет {launch}, installer не создал файлы", file=sys.stderr)
        sys.exit(1)

    print("=== Заливка fabric-server-launch.jar ===")
    sftp_push(launch, "fabric-server-launch.jar")

    libs = INSTALL_DIR / "libraries"
    jars = sorted(libs.rglob("*.jar")) if libs.is_dir() else []
    print(f"=== Заливка {len(jars)} библиотек loader ===")
    for jar in jars:
        rel = jar.relative_to(INSTALL_DIR).as_posix()
        print(f"  {rel}")
        sftp_push(jar, rel)

    print(
        "\nOK. В панели Play2GO: SERVER_JARFILE=fabric-server-launch.jar, MC 1.21.11, затем Start."
        f"\nВ логе должно быть: Fabric Loader {args.loader}"
    )


if __name__ == "__main__":
    main()
