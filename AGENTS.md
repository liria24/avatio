# AGENTS.md — Avatio

Compact instruction for OpenCode sessions. If a fact is obvious from filenames, it is omitted.

---

## Package manager & runtime

- **Package manager:** `bun`. `bunfig.toml` uses `linker = "hoisted"`.
- **Postinstall:** `bun run postinstall` runs `nuxt prepare` only.
- **Development URL:** `bun run dev` serves the Alchemy local proxy at `http://localhost:3000`; the port is fixed and fails if already in use.

## Developer commands

| Task                        | Command                                         |
| --------------------------- | ----------------------------------------------- |
| Dev server                  | `bun run dev`                                   |
| Build                       | `bun run build`                                 |
| Typecheck                   | `bun run typecheck`                             |
| Lint                        | `bun run lint`                                  |
| Fix lint                    | `bun run lint:fix`                              |
| Format                      | `bun run fmt`                                   |
| Check formatting            | `bun run fmt:check`                             |
| Run all tests               | `bun run test`                                  |
| Unit tests only             | `bun run test:unit`                             |
| Nuxt tests only             | `bun run test:nuxt`                             |
| Watch tests                 | `bun run test:watch`                            |
| Generate Drizzle migrations | `bun run db:generate`                           |
| Development Alchemy plan    | `bun run plan:development`                      |
| Production Alchemy plan     | `bun run plan:production`                       |
| Development deploy          | `bun run deploy:development`                    |
| Production deploy           | `bun run deploy:production`                     |
| Generate Better Auth schema | `bunx auth@rc generate --config auth.config.ts` |

## After making changes

Run **`bun run typecheck`** and **`bun run lint`** to verify there are no errors before finishing.
For deployment-related changes, also run **`bun run build`**. In this repo, the production build is expected to complete successfully even though Nuxt/Rolldown may still print non-fatal warnings during the build; treat the command exit code as the source of truth.

## Project architecture

- **Framework:** Nuxt 4 (`compatibilityVersion: 5`).
- **Deployment target:** Cloudflare Workers, built and deployed by `Cloudflare.Website.Nuxt` in `alchemy.run.ts`.
- **Workspace:** Bun workspaces under `packages/*` with exactly three architectural packages:
  - `@avatio/core` — pure domain, application ports, and explicit contracts. It must not import Nuxt, Nitro, Cloudflare, Drizzle, Better Auth, provider SDKs, or read `process.env`.
  - `@avatio/nuxt` — Nuxt integration, content/routing build hooks, and catalog provider adapters. It may depend on core but never on `@avatio/cloudflare`.
  - `@avatio/cloudflare` — D1/Drizzle, Queue, cache, Flagship, R2, Workers AI, and binding adapters. It may depend on core.
- The root application is the composition root. Do not add a fourth package without concrete implementation evidence.
- **Structure:**
  - `app/` — Vue frontend (pages, layouts, composables, components).
  - `server/` — Nitro API routes and server middleware.
  - `database/schema.ts` — Drizzle ORM schema (SQLite via Cloudflare D1).
  - `shared/` — Utilities shared between client and server.
  - `content/` — canonical Markdown sources, split by `en/` and `ja/`. `@avatio/nuxt` parses them with Comark at build time; Nuxt Content is intentionally not active.

## Architecture boundaries

- Abstract at repositories and semantic capabilities, not through generic database/cloud/ORM wrappers.
- Setup domain code references CatalogItem IDs and must not branch on BOOTH, GitHub, or other providers.
- Cloudflare bindings and `event.context.cloudflare` stay in infrastructure/composition code.
- Database schema types are not client/API contracts; use explicit core or shared HTTP contracts.
- Root `types.d.ts` is intentionally absent. Do not re-add a root declaration that imports server or Alchemy types into app/shared type programs.
- CatalogItem IDs are Avatio-owned and provider-independent. Provider keys remain strings with `UNIQUE(provider_key, external_id)` source identity.
- Source availability (`available`/`withdrawn`/`policy_rejected`/`unknown`) and sync state (`fresh`/`stale`/`syncing`/`error`) are independent. Transient provider failures never mean withdrawal.
- Effective category is resolved only through `SetupEntry override > CatalogItem override > primary source mapping > other`.
- Catalog refresh is demand-driven. D1 source leases prevent duplicate v2 Queue messages; cold sources are never refreshed by a global schedule.
- Queue v2 messages contain only a source ID. The old message decoder is temporary rollout compatibility and must not regain Setup-domain lookups.
- Public Setup responses are cookie-independent and resource-tagged; viewer/private responses are `no-store`. D1 remains authoritative when caching or invalidation fails.
- Nitro Storage currently has no mounts. Never restore one for catalog truth, leases, flags, Setup data, or other system-of-record state.
- AI routes and use cases use semantic capabilities. Concrete per-task model IDs live only in typed stage composition.

