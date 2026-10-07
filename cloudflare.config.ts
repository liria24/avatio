import { readFileSync } from 'node:fs'

import { defineConfig } from 'cf/config'

import { getBuildEnvironment } from './config/build.ts'
import { createCloudflareConfig } from './config/cloudflare.ts'

// Preparation only: this does not supply a Nuxt -> Build Output adapter or a deploy command.
export default defineConfig((context) => {
    const path = process.env.AVATIO_CF_RESOURCES_FILE
    if (!path)
        throw new Error('AVATIO_CF_RESOURCES_FILE must identify a reviewed resource inventory.')
    const config = createCloudflareConfig(context, JSON.parse(readFileSync(path, 'utf8')))
    const build = getBuildEnvironment(process.env, false)
    const previewName = context.isPreview ? context.mode : undefined
    const site = config.worker.env.PUBLIC_SITE_URL
    const images = config.worker.env.R2_PUBLIC_BASE_URL
    if (
        process.env.STAGE !== (context.isPreview ? 'development' : 'production') ||
        (process.env.PREVIEW_NAME || undefined) !== previewName ||
        site?.type !== 'text' ||
        site.value !== build.siteUrl ||
        images?.type !== 'text' ||
        images.value !== build.imageBaseUrl
    )
        throw new Error('Nuxt build environment must match the selected Cloudflare target.')
    return config
})
