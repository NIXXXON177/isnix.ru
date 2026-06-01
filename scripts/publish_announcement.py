#!/usr/bin/env python3
"""
Публикация одного поста в Discord (webhook), Telegram (бот) и ВК (wall.post).

Текст: posts/<имя>.txt + подвал docs/social-post-footer.txt (если ещё не в конце).

Секреты (GitHub Actions или social-publish.env локально):
  DISCORD_WEBHOOK_URL
  TELEGRAM_BOT_TOKEN
  TELEGRAM_CHAT_ID     (@channel или -100…)
  VK_ACCESS_TOKEN      (ключ сообщества, запись на стене)
  VK_GROUP_ID          (числовой id группы без минуса, или screen name: isthisnixxxon)

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
DISCORD_EMBED_DESC_LIMIT = 4096
DISCORD_EMBED_TITLE_LIMIT = 256
DISCORD_EMBED_FOOTER_LIMIT = 2048
DISCORD_COLOR = 0x2ECC71  # зелёный ISNIX
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


def escape_telegram_html(text: str) -> str:
    return text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def _tg_inline_markdown(line: str) -> str:
    """**жирный**, *курсив*, `код`, __подчёркивание__, ~~зачёркнутый~~, ссылки."""
    placeholders: list[str] = []

    def stash(html: str) -> str:
        placeholders.append(html)
        return f"\x00{len(placeholders) - 1}\x00"

    line = re.sub(
        r"`([^`\n]+)`",
        lambda m: stash(f"<code>{escape_telegram_html(m.group(1))}</code>"),
        line,
    )
    line = re.sub(
        r"\*\*(.+?)\*\*",
        lambda m: stash(f"<b>{escape_telegram_html(m.group(1))}</b>"),
        line,
    )
    line = re.sub(
        r"(?<!\*)\*([^*\n]+?)\*(?!\*)",
        lambda m: stash(f"<i>{escape_telegram_html(m.group(1))}</i>"),
        line,
    )
    line = re.sub(
        r"__(.+?)__",
        lambda m: stash(f"<u>{escape_telegram_html(m.group(1))}</u>"),
        line,
    )
    line = re.sub(
        r"~~(.+?)~~",
        lambda m: stash(f"<s>{escape_telegram_html(m.group(1))}</s>"),
        line,
    )

    parts: list[str] = []
    for chunk in re.split(r"(\x00\d+\x00)", line):
        if re.fullmatch(r"\x00\d+\x00", chunk):
            parts.append(placeholders[int(chunk[1:-1])])
        else:
            parts.append(_tg_linkify_plain(escape_telegram_html(chunk)))
    return "".join(parts)


def _tg_linkify_plain(escaped: str) -> str:
    """Ссылка на уже экранированном фрагменте (без вложенных тегов)."""

    def trim_trailing(url: str) -> str:
        return url.rstrip(".,;:!?)")

    def link_http(m: re.Match[str]) -> str:
        raw = trim_trailing(m.group(0))
        return f'<a href="{raw}">{raw}</a>'

    def link_bare(m: re.Match[str]) -> str:
        raw = trim_trailing(m.group(0))
        return f'<a href="https://{raw}">{raw}</a>'

    text = re.sub(r"https?://[^\s<]+", link_http, escaped)
    if "<a href=" not in text:
        text = re.sub(
            r"(?<![/\w@:])(?:[a-zA-Z0-9][-a-zA-Z0-9]*\.)+[a-zA-Z]{2,}(?:/[^\s<]*)?",
            link_bare,
            text,
        )
    else:
        # Ссылки без https в подвале (isnix.ru/account, t.me/…)
        parts: list[str] = []
        for chunk in re.split(r"(<a href=\"[^\"]+\">[^<]*</a>)", text):
            if chunk.startswith("<a href="):
                parts.append(chunk)
            else:
                parts.append(
                    re.sub(
                        r"(?<![/\w@:])(?:[a-zA-Z0-9][-a-zA-Z0-9]*\.)+[a-zA-Z]{2,}(?:/[^\s<]*)?",
                        link_bare,
                        chunk,
                    )
                )
        text = "".join(parts)
    return text


def markdown_to_telegram_html(text: str) -> str:
    lines_out: list[str] = []
    for line in text.splitlines():
        if line.startswith("### "):
            lines_out.append(f"<b>{escape_telegram_html(line[4:].strip())}</b>")
        elif line.startswith("## "):
            lines_out.append(f"<b>{escape_telegram_html(line[3:].strip())}</b>")
        else:
            lines_out.append(_tg_inline_markdown(line))
    return "\n".join(lines_out).strip()


def plain_for_vk_telegram(text: str) -> str:
    """Убирает разметку, оставляет эмодзи и текст (для ВК)."""
    out: list[str] = []
    for line in text.splitlines():
        if line.startswith("### "):
            line = line[4:].strip()
        elif line.startswith("## "):
            line = line[3:].strip()
        line = re.sub(r"\*\*(.+?)\*\*", r"\1", line)
        line = re.sub(r"(?<!\*)\*([^*\n]+?)\*(?!\*)", r"\1", line)
        line = re.sub(r"__(.+?)__", r"\1", line)
        line = re.sub(r"~~(.+?)~~", r"\1", line)
        line = re.sub(r"`([^`]+)`", r"\1", line)
        out.append(line)
    return "\n".join(out).strip()


def normalize_vk_group_id(raw: str) -> str:
    """Число, screen name или ссылка vk.ru/vk.com/isthisnixxxon."""
    value = raw.strip()
    match = re.search(
        r"(?:https?://)?(?:www\.)?(?:vk\.com|vk\.ru)/(?:club|public|event)?/?([\w.-]+)",
        value,
        re.IGNORECASE,
    )
    if match:
        return match.group(1)
    return value


def split_body_and_footer(text: str, footer: str) -> tuple[str, str]:
    body = text.strip()
    foot = footer.strip()
    if foot and body.endswith(foot):
        body = body[: -len(foot)].strip()
    elif foot and foot in body:
        body = body.replace(foot, "", 1).strip()
    return body, foot


def build_discord_embeds(body: str, footer: str) -> list[dict]:
    """Один или несколько embed (Discord markdown в description)."""
    lines = body.splitlines()
    if not lines:
        lines = ["ISTHISNIXXXON"]
    title = lines[0].strip()[:DISCORD_EMBED_TITLE_LIMIT]
    description = "\n".join(lines[1:]).strip() if len(lines) > 1 else ""
    if not description:
        description = title
        title = "ISTHISNIXXXON"

    footer_one_line = re.sub(r"\s+", " ", footer.replace("—", "-")).strip()
    footer_text = footer_one_line[:DISCORD_EMBED_FOOTER_LIMIT] if footer_one_line else None

    embeds: list[dict] = []
    remaining = description
    first = True
    while remaining:
        chunk = remaining[:DISCORD_EMBED_DESC_LIMIT]
        remaining = remaining[len(chunk) :].lstrip()
        embed: dict = {
            "color": DISCORD_COLOR,
            "description": chunk,
        }
        if first:
            embed["title"] = title
            first = False
        if footer_text and not remaining:
            embed["footer"] = {"text": footer_text}
        embeds.append(embed)
        if len(embeds) >= 10:
            break
    return embeds


def validate_discord_webhook(url: str) -> None:
    if not url:
        raise ValueError("DISCORD_WEBHOOK_URL пустой")
    if not re.search(r"discord(?:app)?\.com/api/webhooks/\d+/[\w-]+", url, re.I):
        raise ValueError(
            "DISCORD_WEBHOOK_URL должен быть URL webhook из канала "
            "(Интеграции → Webhooks), а не токен бота"
        )


def http_json(url: str, data: dict, headers: dict | None = None) -> dict | None:
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json; charset=utf-8", **(headers or {})},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            raw = resp.read().decode("utf-8")
            if not raw.strip():
                return None
            return json.loads(raw)
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", errors="replace")
        hint = ""
        if e.code == 403:
            if "1010" in detail:
                hint = (
                    " (403/1010: Discord/Cloudflare часто блокирует запросы с GitHub Actions — "
                    "опубликуйте вручную или перезапустите workflow с «skip Discord»; "
                    "также проверьте DISCORD_WEBHOOK_URL в Secrets)"
                )
            else:
                hint = (
                    " (403: неверный или удалённый webhook — создайте новый в Discord: "
                    "канал → Интеграции → Webhooks → Скопировать URL)"
                )
        elif e.code == 404:
            hint = " (404: webhook не существует — создайте новый URL)"
        raise RuntimeError(f"HTTP {e.code}{hint}: {detail[:500]}") from e


def http_form(url: str, fields: dict) -> dict:
    body = urllib.parse.urlencode(fields).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    with urllib.request.urlopen(req, timeout=60) as resp:
        return json.loads(resp.read().decode("utf-8"))


def publish_discord(text: str, webhook: str, footer: str, dry_run: bool) -> None:
    validate_discord_webhook(webhook)
    body, foot = split_body_and_footer(text, footer)
    embeds = build_discord_embeds(body, foot or footer)
    print(f"[discord] embed × {len(embeds)}, {len(text)} символов")
    payload = {
        "username": "ISTHISNIXXXON",
        "avatar_url": "https://isnix.ru/favicon.ico",
        "embeds": embeds,
    }
    if dry_run:
        _safe_print(f"--- discord embed ---\n{json.dumps(payload, ensure_ascii=False, indent=2)}\n")
        return
    http_json(
        webhook,
        payload,
        headers={"User-Agent": "ISNIX-Publish/1.0 (+https://isnix.ru)"},
    )
    print("[discord] OK")


def publish_telegram(text: str, token: str, chat_id: str, dry_run: bool) -> None:
    html = markdown_to_telegram_html(text)
    print(f"[telegram] HTML, {len(html)} символов → {chat_id}")
    if dry_run:
        _safe_print(f"--- telegram (parse_mode=HTML) ---\n{html}\n")
        return
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    fields = {
        "chat_id": chat_id,
        "text": html,
        "parse_mode": "HTML",
        "disable_web_page_preview": "false",
    }
    data = http_form(url, fields)
    if not data.get("ok"):
        err = data.get("description", data)
        if "parse" in str(err).lower() or data.get("error_code") == 400:
            print("[telegram] HTML не принят, повтор без разметки…", file=sys.stderr)
            fields["text"] = plain_for_vk_telegram(text)
            fields.pop("parse_mode")
            data = http_form(url, fields)
        if not data.get("ok"):
            raise RuntimeError(f"Telegram API: {data}")
    print("[telegram] OK")


def _vk_groups_from_response(data: dict) -> list[dict]:
    """VK 5.199: response — массив или объект { groups: [...] }."""
    resp = data.get("response")
    if isinstance(resp, list):
        return [g for g in resp if isinstance(g, dict)]
    if isinstance(resp, dict):
        groups = resp.get("groups")
        if isinstance(groups, list) and groups:
            return [g for g in groups if isinstance(g, dict)]
        if "id" in resp:
            return [resp]
    return []


def resolve_vk_group_id(group_id: str, token: str, dry_run: bool) -> int:
    raw = normalize_vk_group_id(group_id)
    if not raw:
        raise ValueError("VK_GROUP_ID пустой")
    if re.fullmatch(r"-?\d+", raw):
        return abs(int(raw))
    if dry_run:
        print(f"[vk] screen name «{raw}» → id будет запрошен при реальной публикации")
        return 0
    fields = {
        "group_id": raw,
        "access_token": token,
        "v": VK_API,
    }
    data = http_form("https://api.vk.com/method/groups.getById", fields)
    if "error" in data:
        raise RuntimeError(f"VK groups.getById: {data['error']}")
    items = _vk_groups_from_response(data)
    if not items:
        raise RuntimeError(f"VK: группа не найдена по «{raw}» (ответ: {data})")
    return int(items[0]["id"])


def publish_vk(text: str, token: str, group_id: str, dry_run: bool) -> None:
    plain = plain_for_vk_telegram(text)
    gid = resolve_vk_group_id(group_id, token, dry_run)
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

    footer = read_footer()
    message = assemble_message(read_post(post_path), footer)
    errors: list[str] = []
    successes: list[str] = []

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
                publish_discord(message, webhook or "", footer, args.dry_run)
                successes.append("discord")
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
                successes.append("telegram")
            except (urllib.error.URLError, RuntimeError, json.JSONDecodeError) as e:
                errors.append(f"telegram: {e}")

    if not args.skip_vk:
        if (not vk_token or not vk_group) and not args.dry_run:
            errors.append("VK_ACCESS_TOKEN или VK_GROUP_ID не заданы")
        else:
            try:
                publish_vk(message, vk_token or "dry", vk_group or "0", args.dry_run)
                successes.append("vk")
            except (
                urllib.error.URLError,
                RuntimeError,
                json.JSONDecodeError,
                ValueError,
                KeyError,
            ) as e:
                errors.append(f"vk: {e}")

    if successes:
        print("Опубликовано: " + ", ".join(successes))
    if errors:
        print("Ошибки:", file=sys.stderr)
        for err in errors:
            print(f"  - {err}", file=sys.stderr)
    if not successes:
        sys.exit(1)
    if errors:
        print(
            "Завершено с предупреждениями: не все площадки (CI не падает, если хотя бы одна успешна).",
            file=sys.stderr,
        )
        sys.exit(0)

    print("Готово: все выбранные площадки опубликованы." if not args.dry_run else "Dry-run завершён.")


if __name__ == "__main__":
    main()
