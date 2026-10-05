import { fileURLToPath } from 'node:url'

import { bindings, defineConfig } from 'cf/config'

import { createCloudflareConfig } from '../../../config/cloudflare.ts'
import { createCloudflareResourceFixture } from '../../helpers/cloudflareResources.ts'

// SYNTHETIC IDS. This fixture is build-only and must never be deployed.
export default defineConfig((context) => {
    const config = createCloudflareConfig(context, createCloudflareResourceFixture())
    return {
        ...config,
        worker: {
            ...config.worker,
            entrypoint: fileURLToPath(
                new URL('../../../.output/server/index.mjs', import.meta.url),
            ),
            assets: { runWorkerFirst: true },
            env: { ...config.worker.env, ASSETS: bindings.assets() },
        },
    }
})
