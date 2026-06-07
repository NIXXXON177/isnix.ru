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
| `modpack-update-june-2026-vk.txt` | Обновить клиентскую сборку (ВК) |
| `modpack-update-june-2026-telegram.txt` | То же, Telegram |
| `modpack-update-june-2026-discord.txt` | То же, Discord |
| `modpack-restart-2026-06-08-vk.txt` | Перезапуск 08.06.2026 00:00 + новая сборка (ВК) |
| `modpack-restart-2026-06-08-telegram.txt` | То же, Telegram |
| `modpack-restart-2026-06-08-discord.txt` | То же, Discord |
| `modpack-reopen-2026-06-08-vk.txt` | Сервер открыт после перезапуска (ВК) |
| `modpack-reopen-2026-06-08-telegram.txt` | То же, Telegram |
| `modpack-reopen-2026-06-08-discord.txt` | То же, Discord |
| `modpack-hotfix-2026-06-08-vk.txt` | Хотфикс: убрали Create: New Foods, обновить сборку (ВК) |
| `modpack-hotfix-2026-06-08-telegram.txt` | То же, Telegram |
| `modpack-hotfix-2026-06-08-discord.txt` | То же, Discord |

## Разметка по площадкам

| Площадка | Жирный | Команды / IP |
|----------|--------|----------------|
| **ВК** | без разметки, ЗАГЛАВНЫЕ или эмодзи | как есть |
| **Telegram** | обычный текст + полные `https://` ссылки (HTML при вставке **не работает**) | `/reg` как есть; жирный — выделить в редакторе → **Ж** |
| **Discord** | `**текст**` | `` `/reg` `` |

Подвал: `docs/social-post-footer.txt` (ВК, Discord). Для **Telegram** — `docs/social-post-footer-telegram.txt` (без HTML, ссылки `https://`).
