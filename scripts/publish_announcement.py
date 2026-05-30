#!/usr/bin/env python3
"""
Публикация одного поста в Discord (webhook), Telegram (бот) и ВК (wall.post).

Текст: posts/<имя>.txt + подвал docs/social-post-footer.txt (если ещё не в конце).

Секреты (GitHub Actions или social-publish.env локально):
  DISCORD_WEBHOOK_URL
  TELEGRAM_BOT_TOKEN
  TELEGRAM_CHAT_ID     (@channel или -100…)
  VK_ACCESS_TOKEN      (ключ сообщества, запись на стене)
  VK_GROUP_ID          (числовой id группы, без минуса)

Примеры:
  python scripts/publish_announcement.py posts/sell-update.txt
  python scripts/publish_announcement.py posts/sell-update.txt --dry-run
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
FOOTER_PATH = ROOT / "docs" / "social-post-footer.txt"
ENV_FILE = ROOT / "social-publish.env"
DISCORD_LIMIT = 2000
VK_API = "5.199"


def load_env_file(path: Path) -> None:
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


def read_post(path: Path) -> str:
    text = path.read_text(encoding="utf-8").strip()
    if not text:
        raise ValueError(f"Пустой файл поста: {path}")
    return text


def read_footer() -> str:
    if not FOOTER_PATH.is_file():
        raise FileNotFoundError(f"Нет подвала: {FOOTER_PATH}")
    return FOOTER_PATH.read_text(encoding="utf-8").strip()


def assemble_message(body: str, footer: str) -> str:
    body = body.strip()
    footer = footer.strip()
    if footer and footer not in body:
        return f"{body}\n\n{footer}"
    return body


def plain_for_vk_telegram(text: str) -> str:
    """Убирает Discord-markdown, оставляет эмодзи и ссылки."""
    out: list[str] = []
    for line in text.splitlines():
        if line.startswith("### "):
            line = line[4:].strip()
        elif line.startswith("## "):
            line = line[3:].strip()
        line = re.sub(r"\*\*(.+?)\*\*", r"\1", line)
        line = re.sub(r"`([^`]+)`", r"\1", line)
        out.append(line)
    return "\n".join(out).strip()


def discord_chunks(text: str, limit: int = DISCORD_LIMIT) -> list[str]:
    if len(text) <= limit:
        return [text]
    chunks: list[str] = []
    remaining = text
    while remaining:
        if len(remaining) <= limit:
            chunks.append(remaining.strip())
            break
        cut = remaining.rfind("\n\n", 0, limit)
        if cut < limit // 3:
            cut = limit
        chunk = remaining[:cut].strip()
        remaining = remaining[cut:].lstrip()
        if chunk:
            chunks.append(chunk)
    return chunks


def http_json(url: str, data: dict, headers: dict | None = None) -> dict:
    body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", **(headers or {})},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def http_form(url: str, fields: dict) -> dict:
    body = urllib.parse.urlencode(fields).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def publish_discord(text: str, webhook: str, dry_run: bool) -> None:
    chunks = discord_chunks(text)
    print(f"[discord] {len(chunks)} сообщений, {len(text)} символов")
    for i, chunk in enumerate(chunks, 1):
        if dry_run:
            _safe_print(f"--- discord chunk {i} ---\n{chunk}\n")
            continue
        http_json(webhook, {"content": chunk})
    print("[discord] OK")


def publish_telegram(text: str, token: str, chat_id: str, dry_run: bool) -> None:
    plain = plain_for_vk_telegram(text)
    print(f"[telegram] {len(plain)} символов → {chat_id}")
    if dry_run:
        _safe_print(f"--- telegram ---\n{plain}\n")
        return
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    fields = {
        "chat_id": chat_id,
        "text": plain,
        "disable_web_page_preview": "false",
    }
    data = http_form(url, fields)
    if not data.get("ok"):
        raise RuntimeError(f"Telegram API: {data}")
    print("[telegram] OK")


def publish_vk(text: str, token: str, group_id: str, dry_run: bool) -> None:
    plain = plain_for_vk_telegram(text)
    gid = int(group_id)
    owner_id = -gid if gid > 0 else gid
    print(f"[vk] owner_id={owner_id}, {len(plain)} символов")
    if dry_run:
        _safe_print(f"--- vk ---\n{plain}\n")
        return
    fields = {
        "access_token": token,
        "v": VK_API,
        "owner_id": str(owner_id),
        "from_group": "1",
        "message": plain,
    }
    data = http_form("https://api.vk.com/method/wall.post", fields)
    if "error" in data:
        raise RuntimeError(f"VK API: {data['error']}")
    post_id = data.get("response", {}).get("post_id")
    print(f"[vk] OK, post_id={post_id}")


def _safe_print(text: str) -> None:
    try:
        print(text)
    except UnicodeEncodeError:
        sys.stdout.buffer.write((text + "\n").encode("utf-8", errors="replace"))


def main() -> None:
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8")
        except Exception:
            pass
    load_env_file(ENV_FILE)
    parser = argparse.ArgumentParser(description="Publish ISNIX announcement to socials")
    parser.add_argument("post", type=Path, help="Путь к posts/*.txt")
    parser.add_argument("--dry-run", action="store_true", help="Не отправлять, только показать")
    parser.add_argument("--skip-discord", action="store_true")
    parser.add_argument("--skip-telegram", action="store_true")
    parser.add_argument("--skip-vk", action="store_true")
    args = parser.parse_args()

    post_path = args.post if args.post.is_absolute() else ROOT / args.post
    if not post_path.is_file():
        print(f"Файл не найден: {post_path}", file=sys.stderr)
        sys.exit(1)

    message = assemble_message(read_post(post_path), read_footer())
    errors: list[str] = []

    webhook = os.environ.get("DISCORD_WEBHOOK_URL", "").strip()
    tg_token = os.environ.get("TELEGRAM_BOT_TOKEN", "").strip()
    tg_chat = os.environ.get("TELEGRAM_CHAT_ID", "").strip()
    vk_token = os.environ.get("VK_ACCESS_TOKEN", "").strip()
    vk_group = os.environ.get("VK_GROUP_ID", "").strip()

    if not args.skip_discord:
        if not webhook and not args.dry_run:
            errors.append("DISCORD_WEBHOOK_URL не задан")
        else:
            try:
                publish_discord(message, webhook or "", args.dry_run)
            except (urllib.error.URLError, RuntimeError, json.JSONDecodeError) as e:
                errors.append(f"discord: {e}")

    if not args.skip_telegram:
        if (not tg_token or not tg_chat) and not args.dry_run:
            errors.append("TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID не заданы")
        else:
            try:
                publish_telegram(
                    message, tg_token or "dry", tg_chat or "@channel", args.dry_run
                )
            except (urllib.error.URLError, RuntimeError, json.JSONDecodeError) as e:
                errors.append(f"telegram: {e}")

    if not args.skip_vk:
        if (not vk_token or not vk_group) and not args.dry_run:
            errors.append("VK_ACCESS_TOKEN или VK_GROUP_ID не заданы")
        else:
            try:
                publish_vk(message, vk_token or "dry", vk_group or "0", args.dry_run)
            except (urllib.error.URLError, RuntimeError, json.JSONDecodeError, ValueError) as e:
                errors.append(f"vk: {e}")

    if errors:
        print("Ошибки:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
        sys.exit(1)

    print("Готово: все выбранные площадки опубликованы." if not args.dry_run else "Dry-run завершён.")


if __name__ == "__main__":
    main()
