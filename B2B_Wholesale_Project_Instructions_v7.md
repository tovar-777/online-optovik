# B2B Wholesale App — Инструкция по проекту

*Версия от 3 апреля 2026 г.*

---

## 1. Описание проекта

Оптовое B2B приложение для заказа товаров. Клиенты — оптовые покупатели. Все файлы — одностраничные HTML-приложения без фреймворков.

### Файлы проекта

| Файл | Назначение |
|------|------------|
| pochnorm2forcursor_v2.html | Основное клиентское приложение (каталог + корзина + авторизация + регистрация + профиль) |
| admin.html | Панель администратора |
| admin-logistik.html | Карта логистики (маршруты, геокодинг, 2GIS) |
| order-editor.html | Редактор заказов администратором |

### Вкладки admin.html (актуальный состав)

| Вкладка | Описание |
|---------|----------|
| 🗂️ Клиент-заказ | Заказы сгруппированы по клиентам. Активные вверху. |
| 📅 Заказы-дата | Заказы сгруппированы по дате вывоза (по возрастанию). |
| 🏭 Склады | Карточки складов из products.storage + юр. данные (warehouse_legal_info). |
| 📊 Распределение | Иерархия: Дата → Склад → Клиент. Таблица с товарами. Выгрузка в Google Sheets. |
| 🔑 Коды доступа | Создание и управление кодами доступа клиентов. |
| 📋 Заявки на код | Входящие заявки на регистрацию, выдача кода. |
| 💬 Вопросы | Вопросы клиентов. |
| 👥 Клиенты | Скрытая вкладка (совместимость). |

### Текущий билд

```
BUILD = 'YYYYMMDD_HHMM'  // обновляется при каждом изменении
```

---

## 2. Учётные данные и API

⚠ **Все ключи действующие. Хранить конфиденциально.**

### Supabase

| Параметр | Значение |
|----------|----------|
| URL | https://xtwzuymhegwcxdgpmzju.supabase.co |
| Anon key | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (публичный) |
| Service role key | eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9... (СЕКРЕТНЫЙ, только в admin) |

### DaData

| Параметр | Значение |
|----------|----------|
| Токен | 0507df41b41a3993773787a692eebad5631464f5 |
| Адреса | Приморский край (from_bound=city, to_bound=settlement) |
| Юр. лица | Вся Россия, приоритет Приморского края |

### 2GIS

| Параметр | Значение |
|----------|----------|
| Ключ | f6d46de4-405e-40f9-862d-aa8485d99651 |

⚠ **2GIS ключ истекал 2026-04-10 — проверить актуальность.**

### Google Sheets (выгрузка Распределения)

| Параметр | Значение |
|----------|----------|
| Spreadsheet ID | 1Zvr7TiYNhBRu0Hon7Rcd1lZDXpMhAAWPETkpr9UmgKc |
| Service account | oop-891@notional-mantra-477103-i1.iam.gserviceaccount.com |
| Ключи хранятся | Таблица `app_secrets` в Supabase (service_role only) |
| Edge Function | `sync-to-sheets` (Supabase Edge Functions) |

---

## 3. Схема базы данных Supabase

### Таблица orders

```
id, user_id, user_email, user_name, user_location, user_notes,
total_amount, status, created_at, updated_at, admin_note,
delivery_date  ← date
doc_type       ← text, default 'накладная', check IN ('накладная','с/ф')
```

**Статусы:** `draft | new | подтверждён | в маршруте | отгружен | доставлен | отменён`

ℹ️ Для code-клиентов: `user_id = client_codes.id` (UUID клиента), `user_email = телефон`

### Таблица order_items

```
order_id, product_id, product_name, price, quantity, unit, total,
added_at, comment, storage
```

### Таблица client_codes

```
id, phone, name, type, code, email, delivery_address, status,
registration_request_id, last_login, created_at, locality_id,
admin_notes, admin_address, admin_alias,
doc_type  ← text, default 'накладная', check IN ('накладная','с/ф')
```

**Важно:** `phone` НЕ имеет UNIQUE constraint — одно юрлицо может иметь несколько адресов доставки с одним телефоном.

**RLS:** политика только для `authenticated` admin-пользователей. Для чтения данных клиентом используется RPC `get_client_profile` (SECURITY DEFINER).

### Таблица client_legal_info

