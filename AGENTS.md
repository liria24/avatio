# AGENTS.md — Avatio

Compact instruction for OpenCode sessions. If a fact is obvious from filenames, it is omitted.

---

## Package manager & runtime

- **Package manager:** `bun`. `bunfig.toml` uses `linker = "hoisted"` and disables Bun's automatic dotenv loading.
- **Toolchain:** Vite+ runs package scripts, lint, format, and tests. Node 26 runs Nuxt, TypeScript scripts, tests, and the installed Alchemy CLI; Bun only installs dependencies. Workers Builds uses `NODE_OPTIONS=--max-old-space-size=4096` to leave memory for the remaining build processes.
- **Postinstall:** `vp install` uses Bun and runs `nuxt prepare` only.
- **Development URL:** `vp run dev` runs the Node.js Nuxt dev server at `http://localhost:3000`; the port is fixed and fails if already in use.
- **Environment split:** local uses SQLite/filesystem/IPX without Alchemy. `development` remains the deployed Cloudflare stage; plans and deployments use the Cloudflare state store.

## Developer commands

| Task                          | Command                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------- |
| Dev server                    | `vp run dev`                                                                     |
| Build                         | `vp run build`                                                                   |
| Typecheck                     | `vp run typecheck`                                                               |
| Lint                          | `vp run lint`                                                                    |
| Fix lint                      | `vp run lint:fix`                                                                |
| Format                        | `vp run format:fix`                                                              |
| Check formatting              | `vp run format`                                                                  |
| Find unused code              | `vp run lint:unused`                                                             |
| Run all tests                 | `vp run test`                                                                    |
| Unit tests only               | `vp run test:unit`                                                               |
| Nuxt tests only               | `vp run test:nuxt`                                                               |
| Watch tests                   | `vp run test:watch`                                                              |
| Generate Drizzle migrations   | `vp run db:generate`                                                             |
| Development Alchemy plan      | `vp run plan:development`                                                        |
| Production Alchemy plan       | `vp run plan:production`                                                         |
| Development deploy            | `vp run deploy:development`                                                      |
| Production deploy             | `vp run deploy:production`                                                       |
| Explicit development adoption | `vp run infra:adopt:development`                                                 |
| Explicit production adoption  | `vp run infra:adopt:production`                                                  |
| Seed local SQLite from D1     | `vp run db:seed:local -- --yes`                                                  |
| Generate Better Auth schema   | `bunx --bun auth generate --config auth.config.ts --output .data/auth-schema.ts` |

## After making changes

Run **`vp run typecheck`** and **`vp run lint`** to verify there are no errors before finishing.
For deployment-related changes, also run **`vp run build`**. In this repo, the production build is expected to complete successfully even though Nuxt/Rolldown may still print non-fatal warnings during the build; treat the command exit code as the source of truth.

PRs into `main` require the `format`, `lint`, `lint:unused`, `typecheck`, `test`, and `build` checks from `.github/workflows/quality.yml`. These checks use no production secrets. Tests use Node 26 for the SQLite-backed D1 regression checks.

## Project architecture

- **Framework:** Nuxt 4 (`compatibilityVersion: 5`).
- **Deployment target:** Cloudflare Workers, built and deployed by `Cloudflare.Website.Nuxt` in `alchemy.run.ts`.
- **Workspace:** Bun workspaces under `packages/*` with exactly three architectural packages:
  - `@avatio/core` — pure domain, application ports, and explicit contracts. It must not import Nuxt, Nitro, Cloudflare, Drizzle, Better Auth, provider SDKs, or read `process.env`.
  - `@avatio/nuxt` — Nuxt integration, content/routing build hooks, and catalog provider adapters. It may depend on core but never on `@avatio/cloudflare`.
  - `@avatio/cloudflare` — SQLite repository, D1 batch, Queue, cache, Flagship, R2, Workers AI, and binding adapters. It may depend on core.
