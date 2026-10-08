# AGENTS.md — Avatio

Compact instruction for OpenCode sessions. If a fact is obvious from filenames, it is omitted.

---

## Documentation

- `README.md` is user-maintained. Agents must not edit it; only the user changes it manually.
- Do not create `docs/` without explicit user approval. Put implementation and migration reports in the PR description.

## Package manager & runtime

- **Package manager:** `bun`. `bunfig.toml` uses `linker = "hoisted"` and disables Bun's automatic dotenv loading.
- **Toolchain:** Vite+ runs package scripts, lint, format, and tests. Node 26 runs Nuxt, TypeScript scripts, tests, and configuration tooling; Bun only installs dependencies. Cloudflare builds use `NODE_OPTIONS=--max-old-space-size=4096` to leave memory for the remaining build processes.
- **Postinstall:** `vp install` uses Bun and runs `nuxt prepare` only.
- **Development URL:** `vp run dev` runs the Node.js Nuxt dev server at `http://localhost:3000`; the port is fixed and fails if already in use.
- **Environment split:** local uses SQLite/filesystem/IPX. The native development target is one persistent Cloudflare Preview with preprovisioned resources; its endpoint access policy still needs operator approval.

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
| Seed local SQLite from D1   | `vp run db:seed:local -- --yes`                                                  |
| Generate Better Auth schema | `bunx --bun auth generate --config auth.config.ts --output .data/auth-schema.ts` |

Cloudflare delivery uses `vp run build:cloudflare -- development` (or `-- production`) with reviewed non-secret `AVATIO_CF_RESOURCES_JSON`. Local credentialless regression checks are `vp run test:cloudflare:build` and `vp run test:cloudflare:migrations`; they never publish or use remote data.

## After making changes

Run **`vp run typecheck`** and **`vp run lint`** to verify there are no errors before finishing.
For deployment-related changes, also run **`vp run build`**. In this repo, the production build is expected to complete successfully even though Nuxt/Rolldown may still print non-fatal warnings during the build; treat the command exit code as the source of truth.

PRs into `main` require the `format`, `lint`, `lint:unused`, `typecheck`, `test`, and `build` checks from `.github/workflows/quality.yml`. These checks use no production secrets. Tests use Node 26 for the SQLite-backed D1 regression checks.

## Project architecture

- **Framework:** Nuxt 4.6.0 (`compatibilityVersion: 5`), using Nitro. The Nuxt CLI v4 is supplied transitively.
- **Deployment target:** One Cloudflare Worker (`avatio`), using the standard Nuxt/Nitro Cloudflare build and pinned official tooling. Prefer `cf` where supported; Wrangler is allowed.
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
- Legacy Workers Builds commands were removed with Alchemy. The owner deleted only the obsolete `avatio-development` Worker on 2026-10-08; do not recreate it or delete its retained data resources. Retire competing publishers before activating delivery; never replace a failed external check with a silent success command.
- Native Cloudflare configuration declares existing resource bindings. The owner initializes non-production `NUXT_BETTER_AUTH_SECRET` in Previews Base, and initializes that same value plus `TWITTER_CLIENT_SECRET` only in the existing development Preview. Never place Twitter or production credentials in Base. Do not send signing secrets through CI.
- OG image runtime configuration uses Nitro environment expansion to read the canonical `OG_IMAGE_SECRET` binding. Builds must work without that secret and must never inline its value.
- Local development generates and reuses a Better Auth secret under `.data/`. Clear Better Auth's build-time secret for deployed builds in `nitro:config`, after the module's `modules:done` initialization, so only the runtime Worker binding supplies the deployed key.
- Do not print decrypted values or expose secrets through public runtime config, app config, client payloads, logs, snapshots, or generated artifacts.
- `process.env` access is limited to build/deploy/config tooling and unavoidable root composition. Domain/application code receives typed configuration or capabilities. `getRuntimeEnv*` remains confined to root composition/infrastructure; do not introduce new `NUXT_*` aliases for canonical values.

### Local configuration

