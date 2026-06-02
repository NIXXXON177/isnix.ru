# ISNIX Reputation — социальный рейтинг (MVP)

Fabric **1.21.1**, мод `isnix-reputation` + Supabase + placeholder для **TAB**.

Как в «Чёрном зеркале», но мягкий старт: по умолчанию **только лайки**, дизы выключены.

## Что уже есть в MVP

| Часть | Статус |
|-------|--------|
| SQL: голоса, RPC, view | `docs/supabase-player-reputation.sql` |
| Мод: `/rep like`, `/rep info`, placeholder | `isnix-reputation/` |
| TAB: `%isnix:rep%` рядом с ником | snippet ниже |
| Кабинет isnix.ru | **TODO** — блок «Оценить игрока» |

## 1. Supabase

1. Выполни **[supabase-player-reputation.sql](supabase-player-reputation.sql)** в SQL Editor.
2. Нужны `profiles`, `set_updated_at`, `is_admin()` из основной схемы.

RPC:

| Функция | Кто вызывает |
|---------|--------------|
| `rep_cast_vote(nick, ±1)` | Сайт (authenticated) |
| `server_rep_vote(voter, target, ±1)` | Мод (service_role) |
| `server_get_reputation(nick)` | Мод / сайт |
| `server_get_reputations(nicks[])` | Мод (обновление онлайна) |

Правила:

- Голосовать могут только с **привязанным ником** в `profiles`.
- Нельзя за себя.
- Сменить оценку — раз в **7 дней** на пару игроков.

## 2. Сборка мода

```powershell
cd isnix-reputation
.\gradlew.bat build
```

Jar: `isnix-reputation/build/libs/isnix-reputation-0.1.0-mvp.jar`

Зависимости на сервере: **Fabric API**, **Placeholder API** (уже стоят).

## 3. Установка

1. Jar в `mods/`
2. **Restart**
3. `config/isnix-reputation.json` — образец: [isnix-reputation.json](config-samples/isnix-reputation.json)

```json
{
  "enabled": true,
  "supabase_url": "https://….supabase.co",
  "service_role_key": "…",
  "allow_dislikes": true
}
```

4. В логе: `placeholder %isnix:rep%`

## 4. TAB

В `config/tab/groups.yml` (или `users.yml`) добавь suffix:

```yaml
# пример для default — см. config-samples/tab/reputation.snippet.yml
tabprefix: "%luckperms:prefix%"
tabsuffix: " %isnix:rep%"
```

Placeholders:

| Placeholder | Пример |
|-------------|--------|
| `%isnix:rep%` | `★847` или `—` |
| `%isnix:rep_score%` | `847` |
| `%isnix:rep_likes%` | `850` |
| `%isnix:rep_dislikes%` | `3` |

`/tab reload`

## 5. Команды в игре

| Команда | Описание |
|---------|----------|
| `/rep like <ник>` | Лайк |
| `/rep dislike <ник>` | Диз (если `allow_dislikes: true`) |
| `/rep info [ник]` | Статистика |
| `/rep reload` | OP 4 — перечитать конфиг |

## 6. Кабинет (следующий шаг)

```javascript
// auth.js — вызов из кабинета (пользователь залогинен)
await supabase.rpc('rep_cast_vote', {
  p_target_nick: 'TargetNick',
  p_vote: 1  // или -1
});
```

Показать в профиле:

```javascript
const { data } = await supabase.rpc('server_get_reputation', { p_nick: minecraftNick });
// data.score, data.likes …
```

(`server_get_reputation` доступен anon/authenticated — см. SQL grants.)

## 7. Дальше (не MVP)

- Цифра **над головой** (Text Display entity)
- Косметика TAB по порогам рейтинга
- Анти-накрутка: мин. часов на сервере перед голосом
- Обращение «запросить варп / репутация» в support

## Версии

**0.1.0-mvp** — SQL, мод, placeholders, `/rep like|info`.
