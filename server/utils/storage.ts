import { Files } from 'files-sdk'
import { tigris } from 'files-sdk/tigris'

const requireEnv = (name: string) => {
    const value = process.env[name]
    if (!value)
        throw new Error(
            `Missing required environment variable: ${name}. Ensure it is set before starting the server.`,
        )
    return value
}

export const storage = new Files({
    adapter: tigris({
        bucket: requireEnv('TIGRIS_STORAGE_BUCKET'),
        accessKeyId: requireEnv('TIGRIS_STORAGE_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('TIGRIS_STORAGE_SECRET_ACCESS_KEY'),
        endpoint: process.env.TIGRIS_STORAGE_ENDPOINT,
        publicBaseUrl: `https://${requireEnv('TIGRIS_STORAGE_DOMAIN')}`,
    }),
})
