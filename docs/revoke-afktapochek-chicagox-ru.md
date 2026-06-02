# Снятие afktapochek и ChicagoX (админка + вайтлист)

Решение по делу бочек / альт **ChicagoX**. Выполняют **ISTHISNIXXXON** или **NikenER999** (не afktapochek).

## 1. Репозиторий (`whitelist.json`)

Удалены из вайтлиста (остаются снятыми):

| Ник | UUID |
|-----|------|
| ChicagoX | `f2285f8e-161e-30c5-a83e-f416a54f53d6` |

**afktapochek** (`b1034311-2642-3290-8043-dd85f3001903`) снова в вайтлисте — заходит иногда; **админка и ChicagoX без изменений**.

После **push в `main`**:

- дождаться GitHub Actions **Sync whitelist** (или **Process whitelist deploy queue**);
- при необходимости **restart** сервера Play2GO.

## 2. Supabase (сайт)

SQL Editor → выполнить **[supabase-revoke-afktapochek-admin.sql](supabase-revoke-afktapochek-admin.sql)**.

Проверка: у `kupryuhinsemen@gmail.com` → `role = player`; в списке админов только три email.

## 3. Сервер — LuckPerms и OP

Консоль Play2GO или в игре с OP:

```text
lp user afktapochek parent set default
lp user afktapochek meta clear prefix
deop afktapochek

lp user ChicagoX parent set default
lp user ChicagoX meta clear prefix

lp sync
```

Если были OP:

```text
deop ChicagoX
```

(Опционально) кик, если онлайн:

```text
kick afktapochek Снят с администрации. Обращения — на сайте.
kick ChicagoX Снят с вайтлиста.
```

## 4. Что не трогаем автоматически

- Аккаунт **Auth** в Supabase (логин на сайте) — остаётся как игрок; при желании заблокировать отдельно.
- Возврат украденного жертве — по договорённости / отдельному решению.

## 5. Оставшиеся админы сайта

| Email | Ник |
|-------|-----|
| kudrasovn024@gmail.com | ISTHISNIXXXON |
| 1511vasilisa@gmail.com | VaSSiLIISa |
| nikenerdx@gmail.com | NikenER999 |