```
id, client_code_id (FK→client_codes), inn, ogrn, kpp, legal_address,
postal_address, company_full_name, director_name, charter_file_url,
inn_scan_url, ogrn_scan_url, dadata_raw (jsonb), filled_by_client,
created_at, updated_at
```

**RLS:** только service_role. Для чтения клиентом используется RPC `get_client_profile` (SECURITY DEFINER).

### Таблица registration_requests

```
id, type, name, phone, email, delivery_address, status, personal_code,
created_at, inn, ogrn, kpp, legal_address, postal_address,
company_full_name, director_name, dadata_raw
```

**Статусы:** `new → code_sent → active`

### Таблица warehouse_legal_info

```
id, storage_name (text, unique), company_name, inn, ogrn, kpp,
director, legal_addr, phys_addr, dadata_raw (jsonb),
created_at, updated_at
```

RLS: только service_role. Хранит юридические данные складов.
`storage_name` соответствует значениям поля `storage` в таблице `products`.

### Таблица app_secrets

```
key (text, PK), value (text)
```

RLS: только service_role. Хранит секреты для Edge Functions.
Текущие ключи: `gs_client_email`, `gs_private_key`.

### Таблицы логистики

```
localities, direction_localities, delivery_directions, direction_schedules
```

---

## 4. RPC функции (SECURITY DEFINER)

| Функция | Описание |
|---------|----------|
| `upsert_code_draft(p_user_email, p_user_name, p_user_location, p_total_amount, p_items, p_draft_id, p_client_id)` | Создать/обновить черновик. **p_client_id** — UUID клиента. Storage восстанавливается из products автоматически. |
| `confirm_code_order(p_order_id, p_user_name, p_user_location, p_user_notes, p_total_amount, p_items, p_delivery_date)` | Подтвердить заказ. Сохраняет delivery_date. |
| `get_code_draft(p_user_email, p_client_id)` | Получить черновик. Ищет по p_client_id, fallback по email. НЕ матчит по 'не указан'. |
| `get_code_draft_items(p_order_id)` | Позиции черновика |
| `cleanup_code_drafts(p_user_email, p_keep_id, p_client_id)` | Удалить дубли черновиков |
| `check_duplicate_client(p_name, p_type, p_inn, p_address)` | Проверка дублей при регистрации. |
| `check_inn_exists(p_inn)` | Проверка существования ИНН в базе |
| `get_client_directions(p_client_id)` | Все направления вывоза клиента с расписанием и ближайшей датой |
| `transfer_legal_info_on_code_issue(p_request_id, p_client_code_id)` | Перенос юр. данных при выдаче кода |
| `admin_update_order(...)` | Обновление заказа администратором |
| `insert_code_order(...)` | Создание заказа (статус → подтверждён) |
| `admin_get_db_size()` → bigint | Суммарный размер всех таблиц public schema |
| `admin_get_table_sizes()` → table | Размер каждой таблицы по убыванию |
| `get_distrib_data()` → table | Все данные для вкладки «Распределение» одним JOIN-запросом |
| `get_client_profile(p_client_id uuid)` → jsonb | **НОВАЯ.** Возвращает объединённые данные из `client_codes` + `client_legal_info` для клиента. Обходит RLS через SECURITY DEFINER. Используется в панели профиля клиентского приложения. |
| `get_client_orders(p_client_id uuid)` → jsonb | **НОВАЯ.** Возвращает `{orders: [...], items: [...]}` — все не-черновые заказы клиента с позициями. Обходит RLS через SECURITY DEFINER. Используется в панели профиля. |

---

## 5. Архитектура авторизации

### Режим 1 — Вход по личному коду (codeSession)

```javascript
localStorage._codeSession = { id, name, type, phone, email, delivery_address }
```

- `id` = UUID из client_codes (используется как p_client_id во всех RPC)
- `phone` используется как `user_email` в таблице orders
- При смене клиента — автоматически очищается `_draftOrderId` и корзина предыдущей сессии
- **Важно:** code-клиент не аутентифицирован через Supabase Auth → `auth.uid()` = null. Любой прямой запрос к `client_codes`, `client_legal_info`, `orders` через anon-ключ заблокируется RLS. Используйте только SECURITY DEFINER RPC.

### Режим 2 — Гостевой (isGuestMode)