## V2 migration rollout (temporary)

This section is an operator-gated migration runbook, not permanent architecture documentation. Automated coding sessions may prepare plans, code, migrations, and tests, but must not deploy production or invoke the catalog migration `apply` mode without explicit operator authorization.

Delete this entire rollout section from `AGENTS.md` once production verification reports zero pending rows, the retained Queue has drained, the freshness and rollback observation windows have closed, and the separate contract migration has removed the resolved legacy paths. Do not retain completed migration history here. If an unrelated deferral is still active at that point, move only that invariant to its owning section before deleting this one.

### Compatibility ledger

The following compatibility is temporary. Do not add new consumers to it.

- **Legacy Catalog/Setup schema:** `items`, `shops`, `item_category_overrides`, `setup_items`, `setup_item_shapekeys`, `user_shops`, and `user_shop_verifications` remain during expand/backfill/switch. They cannot be contracted yet because Setup list/search/bookmark APIs, item/admin APIs, publisher verification/profile reads, and item reports still use them. In particular, migrate `item_reports.item_id` from provider external IDs to CatalogItem IDs before dropping `items`.
- **Setup fallback and dual-write:** Setup detail reads use v2 only when every legacy relation has a matching SetupEntry; commands write both relation sets. Remove the fallback and legacy writes after production backfill verifies with zero pending rows and the rollback window closes. Do not prolong dual-write for convenience.
- **Catalog bridge:** legacy `getItem()` currently writes v2 through `catalogCompatibilityWrites`, while v2 sync mirrors snapshots back to legacy tables. The target is one authoritative v2 write path, with at most a temporary one-way v2-to-legacy mirror for rollback. Migrate item resolution/search/admin, AI enrichment, publisher verification, and reports before deleting the old resolver and bridge.
- **Legacy HTTP DTO:** `Platform`, `Item`, `Shop`, `SetupItem`, and the v2-to-legacy Setup projection remain because the bundled frontend consumes the old shape. Migrate the frontend to provider-neutral CatalogItem/SetupEntry contracts, verify whether production traffic has external API consumers, then delete the projection and `extractItemId` adapter together.
- **Queue decoder:** accept old `{ id, platform, reason }` messages only until the retained physical queue is confirmed drained. If changed before then, translate the old identity to an ItemSource and use v2 sync; do not restore old Setup lookups or add old-message producers.
- **Backfill tooling:** keep `POST /api/admin/catalog/migration` and its legacy mapping utilities through dry-run/apply/verify and production verification. Remove the endpoint and one-shot migration code in the later contract change.
- **Runtime configuration bridge:** `getRuntimeEnv*` remains only at root composition/infrastructure boundaries. Replace string-key call sites with typed semantic settings as integrations are migrated; do not introduce new `NUXT_*` aliases for canonical application values.
- **Retained unbound resources:** Content D1 and legacy cache KV declarations are data-safety placeholders, not runtime compatibility. Remove or adopt them only through an explicitly approved infrastructure plan.

### Production sequence

1. Run the full test/type/lint/format/build matrix and both stage config checks.
2. Review the production Alchemy plan and confirm retained D1, R2, KV, Queue, and Flagship resources are not being replaced.
3. Deploy development and verify content, Setup routes, OAuth/session behavior, request-time D1 resolution, preview-origin rejection, Queue consumption, and cache tags.
4. As an authenticated admin, call `POST /api/admin/catalog/migration` with `{ "mode": "dry-run" }`. Resolve every error. Nonstandard historical Setup ID warnings require route preflight, never ID rewriting.
5. Obtain explicit production authorization, then deploy the expand-compatible application and generated migration.
6. Call the same endpoint with `{ "mode": "apply" }`. The backfill is resumable/idempotent and preserves legacy IDs and relations.
7. Call it with `{ "mode": "verify" }`; require `verified: true` and zero pending rows.
8. Exercise BOOTH, GitHub, legacy `outdated=true`, publisher verification, notes, categories, shapekeys, private/hidden owner reads, and withdrawal/restoration behavior against production-like data.
9. Observe at least one freshness window and verify v2 Queue messages, lease expiry/release, and item-tag cache invalidation.
10. After the rollback window closes and the retained Queue drains, generate a separate contract migration that removes legacy tables/fields, dual writes, migration tooling, and the old Queue decoder.

