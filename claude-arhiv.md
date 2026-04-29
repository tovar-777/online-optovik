# ONLINE-ОПТОВИК — B2B Wholesale Platform

## Обзор проекта
B2B оптовая платформа для заказа товаров. Vanilla JS (без фреймворков), Vite, Supabase (PostgreSQL + Auth + Edge Functions).

## Документация
- **B2B_Wholesale_Project_Instructions_v7.md** — главный справочник: схема БД, все RPC, авторизация, PIN, вкладки админки, дизайн-система, известные баги. Читать точечно (offset+limit) когда нужны детали по конкретной теме.
- **Online_Optovik_Concept_v1.docx** — исходный концепт/ТЗ проекта (Word).

## Структура

```
├── client/              # Клиентское приложение (Phase 1 — ГОТОВО, баги фиксятся)
│   ├── index.html       # HTML-шаблоны (splash, auth, profile, catalog, modals)
│   ├── main.js          # Точка входа, инициализация, wiring
│   ├── components/      # UI-модули
│   │   ├── AuthModal.js       # Авторизация (code + email + guest)
│   │   ├── Catalog.js         # Каталог товаров (фильтры, группировка, рендер)
│   │   ├── OrderModal.js      # Оформление заказа, доставка
│   │   ├── ProfilePanel.js    # Профиль (заказы, реквизиты, адреса, DaData)
│   │   ├── Registration.js    # Многошаговая регистрация (физлицо/юрлицо)
│   │   └── Splash.js          # Splash-экран с прогрессом загрузки
│   ├── state/
│   │   └── cart.js            # Состояние корзины, localStorage, автосохранение draft
│   └── styles/                # CSS (splash, catalog, cart, auth, profile, modals)
│
├── admin/               # Админ-панель (НЕ МИГРИРОВАНО — Phase 2)
│   ├── index.html       # Заглушка
│   ├── main.js          # Заглушка
│   ├── services/        # Пусто
│   ├── styles/          # Пусто
│   └── tabs/            # Пусто
│
├── order-editor/        # Редактор заказов (НЕ МИГРИРОВАНО — Phase 3)
├── logistics/           # Логистика + 2GIS карта (НЕ МИГРИРОВАНО — Phase 4)
│
├── shared/              # Переиспользуемый код (ГОТОВО)
│   ├── lib/
│   │   ├── supabase.js        # sb, sbAnon, sbAdmin — клиенты Supabase
│   │   ├── dadata.js          # DaData API (адреса, организации, ИНН)
│   │   └── utils.js           # escHtml, formatPrice, formatTimeAgo, $, $0
│   ├── services/
│   │   ├── auth.js            # signUp, signIn, signOut, getCodeSession, getClientProfile
│   │   ├── products.js        # loadAllProducts({batchSize, onProgress})
│   │   ├── orders.js          # saveDraft, restoreCodeDraft/EmailDraft, confirmOrder
│   │   ├── clients.js         # checkDuplicate, checkInnExists, submitRegistration
│   │   └── delivery.js        # getNextDates, lookupDeliveryByCity, getClientDirections
│   └── styles/
│       ├── variables.css      # CSS-переменные
│       └── base.css           # Базовые стили
│
├── supabase/            # Supabase конфигурация
├── vite.config.js       # 4 entry points: client, admin, editor, logistics
├── package.json         # Vite 8, @supabase/supabase-js
│
├── pochnorm2forcursor_v2.html  # МОНОЛИТ: клиент (~11000 строк) — эталон для Phase 1
├── admin.html                  # МОНОЛИТ: админка (~4645 строк) — источник Phase 2
├── order-editor.html           # МОНОЛИТ: редактор (~5983 строк) — источник Phase 3
└── admin-logistik.html         # МОНОЛИТ: логистика (~2574 строк) — источник Phase 4
```

## Ключевые соглашения

### Импорты
- `@shared` alias → `shared/` (настроен в vite.config.js)
- Всегда ES modules (`import`/`export`), никогда `require()`
- Supabase-клиент: `import { sb } from '@shared/lib/supabase.js'`

### Авторизация (двойная система)
- **Email/password** — через Supabase Auth (`sb.auth`)
- **Код доступа** (5 цифр) — кастомная система, сессия в localStorage как `_codeSession`
- **Гостевой режим** — ограниченный доступ без авторизации
- Профиль клиента: RPC `get_client_profile_by_user_id` / `get_client_by_code`

### Корзина
- Хранится в localStorage (ключ зависит от типа авторизации)
- Автосохранение draft в Supabase каждые 5 сек (RPC `upsert_code_draft`)
- Восстановление draft при входе

### DaData
- API-ключ: `window._DADATA_KEY` (из .env → VITE_DADATA_KEY)
- Общий модуль: `shared/lib/dadata.js` — для организаций и адресов
- ProfilePanel.js использует собственную реализацию DaData (каскадный выбор с FIAS ID)