1. Run `vp install` and `vp run dev`; no Cloudflare credentials or `.env.keys` are required.
2. Optional local overrides use Nuxt's standard `.env` loading. Bun does not automatically load dotenv files.
3. Local state is gitignored under `.data/`: `avatio.sqlite`, `local-auth-secret`, `uploads/`, and `mail/`.
4. Do not point normal local startup at deployed development resources. Stage ciphertext is read only by explicit config check commands.

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
- CI runs every Vitest project (`unit`, `integration`, `nuxt`, `http`, `cloudflare`) plus Chromium smoke on every PR and merge group. Extended Chromium, Firefox, WebKit, and mobile checks run on main/development pushes, daily, and manual runs. The required `test` check aggregates applicable suites and fails on failed, cancelled, or unexpectedly skipped jobs. All six existing required check names remain.
- Heavy tests live under `test/integration/`, `test/nuxt/`, `test/http/`, `test/cloudflare/`, and `test/browser/`. Historical migrations and idempotency regression coverage remain in CI; add migration cases when schema/migrations change, rather than duplicating request-replay suites in Miniflare.
- HTTP/browser fixtures copy application sources into a fresh temporary root, exclude real local state and environment files, create a private SQLite/files/mail/auth-secret directory, and reject an occupied port 3000. Better Auth `testUtils` is confined to test-only auth instances; actual HTTP login and device switching use the application's auth server. No test auth bypass route or production plugin is added.
- Fixture child processes and browser contexts deny external network requests. CI traces/screenshots contain synthetic fixture users only and are retained for three days after failure. Fixture databases, files, signing secrets, and normal browser profiles are never cached or uploaded; traces may include disposable fixture session cookies.
- Browser retries do not permit flaky success: `failOnFlakyTests` is enabled in CI. Smoke/full runtime budgets are measured from CI results, not inferred from local unit timing.
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
- Alchemy and its legacy plan/deploy/adopt commands are removed. Code removal never destroys, adopts, deletes or migrates existing Cloudflare resources. Only the protected native workflows may publish when their gates permit. Use supported official CLI operations, without replacement IaC or a custom deployment framework.
- Content D1 remains unbound. The retained production Cache KV is named `avatio` and bound as `CONTENT_CACHE` for authored content; preserve its identity and existing keys through the prefixed cache driver.
- Production cutover remains on hold. Existing production resources and secrets remain untouched; changes to encrypted variable names affect future owner tooling only. Native automatic delivery remains disabled.
- **Workers Cron Triggers**:
  - `/api/admin/job/report` — daily at 22:00
  - `/api/admin/job/cleanup` — manual/admin only
- **Images:** served through `@nuxt/image`. Allowed external domains are whitelisted in `nuxt.config.ts` (Booth, GitHub, R2 public domain).
- **Storage:** `nuxt-files-sdk` is configured in `files.config.ts`; runtime code uses `useServerFiles()`. Its `$development.storage` selects the filesystem adapter under gitignored `.data/uploads`, served at `/api/_local/files/*`, including imported OAuth avatars. Local Nuxt Image uses IPX with only localhost HTTP sources; the local route rejects traversal and metadata sidecars. The deployed development Preview and production Worker use their stage-specific `R2` binding and public domain; R2 HTTP credentials remain unsupported. The local file route returns 404 in deployed builds.
- **files-sdk build compatibility:** The native R2 binding does not use `@aws-sdk/*`; `nuxt-files-sdk` generates shims for optional AWS imports during the Cloudflare build. Nitro source maps are disabled because their generation exceeded the 4 GB heap limit. Check the Cloudflare preset after SDK updates.
- **PWA:** `@vite-pwa/nuxt` is enabled; `sw.js` and `manifest.webmanifest` are served with `must-revalidate`.

## Native Cloudflare delivery (#354, acceptance pending)