## Environment and secrets

- The canonical path is `.env.<stage>` ciphertext -> dotenvx -> shared validation -> Alchemy -> Worker bindings. Do not maintain parallel secret inventories.
- Non-secret stage configuration is typed in `config/environment.ts`.
- Canonical secret definitions and validation live in `config/secrets.ts`.
- `.env.development` and `.env.production` contain committed dotenvx ciphertext. `.env.keys` contains local private keys and must never be committed.
- Use `bun run config:check:development` or `bun run config:check:production` before plans/deploys. Stage selection is explicit and fails closed.
- Production and development use the same application-facing secret names. In particular, use `BETTER_AUTH_SECRET`; do not restore `BETTER_AUTH_SECRET_DEVELOPMENT`.
- Workers Builds directly retains only `DOTENV_PRIVATE_KEY_PRODUCTION`, `DOTENV_PRIVATE_KEY_DEVELOPMENT`, and required provider deployment/bootstrap credentials. `scripts/stage.ts` selects exactly one stage file. `NUXT_BETTER_AUTH_SECRET` is derived from canonical `BETTER_AUTH_SECRET`, never managed separately.
- Do not print decrypted values or expose secrets through public runtime config, app config, client payloads, logs, snapshots, or generated artifacts.
- `process.env` access is limited to build/deploy/config tooling and unavoidable root composition. Domain/application code receives typed configuration or capabilities.

### Local configuration

1. Obtain the managed development dotenv private key.
2. Store it only in gitignored `.env.keys` using dotenvx's standard key format.
3. Run `bun run config:check:development`; failures must report names/reasons only.
4. Run `bun run dev`, which uses the same canonical development names and Alchemy resources as deployment.

### Secret rotation

- For an externally issued secret, obtain the replacement, update only the intended encrypted `.env.<stage>` value through dotenvx, run config check and Alchemy plan, commit ciphertext, obtain deployment authorization, deploy/verify, then revoke the old credential.
- For Better Auth or another persistent signing key, first establish a multi-key/versioned compatibility plan and preserve sessions where practical. Never replace it with `Alchemy.Random` casually.
- Rotate dotenv encryption keys only through dotenvx's supported re-encryption workflow. Commit the resulting ciphertext/public-key changes together and keep managed offline backups of both private keys; `.env.keys` is not a backup.

### Dashboard parity and cleanup

Do not remove legacy Worker variables/secrets until the encrypted stage file is complete, config check passes, the Alchemy plan emits secret bindings, development and production-like workerd verification pass, and the production deployment is explicitly authorized and verified.

After cutover, remove manually mirrored runtime values for `BETTER_AUTH_SECRET`, obsolete `BETTER_AUTH_SECRET_DEVELOPMENT`, `BOOTH_PROXY_URL`, `TWITTER_CLIENT_SECRET`, `OG_IMAGE_SECRET`, `LIRIA_DISCORD_ENDPOINT`, and `LIRIA_DISCORD_ACCESS_TOKEN`, plus manual copies of Git-owned site/image URLs and sender address. Alchemy-owned resource IDs (`APP_DB`, R2, Queue, AI, Flagship, Images, Email, and rate limits) must not be reintroduced as application environment variables.

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
- `bun run dev` runs `alchemy dev --stage development`; Alchemy applies D1 migrations in its local workerd simulator.

## Auth