- The root application is the composition root. Do not add a fourth package without concrete implementation evidence.
- **Structure:**
  - `app/` — Vue frontend (pages, layouts, composables, components).
  - `server/` — Nitro API routes and server middleware.
  - `database/schema.ts` — shared Drizzle SQLite schema for local Node SQLite and deployed Cloudflare D1.
  - `shared/` — Utilities shared between client and server.
  - `content/` — canonical Markdown sources, split by `en/` and `ja/`. `@avatio/nuxt` uses `comark-content` with filesystem sources in local dev and commit-pinned GitHub sources in deployed Workers. Nuxt Content is intentionally not active.

## Architecture boundaries

- Abstract at repositories and semantic capabilities, not through generic database/cloud/ORM wrappers.
- Setup domain code references CatalogItem IDs and must not branch on BOOTH, GitHub, or other providers.
- Cloudflare bindings and `event.context.cloudflare` stay in infrastructure/composition code.
- Database schema types are not client/API contracts; use explicit core or shared HTTP contracts. Catalog HTTP IDs are Avatio-owned. Provider URLs are resolved through authenticated `POST /api/items/resolve`; item reads and Setup commands use CatalogItem IDs.
- Root `types.d.ts` is intentionally absent. Do not re-add a root declaration that imports server or Alchemy types into app/shared type programs.
- CatalogItem IDs are Avatio-owned and provider-independent. Provider keys remain strings with `UNIQUE(provider_key, external_id)` source identity.
- Source availability (`available`/`withdrawn`/`policy_rejected`/`unknown`) and sync state (`fresh`/`stale`/`syncing`/`error`) are independent. Transient provider failures never mean withdrawal.
- Effective category is resolved only through `SetupEntry override > CatalogItem override > primary source mapping > other`.
- Catalog refresh is demand-driven. SQLite source leases prevent duplicate v2 Queue messages; cold sources are never refreshed by a global schedule.
- URL resolution classifies the current source snapshot synchronously with `typesafe/jev` through the `default` AI Gateway, with a two-second deadline. Only results at or above `0.85` replace an unset or AI-owned category; the latest classification state is retained in SQLite. Display-name generation remains an independent after-response task.
- Queue v2 messages contain a source ID and its claimed lease token. Every source sync write and lease release is fenced by that token. Reject messages without a lease token.
- Local development runs the same fenced catalog sync inline and awaits it; it does not reproduce Queue delivery or retry guarantees.
- Public Setup responses are cookie-independent and resource-tagged; viewer/private responses are `no-store`. The configured SQLite database remains authoritative when caching or invalidation fails.
- Nitro Storage currently has no mounts. Never restore one for catalog truth, leases, flags, Setup data, or other system-of-record state.
- AI routes and use cases use semantic capabilities. Concrete per-task model IDs live only in typed stage composition.

## Environment and secrets

- The canonical path is `.env.<stage>` ciphertext -> dotenvx -> shared validation -> Alchemy -> Worker bindings. Do not maintain parallel secret inventories.
- Stage commands run dotenvx with `--strict`; any decryption failure must stop before validation or Alchemy, even when legacy environment values exist.
- Non-secret stage configuration is typed in `config/environment.ts`.
- Canonical secret definitions and validation live in `config/secrets.ts`.
- `.env.development` and `.env.production` contain committed dotenvx ciphertext. `.env.keys` contains local private keys and must never be committed.
- Use `vp run config:check:development` or `vp run config:check:production` before plans/deploys. Stage selection is explicit and fails closed.
- Production and development use the same application-facing secret names. In particular, use `BETTER_AUTH_SECRET`; do not restore `BETTER_AUTH_SECRET_DEVELOPMENT`.
- Each Worker's Workers Builds settings retain only its stage's dotenv private key and required provider deployment/bootstrap credentials. `scripts/stage.ts` selects exactly one stage file. `NUXT_BETTER_AUTH_SECRET` is derived from canonical `BETTER_AUTH_SECRET`, never managed separately.
- Alchemy manages Worker runtime variables, secrets, and resource bindings. Do not mirror Git-owned configuration in the dashboard or introduce Alchemy-owned resource IDs as application environment variables.
- OG image runtime configuration uses Nitro environment expansion to read the canonical `OG_IMAGE_SECRET` binding. Builds must work without that secret and must never inline its value.
- Local development generates and reuses a Better Auth secret under `.data/`. Clear Better Auth's build-time secret for deployed builds in `nitro:config`, after the module's `modules:done` initialization, so only the runtime Worker binding supplies the deployed key.
- Do not print decrypted values or expose secrets through public runtime config, app config, client payloads, logs, snapshots, or generated artifacts.
- `process.env` access is limited to build/deploy/config tooling and unavoidable root composition. Domain/application code receives typed configuration or capabilities. `getRuntimeEnv*` remains confined to root composition/infrastructure; do not introduce new `NUXT_*` aliases for canonical values.

