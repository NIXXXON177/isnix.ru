# TAB + кланы ISNIX — эталонные конфиги

Скопируйте на сервер (Play2GO) при **выключенном** сервере или правьте через SFTP, затем `/tab reload`.

| Файл в репозитории | Куда на сервере |
|--------------------|-----------------|
| `groups.yml` | `config/tab/groups.yml` (слить с существующим `_DEFAULT_` / группами) |
| `config.yml` | фрагмент в `config/tab/config.yml` — секции `tablist-name-format*` и `above-name-format` |

## Проверка

1. В логе при старте: `TAB: зарегистрирован player placeholder %isnix:clan_tag%`
2. В игре: `/tab debug <ник>` или список TAB — справа от ника тег клана, слева префикс LP
3. Владелец клана: `/clantag show` — превью тега

## Форматирование тега (только владелец клана)

Текст тега: OPAC → `'` → **Party name** или `/clantag name [Тег]`

Стиль (цвет, жирный, курсив…): команды `/clantag` → см. `docs/opac-tab-klany-ru.md`

Стили хранятся в `config/isnix-opac-tab.json` по UUID **владельца** клана.