- `@nuxtjs/better-auth` owns Nuxt/Nitro routing, SSR hydration, client session state, and request session memoization.
- `server/auth.config.ts` is the sole runtime Better Auth configuration; `app/auth.config.ts` configures client plugins. Root `auth.config.ts` exists only for Better Auth CLI schema generation and must not be imported at runtime. Remove it only after the Nuxt module proves equivalent custom D1/Drizzle schema generation directly from `server/auth.config.ts`.
- Better Auth uses the relations-v2 Drizzle adapter with `usePlural: true`; keep `advanced.database.joins: false` until the relevant upstream fix is released and separately verified.
- Use `useUserSession()`/module client helpers in the app and `getRequestSession()`/`requireUserSession()` on the server. Do not recreate `useAuth()` or another session state machine.
- Protected APIs explicitly call `requireUserSession()`; route rules are navigation UX, not the API security boundary. Preserve banned-user policy independently from admin roles.
- Better Auth tables share `APP_DB`. Do not change auth schema/migrations merely to change Nuxt integration.
- Versioned terms acceptance remains deferred because legacy `lastAgreedToTerms` timestamps have no defensible legal-version mapping. Never fabricate one during auth cleanup.

## Deployment & infra quirks

- **Cloudflare Flagship** owns true operational flags such as `is-maintenance`; unavailable evaluation fails closed. Catalog admission/category configuration lives in D1. Explicit catalog revalidation uses `POST /api/admin/catalog/revalidate` rather than a global force-update flag.
- `alchemy.run.ts` is the only infrastructure, D1 migration, and Worker deployment entry point. Do not add a Wrangler config or direct Wrangler deployment script.
- The old Content D1 and Nitro-cache KV resources remain declared only to preserve retained production resources; neither is bound to the Worker. Do not destroy or repurpose them without explicit operator approval.
- Workers Builds uses an empty build command, `bun run deploy:production` on `main`, and `bun run deploy:development` for the `development` preview branch.
- **Workers Cron Triggers**:
  - `/api/admin/job/report` — daily at 22:00
  - `/api/admin/job/cleanup` — manual/admin only
- **Images:** served through `@nuxt/image`. Allowed external domains are whitelisted in `nuxt.config.ts` (Booth, GitHub, R2 public domain).
- **Storage:** Cloudflare R2 through `files-sdk/r2` for user-uploaded images. Workers use the native `R2` binding only; HTTP credentials and runtime Cloudflare tokens are intentionally unsupported.
- **files-sdk build compatibility:** Keep the direct dependencies `@aws-sdk/client-s3`, `@aws-sdk/lib-storage`, `@aws-sdk/s3-presigned-post`, and `@aws-sdk/s3-request-presigner`. A known files-sdk build defect requires them even though application code must not import or use AWS SDK/R2 HTTP signing. `bun run build` is the regression check.
- **PWA:** `@vite-pwa/nuxt` is enabled; `sw.js` and `manifest.webmanifest` are served with `must-revalidate`.

## i18n

- Default locale: `ja`. Secondary: `en`.
- Locale files: `i18n/locales/*.json`.
- Route rules in `nuxt.config.ts` are **auto-localized** for every locale in `availableI18nLocales`. If you add a new locale, existing route rules (redirects, middleware, ISR, etc.) are cloned under that prefix automatically.
- Missing translations are intentional. Content requests fall back to Japanese with `isFallback: true`; do not create files merely to make locale trees symmetrical.

## Setup URLs

- Normal canonical Setup URLs are `/<existing-id>`; Setup IDs remain opaque and unchanged.
- `/setup/<id>` is permanent compatibility. It redirects with 308 unless the ID collides with a static root route, in which case the legacy path remains canonical.
- Static root reservations are generated by `@avatio/nuxt` from `pages:resolved`. Do not introduce a handwritten reserved-path list.
- Use `useSetupPath()` in app code and `getSetupPath()` in server code. Do not concatenate Setup URLs manually.

## Versioning

`package.json` is the sole version source. `app/app.config.ts` reads it at build time. Release PRs and tags are handled by the pinned `danielroe/uppt` workflow; no deploy job is part of the release workflow.

## Server conventions

### API handlers

Wrap every API handler with the appropriate factory from `server/utils/eventHandler.ts`:

- `promiseEventHandler` — no auth required
- `sessionEventHandler` — session available but optional (null-safe)
- `authedSessionEventHandler` — login required (throws 401 if unauthenticated)

Admin and cron routes use `promiseEventHandler` plus their explicit module-native server guard. The handler wrappers provide DB injection and conflict normalization; they do not own authorization.

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
- Admin pages live under `app/pages/admin/` and use the `dashboard` layout. Typed Better Auth route rules provide navigation authorization.

## Documentation maintenance

If your changes affect project structure, developer commands, deployment logic, or any topic covered in `AGENTS.md` or `README.md`, propose updating those documents as part of your change.