### Local configuration

1. Run `vp install` and `vp run dev`; no Cloudflare credentials or `.env.keys` are required.
2. Optional local overrides use Nuxt's standard `.env` loading. Bun does not automatically load dotenv files.
3. Local state is gitignored under `.data/`: `avatio.sqlite`, `local-auth-secret`, `uploads/`, and `mail/`.
4. Do not point normal local startup at deployed development resources. Stage ciphertext is read only by explicit config/plan/deploy/adopt commands.

### Secret rotation

- For an externally issued secret, obtain the replacement, update only the intended encrypted `.env.<stage>` value through dotenvx, run config check and Alchemy plan, commit ciphertext, obtain deployment authorization, deploy/verify, then revoke the old credential.
- For Better Auth or another persistent signing key, first establish a multi-key/versioned compatibility plan and preserve sessions where practical. Never replace it with `Alchemy.Random` casually.
- Rotate dotenv encryption keys only through dotenvx's supported re-encryption workflow. Commit the resulting ciphertext/public-key changes together and keep managed offline backups of both private keys; `.env.keys` is not a backup.

## Tooling constraints

- Vite+ handles all formatting automatically; do not manually adjust indentation, quotes, or semicolons.
- `oxlint` and TypeScript enforce the remaining style rules (`no-explicit-any`, `consistent-type-imports`, `noUncheckedIndexedAccess`, etc.).
- Vue Options API is disabled (`vite.vue.features.optionsAPI: false`).

## Testing

- **Runner:** Vitest, configured in `vitest.config.ts`.
- Unit tests live in `test/unit/*.{test,spec}.ts`.
- `test/setup.ts` supplies shared server auto-imports; database regression tests use a migrated in-memory SQLite D1 adapter.
- Test env is loaded from `.env` via `loadEnv('test', ...)`.

## Database (Drizzle)

- **Dialect:** SQLite. Local uses `node:sqlite` + `drizzle-orm/node-sqlite`; deployed stages use Cloudflare D1 bound as `APP_DB`.
- Schema file: `database/schema.ts`.
- Config: `drizzle.config.ts`.
- Migration output: `./drizzle`.
- Naming convention: `snakeCase` (Drizzle `snakeCase` helper is used).
- Migrations use Drizzle v1 nested output under `./drizzle`.
- Do not edit generated migration SQL by hand; regenerate with `vp run db:generate`.
- For data-only migrations, generate an empty migration with `vp run db:generate --custom --name=<name>` and fill its SQL. Keep historical migrations unchanged.
- Stored Setup images require a unique `stableId`. The image ID backfill preserves existing IDs and fills nulls with `CAST(id AS TEXT)` before the generated NOT NULL migration; collisions fail instead of renumbering images.
- Both drivers keep foreign keys enabled. Parent-table rebuilds must preserve retained child rows and be tested with populated data.
- `vp run dev` creates `.data/avatio.sqlite` and applies the checked-in migrations with Drizzle's official Node SQLite migrator before serving requests. Build/prerender must not create local state.
- `executeAppBatch` preserves D1 `batch()` semantics and uses a synchronous Node SQLite transaction locally. Never return an async callback from the local transaction.
- `vp run db:seed:local -- --yes` explicitly copies the remote `avatio-development` D1 into local SQLite; authenticate Wrangler separately with D1 read permission. Its `--source production --allow-production` form requires explicit operator approval and is only for one-off local seeding. It never writes to remote D1.

## Auth

