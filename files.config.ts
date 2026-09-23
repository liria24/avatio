import type { R2Bucket } from '@cloudflare/workers-types'
import { defineFilesConfig } from 'nuxt-files-sdk/config'

import { getRuntimeEnv, getRuntimeEnvString } from './server/utils/runtimeEnv'

export default defineFilesConfig({
    storage: {
        adapter: 'r2',
        config: () => {
            const binding = getRuntimeEnv().R2 as R2Bucket | undefined
            if (!binding || typeof binding !== 'object')
                throw new Error('Missing required Cloudflare R2 binding: R2')

            const publicBaseUrl = getRuntimeEnvString('R2_PUBLIC_BASE_URL')
            if (!publicBaseUrl)
                throw new Error(
                    'Missing required environment variable: R2_PUBLIC_BASE_URL. Ensure it is set before starting the server.',
                )

            return { binding, client: 'fetch', publicBaseUrl }
        },
    },
    devStorage: {
        adapter: 'fs',
        config: {
            root: '.data/uploads',
            urlBaseUrl: 'http://localhost:3000/api/_local/files',
        },
    },
})