Без регистрации. Корзина только в памяти.

---

## 6. Система черновиков (draft orders)

Черновики идентифицируются по `user_id = client_codes.id` (UUID), а НЕ по телефону.

```javascript
// При сохранении черновика — обязательно передаём p_client_id
await sb.rpc('upsert_code_draft', {
    p_user_email:    codeSession.phone,
    p_user_name:     codeSession.name,
    p_user_location: codeSession.delivery_address,
    p_total_amount:  total,
    p_items:         items,
    p_draft_id:      _draftOrderId || null,
    p_client_id:     codeSession.id    // ← ОБЯЗАТЕЛЬНО
});

// При поиске черновика — передаём p_client_id
await sb.rpc('get_code_draft', {
    p_user_email: codeSession.phone,
    p_client_id:  codeSession.id       // ← ОБЯЗАТЕЛЬНО
});
```

**Storage в позициях:** RPC `upsert_code_draft` и `confirm_code_order` автоматически восстанавливают `storage` из таблицы `products` по `product_id`.

---

## 7. Система регистрации

### Логика проверки дублей

**Физлицо:** проверка по имени (`check_duplicate_client` с p_type='physical')

**Юрлицо — шаг 1 (выбор из DaData):**
- Проверка ИНН через `check_inn_exists(p_inn)`
- Если ИНН найден → «➕ Добавить адрес доставки» или «Отмена»

**Юрлицо — шаг 2 (адрес доставки):**
- Проверка по адресу через `check_duplicate_client` с p_type='legal', p_address

### Защита от редактирования полей

После выбора из DaData-подсказки — `readonly` + зелёная рамка `.addr-field-confirmed`.
При фокусе без нового выбора — красная рамка `.addr-field-dirty`.

### Флаг _legalLocked

При добавлении нового адреса существующего юрлица: `_regData._legalLocked = true`.

---

## 8. Вкладка «Клиент-заказ» (admin.html)

### Матчинг заказов на клиентов

Заказы матчатся по `user_email` (телефон). При дублирующемся телефоне — уточнение по `user_name`.

```javascript
const oName = (o.user_name || '').toLowerCase();
orders = allByPhone.filter(o => oName === nameLower || ...);
```

### Отображение юрлиц с несколькими адресами

`displayName` дополняется адресом: `ООО Ромашка (ул. Ленина, 5)`

### Направления вывоза в шапке клиента

Подгружаются асинхронно через `_loadClientDirs(clientId)` → RPC `get_client_directions`.

### Дата вывоза в заказе

Поле `delivery_date` в таблице `orders`. Попап `co-date-picker-popup` с нативным date-picker.

### Тип документа отгрузки (doc_type)

Кнопка-переключатель **«накладная» / «с/ф»** в шапке клиента и каждого заказа.

```javascript
const effectiveDoc = order.doc_type || clientDocType || 'накладная';
```

### Структура панели (layout)

```css
#panel-co.active {
  display: flex;
  flex-direction: column;
  margin: -24px -28px;
  height: calc(100vh - 57px);
  overflow: hidden;
}
```

⚠ Панели `panel-co`, `panel-bydate`, `panel-distrib` НЕ должны иметь `style="display:flex"` в HTML-атрибуте.

---

## 9. Вкладка «Заказы-дата» (admin.html)

Заказы (кроме черновиков и отменённых) сгруппированы по `delivery_date` по возрастанию. Без даты — в конце.

---

## 10. Вкладка «Склады» (admin.html)

- Цветовая палитра — `STORAGE_PALETTE`
- DaData: поиск организации по ИНН или названию
- Сохранение в `warehouse_legal_info` (upsert по `storage_name`)

---

## 11. Вкладка «Распределение» (admin.html)

Иерархия: **Дата вывоза → Склад → таблица товаров по клиентам**

### Кнопка GS (выгрузка в Google Sheets)

```
Кнопка GS → Edge Function sync-to-sheets (Deno)
          → RPC get_distrib_data()
          → Google Sheets API batchUpdate
          → Лист «Распределение» перезаписан (колонки A–L)
```

---

## 12. Карточка клиента — заявки на код (openRegReqModal)

До выдачи кода — имя кликабельно, открывает `cc-modal` с данными из `registration_requests`.

---

## 13. PIN-авторизация (admin.html)