- `@nuxtjs/better-auth` owns Nuxt/Nitro routing, SSR hydration, client session state, and request session memoization.
- `server/auth.config.ts` is the sole runtime Better Auth configuration; `app/auth.config.ts` configures client plugins. Root `auth.config.ts` exists only for Better Auth CLI schema generation and must not be imported at runtime. Remove it only after the Nuxt module proves equivalent custom D1/Drizzle schema generation directly from `server/auth.config.ts`.
- Better Auth uses the relations-v2 Drizzle adapter with `usePlural: true` and `advanced.database.joins: true`. Account identity is `(providerId, providerAccountId)`. Generate the auth schema separately, review it against `database/schema.ts`, and generate migrations with Drizzle; never overwrite the full application schema with the auth-only output.
- Use `useUserSession()`/module client helpers in the app and `getRequestSession()`/`requireUserSession()` on the server. Do not recreate `useAuth()` or another session state machine.
- Protected APIs explicitly call `requireUserSession()`; route rules are navigation UX, not the API security boundary. Preserve banned-user policy independently from admin roles.
- Better Auth tables share `APP_DB`. Do not change auth schema/migrations merely to change Nuxt integration.
- Local dev enables the Better Auth email/password UI. A local-only SQLite trigger promotes the first successfully inserted user when the user count is zero; deployed D1 never installs it. Hard navigation after signup ensures the session reads the committed role.
- Deployed client IP resolution trusts only `cf-connecting-ip`, even before bindings are available; forwarded headers are local development compatibility only.
- Terms and Privacy have independent `version` and `effectiveDate` frontmatter. `updatedAt` is presentation-only. Append-only `legal_acceptances` records are unique per user/document/version and preserve the server-resolved source hash, commit, locale, and acceptance timestamp. Never fabricate records from `lastAgreedToTerms`; it remains a read-only timestamp fallback set by the existing account-creation consent flow.
- `/welcome` does not exist: provider usernames are retained, and local registration collects a username. Users with neither the account-creation fallback nor document history see the agreement modal as an initial review, never as an update.

## Authored content

- Deployed content uses the stage's GitHub repository/branch/path from `config/environment.ts`, with the existing `CONTENT_CACHE` KV binding and a five-minute blocking refresh interval. Content-only changes do not require an app build. Local requests read `content/` through the filesystem source without a generated all-pages payload.
- Resolve the current content commit through Git smart HTTP; use ungh only for the immutable commit's file tree and fetch bodies from commit-pinned GitHub raw URLs. Do not use ungh's cached branch metadata or unauthenticated GitHub REST lookups for current legal versions.
- Keep `experimental.extractAsyncDataHandlers` disabled: content is fetched at runtime, and handler extraction loses composable parameters during client navigation. Verify content routes through links as well as direct requests.
- Legal status reads manifest metadata only and returns no Markdown document bodies. Pages/modal load the actual document. Acceptance checks the reviewed version/hash against the current server source and returns 409 on mismatch, 503 if source/cache is unavailable.
- Only a `version` change triggers re-agreement; source corrections and unrelated commits do not. Versions activate at 00:00 UTC on `effectiveDate`. Translations must match the Japanese canonical version/effective date; missing translations fall back with the actual Japanese source provenance.
- Changelog remains in D1/Drizzle and is outside the authored-content service.

## Deployment & infra quirks

- **Cloudflare Flagship** owns true operational flags such as `is-maintenance`; unavailable evaluation fails closed. Catalog admission/category configuration lives in D1. Explicit catalog revalidation uses `POST /api/admin/catalog/revalidate` rather than a global force-update flag.
- `alchemy.run.ts` is the only infrastructure, D1 migration, and Worker deployment entry point. Do not add a Wrangler config or direct Wrangler deployment script.
- Content D1 remains unbound. The retained production Cache KV is named `avatio` and bound as `CONTENT_CACHE` for authored content; preserve its identity and existing keys through the prefixed cache driver.
- Workers Builds uses an empty build command on both Workers. The `avatio` Worker builds only `main` with `vp run deploy:production`; `avatio-development` builds only `development` with `vp run deploy:development`. Non-production branch builds are disabled on both Workers.
- Production deploy/adoption requires a clean `main` checkout. CI additionally checks branch/ref metadata and the actual checked-out commit SHA; detached HEAD is permitted only with matching main CI metadata. Normal deploy never passes `--adopt`. Use the explicit `infra:adopt:*` command only after reviewing the infrastructure plan and obtaining applicable operator authorization.
- **Workers Cron Triggers**:
  - `/api/admin/job/report` — daily at 22:00
  - `/api/admin/job/cleanup` — manual/admin only
