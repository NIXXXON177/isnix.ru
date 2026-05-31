# OPAC: гости могут заходить в чужие приваты

## Проблема

По умолчанию OPAC ставил **барьер на игроков** (`Players = "E"`) — чужие **не могли войти** в регион (отталкивало у границы).

## Решение на сервере

1. **`world/serverconfig/openpartiesandclaims-default-player-config.toml`**
   - `claims.protection.exceptions.groups.entity.barrier.Players = "N"`
   - `claims.protection.exceptions.groups.entity.barrier.Ender_Pearls = "N"`

2. **`config/openpartiesandclaims-server.toml`**
   - Убраны `entity.barrier.Players` и `Ender_Pearls` из `playerConfigurablePlayerConfigOptions`, чтобы все регионы использовали серверный дефолт (гости заходят; владелец не может случайно закрыть базу через меню).

## Деплой

**Сервер выключить** (Stop на Play2GO), иначе OPAC может перезаписать конфиги.

1. Дефолт + `openpartiesandclaims-server.toml`:
   ```bash
   python scripts/deploy_server_configs.py --only opac
   ```

2. **Сохранённые настройки владельцев** (у ~54 игроков в базе было `Players = "E"`):
   ```bash
   python scripts/opac_fix_player_barriers.py --pull   # скачать
   python scripts/opac_fix_player_barriers.py          # E → N локально
   python scripts/opac_fix_player_barriers.py --push   # залить (сервер STOP)
   ```

3. **Запуск** сервера. Игрокам — **перезайти** в мир.

## Что остаётся запрещённым

Гости **могут ходить** по чужому привату. **Ломать блоки, открывать сундуки, воровать** — по-прежнему нельзя (это отдельные опции защиты, по умолчанию `N`).

## Игрокам

Если после рестарта всё ещё не пускает — напишите в поддержку: возможно старый кэш клиента OPAC; перезайдите на сервер.

Владельцу, который **хочет закрыть базу**: после возврата опций в меню — «Entity barrier → Players → Party/Every» (см. админов).