- PIN хранится как SHA-256 хэш
- **Текущий PIN — 123456 (для теста). Сменить перед деплоем!**
- 5 неверных попыток → блокировка 60 сек (sessionStorage)

```javascript
crypto.subtle.digest('SHA-256', new TextEncoder().encode('ВАШИ_6_ЦИФР'))
  .then(b => console.log([...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,'0')).join('')))
```

---

## 14. Виджет мониторинга БД (сайдбар admin.html)

RPC: `admin_get_db_size()` и `admin_get_table_sizes()`. Прогресс-бар 500 МБ лимита Free плана.

---

## 15. Supabase MCP Connector — правила

| Правило | Описание |
|---------|----------|
| 1 — Только чтение без разрешения | НЕ выполнять INSERT/UPDATE/DELETE/DROP без явной фразы «выполни», «примени», «обнови в базе» |
| 2 — Показ SQL перед выполнением | Перед модифицирующей операцией показывать SQL и ждать подтверждения |
| 3 — Бэкап перед массовыми операциями | Напоминать: Supabase Dashboard → Database → Backups |
| 4 — SELECT свободен | SELECT, EXPLAIN, просмотр схемы — без подтверждения |

---

## 16. Дизайн-система (pochnorm2forcursor_v2.html)

### Цветовая схема

```css
--primary-color: #d32f2f;   /* красный */
--brand-color: #4285f4;     /* синий */
/* Акцент: #e7f708 (жёлтый), #23aeb8 (бирюзовый) */
```

Шрифты: `Manrope` (основной), `Syne` (заголовки).

### Кнопки фильтрации нижней панели

Шесть кнопок: Акции, Новинки, Поступления, Актуальное, Детское, Уценка.

**Принцип:** каждая кнопка содержит два SVG-слоя — `filter-icon-outline` (контур, чёрный) и `filter-icon-fill` (заливка, цветной). CSS-переключение через `.filter-btn.active`.

```css
.filter-btn .filter-icon-outline { display: block; }
.filter-btn .filter-icon-fill    { display: none; }
.filter-btn.active .filter-icon-outline { display: none; }
.filter-btn.active .filter-icon-fill    { display: block; }
```

**Цвета активных кнопок:**
- Акции → `#e07800` (оранжевый) + анимация пульсации на ярлыках карточек
- Новинки → `#1565c0` (синий)
- Поступления → `#1b5e20` (тёмно-зелёный)
- Актуальное → `#c62828` (красный)
- Детское → `#e91e8c` (розовый)
- Уценка → `#666` (серый)

**Ярлыки на карточках товаров:** те же SVG fill, хранятся в объекте `filterImages`. При рендеринге карточки добавляются через `data-filter-type="${icon.type}"` для CSS-анимации пульсации акций.

### Плавающие кнопки

| Кнопка | Иконка | Цвет |
|--------|--------|------|
| Профиль (FAB) | SVG (человек + шестерня) | `#e7f708` на чёрном `#0a0a0f` |
| Поиск | SVG (документ с лупой) | `#23aeb8` |
| Корзина | SVG корзины outline/fill | `#fc0328` |

Сумма корзины — слева от иконки, `font-weight: 800`, жёлтая кайма через `text-shadow`.

### Заголовки подгрупп в каталоге

`.subgroup-header` — 15px, weight 800, синий фон `#f0f4ff`, пульсирующая синяя кайма:

```css
animation: subgroup-pulse 2.2s ease-in-out infinite;
```

---

## 17. Панель профиля (pochnorm2forcursor_v2.html)

### Структура (сверху вниз)

1. **Шапка** — иконка профиля (SVG жёлтый на чёрном круге 64px), имя клиента
2. **Мои заказы** → открывает субпанель
3. **Данные клиента** (кнопка «Реквизиты и адрес») → открывает субпанель
4. **Поддержка** — номер менеджера +7 (924) 262-77-67 + кнопка копирования, кнопка «Задать вопрос»
5. **О приложении** — соглашение, версия
6. **Кнопка «Выйти»** в футере

### Субпанель «Мои заказы»

Трёхуровневая иерархия: **Месяц → День → Заказ → Позиции**.
Первый месяц раскрыт по умолчанию. Остальные свёрнуты.
Кнопка 📅 Календарь в заголовке — попап-календарь с отмеченными днями заказов.