### Window-глобалы
- Функции, вызываемые из inline onclick в HTML, экспонируются через `window.xxx` в main.js
- Полный список: doLogout, openProfilePanel, closeProfilePanel, updateCart, clearCart, showOrderInfoModal, copyOrderToClipboard, renderProducts, toggleGroupFilter, formatPrice, positionFloatingButtons, initApp, _guestExit, _showGuestConfirm, _hideGuestConfirm, _calNav, _profileSelectAddr, _profileDelAddr, checkAndRestoreCodeDraft, checkAndRestoreDraft

### Товары
- Иерархия: group → subgroup → tag → brand
- Горизонтальные lanes (scroll-контейнеры) внутри тегов
- Фильтры: 6 кнопок (promo, new, arrival, actual, child, discount) + группы + бренды + поиск

### Видимость UI
- `#app-content` — скрыт по умолчанию (`display:none`), показывается через класс `.visible`
- `#splash-screen` — скрывается классами `.exit` + `.hidden` (анимация) или `style.display='none'` (гостевой)
- `.my-orders-fab` — показывается через класс `.visible` при восстановлении сессии (code/email)

## Статус миграции

| Фаза | Описание | Статус |
|------|----------|--------|
| Phase 1 | Клиент (pochnorm2forcursor_v2.html → client/) | ✅ ГОТОВО (bugfix в процессе) |
| Phase 2 | Админка (admin.html → admin/) | ⬜ Следующая |
| Phase 3 | Редактор заказов (order-editor.html → order-editor/) | ⬜ |
| Phase 4 | Логистика (admin-logistik.html → logistics/) | ⬜ |
| Phase 5 | Git init + деплой | ⬜ |

## Phase 1: Исправленные баги (после миграции)
- Кнопка "Все" в группах — убрана (не было в монолите)
- `<button>` → `<div>` для групп, подгрупп, брендов (CSS ожидает div)
- Auto-select первой группы при загрузке
- toggleGroupFilter — убрана toggle-логика (selectedGroup = group, не null)
- createSubgroupsFilter — guard `if (!selectedGroup) return`, вызов из createGroupsFilter
- Панель брендов — правильный ID `main-brands-filter`, кнопка "Все бренды", CSS-классы `brand-item`/`brand-counter`
- updateFilterButtons — интеграция с checkFilterAvailability (disabled для недоступных фильтров)
- scrollToBrand(brand, tag) — полная логика прокрутки внутри tag-section
- Поиск — обработчики search-toggle-btn, global-search-open-btn добавлены в initCatalogListeners
- `#app-content` CSS — `display:none` + `.visible` (не было в CSS-файлах)
- Гостевой/edit mode — classList.add('visible') вместо inline style
- Выход из гостевого — classList.remove('visible') + сброс splash inline style
- FAB профиля — classList.add('visible') при восстановлении code/email сессии

## Phase 2: Админка (admin.html → admin/)

### Что внутри admin.html (~4645 строк)
- PIN-авторизация (SHA-256, блокировка после 5 попыток на 60 сек)
- 7 вкладок: Клиент-заказ, Заказы-дата, Склады, Распределение, Коды доступа, Заявки на код, Вопросы
- Inline CSS ~1500 строк
- Google Sheets выгрузка через Edge Function

### Целевая структура admin/
```
admin/
├── index.html          # HTML (вкладки, модалки, PIN-форма)
├── main.js             # Точка входа, переключение вкладок
├── auth.js             # PIN-авторизация
├── services/
│   ├── admin-orders.js
│   ├── admin-clients.js
│   ├── admin-codes.js
│   ├── admin-warehouses.js
│   ├── admin-distrib.js
│   └── admin-questions.js
├── tabs/
│   ├── ClientOrders.js
│   ├── OrdersByDate.js
│   ├── Warehouses.js
│   ├── Distribution.js
│   ├── AccessCodes.js
│   ├── CodeRequests.js
│   └── Questions.js
└── styles/
    └── admin.css
```

## Команды
- `npm run dev` — dev-сервер (http://localhost:5173)
- `npm run build` — production build
- `npm run preview` — preview production build

## Правила работы (технические)
- **НЕ менять структуру Supabase** (таблицы, RPC, RLS) — только фронтенд
- Читать монолиты точечно (offset + limit), не целиком
- Создавать файлы пакетами, проверять билд один раз в конце
- Без промежуточных отчётов — работать молча до завершения фазы
- При извлечении кода из монолита — **точное соответствие** оригиналу (DOM-структура, CSS-классы, логика). Не "улучшать" и не "оптимизировать"
- Эталон для сравнения — монолит pochnorm2forcursor_v2.html. При расхождениях — монолит прав

## Правила взаимодействия
- **Высказывать сомнения.** Если есть неуверенность в подходе — проговаривать, предлагать альтернативы, не соглашаться молча
- **Дискутировать.** Давать рекомендации, аргументировать своё мнение, но не навязывать — финальное решение за пользователем
- **Не домысливать.** Если задача неоднозначна — спросить, а не угадывать
- **Экономить токены.** Минимум слов, максимум действий. Не пересказывать что сделано — diff видно в файлах

## Известные проблемы (Phase 1)
- Картинки (s3.twcstorage.ru) — HTTP/2 отказывает при массовой загрузке. Не баг приложения
- Password field not in form — предупреждение Chrome, косметика
- Поиск в гостевом режиме — может не работать (расследуется)
