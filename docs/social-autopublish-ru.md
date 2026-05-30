# Автопубликация постов (Discord, Telegram, ВК)

Один текст в `posts/*.txt` публикуется на все площадки. В конец **всегда** добавляется подвал из `docs/social-post-footer.txt`.

## Быстрый старт

1. Заполните секреты в GitHub (см. таблицу ниже) **или** локально `social-publish.env`.
2. Напишите пост: `posts/announcement.txt`.
3. **Actions** → **Publish announcement** → Run workflow → путь к файлу.
4. Готово: пост на Discord, в Telegram-канале и на стене ВК.

## Настройка Discord

1. Канал объявлений → ⚙️ → **Интеграции** → **Webhooks** → **Создать**.
2. Скопируйте **URL webhook** → секрет `DISCORD_WEBHOOK_URL`.

## Настройка Telegram

1. @BotFather → `/newbot` → токен → `TELEGRAM_BOT_TOKEN`.
2. Добавьте бота в канал **@isthisnixxxon** как **администратора** (право публиковать сообщения).
3. `TELEGRAM_CHAT_ID` = `@isthisnixxxon` (для публичного канала).

Проверка id: отправьте боту сообщение в канал, откройте  
`https://api.telegram.org/bot<TOKEN>/getUpdates` — найдите `"chat":{"id":-100...}`.

## Настройка ВКонтакте

1. Сообщество **vk.com/isthisnixxxon** → **Управление** → **Работа с API**.
2. Создайте ключ с правами **Управление сообществом** и **Запись на стене** → `VK_ACCESS_TOKEN`.
3. `VK_GROUP_ID` — число из ссылки группы (`club123456` → `123456`).

## Секреты GitHub

Repository **isnix.ru** → **Settings** → **Secrets and variables** → **Actions** → New repository secret:

| Имя | Значение |
|-----|----------|
| `DISCORD_WEBHOOK_URL` | URL webhook |
| `TELEGRAM_BOT_TOKEN` | токен бота |
| `TELEGRAM_CHAT_ID` | `@isthisnixxxon` |
| `VK_ACCESS_TOKEN` | ключ сообщества |
| `VK_GROUP_ID` | id группы |

## Локальная публикация

```powershell
cd isnix.ru
copy social-publish.env.example social-publish.env
# вставьте токены в social-publish.env (файл в .gitignore)

python scripts/publish_announcement.py posts/sell-update.txt --dry-run
python scripts/publish_announcement.py posts/sell-update.txt
```

## Формат поста

- Пишите **один** текст: эмодзи Unicode (🔧 ✅), ссылки с `https://`.
- Discord-markdown (`##`, `**`) в файле можно — для ВК и TG скрипт упростит текст.
- Подвал **не** вставляйте в `posts/*.txt` — он подставится автоматически.

## Ограничения

- Discord: до 2000 символов на сообщение (длинные посты режутся на части).
- ВК: лимит API (~4096 на пост).
- Токены **не** коммитить в git.

## Пример

Готовый пост: `posts/sell-update.txt` — обновление `/sell`, вайтлист и жалобы только на сайте.
