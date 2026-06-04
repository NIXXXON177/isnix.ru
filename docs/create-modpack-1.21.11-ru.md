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
| **Farmer's Delight Refabricated** | Еда + рецепты Create (миксер, пила) — интеграция в FD под Fly |
| **More Delight** | Доп. блюда FD, совместимость с Create |
| **Create: Handy Recipes** | Удобные рецепты |
| **Create: Useful Recipes** | Полезные рецепты |
| **Create: Extra Recipes (Kuma)** | Расширение рецептов |
| **Create: Nerfad** *(опционально)* | Смягчение «имбы» Create — обсудить с игроками |

**EMI** (в клиентской сборке) — показывать рецепты Create.

---

## Чего не будет (честно)

Популярные аддоны с Forge/NeoForge **под наш стек не подходят**:

- Create: Steam 'n' Rails  
- Create: Designed Decor (NeoForge)  
- Create Crafts & Additions (старые ветки)  
- Slice and Dice и др. с роликов 1.20.1 Forge  

На **Fabric 1.21.11** экосистема меньше; зато **Create целиком** + кухня FD — этого достаточно для «затягивающего» контента.

**Create: New Foods** (мост Create + еда) сейчас только **1.21.10** — после стабилизации сервера можно **протестировать** на 1.21.11 вручную.

---

## Правила и TPS

- Первую неделю следить за `/spark tps` у больших фабрик.  
- В правилах: не строить лаг-машины у спавна; админ может сносить по жалобам.  
- **Ledger** остаётся для расследований.

---

## Связанные файлы

- [modpack-1.21.11-manifest.json](modpack-1.21.11-manifest.json)  
- [server-upgrade-1.21.11-ru.md](server-upgrade-1.21.11-ru.md)  
- `scripts/fetch_modpack_12111.py` — скачивание jar с Modrinth  
