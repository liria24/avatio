import { createFilesRouter, type FilesOperation } from 'files-sdk/api'
import { createRouteHandler } from 'files-sdk/nitro'

const allowedOperations = [
    'head',
    'exists',
    'list',
    'search',
    'url',
    'capabilities',
    'download',
    'upload',
    'delete',
    'copy',
    'move',
    'signedUploadUrl',
] as const satisfies readonly FilesOperation[]

const normalizeOrigin = (origin: string) => origin.replace(/\/$/, '')

const isAllowedOrigin = (origin: string) => {
    const normalizedOrigin = normalizeOrigin(origin)
    const siteUrl = getRuntimeEnvString('PUBLIC_SITE_URL')

    return (
        (siteUrl && normalizedOrigin === normalizeOrigin(siteUrl)) ||
        (import.meta.dev && normalizedOrigin === 'http://localhost:3000')
    )
}

const router = createFilesRouter({
    files: () => getStorage(),
    operations: allowedOperations,
    allowedOrigins: isAllowedOrigin,
    maxListLimit: 500,
    maxSearchResults: 500,
    maxUploadSize: MAX_IMAGE_UPLOAD_SIZE,
    authorize: async ({ req, operation }) => {
        const session = await auth.api.getSession({ headers: req.headers })
        assertAdminSession(session)

        const disposition = operation === 'url' || operation === 'download' ? 'inline' : undefined
        return {
            disposition,
            maxResults: 500,
        }
    },
})

export default defineEventHandler(createRouteHandler(router))
