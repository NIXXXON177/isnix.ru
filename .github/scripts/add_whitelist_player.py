#!/usr/bin/env python3
"""
Добавляет игрока в whitelist.json (Mojang UUID) и заливает на сервер по SFTP.
Переменные: SFTP_* как в sync-whitelist.yml; аргумент — ник.
"""
from __future__ import annotations

import json
import re
import sys
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


def mojang_uuid(username: str) -> str:
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
            raise RuntimeError(
                f"Ник «{username}» не найден в Mojang — проверь написание лицензионного ника"
            ) from e
        raise RuntimeError(f"Mojang API HTTP {e.code}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"Mojang API недоступен: {e}") from e

    uid = data.get("id")
    if not uid:
        raise RuntimeError("Mojang API не вернул UUID")
    return format_uuid(str(uid))


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


def add_player(entries: list, nick: str) -> bool:
    """Возвращает True, если запись добавлена."""
    if has_nick(entries, nick):
        return False
    uuid = mojang_uuid(nick)
    entries.append({"uuid": uuid, "name": nick})
    return True


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

    if add_player(entries, nick):
        local.write_text(
            json.dumps(entries, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        upload_whitelist(str(local))
        print(f"Добавлен в whitelist на сервере: {nick}")
    else:
        print(f"Уже в whitelist: {nick}")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as e:
        print(str(e), file=sys.stderr)
        sys.exit(2)
