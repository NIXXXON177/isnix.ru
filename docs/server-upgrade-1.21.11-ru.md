# Миграция ISTHISNIXXXON → Minecraft **1.21.11** (Fabric)

Цель: современная версия, **Create** (через Create-Fly), комфорт игроков, удержание онлайна.  
Текущая база: **1.21.1** · Play2GO · 33 клиентских мода · кастомные `isnix-*`.

**Решение:** **только Java Edition** — Bedrock / Geyser / Floodgate **снимаем** (мало игроков, лишняя поддержка при апгрейде).

---

## Только Java — что это даёт

| Плюс | Пояснение |
|------|-----------|
| Проще апгрейд | Не гоняем Geyser под каждую версию Java |
| Меньше RAM/CPU | Нет моста Bedrock↔Java на сервере |
| Проще правила | Один клиент — сборка с isnix.ru, без `/linkaccount` |
| Один IP в рекламе | **mc.isnix.ru:20122**, без `bedrock.isnix.ru` и UDP 20545 |

**Остаётся:** вторые **Java**-ники в вайтлисте по правилам (алты друзей/семьи) — это не кроссплатформа.

**Убрать с сервера при миграции:** `geyser-fabric-*.jar`, `Floodgate-*.jar`, `floodgate-sqlite-database.jar`, `config/geyser/`, `config/floodgate/`.

**Убрать с сайта/постов (после анонса):** блоки Bedrock на `index.html`, `how-to-play.html`, §9.2 про ПК+телефон, посты `bedrock-*.txt` — архив или пометка «снято».

---

## Какую версию выбрать

| Версия | Плюсы | Минусы для ISNIX |
|--------|--------|------------------|
| **1.21.1** (сейчас) | Всё уже работает | Нет Create Fabric |
| **1.21.11** ✅ **рекомендуем** | Create-Fly 6.0.9, FD/Supplementaries, стабильный Fabric | Полная пересборка модов и сайта |
| **26.1** (новая нумерация) | Самая новая игра | Мало модов; все `isnix-*` с нуля; риск выше, Bedrock уже не аргумент |

**Вердикт:** целевая версия — **Java 1.21.11 + Fabric Loader 0.17+** (уточнить по ElyPrismLauncher при сборке).

**26.1** по-прежнему не целимся в первый релиз — из‑за экосистемы модов, не из‑за Bedrock.

---

## Контент-пакет после апгрейда (затягивает, но не ломает TPS)

### Фаза A — сразу с миграцией (низкий риск)

| Мод | Роль |
|-----|------|
| **Farmer's Delight Refabricated** | Кухня, фермы, совместные проекты |
| **More Delight** | Расширение FD |
| **Supplementaries** + **Amendments** | Декор, QoL в духе ванили |
| **EMI** (уже есть) | Рецепты |

### Фаза B — Create с аддонами (сразу с релизом 1.21.11)

Полный список: **[create-modpack-1.21.11-ru.md](create-modpack-1.21.11-ru.md)**

| Мод | Роль |
|-----|------|
| **Create-Fly** 6.0.9 | Весь Create (сервер: `*-server.jar`, клиент: полный jar) |
| **Farmer's Delight** + **More Delight** | Интеграция с Create (еда, рецепты) |
| **Create: Handy / Useful / Extra Recipes** | Доп. рецепты под Fly |
| **Create: Nerfad** | Опционально — баланс |

Классические аддоны **Steam 'n' Rails / Deco** на Fabric 1.21.11 **нет** — не обещаем их в анонсе.

### Фаза C — по желанию

| Мод | Роль |
|-----|------|
| **Waystones** | Телепорты (жёсткий конфиг: XP, кулдаун, запрет в PvP) |

**Не ставить сразу:** Cobblemon, тяжёлая генерация, 20 техно-модов.

---

## ⚠️ Главный риск: Create-Fly и Fabric API

Сервер **целиком на Fabric API** (OPAC, Voice Chat, EasyAuth, Grim, все `isnix-*`).

Create-Fly исторически конфликтует с FAPI; у автора есть режим совместимости (**Compat Fabric Events**), но это **обязательно проверить на тестовом сервере** до продакшена.

**Порядок:**

1. Поднять **тестовый** инстанс 1.21.11 **без** Create — все текущие моды + FD + Supplementaries.
2. Прогнать чек-лист (вход Java, OPAC, голос, вайтлист, могилы).
3. Добавить **только Create-Fly** → `/spark tps`, 5+ игроков у механизмов.
4. Если краши/конфликты — оставить FD+Supplementaries на 1.21.11, Create отложить или искать совместимую сборку.

---

## План миграции (по шагам)

### 0. Подготовка (1–2 дня)

