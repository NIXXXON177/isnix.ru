# Жирный ник: только админам (Styled Chat + LuckPerms)

Готовый конфиг для сервера: **[styled-chat.json](styled-chat.json)** — скопируй в `config/styled-chat.json` на Play2GO.

После замены: `/styledchat reload` или перезапуск сервера.

---

## В чём была проблема в твоём конфиге

1. **В чате у всех жирный ник** — в `default.message_formats.chat` было:
   ```json
   "<bold><white>${player}</bold> ..."
   ```
   `<bold>` нужно убрать из `default` и оставить только в стиле для админов.

2. **Пропущена запятая** после `display_name` (JSON не валидный).

3. **`styles` был пустой** — некуда было повесить жирный только на админов.

`display_name` у тебя был правильный. В формате **chat** нельзя использовать `${displayName}` — только `${player}` и `${message}` (иначе `INVALID KEY dynamic:styled_chat | displayName`).

---

## Что в исправленном конфиге

**default** — чат без жирного (префикс только через `display_name`, не дублировать в `chat`):
```json
"display_name": "%luckperms:prefix%${default}",
"chat": "<white>${player}</white> <dark_gray>»</dark_gray> <white>${message}</white>"
```

**styles** — только с правом `isthis.boldnick`:
```json
"display_name": "%luckperms:prefix%<bold>${default}</bold>",
"message_formats": {
  "chat": "<bold><white>${player}</bold> <dark_gray>»</dark_gray> <white>${message}</white>"
}
```

Если в чате **два раза** `[Админ]` — в `chat` / join / leave снова попал `%luckperms:prefix%`, а `${player}` уже рисуется с префиксом из `display_name`. Убери `%luckperms:prefix%` из **всех** `message_formats` (chat, joined_the_game, left_game, say_command и т.д.).

---

## 3. LuckPerms: права только админ-группам

В консоли сервера (замени `admin` на свои группы: `owner`, `moder` и т.д.):

```text
lp group default permission unset isthis.boldnick
lp group admin permission set isthis.boldnick true
lp group owner permission set isthis.boldnick true
```

Если жирный выдавали игрокам за донат — снять у каждого:

```text
lp user <ник> permission unset isthis.boldnick
```

Проверка:

```text
lp user <ник> permission check isthis.boldnick
lp group admin info
```

Сохранить:

```text
lp sync
```

---

## 4. Если жирный «зашит» в префиксе LuckPerms

Иногда в meta префикса есть `<bold>` или `&l`. Проверь:

```text
lp group default meta info
lp group admin meta info
```

У `default` и групп с префиксами для игроков в prefix/suffix **не должно** быть bold.  
Жирный только через право `isthis.boldnick` + стиль Styled Chat из шага 2.

---

## 5. Проверка в игре

1. Зайти обычным аккаунтом — ник в чате/табе **не жирный**.  
2. Зайти админом — ник **жирный**.  
3. Написать в чат — убедиться, что формат совпадает с табом.

---

## 6. Когда снова откроете продажу «Жирный ник»

Выдавать покупателям:

```text
lp user <ник> permission set isthis.boldnick true
```

Снять:

```text
lp user <ник> permission unset isthis.boldnick
```

На сайте можно снова включить кнопку «Купить» в карточке магазина.
