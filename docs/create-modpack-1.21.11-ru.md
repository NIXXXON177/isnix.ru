# Create на ISTHISNIXXXON (1.21.11, Fabric)

## Главное

**Create-Fly** — это не «облегчённый Create», а **полный Create 6.0.9** на Fabric: шестерни, конвейеры, поезда, карьеры, механические прессы и т.д.

| Где | Файл |
|-----|------|
| **Сервер** | `create-fly-1.21.11-6.0.9-5-server.jar` |
| **Клиент** | `create-fly-1.21.11-6.0.9-5.jar` (полный, не server) |

Оба обязательны у игроков и на сервере.

---

## Аддоны в нашей сборке (есть на Modrinth для 1.21.11)

| Мод | Зачем |
|-----|--------|
| **Create-Fly** | Сам Create |
| **Farmer's Delight Refabricated** | Еда + рецепты Create (миксер, пила) |
| **More Delight** / **Flora's Delight** | Доп. кухня без алкоголя |
| **Create: Handy Recipes** | Удобные рецепты |
| **Create: Useful Recipes** | Полезные рецепты (патч под Fly) |
| **Create: Extra Recipes (Kuma)** | Расширение рецептов |
| **Create: Nerfad** | Баланс Create под survival без pay-to-win |
| **Create: Cyber Goggles** | HUD RPM/стресс — **только клиент** |

**REI** (в клиентской сборке) — рецепты Create/FD, клавиша **R**, фильтр `@create`.

---

## Снято из сборки (июнь 2026)

| Мод | Почему |
|-----|--------|
| **Ultimate Resource Automation** | Битые рецепты под Create Fly → ERROR в логе сервера |
| **Create: New Foods** | Jar 1.21.10 несовместим с MC 1.21.11 |

---

## Онбординг игроков

- Книга **Путеводитель** при первом входе + `/guidebook`
- **Esc → Прогресс → ISTHISNIXXXON** — цепочка Create: сплав → латунь → колесо → пресс → конвейер
- Сайт: [guide.html](../guide.html)

---

## Чего не будет (честно)

Популярные аддоны с Forge/NeoForge **под наш стек не подходят**:

- Create: Steam 'n' Rails  
- Create: Designed Decor (NeoForge)  
- Create Crafts & Additions (старые ветки)  

На **Fabric 1.21.11** экосистема меньше; зато **Create целиком** + кухня FD + Nerfad.

---

## Правила и TPS

- Следить за `/spark tps` у больших фабрик.  
- В правилах: не строить лаг-машины у спавна; админ может сносить по жалобам.  
- **Ledger** остаётся для расследований.

---

## Деплой изменений Create-стека

```bash
python scripts/fetch_modpack_12111.py
python scripts/build_isnix_mods_12111.py isnix-guide
python scripts/build_client_modpack_12111.py
python scripts/deploy_create_improvements.py
```

Перезапуск сервера в Play2GO.

---

## Связанные файлы

- [modpack-1.21.11-manifest.json](modpack-1.21.11-manifest.json)  
- [server-upgrade-1.21.11-ru.md](server-upgrade-1.21.11-ru.md)  
- `scripts/fetch_modpack_12111.py` — скачивание jar с Modrinth  
- `scripts/deploy_create_improvements.py` — Nerfad + guide, снятие Ultimate Factory
