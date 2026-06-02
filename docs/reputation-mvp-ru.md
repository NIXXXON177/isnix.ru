# Социальный рейтинг — дорожная карта MVP

## Концепция

Игроки видят **★рейтинг** в TAB (как «соцсеть» сервера). Голосуют лайком через `/rep like` или позже — в кабинете **isnix.ru**.

**Не** банят за низкий рейтинг. **Не** дают силу/броню — только социальный статус.

## Фаза 1 — сейчас (набросок в репо)

- [x] SQL `docs/supabase-player-reputation.sql`
- [x] Мод `isnix-reputation` 0.1.0-mvp
- [x] Placeholder `%isnix:rep%` для TAB
- [ ] **Выполнить SQL в Supabase** (обязательно!)
- [x] Jar на Play2GO + `config/isnix-reputation.json`
- [x] TAB suffix в `groups.yml` (после restart: `/tab reload`)

## Фаза 2 — сайт

- [x] Блок в `account.html`: рейтинг + лайк
- [x] `auth.js`: `getReputation`, `castReputationVote`
- [ ] Правила §… — описать систему рейтинга

## Фаза 3 — «как в фильме»

- [ ] Text Display над игроком (опционально)
- [ ] Пороги: ★500+ — цвет в TAB
- [x] Дизлайки в кабинете isnix.ru (лайк + дизлайк)
- [x] `allow_dislikes: true` в образце конфига мода (`/rep dislike` на сервере)

## Анти-токсичность

| Мера | Где |
|------|-----|
| Только аккаунт с ником | SQL + mod |
| 7 дней на смену голоса | SQL |
| Дизы выключены по умолчанию | mod config |
| Список «кто дизнул» скрыт | SQL (только агрегат) |

## Связанные файлы

- [isnix-reputation-mod.md](isnix-reputation-mod.md)
- [supabase-player-reputation.sql](supabase-player-reputation.sql)
