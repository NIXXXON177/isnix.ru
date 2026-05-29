#!/usr/bin/env python3
"""
Добавляет игрока в whitelist.json и заливает на сервер по SFTP.

UUID:
  - offline — как при online-mode=false (пиратский/бесплатный клиент), по нику;
  - mojang — только лицензия;
  - auto (по умолчанию) — сначала Mojang, при 404 → offline.

Переменные: SFTP_*; WHITELIST_UUID_MODE=auto|offline|mojang
"""
from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import uuid
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from whitelist_sftp import download_whitelist, upload_whitelist

NICK_RE = re.compile(r"^[a-zA-Z0-9_]{3,16}$")


def format_uuid(raw: str) -> str:
    u = raw.replace("-", "").lower()
    if len(u) != 32:
        raise ValueError(f"bad uuid: {raw!r}")
    return f"{u[0:8]}-{u[8:12]}-{u[12:16]}-{u[16:20]}-{u[20:32]}"


def offline_uuid(username: str) -> str:
    """UUID как у Minecraft для online-mode=false (OfflinePlayer + ник)."""
    data = ("OfflinePlayer" + username).encode("utf-8")
    md5 = hashlib.md5(data).digest()
    b = bytearray(md5)
    b[6] = (b[6] & 0x0F) | 0x30
    b[8] = (b[8] & 0x3F) | 0x80
    return str(uuid.UUID(bytes=bytes(b)))


def mojang_uuid(username: str) -> str | None:
    """Возвращает UUID или None, если ник не куплен в Mojang (404)."""
    quoted = urllib.parse.quote(username)
    url = f"https://api.mojang.com/users/profiles/minecraft/{quoted}"
    req = urllib.request.Request(
        url,
        headers={"User-Agent": "isnix-whitelist-deploy/1.0 (github-actions)"},
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise RuntimeError(f"Mojang API HTTP {e.code}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Mojang API недоступен: {e}") from e

    uid = data.get("id")
    if not uid:
        raise RuntimeError("Mojang API не вернул UUID")
    return format_uuid(str(uid))


def resolve_player_uuid(username: str) -> tuple[str, str]:
    """Возвращает (uuid, source) где source: offline | mojang."""
    mode = (os.environ.get("WHITELIST_UUID_MODE") or "auto").strip().lower()
    if mode not in ("auto", "offline", "mojang"):
        mode = "auto"

    if mode == "offline":
        return offline_uuid(username), "offline"

    if mode == "mojang":
        uid = mojang_uuid(username)
        if uid is None:
            raise RuntimeError(
                f"Ник «{username}» не найден в Mojang (режим mojang). "
                "Для пиратских ников задай WHITELIST_UUID_MODE=auto или offline."
            )
        return uid, "mojang"

    # auto
    uid = mojang_uuid(username)
    if uid is not None:
        return uid, "mojang"
    return offline_uuid(username), "offline"


def load_list(path: Path) -> list:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise RuntimeError("whitelist.json должен быть массивом")
    return raw


def has_nick(entries: list, nick: str) -> bool:
    key = nick.strip().lower()
    for item in entries:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name", "")).strip().lower()
        if name == key:
            return True
    return False


def add_player(entries: list, nick: str) -> tuple[bool, str]:
    """Возвращает (добавлен, источник_uuid)."""
    if has_nick(entries, nick):
        return False, ""
    player_uuid, source = resolve_player_uuid(nick)
    entries.append({"uuid": player_uuid, "name": nick})
    return True, source


def main() -> None:
    if len(sys.argv) < 2:
        print("Использование: add_whitelist_player.py <Nick>", file=sys.stderr)
        sys.exit(1)

    nick = sys.argv[1].strip()
    if not NICK_RE.match(nick):
        print(f"Некорректный ник: {nick!r}", file=sys.stderr)
        sys.exit(1)

    local = Path("whitelist.json")
    download_whitelist(str(local))
    entries = load_list(local)

    added, source = add_player(entries, nick)
    if added:
        local.write_text(
            json.dumps(entries, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        upload_whitelist(str(local))
        print(f"Добавлен в whitelist: {nick} (UUID: {source})")
    else:
        print(f"Уже в whitelist: {nick}")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as e:
        print(str(e), file=sys.stderr)
        sys.exit(2)
