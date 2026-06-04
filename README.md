# isnix.ru

Официальный сайт сервера ISTHISNIXXXON — модовый Minecraft-сервер (Fabric 1.21.11, Create, whitelist).

- Сборка для игроков: `downloads/ISTHISNIXXXONmods.zip` (~42 МБ, только клиент) — `python scripts/build_client_modpack.py`, см. [docs/client-modpack.md](docs/client-modpack.md)
- Инструкция: [how-to-play.html](how-to-play.html)
- Аккаунт и заявка в вайтлист: [account.html](account.html) — нужен [Supabase](docs/supabase-auth-setup.md)
- Жирный ник только админам (сервер): [docs/bold-nick-server.md](docs/bold-nick-server.md)

## Структура

```
index.html              — главная (разметка)
account.html            — регистрация, вход, заявка в вайтлист
how-to-play.html        — как установить сборку
assets/css/main.css     — основные стили
assets/css/components.css — блок «На сервер», модалки
assets/css/auth.css     — страница аккаунта
assets/js/site.js       — магазин, вайтлист, навигация
assets/js/auth.js       — Supabase: вход и заявки
assets/js/shop-slider.js — слайдер префиксов
whitelist.json          — синхронизация с сервера; авто-добавление после одобрения заявки (см. docs/auto-whitelist-deploy-ru.md)
```

Публикация: push в `main` → GitHub Pages. После правок обновите страницу с **Ctrl+Shift+R**.
