# Автопубликация постов (Discord, Telegram, ВК)

Один текст в `posts/*.txt` публикуется на все площадки. В конец **всегда** добавляется подвал из `docs/social-post-footer.txt`.

## Быстрый старт

1. Заполните секреты в GitHub (см. таблицу ниже) **или** локально `social-publish.env`.
2. Напишите пост: `posts/announcement.txt`.
3. **Actions** → **Publish announcement** → Run workflow → путь к файлу.
4. Готово: пост на Discord, в Telegram-канале и на стене ВК.

## Настройка Discord

1. Канал объявлений → ⚙️ → **Интеграции** → **Webhooks** → **Создать** → **Скопировать URL webhook**.
2. В секрет `DISCORD_WEBHOOK_URL` — **только** этот URL (`https://discord.com/api/webhooks/…`), **не** токен бота.
3. Пост уходит **Embed** (заголовок = первая строка поста, текст, подвал в footer embed).

**Ошибка 403:** webhook удалён или вставлен не тот URL — создайте новый webhook и обновите секрет в GitHub.

## Настройка Telegram

1. @BotFather → `/newbot` → токен → `TELEGRAM_BOT_TOKEN`.
2. Добавьте бота в канал **@isthisnixxxon** как **администратора** (право публиковать сообщения).
3. `TELEGRAM_CHAT_ID` = `@isthisnixxxon` (для публичного канала).

Проверка id: отправьте боту сообщение в канал, откройте  
`https://api.telegram.org/bot<TOKEN>/getUpdates` — найдите `"chat":{"id":-100...}`.

## Настройка ВКонтакте

1. Сообщество [vk.ru/isthisnixxxon](https://vk.ru/isthisnixxxon) (то же, что `vk.com/isthisnixxxon`) → **Управление** → **Работа с API**.
2. Создайте ключ с правами **Управление сообществом** и **Запись на стене** → `VK_ACCESS_TOKEN`.
3. `VK_GROUP_ID` — **числовой** id группы для API (не короткое имя из ссылки).

   В секрет можно: **`isthisnixxxon`**, **`123456`** или полную ссылку `https://vk.ru/isthisnixxxon` — скрипт сам нормализует.

   **Как узнать число (опционально):**
   - Уже работает **`isthisnixxxon`** — id подтянется через API при публикации.
   - Или в браузере откройте группу → иногда в адресе появится `club123456` / `public123456` → id = `123456`.
   - Или в консоли (подставьте свой токен):

     ```text
     https://api.vk.com/method/groups.getById?group_id=isthisnixxxon&access_token=ВАШ_ТОКЕН&v=5.199
     ```

     В ответе `"id": 123456` → в секреты пишите `VK_GROUP_ID=123456` (без минуса).

## Секреты GitHub

Repository **isnix.ru** → **Settings** → **Secrets and variables** → **Actions** → New repository secret:

| Имя | Значение |
|-----|----------|
| `DISCORD_WEBHOOK_URL` | URL webhook |
| `TELEGRAM_BOT_TOKEN` | токен бота |
| `TELEGRAM_CHAT_ID` | `@isthisnixxxon` |
| `VK_ACCESS_TOKEN` | ключ сообщества |
| `VK_GROUP_ID` | `123456` или `isthisnixxxon` |

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
