# Configuration and secret operations

Avatio has one configuration path for local development, Workers Builds, plans, and deploys:

```text
.env.<stage> ciphertext -> dotenvx -> validation -> Alchemy -> Worker bindings
```

Non-secret values live in `config/environment.ts`. Secret names, validation, and pairing rules live in `config/secrets.ts`. Do not maintain separate handwritten inventories.

## Bootstrap secrets in Workers Builds

The only Avatio secret values that Workers Builds must retain directly are:

- `DOTENV_PRIVATE_KEY_PRODUCTION`
- `DOTENV_PRIVATE_KEY_DEVELOPMENT`

A single Workers Builds configuration serving both branches needs both keys. `scripts/stage.ts` selects exactly one `.env.<stage>` file, and rejects missing/unknown stages. Existing Cloudflare/Alchemy deployment credentials remain provider bootstrap credentials; they are not Avatio runtime configuration.

All application secrets use identical names in both encrypted stage files. `NUXT_BETTER_AUTH_SECRET` is derived by Alchemy from the canonical `BETTER_AUTH_SECRET`; it is not a separately managed value.

## Local development

1. Obtain the managed development dotenv private key.
2. Store it only in the gitignored `.env.keys` file using dotenvx's standard key format.
3. Run `bun run config:check:development`.
4. Run `bun run dev`.

The check prints invalid names and reasons only. Never paste decrypted output into source files, logs, issues, snapshots, or client runtime configuration.

## Rotation

For an externally issued secret:

1. Obtain the replacement from its issuer.
2. Use dotenvx to update the value in the intended `.env.<stage>` file; never hand-edit ciphertext.
3. Run the matching `config:check` and Alchemy plan command.
4. Commit the ciphertext-only change.
5. Deploy that stage after obtaining the required production authorization.
6. Verify the integration, then revoke the old credential when safe.

For Better Auth or another signing key, first determine whether the library supports multi-key/versioned rotation. Preserve existing sessions where practical; do not replace a persistent key with `Alchemy.Random` without a compatibility plan.

For dotenv private-key rotation, use dotenvx's supported key rotation/re-encryption workflow and commit all resulting ciphertext/public-key changes together. Keep a managed offline backup of both private keys; `.env.keys` is not the backup.

## Dashboard parity and cleanup

Do not remove legacy Worker variables or secrets until all of these are true for the relevant stage:

- the encrypted stage file contains the intended ciphertext entries;
- `config:check` passes;
- the Alchemy plan shows secret bindings for sensitive values;
- development and production-like workerd verification pass;
- the production deployment is explicitly authorized and verified.

After cutover, remove manually mirrored runtime entries for these application values:

- `BETTER_AUTH_SECRET` and the obsolete `BETTER_AUTH_SECRET_DEVELOPMENT` variant;
- `BOOTH_PROXY_URL`;
- `TWITTER_CLIENT_SECRET`;
- `OG_IMAGE_SECRET`;
- `LIRIA_DISCORD_ENDPOINT` and `LIRIA_DISCORD_ACCESS_TOKEN`.

Also remove manual copies of Git-owned values such as site/image URLs and sender address. Infrastructure IDs for `APP_DB`, R2, Queue, AI, Flagship, Images, Email, and rate limits are Alchemy-owned bindings and must not be reintroduced as application env values.

The retained Content D1 and old cache KV resources are intentionally unbound orphans during migration. Their removal is a separate destructive infrastructure action requiring explicit operator approval.
