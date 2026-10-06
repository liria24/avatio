import { defineFilesConfig } from 'nuxt-files-sdk/config'

import { getRuntimeEnv, getRuntimeEnvString } from './server/utils/runtimeEnv'

export default defineFilesConfig({
    storage: {
        adapter: 'r2',
        config: () => {
            const binding = getRuntimeEnv().R2
            const publicBaseUrl = getRuntimeEnvString('R2_PUBLIC_BASE_URL')
            if (!binding || typeof binding !== 'object' || !publicBaseUrl)
                throw new Error('R2 binding and public URL are required')

            return { binding, publicBaseUrl }
        },
    },
    $development: {
        storage: {
            adapter: 'fs',
            config: {
                root: '.data/uploads',
                urlBaseUrl: 'http://localhost:3000/api/_local/files',
            },
        },
    },
})