- **Images:** served through `@nuxt/image`. Allowed external domains are whitelisted in `nuxt.config.ts` (Booth, GitHub, R2 public domain).
- **Storage:** `nuxt-files-sdk` is configured in `files.config.ts`; runtime code uses `useServerFiles()`. Its `$development.storage` selects the filesystem adapter under gitignored `.data/uploads`, served at `/api/_local/files/*`, including imported OAuth avatars. Local Nuxt Image uses IPX with only localhost HTTP sources; the local route rejects traversal and metadata sidecars. Deployed development/production Workers use the native stage-specific `R2` binding and public domain; R2 HTTP credentials remain unsupported. The local file route returns 404 in deployed builds.
- **files-sdk build compatibility:** The native R2 binding does not use `@aws-sdk/*`; `nuxt-files-sdk` generates shims for optional AWS imports during the Cloudflare build. Nitro source maps are disabled because their generation exceeded the 4 GB heap limit. Check the Cloudflare preset after SDK updates.
- **PWA:** `@vite-pwa/nuxt` is enabled; `sw.js` and `manifest.webmanifest` are served with `must-revalidate`.

## Native Cloudflare Preview preparation (#354)

- The active deployment remains Alchemy on Nuxt 4.5.2. `cloudflare.config.ts` is a prepared configuration contract, not an enabled deployment path. `cf` is pinned to `1.0.0-beta.11` and runs on Node (`node node_modules/cf/bin/cf`), never Bun. Do not add a direct deploy command until the activation gates below are verified.
- `config/build.ts` owns public Nuxt build settings. Explicit deployed builds use `STAGE=production|development`; local `vp run dev` remains independent of those stages. `server/types/cloudflare.ts` owns application-facing binding types and must not import Alchemy.
- The prepared Worker name is always `avatio`. Mode `production` requires `isPreview=false`, `STAGE=production`, and no `PREVIEW_NAME`. Modes `development` and `pr-<positive-number>` require native Preview mode, `STAGE=development`, and an identical `PREVIEW_NAME`. They also require explicit HTTPS origins for `PUBLIC_SITE_URL`, `R2_PUBLIC_BASE_URL`, and `OG_IMAGE_ENDPOINT` at build time. The root config rejects mismatches between these URLs and binding inputs.
- `AVATIO_CF_RESOURCES_FILE` must point to an operator-reviewed JSON inventory (for example, gitignored `.cloudflare/resources.json`). Its top level contains `accountId`, `production`, `development`, and `previews` keyed by `pr-<number>`. Every target contains `database: { id, name }`, `cache: { id, name }`, `bucket`, `flagshipId`, four `rateLimitNamespaces`, `siteUrl`, `imageBaseUrl`, `ogImageEndpoint`, and `emailFrom`. Non-production targets require `emailDestinations`; production requires `analyticsSiteTag`. `optionalSecrets` selects optional names from the existing `config/secrets.ts` definitions, never values. See the validated schema in `config/cloudflare.ts`; fixtures under `test/` are synthetic and must never become deployment inputs.
- Existing production/development resource names, development image URL, and rate-limit namespaces remain tied to `config/environment.ts`. PR D1/KV/R2 resources must be named `avatio-pr-<number>`; database IDs, KV IDs, buckets, public URLs, and all rate-limit namespaces must be distinct across targets. Reusing the same reviewed PR inventory produces the same bindings. This configuration neither provisions nor destroys resources, and does not transfer Alchemy resource ownership.
- Native Previews omit Queue producers, consumers, and Cron; Catalog uses the existing awaited inline sync with fenced lease tokens. PR email/password auth requires the server-side Preview binding and uses the existing form; a public UI flag cannot enable auth. The first-user admin trigger remains local-only. Preview trusted origins contain only the explicit Preview URL. PR images use their dedicated R2 public URL directly.
- Preview email senders, allowed recipients, Flagship, and OG endpoints must be non-production. Workers AI and Images bindings are available for application checks. Analytics credentials and notification integrations are disabled; the only currently permitted optional Preview secret is `BOOTH_PROXY_URL`. A future notification integration must first establish a verified non-production destination. Signing secrets are declared without values; any future publisher must derive `NUXT_BETTER_AUTH_SECRET` from canonical `BETTER_AUTH_SECRET`, not introduce another managed secret.
- `vp run test:cloudflare` validates synthetic configuration, event selection, PR auth, and inline sync without credentials, write permissions, or Cloudflare API mutations. The same tests run in the quality workflow's full `test` check. Same-repository PR close selects cleanup and reopen selects the same PR target; forks are excluded. These are tested decisions only, not active lifecycle operations. Existing quality/release jobs and required checks remain authoritative.
- Activation gates: validate actual Nuxt/Nitro Build Output and Avatio tasks/plugins/cache (the proposed Nuxt 4.6 Vite server alone is insufficient); inspect Preview secret scoping and close/reopen resource handling; supply reviewed real IDs; prove migration-history compatibility against a populated D1 backup. Alchemy's `__alchemy_migrations` ledger and `cf`'s `d1_migrations` ledger must not be assumed interchangeable. Do not stop Workers Builds, remove Alchemy or `avatio-development`, or alter local SQLite/seed as part of this preparation.