- The revised plan has two targets only: `main` publishes production on the existing `avatio` Worker; `development` updates one persistent native Preview named `development` under that Worker. A native Preview is not another Worker or a Wrangler environment. Every PR, including same-repository PRs, runs secretless quality/build checks only; never create a PR Preview, bind remote PR data, or run remote PR migrations.
- Use the standard Nuxt/Nitro `cloudflare_module` build. Delivery installs dependencies only at the repository root and must not depend on test-fixture installations, custom Build Output packaging, or an alternate application server. `cf` remains preferred where its pinned version supports the operation; pinned Wrangler is permitted for standard-output publication and D1 migrations.
- Preserve compatibility date `2026-05-26`, native Node compatibility v2 and `no_handle_cross_request_promise_resolution`. Never restore `no_nodejs_compat_v2`; keep Nitro Node crypto compatibility, console/async-context behavior and disabled source maps. Validate the actual generated configuration against the pinned tools and local workerd.
- `cloudflare.config.ts` and the reviewed `AVATIO_CF_RESOURCES_JSON` declare existing production/development identities only. The inventory is non-secret configuration, not a state store or allocator. Missing or ambiguous bindings fail closed. Keep development D1/R2/KV/flags/rate limits separate from production and preserve all retained legacy data resources and unrelated services.
- Production keeps its existing domain, Cron `0 22 * * *`, Queue consumer (batch 10, wait 5 seconds, 3 retries), image domains/CORS and storage retention. Development has no Cron, Queue producer/consumer, production data binding, email sending, dynamic OG or production analytics; catalog refresh uses awaited fenced inline sync. Do not change local SQLite, Setup compatibility, optional local seed guards, or encrypted signing values as a delivery side effect.
- `native-production.yml` and `native-development.yml` call the small shared `native-delivery.yml`. Only the exact successful branch-push quality run for the current source can authorize delivery. All six required checks must succeed. Separate credentialless source/build execution from the trusted publisher; hand off the immutable artifact ID plus its exact source SHA and hash, and validate artifact data without executing its application/configuration code with deployment credentials.
- Both build and publisher use protected GitHub Environments named `production` and `development` for reviewed configuration. Build receives no Cloudflare token, dotenv key or signing value. Forward only the named `CLOUDFLARE_API_TOKEN` for the publisher, never inherited secrets. Operators must configure environment protection, branch restrictions and scoped credentials before acceptance.
- Keep repository variable `AVATIO_NATIVE_DELIVERY_ENABLED` disabled until live development acceptance and single-publisher handoff are complete. Production additionally requires `AVATIO_PRODUCTION_DELIVERY_ENABLED`, which remains disabled pending production recovery/binding review and explicit cutover approval. Manual dispatch uses the same gates, exact successful quality evidence and current branch guard; it is not a bypass.
- Migration plus publication share a per-target non-cancelling concurrency lane. Require operator-verified `AVATIO_MIGRATION_HISTORY_VERIFIED` in the protected target environment before remote migration; stop on any migration failure, and recheck current source immediately before publication. Use explicit target database IDs, nested Drizzle migrations and `d1_migrations`; never assume the Alchemy ledger is interchangeable or guess/import applied history. Worker rollback does not roll back D1.
- The owner initializes the unchanged non-production `NUXT_BETTER_AUTH_SECRET` once in Previews Base and in the existing development Preview; Base inheritance alone does not initialize an existing Preview. Keep `TWITTER_CLIENT_SECRET` development-only. Inspect names/types only; do not transfer runtime signing secrets through CI or rotate them casually. Development endpoint access, callback origins and image CORS still need approval and verification; `noindex` is not access control.
- Keep owner/manual/development-only `native-inspection.yml` until acceptance. It retains the existing `preview` GitHub Environment and shares the development lane. Historical deployed source is separate from current trusted inspection code. This path reads metadata and fixed schema/Alchemy-ledger queries, optionally checks reviewed static immutable-origin assets, and cannot publish, migrate, allocate, transfer secrets or delete resources. Existing historical Preview provenance remains unverified.
- Normal quality includes the actual standard application build, synthetic local workerd/binding checks and migration regressions without credentials or external mutations. These are implementation evidence only. Populated-data migration/idempotency/recovery, real target binding/secret inspection, exact deployed-version smoke tests and production cutover remain pending. Keep publication disabled until the corresponding operator acceptance and authorization; no resource creation, data deletion or security/access change is implied by #354.

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
- Portable public HTTP handlers use `requestEventHandler` and explicit imports from `nuxt/server`. Their `RequestEvent` exposes `req: Request`, `url: URL`, and `res.headers: Headers`. Never mix H3 auto-imports into them. Pass that event explicitly to `validateRequestQuery`/`validateRequestParams`; shared Zod failure handling preserves the existing validation contract.
- Better Auth session/admin handlers, Nitro plugins/tasks, sitemap integration, and Cloudflare composition retain explicit H3/Nitro boundaries. Keep domain/application behavior independent of either event type. The new Nuxt cookie-session helpers and `appSecret` do not replace Better Auth or its signing key.

### API handlers

Wrap every API handler with the appropriate factory:

- `requestEventHandler` from `server/utils/requestEventHandler.ts` — portable public HTTP handlers; no auth required

Factories from `server/utils/eventHandler.ts` retain the Better Auth/H3 boundary:

- `promiseEventHandler` — no auth required
- `sessionEventHandler` — session available but optional (null-safe)
- `authedSessionEventHandler` — login required (throws 401 if unauthenticated)

Admin and cron routes use `promiseEventHandler` plus `requireAdminSession`, which composes the module-native admin role guard with the independent banned-user policy. The handler wrappers provide DB injection and conflict normalization; they do not own authorization.

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
