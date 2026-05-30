# Посты для автопубликации

Один файл → **Discord + Telegram + ВК** + подвал из `docs/social-post-footer.txt`.

## Новый пост

1. Создайте `posts/мой-пост.txt` (обычный текст, эмодзи Unicode, ссылки `https://`).
2. Не копируйте подвал вручную — скрипт добавит его сам.
3. Опубликуйте:

**GitHub (рекомендуется):**  
Repository → **Actions** → **Publish announcement** → **Run workflow** → укажите `posts/мой-пост.txt`.

**Локально:**
```powershell
copy social-publish.env.example social-publish.env
# заполните токены
python scripts/publish_announcement.py posts/мой-пост.txt --dry-run
python scripts/publish_announcement.py posts/мой-пост.txt
```

## Секреты GitHub

Settings → Secrets and variables → Actions:

| Secret | Где взять |
|--------|-----------|
| `DISCORD_WEBHOOK_URL` | Discord: канал → Настройки → Интеграции → Webhooks |
| `TELEGRAM_BOT_TOKEN` | @BotFather |
| `TELEGRAM_CHAT_ID` | `@isthisnixxxon` (бот — админ канала) |
| `VK_ACCESS_TOKEN` | vk.com/isthisnixxxon → Управление → API → ключ (стена) |
| `VK_GROUP_ID` | Число из `clubXXXXX` (без `club`) |

Подробно: [docs/social-autopublish-ru.md](../docs/social-autopublish-ru.md).
