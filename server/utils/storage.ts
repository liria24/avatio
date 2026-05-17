import { Files } from 'files-sdk'
import { tigris } from 'files-sdk/tigris'

export const storage = new Files({
    adapter: tigris({
        bucket: process.env.TIGRIS_STORAGE_BUCKET!,
        accessKeyId: process.env.TIGRIS_STORAGE_ACCESS_KEY_ID!,
        secretAccessKey: process.env.TIGRIS_STORAGE_SECRET_ACCESS_KEY!,
        endpoint: process.env.TIGRIS_STORAGE_ENDPOINT,
        publicBaseUrl: `https://${process.env.TIGRIS_STORAGE_DOMAIN}`,
    }),
})