**Загрузка:** RPC `get_client_orders(p_client_id)` → возвращает `{orders, items}` за один запрос.
Результат кешируется в `_ordersCache`. При открытии панели профиля кеш сбрасывается.

### Субпанель «Реквизиты и адрес»

Показывает данные из `client_codes` + `client_legal_info`:
тип, телефон, email, адрес доставки, документ, организация, ИНН, ОГРН, КПП, руководитель, юр. адрес.

**Загрузка:** RPC `get_client_profile(p_client_id)` → возвращает jsonb.

### Важно: RLS и code-клиенты

Code-клиент не аутентифицирован через Supabase Auth → `auth.uid() = null`.
Прямые запросы к `client_codes`, `client_legal_info`, `orders` через anon-ключ — **заблокированы RLS**.
Все данные в профиле загружаются **только через SECURITY DEFINER RPC**.

```javascript
// Правильно:
const { data } = await sb.rpc('get_client_orders', { p_client_id: codeSession.id });

// Неправильно (заблокирует RLS):
const { data } = await sb.from('orders').select('*').eq('user_id', codeSession.id);
```

---

## 18. Известные особенности и решённые проблемы

| Проблема | Решение |
|----------|---------|
| Заказы под чужим клиентом при одинаковом phone | get_code_draft и upsert_code_draft переведены на p_client_id (UUID) |
| storage=null в позициях после подтверждения | RPC confirm_code_order и upsert_code_draft делают lookup storage из products |
| Дублирование заказа на всех юрлицах с phone='не указан' | Матчинг ordersByPhone + уточнение по user_name |
| UNIQUE constraint на phone в client_codes | Удалён |
| PIN-кнопки не реагируют | Синтаксическая ошибка в JS блокировала весь скрипт |
| Панели отображаются во всех вкладках | Убран inline `style="display:flex"`, управление только через `.panel.active` |
| GS кнопка: CORS ошибка 500 | Edge Function — весь код в одном try/catch с CORS в respond() |
| GS кнопка: Failed to decode base64 | `UPDATE app_secrets SET value = replace(value, '\n', chr(10)) WHERE key = 'gs_private_key'` |
| Кнопки фильтров нижней панели не работали | `document.querySelector('.filter-buttons').addEventListener` заменён на `document.addEventListener` с делегированием |
| Профиль: бесконечная загрузка «Мои заказы» | `window.openOrdersModal()` не была определена. Заменена на `_profileLoadOrders()` через RPC |
| Профиль: «Данные не заполнены» | Прямые запросы к client_codes/client_legal_info блокировались RLS. Заменены на RPC get_client_profile (SECURITY DEFINER) |
| Профиль: субпанель не открывалась поверх | `style="position:relative"` на .profile-subpanel перебивал CSS `position:absolute;inset:0` |
| 2GIS ключ истекал 2026-04-10 | ⚠ Проверить актуальность |
| products.storage — случайные данные | ⚠ Заполнить реальными |
| PIN = 123456 (тест) | ⚠ Сменить перед деплоем |

---

## 19. Алгоритм работы в Claude Projects

### Шаг 1 — Начало каждой сессии

Открывайте новый чат ВНУТРИ проекта. Первое сообщение:
```
Работаем над B2B Wholesale App. Задача: [что нужно сделать].
Актуальный файл прилагаю: [прикрепить HTML]
```

**Файлы из предыдущих сессий недоступны** — прикрепляйте актуальный HTML к каждому новому чату.

### Шаг 2 — Принцип: одна задача = один чат

| Задача | Отдельный чат? |
|--------|----------------|
| Добавить RPC функцию | ✅ Да |
| Починить конкретный баг | ✅ Да |
| Несколько несвязанных правок | ❌ Разбить |

### Шаг 3 — После получения файла

- Сразу скачайте и сохраните локально
- Старые версии храните с датой: `pochnorm_20260403.html`
- Следующая задача — новый чат

### Шаг 4 — Работа с Supabase MCP

Claude имеет прямой доступ к Supabase через MCP-коннектор.
Для диагностики проблем с данными — просите проверить через SQL, не добавляя файлы.
Для изменений схемы — использовать `apply_migration`, для чтения — `execute_sql`.

*Документ обновлён 3 апреля 2026 г. • B2B Wholesale App*
