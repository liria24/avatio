# AGENTS.md — Avatio

Compact instruction for OpenCode sessions. If a fact is obvious from filenames, it is omitted.

---

## Documentation

- `README.md` is user-maintained. Agents must not edit it; only the user changes it manually.
- Do not create `docs/` without explicit user approval. Put implementation and migration reports in the PR description.

## Package manager & runtime

- Renovate targets `development`. Bootstrap only `renovate.json` on default `main`; merging
  that file still triggers production Workers Builds and requires owner review. Keep identical
  config filenames on both branches with `useBaseBranchConfig: merge`. Reapply updates on the
  latest base, regenerate existing locks with the pinned Bun, and require frozen install and
  every quality check. Do not delete the lock to resolve conflicts or change release workflows.

- **Package manager:** Bun 1.4.5. `bunfig.toml` uses `linker = "hoisted"` and disables runtime dotenv loading. Installation has loaded `.env.production` despite `env = false` and `--no-env-file`; run CI installation with lifecycle scripts disabled and a clean environment. Nuxt preparation/build runs separately without inherited ciphertext. Never provide dotenv private keys or plaintext application secrets to installation.
- **Toolchain:** Vite+ runs package scripts, lint, format, and tests. Node 26 runs Nuxt, TypeScript scripts, tests, and configuration tooling; Bun only installs dependencies. Cloudflare builds use `NODE_OPTIONS=--max-old-space-size=4096` to leave memory for the remaining build processes.
- **Postinstall:** `vp install` uses Bun and runs `nuxt prepare` only.
- **Development URL:** `vp run dev` runs the Node.js Nuxt dev server at `http://localhost:3000`; the port is fixed and fails if already in use.
- **Environment split:** local uses persistent local D1/filesystem/IPX. The prepared development target is the separate `avatio-development` Worker at `dev.avatio.me`, with retained development data resources. Its creation, Access policy and live acceptance remain pending; production cutover is separate.
- **Verified dependency holds:** TypeScript 6.0.3 (`vue-tsc` cannot load TypeScript 7's compiler entry), `vue-tsc` 3.3.11 (3.3.13–3.3.14 lose Vue 3.6 template bindings), Nuxt / `@nuxt/kit` / `@nuxt/schema` 4.6.3 (`@nuxt/schema` 4.6.4 resolves unset `devServer.host` to `{}` under `untyped` 2.0.0 and crashes `nuxt dev`), and `@vite-pwa/nuxt` 1.1.1 (`2.0.2` deprecates `workbox` for `generateSW` and fails strict `**/_payload.json` precache glob matching in SSR builds). Reproduce or resolve these incompatibilities before lifting the pins.

## Developer commands

| Task                        | Command                                                                          |
| --------------------------- | -------------------------------------------------------------------------------- |
| Dev server                  | `vp run dev`                                                                     |
| Build                       | `vp run build`                                                                   |
| Typecheck                   | `vp run typecheck`                                                               |
| Lint                        | `vp run lint`                                                                    |
| Fix lint                    | `vp run lint:fix`                                                                |
| Format                      | `vp run format:fix`                                                              |
| Check formatting            | `vp run format`                                                                  |
| Find unused code            | `vp run lint:unused`                                                             |
| Fast local tests            | `vp run test`                                                                    |
| Unit tests only             | `vp run test:unit`                                                               |
| Full Vitest suite (CI)      | `vp run test:ci`                                                                 |
| Integration tests (CI)      | `vp run test:integration`                                                        |
| HTTP contracts (CI)         | `vp run test:http`                                                               |
| Miniflare bindings (CI)     | `vp run test:bindings`                                                           |
| Browser smoke (CI)          | `vp run test:browser:smoke`                                                      |
| Extended browsers (CI)      | `vp run test:browser:extended`                                                   |
| Nuxt tests only             | `vp run test:nuxt`                                                               |
| Watch tests                 | `vp run test:watch`                                                              |
| Generate Drizzle migrations | `vp run db:generate`                                                             |
| Seed local D1 from remote   | `vp run db:seed:local -- --yes`                                                  |
| Generate Better Auth schema | `bunx --bun auth generate --config auth.config.ts --output .data/auth-schema.ts` |

Credentialless Cloudflare builds use `vp run build:cloudflare -- development` (or `-- production`) with the checked-in `deployment/<stage>/wrangler.json` configuration (`config/cloudflare.ts`). `scripts/cloudflareBuild.ts` passes `--dotenv .env.disabled` to Nuxt `prepare`/`build`, rejects `.env` only when `AVATIO_SOURCE_SHA` is set (delivery builds), and patches `.output/server/wrangler.json`; local `.data/` does not block builds. Local regression checks are `vp run test:cloudflare:build`, `vp exec node test/cloudflare/application.mjs production`, and `vp run test:cloudflare:migrations`; they never publish or use remote data.

## After making changes

Run **`vp run typecheck`** and **`vp run lint`** to verify there are no errors before finishing.
For deployment-related changes, also run **`vp run build`**. In this repo, the production build is expected to complete successfully even though Nuxt/Rolldown may still print non-fatal warnings during the build; treat the command exit code as the source of truth.

PRs into `main` require the `format`, `lint`, `lint:unused`, `typecheck`, `test`, and `build` checks from `.github/workflows/quality.yml`. These checks use no production secrets. Tests use Node 26 for the SQLite-backed D1 regression checks.

## Project architecture

- **Framework:** Nuxt 4.6.3 (`compatibilityVersion: 5`), using Nitro. The Nuxt CLI v4 is supplied transitively.
- **Deployment targets:** Separate `avatio` production (`main`) and `avatio-development` development (`development`) Workers, built as standard Nuxt/Nitro `cloudflare_module` artifacts and published through checked-in `deployment/<stage>/wrangler.json` and gated `.github/workflows/quality.yml` (`AVATIO_DEVELOPMENT_DELIVERY_ENABLED` / `AVATIO_PRODUCTION_DELIVERY_ENABLED`). Do not enable delivery gates, merge `main`, or modify remote Cloudflare/GitHub settings without explicit owner approval.
- **Workspace:** Bun workspaces under `packages/*` with exactly three architectural packages:
  - `@avatio/core` — pure domain, application ports, and explicit contracts. It must not import Nuxt, Nitro, Cloudflare, Drizzle, Better Auth, provider SDKs, or read `process.env`.
  - `@avatio/nuxt` — Nuxt integration, content/routing build hooks, and catalog provider adapters. It may depend on core but never on `@avatio/cloudflare`.
  - `@avatio/cloudflare` — SQLite repository, D1 batch, Queue, cache, Flagship, R2, Workers AI, and binding adapters. It may depend on core.
- The root application is the composition root. Do not add a fourth package without concrete implementation evidence.
- **Structure:**
  - `app/` — Vue frontend (pages, layouts, composables, components).
  - `server/` — Nitro API routes and server middleware.
  - `database/schema.ts` — shared Drizzle SQLite schema for local and deployed Cloudflare D1.
  - `shared/` — Utilities shared between client and server.
  - `content/` — canonical Markdown sources, split by `en/` and `ja/`. `@avatio/nuxt` uses `comark-content` with filesystem sources in local dev and commit-pinned GitHub sources in deployed Workers. Nuxt Content is intentionally not active.

## Architecture boundaries

- Remove superseded implementations, duplicate paths, and their unused callers/tests/dependencies when replacing a feature. Do not retain an obsolete implementation as an indefinite fallback.
- Preserve intentional compatibility contracts, including `/setup/<id>` redirects, existing links, data, and session behavior. Review each compatibility path's purpose and consumers before removing it; age alone is not a reason to delete it.
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

- `.env.<stage>` ciphertext remains the canonical dotenvx-managed secret store. Explicit owner config checks use strict dotenvx and shared validation. Native builds and delivery never receive dotenv keys or application signing values.
- Config checks run dotenvx with `--strict`; decryption failure must stop before validation, even when environment values exist.
- Non-secret stage configuration is typed in `config/environment.ts`.
- Canonical secret definitions and validation live in `config/secrets.ts`.
- `.env.development` and `.env.production` contain committed dotenvx ciphertext. `.env.keys` contains local private keys and must never be committed.
- Use `vp run config:check:development` or `vp run config:check:production` for an explicit owner configuration check. Stage selection fails closed; these commands cannot deploy or migrate.
- Production and development use canonical `NUXT_BETTER_AUTH_SECRET`. No derived duplicate binding or stage-specific application secret names are managed. The encrypted key rename preserves the signing value and does not rotate sessions.
- Initialize runtime secrets directly in the intended Worker (`NUXT_BETTER_AUTH_SECRET`, etc.); never send signing secrets through CI or place production credentials in development or shared settings. Preserve existing Preview/Base settings and secrets until explicitly retired. Never replace a failed check with a silent success command.
- OG image runtime configuration uses Nitro environment expansion to read the canonical `OG_IMAGE_SECRET` binding. Builds must work without that secret and must never inline its value.
- Local development generates and reuses a Better Auth secret under `.data/`. Clear Better Auth's build-time secret for deployed builds in `nitro:config`, after the module's `modules:done` initialization, so only the runtime Worker binding supplies the deployed key.
- Do not print decrypted values or expose secrets through public runtime config, app config, client payloads, logs, snapshots, or generated artifacts.
- `process.env` access is limited to build/deploy/config tooling and unavoidable root composition. Domain/application code receives typed configuration or capabilities. `getRuntimeEnv*` remains confined to root composition/infrastructure; do not introduce new `NUXT_*` aliases for canonical values.

### Local configuration

1. Run `vp install` and `vp run dev`; no Cloudflare credentials or `.env.keys` are required.
2. Optional local overrides use Nuxt's standard `.env` loading. Bun runtime dotenv loading is disabled; its installer limitation is described above.
3. Local state is gitignored under `.data/`: persistent D1 in `d1/`, `local-auth-secret`, `uploads/`, and `mail/`. Preserve the signing key across local database resets.
4. Do not point normal local startup at deployed development resources. Stage secrets are decrypted only by explicit config check commands.

### Secret rotation

- For an externally issued secret, obtain the replacement, update only the intended encrypted `.env.<stage>` value through dotenvx, run a config check and review the native binding contract, commit ciphertext, obtain deployment authorization, deploy/verify, then revoke the old credential.
- For Better Auth or another persistent signing key, first establish a multi-key/versioned compatibility plan and preserve sessions where practical. Never replace it casually.
- Rotate dotenv encryption keys only through dotenvx's supported re-encryption workflow. Commit the resulting ciphertext/public-key changes together and keep managed offline backups of both private keys; `.env.keys` is not a backup.

## Tooling constraints

- Vite+ handles all formatting automatically; do not manually adjust indentation, quotes, or semicolons.
- `oxlint` and TypeScript enforce the remaining style rules (`no-explicit-any`, `consistent-type-imports`, `noUncheckedIndexedAccess`, etc.).
- Vue Options API is disabled (`vite.vue.features.optionsAPI: false`).
- Keep the explicit lazy client dependencies in `vite.optimizeDeps.include`; cold compose, overlay, and navigation flows must not lose state to development dependency reloads. Recheck these flows when upgrading the bundler or client SDKs.

## Testing

- **Runner:** Vitest, configured in `vitest.config.ts`.
- Local `test`, `test:unit`, and `test:watch` select only `test/unit/`; they do not initialize Nuxt or execute SQLite integration, HTTP, browser, Miniflare, or build checks.
- CI runs every Vitest project (`unit`, `integration`, `nuxt`, `http`, `cloudflare`) plus Chromium smoke on every PR, branch push and merge group. Extended Chromium, Firefox, WebKit, and mobile checks run on branch pushes, daily, and manual runs. The required `test` check aggregates applicable suites and fails on failed, cancelled, or unexpectedly skipped jobs. All six existing required check names remain. Only the gated `quality.yml` delivery job can receive a Cloudflare deployment credential, on the corresponding protected stage branch after operator activation.
- Heavy tests live under `test/integration/`, `test/nuxt/`, `test/http/`, `test/cloudflare/`, and `test/browser/`. Historical migrations and idempotency regression coverage remain in CI; add migration cases when schema/migrations change, rather than duplicating request-replay suites in Miniflare.
- HTTP/browser fixtures copy application sources into a fresh temporary root, exclude real local state and environment files, create private local D1/files/mail/auth-secret directories, and reject an occupied port 3000. Better Auth `testUtils` is confined to test-only auth instances; actual HTTP login and device switching use the application's auth server. No test auth bypass route or production plugin is added.
- Fixture child processes and browser contexts deny external network requests. CI traces/screenshots contain synthetic fixture users only and are retained for three days after failure. Fixture databases, files, signing secrets, and normal browser profiles are never cached or uploaded; traces may include disposable fixture session cookies.
- Browser retries do not permit flaky success: `failOnFlakyTests` is enabled in CI. Smoke/full runtime budgets are measured from CI results, not inferred from local unit timing.
- `test/setup.ts` supplies shared server auto-imports; database regression tests use migrated local D1. Historical migration tooling retains an isolated Node SQLite adapter for populated-data and failure-recovery checks.
- Test env is loaded from `.env` via `loadEnv('test', ...)`.

## Database (Drizzle)

- **Dialect:** SQLite. Local and deployed application code use `drizzle-orm/d1` with `APP_DB`. Local Nuxt uses Wrangler's platform proxy and the same persistence path as local migration/seed commands; do not introduce a second local driver.
- Drizzle ORM and Kit are pinned together at 1.0.0-rc.5. Use `EmptyFilter` when a relational condition is absent. User text searches use the shared SQLite string-function filters because D1 limits LIKE pattern length; preserve literal `%`/`_` handling and existing case/ranking behavior.
- Schema file: `database/schema.ts`.
- Config: `drizzle.config.ts`.
- Migration output: `./drizzle`.
- Naming convention: `snakeCase` (Drizzle `snakeCase` helper is used).
- Migrations use Drizzle v1 nested output under `./drizzle`.
- Do not edit generated migration SQL by hand; regenerate with `vp run db:generate`.
- For data-only migrations, generate an empty migration with `vp run db:generate --custom --name=<name>` and fill its SQL. Keep historical migrations unchanged.
- Stored Setup images require a unique `stableId`. The image ID backfill preserves existing IDs and fills nulls with `CAST(id AS TEXT)` before the generated NOT NULL migration; collisions fail instead of renumbering images.
- Local and deployed D1 keep foreign keys enabled. Parent-table rebuilds must preserve retained child rows and be tested with populated data.
- `vp run dev` applies checked-in migrations with Wrangler's local D1 migrator, installs the local-only first-user trigger, and then starts Nuxt. Both use `.data/d1`; build/prerender must not create local state.
- `executeAppBatch` uses D1 `batch()` in both application environments. Migration rehearsal's Node SQLite adapter keeps a synchronous transaction callback.
- `vp run db:seed:local -- --yes` explicitly copies the remote `avatio-development` D1 into local D1; authenticate Wrangler separately with D1 read permission. Its `--source production --allow-production` form requires explicit operator approval and is only for one-off local seeding. It never writes to remote D1.

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
- **Publisher boundary:** Alchemy and Native Preview delivery are retired. Keep one approved publisher per target (`wrangler` via `.github/workflows/quality.yml`), and never destroy, adopt, delete, or recreate existing Cloudflare resources (including the retained development D1/R2/KV and production Cache KV `avatio` / `CONTENT_CACHE`). Content D1 remains unbound.
- **Workers Cron Triggers**:
  - `/api/admin/job/report` — daily at 22:00
  - `/api/admin/job/cleanup` — manual/admin only
- **Images:** served through `@nuxt/image`. Allowed external domains are whitelisted in `nuxt.config.ts` (Booth, GitHub, R2 public domain).
- **Storage:** `nuxt-files-sdk` is configured in `files.config.ts`; runtime code uses `useServerFiles()`. Its `$development.storage` selects the filesystem adapter under gitignored `.data/uploads`, served at `/api/_local/files/*`, including imported OAuth avatars. Local Nuxt Image uses IPX with only localhost HTTP sources; the local route rejects traversal and metadata sidecars. The development and production Workers use their stage-specific `R2` binding and public domain; R2 HTTP credentials remain unsupported. The local file route returns 404 in deployed builds.
- **files-sdk build compatibility:** The native R2 binding does not use `@aws-sdk/*`; `nuxt-files-sdk` generates shims for optional AWS imports during the Cloudflare build. Nitro source maps are disabled because their generation exceeded the 4 GB heap limit. Check the Cloudflare preset after SDK updates.
- **PWA:** `@vite-pwa/nuxt` is enabled; `sw.js` and `manifest.webmanifest` are served with `must-revalidate`.

## Stage Worker delivery (#354, acceptance pending)

- `.github/workflows/quality.yml` runs credentialless checks on every PR/branch and gates delivery on branch + variable: `push` to `development` targets `avatio-development` (`AVATIO_DEVELOPMENT_DELIVERY_ENABLED == 'true'`), and `push` to `main` targets `avatio` (`AVATIO_PRODUCTION_DELIVERY_ENABLED == 'true'`). Existing live production Workers Builds remains until owner-approved cutover; verify platform branch exclusions and Preview auto-build OFF before pushing feature branches.
- `deployment/<stage>/wrangler.json` and `config/cloudflare.ts` declare the reviewed bindings (`APP_DB`, `CONTENT_CACHE`, `R2`, `FLAGS`, `ratelimits`, `AI`, `IMAGES`, `EMAIL`, `ITEM_REVALIDATION_QUEUE`) with `no_bundle: true`, `compatibility_date: 2026-05-26`, `compatibility_flags: ["no_handle_cross_request_promise_resolution", "nodejs_compat"]`, disabled source maps, and `preview_urls: false`. Keep `getNitroCloudflareConfig()` stripping `$schema`, `main`, and `assets.directory` for `nitro.cloudflare.wrangler` so Nitro writes canonical `.output/server/wrangler.json`, then `scripts/cloudflareBuild.ts` patches `compatibility_flags`, `AVATIO_SOURCE_SHA`, and D1 migration settings onto that artifact. Verify generated artifacts in local workerd with outbound requests denied (`test/cloudflare/application.mjs`).
- Installation (`scripts/installDependencies.ts`) uses frozen Bun, `--ignore-scripts --no-env-file`, and a clean environment; builds run in private temp HOME/config dirs, reject plaintext app secrets or `DOTENV_PRIVATE_KEY*`, and isolate the platform token strictly to migration/publication steps.
- Preserve retained D1/R2/KV, existing keys, image domains/CORS, storage retention, Queues (`item-revalidation` / `item-revalidation-development`, batch 10 / wait 5s / 3 retries), and Cron `0 22 * * *` (`job:report`; `cleanup` manual/admin). Development uses separate resources, restricted email (recipients limited to `hello@liria.me`, subjects `[development]`), dry-run cleanup, and no production analytics/optional credentials.
- Delivery serializes per-target D1 migration + publish (`avatio-${stage}-APP_DB`, `cancel-in-progress: false`), checks `AVATIO_MIGRATION_HISTORY_VERIFIED == d1_databases[0].database_id`, verifies `secrets.required` exist on the Worker, runs `wrangler d1 migrations apply APP_DB --remote`, and runs `wrangler deploy --config .output/server/wrangler.json`. Stop on migration failure; Worker rollback does not roll back D1.
- Preserve all 17 historical migrations, `20261026065213_auth-unique-indexes`, nested Drizzle files, and `d1_migrations`. Keep `scripts/cloudflareMigrationHistory.ts` until cutover acceptance is complete; never guess or replay Alchemy history.
- Protect both `dev.avatio.me` and its `workers.dev` hostname with Access + CI Service Auth only (`preview_urls: false`); `noindex` is not access control. Access, OAuth callbacks/origins, image CORS, and development secret initialization require live verification. Close #358 without merging after development publication succeeds; keep #354 open through live acceptance and reuse #362 for `development` → `main`. Do not merge `main` or enable production cutover without explicit owner approval.

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
- All API handlers, Better Auth session/admin handlers, Nitro plugins/tasks, sitemap integration, and Cloudflare composition use unified H3/Nitro boundaries (`server/utils/eventHandler.ts`, `server/utils/validateRequest.ts`, `server/utils/edgeCache.ts`). Keep domain/application behavior independent of H3 event types.

### API handlers

Wrap every API handler with the appropriate factory from `server/utils/eventHandler.ts`:

- `promiseEventHandler` — no auth required
- `sessionEventHandler` — session available but optional (null-safe)
- `authedSessionEventHandler` — login required (throws 401 if unauthenticated)

Public cacheable routes apply `applyPublicEdgeCache(event, tags)` from `server/utils/edgeCache.ts`.
Admin and cron routes use `promiseEventHandler` plus `requireAdminSession`, which composes the module-native admin role guard with the independent banned-user policy. The handler wrappers provide DB injection and conflict normalization; they do not own authorization.

### Database queries

- Prefer Drizzle ORM query builder (`db.query.*`, `db.select()`, `db.insert()`, etc.) over raw `sql` template literals. Use `sql` only when the query builder cannot express the logic.
- D1 does not expose Drizzle callback transactions. Build all required statements first and pass them in order to `executeAppBatch(db, queries)` so the D1 batch commits or rolls back atomically.
- Generate parent and child IDs in the application before a batch when later statements need those IDs.

## Security

- Validate all API inputs with a Zod schema and the appropriate helper from `server/utils/validateRequest.ts`:
  - `validateQuery(schema)` — query parameters
  - `validateParams(schema)` — URL path parameters
  - `validateBody(schema)` — request body
  - `validateFormData(schema)` — form data
- Validate ordinary text with `validateBody(schema)` so stored text and identifiers retain their exact values. The helper always removes dangerous object keys recursively. Use `{ sanitize: true }` only for content intentionally handled as HTML; retain dedicated email HTML sanitization and escape plain text when rendering it.

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
