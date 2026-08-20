# AGENTS.md — Avatio

Compact instruction for OpenCode sessions. If a fact is obvious from filenames, it is omitted.

---

## Package manager & runtime

- **Package manager:** `bun`. `bunfig.toml` uses `linker = "hoisted"`.
- **Postinstall:** `bun run postinstall` runs `nuxt prepare` only.

## Developer commands

| Task                               | Command                                         |
| ---------------------------------- | ----------------------------------------------- |
| Dev server                         | `bun run dev`                                   |
| Build                              | `bun run build`                                 |
| Typecheck                          | `bun run typecheck`                             |
| Lint                               | `bun run lint`                                  |
| Fix lint                           | `bun run lint:fix`                              |
| Format                             | `bun run fmt`                                   |
| Check formatting                   | `bun run fmt:check`                             |
| Run all tests                      | `bun run test`                                  |
| Unit tests only                    | `bun run test:unit`                             |
| Nuxt tests only                    | `bun run test:nuxt`                             |
| Watch tests                        | `bun run test:watch`                            |
| Generate Drizzle migrations        | `bun run db:generate`                           |
| Apply local D1 migrations          | `bun run db:migrate:local`                      |
| Apply remote D1 migrations         | `bun run db:migrate:remote`                     |
| Deploy after remote migrations     | `bun run deploy`                                |
| Upload Workers Builds preview      | `bun run deploy:preview`                        |
| Generate Better Auth schema        | `bunx auth@rc generate --config auth.config.ts` |
| Bump version + commit + tag + push | `bun run release`                               |

## After making changes

Run **`bun run typecheck`** and **`bun run lint`** to verify there are no errors before finishing.
For deployment-related changes, also run **`bun run build`**. In this repo, the production build is expected to complete successfully even though Nuxt/Rolldown may still print non-fatal warnings during the build; treat the command exit code as the source of truth.

## Project architecture

- **Framework:** Nuxt 4 (`compatibilityVersion: 5`).
- **Deployment target:** Cloudflare Workers (`nitro.preset: 'cloudflare-module'`).
- **Structure:**
  - `app/` — Vue frontend (pages, layouts, composables, components).
  - `server/` — Nitro API routes and server middleware.
  - `database/schema.ts` — Drizzle ORM schema (SQLite via Cloudflare D1).
  - `shared/` — Utilities shared between client and server.
  - `content/` — `@nuxt/content` pages, split by `en/` and `ja/`.

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

- **Dialect:** SQLite (Cloudflare D1), bound as `APP_DB`.
- Schema file: `database/schema.ts`.
- Config: `drizzle.config.ts`.
- Migration output: `./drizzle`.
- Naming convention: `snakeCase` (Drizzle `snakeCase` helper is used).
- Migrations use Drizzle v1 nested output under `./drizzle`.
- Do not edit generated migration SQL by hand; regenerate with `bun run db:generate`.
- `bun run dev` applies local migrations before starting Nuxt and persists SQLite data under `.wrangler/state`.

## Auth

- Uses **Better Auth** with Drizzle adapter (`@better-auth/drizzle-adapter`).
- Better Auth uses its SQLite provider; auth tables share the D1 database with app tables.

## Deployment & infra quirks

- **Cloudflare KV HTTP** drives app flags and maintenance mode (`server/middleware/maintenance.ts`). Key: `isMaintenance`.
- Root `wrangler.jsonc` is the minimal D1 CLI config. Nuxt generates `.output/server/wrangler.json` for Worker deploys; do not use the generated file for pre-build D1 migrations.
- Workers Builds runs `bun run deploy:preview` for non-production branches; only `development` applies remote D1 migrations before uploading its preview version.
- **Workers Cron Triggers**:
  - `/api/admin/job/report` — daily at 22:00
  - `/api/admin/job/cleanup` — manual/admin only
- **Images:** served through `@nuxt/image`. Allowed external domains are whitelisted in `nuxt.config.ts` (Booth, GitHub, R2 public domain).
- **Storage:** Cloudflare R2 through `files-sdk/r2` for user-uploaded images. Workers use the `R2` binding; local environments fall back to HTTP mode.
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
- D1 does not expose Drizzle callback transactions. Build all required statements first and pass them in order to `executeD1Batch(db, queries)` so the batch commits or rolls back atomically.
- Generate parent and child IDs in the application before a batch when later statements need those IDs.

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

- Do not use Vue Options API (disabled in Vite config).
- Admin pages live under `app/pages/admin/` and use the `dashboard` layout + `admin` middleware (configured in route rules, not per-page).

## Documentation maintenance

If your changes affect project structure, developer commands, deployment logic, or any topic covered in `AGENTS.md` or `README.md`, propose updating those documents as part of your change.
