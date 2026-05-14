# AGENTS.md — Avatio

Compact instruction for OpenCode sessions. If a fact is obvious from filenames, it is omitted.

---

## Package manager & runtime

- **Package manager:** `bun`. `bunfig.toml` uses `linker = "hoisted"`.
- **Node:** 24.x required.
- **Postinstall is mandatory:** `bun run postinstall` builds workspace packages (`@avatio/bot-notifier`, `@avatio/ungh`) **before** `nuxt prepare`. Run it after any install.

## Developer commands

| Task                               | Command                    |
| ---------------------------------- | -------------------------- |
| Dev server                         | `bun run dev`              |
| Build                              | `bun run build`            |
| Typecheck                          | `bun run typecheck`        |
| Lint                               | `bun run lint`             |
| Fix lint                           | `bun run lint:fix`         |
| Format                             | `bun run fmt`              |
| Check formatting                   | `bun run fmt:check`        |
| Run all tests                      | `bun run test`             |
| Unit tests only                    | `bun run test:unit`        |
| Nuxt tests only                    | `bun run test:nuxt`        |
| Watch tests                        | `bun run test:watch`       |
| Generate Drizzle migrations        | `bun run drizzle:generate` |
| Bump version + commit + tag + push | `bun run release`          |

## After making changes

Run **`bun run typecheck`** and **`bun run lint`** to verify there are no errors before finishing.

## Project architecture

- **Framework:** Nuxt 4 (`compatibilityVersion: 5`).
- **Deployment target:** Vercel (`nitro.preset: 'vercel'`).
- **Structure:**
  - `app/` — Vue frontend (pages, layouts, composables, components).
  - `server/` — Nitro API routes and server middleware.
  - `database/schema.ts` — Drizzle ORM schema (PostgreSQL via Neon).
  - `shared/` — Utilities shared between client and server.
  - `content/` — `@nuxt/content` pages, split by `en/` and `ja/`.
  - `packages/` — Workspace libraries (`bot-notifier`, `ungh`). Built with `tsdown`.

## Tooling constraints

- `oxfmt` handles all formatting automatically; do not manually adjust indentation, quotes, or semicolons.
- `oxlint` and TypeScript enforce the remaining style rules (`no-explicit-any`, `consistent-type-imports`, `noUncheckedIndexedAccess`, etc.).
- Vue Options API is disabled (`vite.vue.features.optionsAPI: false`).

## Testing

- **Runner:** Vitest, configured in `vitest.config.ts`.
- Unit tests live in `test/unit/*.{test,spec}.ts`.
- `test/setup.ts` polyfills:
  - `globalThis.$fetch` (from `ofetch`)
  - `globalThis.defineCachedFunction` (bypasses caching in tests)
- Test env is loaded from `.env` via `loadEnv('test', ...)`.

## Database (Drizzle)

- **Dialect:** PostgreSQL (Neon).
- Schema file: `database/schema.ts`.
- Config: `drizzle.config.ts`.
- Migration output: `./drizzle`.
- Schema namespaces: `public`, `user`, `feedback`, `admin`.
- Naming convention: `snakeCase` (Drizzle `snakeCase` helper is used).
- Do not edit generated migration SQL by hand; regenerate with `bun run drizzle:generate`.

## Auth

- Uses **Better Auth** with Drizzle adapter (`@better-auth/drizzle-adapter`).
- Auth tables live in the `user` schema (`users`, `sessions`, `accounts`, `verifications`, etc.).

## Deployment & infra quirks

- **Vercel Edge Config** drives a maintenance mode middleware (`middleware.ts` at repo root, not Nuxt middleware). Key: `isMaintenance`.
- **Vercel crons** (configured in `vercel.ts`):
  - `/api/admin/job/report` — daily at 22:00
  - `/api/admin/job/cleanup` — daily at 22:00
- **Images:** served through `@nuxt/image`. Allowed external domains are whitelisted in `nuxt.config.ts` (Booth, GitHub, Tigris).
- **Storage:** Tigris (S3-compatible) for user-uploaded images.
- **PWA:** `@vite-pwa/nuxt` is enabled; `sw.js` and `manifest.webmanifest` are served with `must-revalidate`.

## i18n

- Default locale: `ja`. Secondary: `en`.
- Locale files: `i18n/locales/*.json`.
- Route rules in `nuxt.config.ts` are **auto-localized** for every locale in `availableI18nLocales`. If you add a new locale, existing route rules (redirects, middleware, ISR, etc.) are cloned under that prefix automatically.

## Version bumping

`bump.config.ts` bumps `package.json` **and** `app/app.config.ts` together. Keep the version in `app/app.config.ts` in sync with `package.json`; `bun run release` handles it.

## Server conventions

### API handlers

Wrap every API handler with the appropriate factory from `server/utils/eventHandler.ts`:

- `promiseEventHandler` — no auth required
- `sessionEventHandler` — session available but optional (null-safe)
- `authedSessionEventHandler` — login required (throws 401 if unauthenticated)
- `adminSessionEventHandler` — admin only (throws 403)
- `cronEventHandler` — cron jobs or admin

### Database queries

- Prefer Drizzle ORM query builder (`db.query.*`, `db.select()`, `db.insert()`, etc.) over raw `sql` template literals. Use `sql` only when the query builder cannot express the logic.
- For multi-statement writes, wrap in `db.transaction(async (tx) => { ... })` and use `tx.*` (not `db.*`) for all operations inside the callback.
- Group independent parallel inserts inside a transaction with `Promise.all([...].filter(Boolean))`.

## Security

- Validate all API inputs with a Zod schema and the appropriate helper from `server/utils/validateRequest.ts`:
  - `validateQuery(schema)` — query parameters
  - `validateParams(schema)` — URL path parameters
  - `validateBody(schema)` — request body
  - `validateFormData(schema)` — form data
- For POST/PUT endpoints that accept user-supplied text, use `validateBody(schema, { sanitize: true })` to enable XSS sanitization.

## Logging

- Use `logger` from `server/utils/logger.ts` for all server-side logging. Do not use `console.log/error/warn` directly in server code.
- Declare a module-level constant: `const log = logger('tag')`, then call `log.info()`, `log.error()`, `log.warn()`.
- Tag naming — two accepted patterns (use whichever fits the context):
  - Route path style: `'/api/images:POST'`, `'/api/users/[username]:PUT'`
  - Function name style: `'createNotification'`, `'getItem'`
- Client-side `console.*` output should be in English.

## Auto-imports & icons

- Nuxt 4 uses auto-importing. Elements exported in the following directories do not need to be explicitly imported:
  - `app/composables`
  - `app/components`
  - `app/utils`
  - `shared/types`
  - `shared/utils`
  - Specific Nuxt modules
- To use an icon in Vue, use the `<Icon>` component:
  - `name="mingcute:arrow-right-line"`
  - `size="18"`

## Common mistakes to avoid

- Do not assume `process.env` in `nuxt.config.ts`; the config uses `import.meta.env` for runtime config defaults.
- Do not skip `bun run postinstall` after adding packages; workspace packages must be built before Nuxt prepare succeeds.
- Do not use Vue Options API (disabled in Vite config).
- Admin pages live under `app/pages/admin/` and use the `dashboard` layout + `admin` middleware (configured in route rules, not per-page).

## Documentation maintenance

If your changes affect project structure, developer commands, deployment logic, or any topic covered in `AGENTS.md` or `README.md`, propose updating those documents as part of your change.
