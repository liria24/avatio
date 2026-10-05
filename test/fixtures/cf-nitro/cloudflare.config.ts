import { fileURLToPath } from 'node:url'

import { bindings, defineConfig } from 'cf/config'

import { createCloudflareConfig } from '../../../config/cloudflare.ts'
import { createCloudflareResourceFixture } from '../../helpers/cloudflareResources.ts'

// SYNTHETIC IDS. This fixture is build-only and must never be deployed.
export default defineConfig((context) => {
    const config = createCloudflareConfig(context, createCloudflareResourceFixture())
    const nodeCompat = process.env.AVATIO_SPIKE_NODE_COMPAT
    if (nodeCompat !== 'v1' && nodeCompat !== 'v2')
        throw new Error('The isolated spike requires an explicit v1 or v2 selection.')
    return {
        ...config,
        worker: {
            ...config.worker,
            // Trial only: the application's formal compatibility flags stay unchanged.
            compatibilityFlags: config.worker.compatibilityFlags.filter(
                (flag) => nodeCompat !== 'v2' || flag !== 'no_nodejs_compat_v2',
            ),
            entrypoint: fileURLToPath(
                new URL('../../../.output/server/index.mjs', import.meta.url),
            ),
            assets: { runWorkerFirst: true },
            env: { ...config.worker.env, ASSETS: bindings.assets() },
        },
    }
})
