# ONLINE-ОПТОВИК — B2B Wholesale Platform

B2B оптовая платформа. Vanilla JS, Vite, Supabase (PostgreSQL + Auth + Edge Functions).

## Docs
- **B2B_Wholesale_Project_Instructions_v7.md** — схема БД, RPC, авторизация, дизайн-система
- **Online_Optovik_Concept_v1.docx** — исходный концепт
- **claude-arhiv.md** — полная версия старого CLAUDE.md (структура файлов, Phase 2 план, исправленные баги)

## Commands
- `npm run dev` — dev (http://localhost:5173)
- `npm run build` — production
- `npm run preview` — preview build

## Key conventions
- `@shared` alias → `shared/` (vite.config.js). ES modules only
- Supabase: `import { sb } from '@shared/lib/supabase.js'`
- Auth: email/password (sb.auth) + код доступа 5 цифр (_codeSession в localStorage) + гостевой
- Cart: localStorage + автосохранение draft в Supabase (RPC `upsert_code_draft`)
- Products hierarchy: group → subgroup → tag → brand
- Filters: promo, new, arrival, actual, child, discount
- Product ID prefix: `oof` = food, `ooh` = non-food
- Monoliths are the source of truth when migrating phases

## Migration status
| Phase | What | Status |
|-------|------|--------|
| 1 | Client (pochnorm2forcursor_v2.html → client/) | ✅ Done |
| 2 | Admin (admin.html → admin/) | ⬜ Next |
| 3 | Order editor (order-editor.html → order-editor/) | ⬜ |
| 4 | Logistics (admin-logistik.html → logistics/) | ⬜ |
| 5 | Git + deploy | ⬜ |

## Rules
- **НЕ менять Supabase** (таблицы, RPC, RLS) — только фронтенд
- Монолиты читать точечно (offset+limit), не целиком
- При миграции — точное соответствие монолиту (DOM, CSS-классы, логика)
- Высказывать сомнения, дискутировать, не домысливать
- Экономить токены: минимум слов, максимум действий, не пересказывать что сделано