## i18n

- Default locale: `ja`. Secondary: `en`.
- Locale files: `i18n/locales/*.json`.
- Route rules in `nuxt.config.ts` are **auto-localized** for every locale in `availableI18nLocales`. If you add a new locale, existing route rules (redirects, middleware, ISR, etc.) are cloned under that prefix automatically.
- Missing translations are intentional. Content requests fall back to Japanese with `isFallback: true`; do not create files merely to make locale trees symmetrical.

## Setup URLs

- Bookmark lists use `GET /api/setups?bookmarked=true`; the former `GET /api/setups/bookmarks` list is retired. Individual bookmark reads and writes remain available.
- Normal canonical Setup URLs are `/<existing-id>`; Setup IDs remain opaque and unchanged.
- `/setup/<id>` is permanent compatibility. It redirects with 308 unless the ID collides with a static root route, in which case the legacy path remains canonical.
- Static root reservations are generated by `@avatio/nuxt` from `pages:resolved`. Do not introduce a handwritten reserved-path list.
- Use `useSetupPath()` in app code and `getSetupPath()` in server code. Do not concatenate Setup URLs manually.

## Versioning

`package.json` is the sole version source. `app/app.config.ts` reads it at build time. Release PRs and tags are handled by the pinned `danielroe/uppt` workflow; no deploy job is part of the release workflow.

## Server conventions

### Runtime organization

- `server/utils` is Avatio's formal Nuxt/Nitro server runtime integration and continues to use framework auto-imports.
- Organize runtime utilities by one coherent responsibility per file; one exported function per file is not required. Never introduce catch-all names such as `misc.ts`, `helpers.ts`, or `common.ts`.
- Migration-only, rollout compatibility, and backfill implementations must not live in `server/utils`.

### API handlers

Wrap every API handler with the appropriate factory from `server/utils/eventHandler.ts`:

- `promiseEventHandler` — no auth required
- `sessionEventHandler` — session available but optional (null-safe)
- `authedSessionEventHandler` — login required (throws 401 if unauthenticated)

Admin and cron routes use `promiseEventHandler` plus their explicit module-native server guard. The handler wrappers provide DB injection and conflict normalization; they do not own authorization.

### Database queries

- Prefer Drizzle ORM query builder (`db.query.*`, `db.select()`, `db.insert()`, etc.) over raw `sql` template literals. Use `sql` only when the query builder cannot express the logic.
- D1 does not expose Drizzle callback transactions. Build all required statements first and pass them in order to `executeAppBatch(db, queries)` so D1 batch or the local synchronous transaction commits or rolls back atomically.
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
