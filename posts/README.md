# Посты для соцсетей

Тексты в `posts/*.txt` — **копируй вручную** в ВК, Telegram и Discord. Подвал в конце поста **не** пиши в файле — допиши из `docs/social-post-footer.txt` при публикации.

Автопубликация (`scripts/publish_announcement.py`, GitHub Action) — **не используем**; готовые варианты с разметкой проси в чате у ассистента или собери по образцу ниже.

## Примеры

| Файл | Тема |
|------|------|
| `modded-rebrand-vk.txt` | Анонс: модовый сервер (ВК) |
| `modded-rebrand-telegram.txt` | То же, Telegram |
| `modded-rebrand-discord.txt` | То же, Discord |
| `modded-rebrand-short.txt` | Коротко (статус / сторис) |
| `create-railroad-vk.txt` | ЖД Create — магистраль между городами (ВК) |
| `create-railroad-telegram.txt` | То же, Telegram |
| `create-railroad-discord.txt` | То же, Discord |
| `create-railroad-short.txt` | Коротко (сторис / пин) |
| `referral-discord.txt` | Рефералка |
| `maintenance-upgrade-vk.txt` | Закрытие на обновление 1.21.11 (ВК) |
| `maintenance-upgrade-telegram.txt` | То же, Telegram |
| `maintenance-upgrade-discord.txt` | То же, Discord |
| `maintenance-upgrade-short.txt` | Короткая версия (сторис / пин) |
| `maintenance-reopen-vk.txt` | Открытие после апгрейда (ВК) |
| `maintenance-reopen-discord.txt` | Открытие (Discord) |

## Разметка по площадкам

| Площадка | Жирный | Команды / IP |
|----------|--------|----------------|
| **ВК** | без разметки, ЗАГЛАВНЫЕ или эмодзи | как есть |
| **Telegram** | обычный текст + полные `https://` ссылки (HTML при вставке **не работает**) | `/reg` как есть; жирный — выделить в редакторе → **Ж** |
| **Discord** | `**текст**` | `` `/reg` `` |

Подвал: `docs/social-post-footer.txt` (ВК, Discord). Для **Telegram** — `docs/social-post-footer-telegram.txt` (без HTML, ссылки `https://`).
