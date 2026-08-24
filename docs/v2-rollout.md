# Avatio v2 rollout

The repository contains the expand/backfill/switch implementation, but production rollout is deliberately operator-gated. Do not deploy or invoke an `apply` action from an automated coding session.

## Compatibility retained during rollout

- Existing Setup IDs remain unchanged.
- `/setup/<id>` remains a permanent 308-compatible path; historical static-route collisions stay on that path.
- Setup reads prefer complete v2 `SetupEntry` data and fall back to legacy relations while a backfill is incomplete.
- Setup writes currently update both legacy relations and v2 `SetupEntry` relations so rollback remains possible during the verified migration window.
- The Queue consumer accepts v2 source-only messages and old messages already present in the retained physical queue. No producer emits the old shape.
- Legacy `items`, `shops`, `setup_items`, and `outdated` remain compatibility schema only. They are not v2 domain concepts.
- The Content D1 and old cache KV are retained but unbound.

## Production sequence

1. Run the full test/type/lint/format/build matrix and both stage config checks.
2. Review the production Alchemy plan. Confirm retained D1, R2, KV, Queue, and Flagship resources are not being replaced.
3. Deploy development and verify content, Setup routes, OAuth/session behavior, D1 request-time resolution, preview-origin rejection, Queue consumption, and cache tags.
4. Call `POST /api/admin/catalog/migration` with `{ "mode": "dry-run" }` as an authenticated admin. Resolve every error; warnings about nonstandard historical Setup ID shapes require route preflight, not ID rewriting.
5. Obtain explicit production authorization and deploy the expand-compatible application/migration.
6. Call the same endpoint with `{ "mode": "apply" }`. The backfill is resumable/idempotent and preserves legacy IDs and relations.
7. Call it with `{ "mode": "verify" }`; require `verified: true` and zero pending rows.
8. Exercise BOOTH, GitHub, legacy `outdated=true`, publisher verification, notes, categories, shapekeys, private/hidden owner reads, and withdrawal/restoration fixtures against production-like data.
9. Observe at least one freshness window and confirm v2 Queue messages, lease expiry/release, and item-tag cache invalidation.
10. Only after the rollback window closes, generate a separate contract migration that removes legacy tables/fields and the old Queue decoder.

## Intentionally deferred cleanup

- Dropping legacy schema and ending dual writes is blocked on production backfill verification and the rollback window.
- Removing the old Queue message decoder is blocked on confirming the retained physical queue has drained.
- Destroying the unbound Content D1 or cache KV requires a separate explicit infrastructure decision.
- A versioned terms-acceptance plugin is deferred because the legacy `lastAgreedToTerms` timestamp has no defensible legal-version mapping.
- Enabling Better Auth joins is deferred while upstream PR #10631 remains unreleased; it is a separate measured migration even after release.
- Removing root `auth.config.ts` is deferred until the Nuxt module can generate an equivalent custom D1/Drizzle schema directly from `server/auth.config.ts`.
