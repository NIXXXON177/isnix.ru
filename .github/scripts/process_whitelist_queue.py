#!/usr/bin/env python3
"""
Обрабатывает очередь whitelist_deploy_queue в Supabase (service_role).
Добавляет ники на сервер и коммитит whitelist.json в репозиторий.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

from add_whitelist_player import add_player, load_list
from whitelist_sftp import download_whitelist, upload_whitelist

REPO_ROOT = Path(__file__).resolve().parents[2]
WHITELIST_FILE = REPO_ROOT / "whitelist.json"


def supabase_request(method: str, path: str, body: dict | None = None) -> object:
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    if not base or not key:
        raise RuntimeError("Задай SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY")

    url = f"{base}/rest/v1/{path.lstrip('/')}"
    data = None
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
    }
    if body is not None:
        data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            raw = resp.read().decode("utf-8")
            if not raw:
                return None
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"Supabase {method} {path}: HTTP {e.code} {detail}") from e


def fetch_pending() -> list:
    query = urllib.parse.urlencode(
        {
            "status": "eq.pending",
            "order": "created_at.asc",
            "select": "id,minecraft_nick,application_id",
        }
    )
    rows = supabase_request("GET", f"whitelist_deploy_queue?{query}")
    return rows if isinstance(rows, list) else []


def patch_row(row_id: str, status: str, error_message: str | None = None) -> None:
    body: dict = {"status": status}
    if error_message is not None:
        body["error_message"] = error_message[:2000]
    q = urllib.parse.urlencode({"id": f"eq.{row_id}"})
    headers_extra = {"Prefer": "return=minimal"}
    base = os.environ.get("SUPABASE_URL", "").rstrip("/")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
    url = f"{base}/rest/v1/whitelist_deploy_queue?{q}"
    data = json.dumps(body).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=minimal",
        },
        method="PATCH",
    )
    with urllib.request.urlopen(req, timeout=30):
        pass


def process_nick(nick: str) -> None:
    download_whitelist(str(WHITELIST_FILE))
    entries = load_list(WHITELIST_FILE)
    added, source = add_player(entries, nick)
    if added:
        WHITELIST_FILE.write_text(
            json.dumps(entries, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        upload_whitelist(str(WHITELIST_FILE))
        print(f"OK: добавлен {nick} (UUID: {source})")
    else:
        print(f"OK: уже в whitelist {nick}")


def main() -> None:
    pending = fetch_pending()
    if not pending:
        print("Очередь пуста")
        return

    failed = 0
    for row in pending:
        row_id = row.get("id")
        nick = (row.get("minecraft_nick") or "").strip()
        if not row_id or not nick:
            continue
        patch_row(row_id, "processing")
        try:
            process_nick(nick)
            patch_row(row_id, "done", None)
        except Exception as e:
            failed += 1
            patch_row(row_id, "failed", str(e))
            print(f"FAIL {nick}: {e}", file=sys.stderr)

    if failed:
        sys.exit(2)


if __name__ == "__main__":
    main()