- [ ] Анонс в Discord/VK: «Готовим обновление до 1.21.11 + новый контент, дата окна — …»
- [ ] Play2GO: **полный бэкап** мира + `mods/` + `config/`
- [ ] Скачать тестовый мир / клон панели или второй слот (если есть)

### 1. Тестовый сервер 1.21.11

- [ ] Новый jar сервера **1.21.11** (Fabric installer)
- [x] Клиентский ZIP `downloads/ISTHISNIXXXONmods.zip` (скрипт `build_client_modpack_12111.py`)
- [x] Сайт: Bedrock убран с `index.html`, `how-to-play.html`, §9.2 в `rules.html`
- [ ] Обновить: Fabric API, Fabric Kotlin, LuckPerms, TAB, EasyAuth, Essential Commands, OPAC, Voice Chat, Styled Chat, Grim, ServerCore, Graves datapack, серверные QoL (**без** Geyser/Floodgate)
- [ ] Пересобрать **все** `isnix-*` на `minecraft_version=1.21.11` (gradle.properties + yarn + fabric-api версии)
- [ ] Прогнать [restart-checklist-ru.md](restart-checklist-ru.md) на тесте (пункты Bedrock убрать из чек-листа)

### 2. Мир

- [ ] Официальный апгрейд мира 1.21.1 → 1.21.11 (резервная копия обязательна)
- [ ] Проверить OPAC-регионы, могилы (VT Graves), спавн, NPC/datapacks
- [ ] При битых чанках — откат из бэкапа Play2GO

### 3. Контент (фаза A)

- [ ] Farmer's Delight Refabricated + More Delight + Supplementaries (+ Amendments)
- [ ] Конфиги: лимиты Waystones/Create — **позже**

### 4. Клиент и сайт

- [ ] `scripts/build_client_modpack.py` — версия **1.21.11**, новые jar с Modrinth
- [ ] Sodium/Iris/Lithium/Xaero — версии под 1.21.11
- [ ] `downloads/ISTHISNIXXXONmods.zip` + пост «скачай новую сборку»
- [ ] Обновить: `index.html`, `how-to-play.html`, `rules.html`, `docs/server-descriptions.md` — **только Java**
- [ ] Пост в соцсетях: «с 1.21.11 вход только с ПК/лаунчера, Bedrock отключён»

### 5. Create (фаза B)

- [ ] `create-fly` 1.21.11 на тест → прод
- [ ] Правила: лимит карьеров/контрапций, `/spark` у админов
- [ ] EMI: Create рецепты видны

### 6. Продакшен-окно

- [ ] Стоп сервера → бэкап → замена `mods/` и server jar → апгрейд мира → старт
- [ ] 30–60 мин smoke-test с 2–3 админами
- [ ] Открыть игрокам + закреплённый пост с ссылкой на ZIP

### 7. После релиза

- [ ] Мониторинг TPS 3–7 дней (`/spark tps`, ServerCore)
- [ ] Собрать фидбек: «что мешает / что цепляет»
- [ ] Ивент: «первая фабрика Create» / «кулинарная неделя» (FD)

---

## Что пересобрать в репозитории

Все модули с `minecraft_version=1.21.1` в `gradle.properties`:

- isnix-chat, isnix-market, isnix-modtools, isnix-graveguard, isnix-player-backup
- isnix-opac-tab, isnix-player-stats, isnix-reputation, isnix-server-messages, isnix-lagwatch

Плюс CI workflows `build-isnix-*.yml` — артефакты под новую версию.

---

## Откат

Если после апгрейда мир/моды ломаются:

1. Stop
2. Play2GO → Restore backup (до миграции)
3. Вернуть старый `mods/` и server 1.21.1 из бэкапа SFTP
4. Сообщить игрокам: откат, старая сборка ZIP

Держать старый ZIP `ISTHISNIXXXONmods-1.21.1.zip` на сайте 2 недели.

---

## Текст для игроков (черновик)

> **ISTHISNIXXXON обновляется до Minecraft Java 1.21.11**  
> Новая сборка на isnix.ru: кухня (Farmer's Delight), декор (Supplementaries), позже — **Create**.  
> Старая 1.21.1 **не подойдёт**. Скачай ZIP, Java 21, ElyPrismLauncher.  
> **Вход с телефона (Bedrock) больше не поддерживается** — только Java.  
> Окно: [дата] ~30–60 мин, мир сохраняется. Вопросы — Discord.

---

## Следующий шаг в репо

1. Тестовый инстанс + таблица совместимости модов (версии jar).
2. Ветка `upgrade/1.21.11` — bump gradle во всех `isnix-*`.
3. Скрипт `scripts/check_mod_versions_1.21.11.py` (опционально).

Когда скажешь «старт теста» — можно начать с bump одного мода (например `isnix-server-messages`) и чек-листа jar с Modrinth.
