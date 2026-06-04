import { getRequestURL, getRouterParam, readBody, type H3Event } from 'h3'
import * as v from 'valibot'

import { getOgImageEnv, getWaitUntil } from './cloudflare'
import { getPreset } from './getPreset'
import { logger } from './logger'
import type { RenderContext } from './render'
import {
    issueAvatioImageRequestSchema,
    ogImageDescriptorSchema,
    type OgImageDescriptor,
    type OgImageEnv,
    type WaitUntil,
} from './schema'
import { getOgImageStorage, type OgImageStorage } from './storage'

export const PNG_TTL_SECONDS = 60 * 60 * 24 * 30 // 30 days
export const FAILED_TTL_SECONDS = 60 * 5 // 5 minutes
export const RENDER_TIMEOUT_MS = 15_000 // 15 seconds
export const SUCCESS_CACHE_CONTROL = 'public, max-age=31536000, immutable'
export const FAILURE_CACHE_CONTROL = 'no-store'

const imageIdPattern = /^[a-f0-9]{64}$/
const pngExtensionPattern = /\.png$/i
const cleanupKeyPrefixes = ['descriptor:', 'png:', 'failed:'] as const

type CanonicalValue =
    | string
    | number
    | boolean
    | null
    | CanonicalValue[]
    | { [key: string]: CanonicalValue }

export type RenderPng = (
    descriptor: OgImageDescriptor,
    context?: RenderContext,
) => Promise<Uint8Array>

export interface RenderDependencies {
    assets?: Fetcher
    origin?: string
    renderPng?: RenderPng
    renderTimeoutMs?: number
    storage?: OgImageStorage
}

export interface IssueAvatioImageOptions extends RenderDependencies {
    body: unknown
    origin: string
    env: OgImageEnv
    waitUntil: WaitUntil
}

export interface GetImageOptions extends RenderDependencies {
    env?: OgImageEnv
    imageId: string
}

export interface CleanupImagesOptions {
    body: unknown
    env: OgImageEnv
    storage?: OgImageStorage
}

export interface CleanupImageOptions extends CleanupImagesOptions {
    imageId: string
}

const isH3Event = (value: unknown): value is H3Event =>
    typeof value === 'object' && value !== null && 'context' in value && 'path' in value

const getImageIdFromEvent = (event: H3Event) =>
    getRouterParam(event, 'imageId') ??
    getRouterParam(event, 'imageId.png') ??
    event.path.split('?')[0]?.split('/').pop() ??
    ''

const getEventBody = (event: H3Event) => readBody(event).catch(() => null)

const canonicalize = (value: unknown): CanonicalValue => {
    if (value === null) return null

    if (Array.isArray(value)) return value.map((item) => canonicalize(item))

    if (typeof value === 'object')
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .filter(([, entry]) => entry !== undefined)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, entry]) => [key, canonicalize(entry)]),
        )

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
        return value

    return null
}

export const canonicalJson = (value: unknown) => JSON.stringify(canonicalize(value))

export const descriptorPayload = (descriptor: OgImageDescriptor) =>
    canonicalJson({
        preset: descriptor.preset,
        version: descriptor.version,
        cacheKey: getPreset(descriptor)?.cacheKey ?? `${descriptor.preset}:${descriptor.version}`,
        props: descriptor.props,
    })

export const sha256Hex = async (value: string) => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))
    return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export const imageIdForDescriptor = async (descriptor: OgImageDescriptor) =>
    sha256Hex(descriptorPayload(descriptor))

const normalizeImageId = (imageId: string) => imageId.replace(pngExtensionPattern, '')

const digest = async (value: string) =>
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)))

const timingSafeEqual = async (actual: string, expected: string | undefined) => {
    if (!expected) return false

    const [actualDigest, expectedDigest] = await Promise.all([digest(actual), digest(expected)])
    let diff = actualDigest.length ^ expectedDigest.length

    for (let index = 0; index < actualDigest.length; index += 1)
        diff |= actualDigest[index]! ^ expectedDigest[index]!

    return diff === 0
}

const cleanupRequestSchema = v.object({
    secret: v.string(),
})

const cleanupKeysForImageId = (imageId: string) =>
    cleanupKeyPrefixes.map((prefix) => `${prefix}${imageId}`)

const isCleanupKey = (key: string) => cleanupKeyPrefixes.some((prefix) => key.startsWith(prefix))

const validateCleanupSecret = async (body: unknown, env: OgImageEnv) => {
    const bodyResult = v.safeParse(cleanupRequestSchema, body)
    if (!bodyResult.success)
        return { ok: false as const, response: jsonResponse({ error: 'Invalid request' }, 400) }

    const validSecret = await timingSafeEqual(bodyResult.output.secret, env.OG_IMAGE_SECRET)
    if (!validSecret)
        return { ok: false as const, response: jsonResponse({ error: 'Unauthorized' }, 401) }

    return { ok: true as const }
}

const parseDescriptor = (value: string | null): OgImageDescriptor | undefined => {
    if (!value) return undefined

    try {
        const result = v.safeParse(ogImageDescriptorSchema, JSON.parse(value) as unknown)
        return result.success ? result.output : undefined
    } catch {
        return undefined
    }
}

export const jsonResponse = (body: unknown, status = 200) =>
    Response.json(body, {
        status,
        headers: {
            'cache-control': FAILURE_CACHE_CONTROL,
        },
    })

export const notFoundResponse = () =>
    new Response(null, {
        status: 404,
        headers: {
            'cache-control': FAILURE_CACHE_CONTROL,
        },
    })

export const storageUnavailableResponse = () =>
    new Response('OG image storage is not available', {
        status: 500,
        headers: {
            'cache-control': FAILURE_CACHE_CONTROL,
        },
    })

const pngBytes = (png: ArrayBuffer | ArrayBufferView) =>
    png instanceof ArrayBuffer
        ? new Uint8Array(png)
        : new Uint8Array(png.buffer, png.byteOffset, png.byteLength)

const pngArrayBuffer = (png: ArrayBuffer | ArrayBufferView) => Uint8Array.from(pngBytes(png)).buffer

const pngResponse = (png: ArrayBuffer | ArrayBufferView) =>
    new Response(pngArrayBuffer(png), {
        headers: {
            'content-type': 'image/png',
            'cache-control': SUCCESS_CACHE_CONTROL,
        },
    })

const defaultRenderPng: RenderPng = async (descriptor, context) => {
    const { renderDescriptor } = await import('./render')
    return renderDescriptor(descriptor, context)
}

const resolveRenderDependencies = (
    {
        assets,
        origin,
        renderPng = defaultRenderPng,
        renderTimeoutMs = RENDER_TIMEOUT_MS,
        storage = getOgImageStorage(),
    }: RenderDependencies = {},
    fallbackContext: RenderContext = {},
) => ({
    renderContext: {
        assets: assets ?? fallbackContext.assets,
        origin: origin ?? fallbackContext.origin,
    },
    renderPng,
    renderTimeoutMs,
    storage,
})

const withRenderTimeout = async (
    descriptor: OgImageDescriptor,
    renderPng: RenderPng,
    timeoutMs = RENDER_TIMEOUT_MS,
    context: RenderContext = {},
) => {
    const controller = new AbortController()
    let timeout: ReturnType<typeof setTimeout> | undefined

    try {
        const timeoutPromise = new Promise<never>((_, reject) => {
            timeout = setTimeout(() => {
                controller.abort()
                reject(new Error('OG image render timed out'))
            }, timeoutMs)
        })

        return await Promise.race([
            renderPng(descriptor, {
                ...context,
                signal: controller.signal,
            }),
            timeoutPromise,
        ])
    } finally {
        if (timeout) clearTimeout(timeout)
    }
}

const renderAndCache = async (
    storage: OgImageStorage,
    imageId: string,
    descriptor: OgImageDescriptor,
    renderPng: RenderPng,
    renderTimeoutMs = RENDER_TIMEOUT_MS,
    renderContext: RenderContext = {},
) => {
    const png = await withRenderTimeout(descriptor, renderPng, renderTimeoutMs, renderContext)
    await storage.setItemRaw(`png:${imageId}`, pngBytes(png), { ttl: PNG_TTL_SECONDS })
    return png
}

const putFailedMarker = (storage: OgImageStorage, imageId: string) =>
    storage.setItem(`failed:${imageId}`, '1', {
        ttl: FAILED_TTL_SECONDS,
    })

const backgroundRenderAndCache = (
    storage: OgImageStorage,
    imageId: string,
    descriptor: OgImageDescriptor,
    renderPng: RenderPng,
    renderTimeoutMs: number,
    renderContext: RenderContext,
) => {
    const start = Date.now()
    return renderAndCache(storage, imageId, descriptor, renderPng, renderTimeoutMs, renderContext)
        .then(() => {
            logger.info('Image rendered', {
                imageId,
                preset: descriptor.preset,
                durationMs: Date.now() - start,
            })
        })
        .catch((error: unknown) => {
            logger.error('Background render failed', {
                imageId,
                preset: descriptor.preset,
                durationMs: Date.now() - start,
                error: error instanceof Error ? error.message : String(error),
            })
        })
}

export async function issueAvatioImage(event: H3Event): Promise<Response>
export async function issueAvatioImage(options: IssueAvatioImageOptions): Promise<Response>
export async function issueAvatioImage(input: H3Event | IssueAvatioImageOptions) {
    const { body, origin, env, waitUntil, ...dependencies } = isH3Event(input)
        ? {
              body: await getEventBody(input),
              origin: getRequestURL(input).origin,
              env: getOgImageEnv(input) ?? {},
              waitUntil: getWaitUntil(input),
          }
        : input
    const bodyResult = v.safeParse(issueAvatioImageRequestSchema, body)
    if (!bodyResult.success) return jsonResponse({ error: 'Invalid request' }, 400)

    const validSecret = await timingSafeEqual(bodyResult.output.secret, env.OG_IMAGE_SECRET)
    if (!validSecret) {
        logger.warn('Unauthorized issue request', { origin })
        return jsonResponse({ error: 'Unauthorized' }, 401)
    }

    const descriptor: OgImageDescriptor = {
        preset: 'avatio',
        version: 'v1',
        props: bodyResult.output.props,
    }
    const imageId = await imageIdForDescriptor(descriptor)

    try {
        const { renderContext, renderPng, renderTimeoutMs, storage } = resolveRenderDependencies(
            dependencies,
            {
                assets: env.ASSETS,
                origin,
            },
        )
        await storage.setItem(`descriptor:${imageId}`, descriptorPayload(descriptor))

        waitUntil(
            backgroundRenderAndCache(
                storage,
                imageId,
                descriptor,
                renderPng,
                renderTimeoutMs,
                renderContext,
            ),
        )
        logger.info('Image issued', {
            origin,
            imageId,
            preset: descriptor.preset,
            props: descriptor.props,
        })
    } catch (error: unknown) {
        logger.error('Failed to issue image', {
            origin,
            imageId,
            error: error instanceof Error ? error.message : String(error),
        })
        return jsonResponse({ error: 'Unable to issue image URL' }, 500)
    }

    return jsonResponse({ url: `${origin}/v1/images/${imageId}.png` }, 202)
}

export async function getImage(event: H3Event): Promise<Response>
export async function getImage(options: GetImageOptions): Promise<Response>
export async function getImage(input: H3Event | GetImageOptions) {
    const {
        env,
        imageId: rawImageId,
        origin,
        ...dependencies
    } = isH3Event(input)
        ? {
              env: getOgImageEnv(input) ?? {},
              imageId: getImageIdFromEvent(input),
              origin: getRequestURL(input).origin,
          }
        : input
    const imageId = normalizeImageId(rawImageId)
    if (!imageIdPattern.test(imageId)) return notFoundResponse()

    const { renderContext, renderPng, renderTimeoutMs, storage } = resolveRenderDependencies(
        dependencies,
        { assets: env?.ASSETS, origin },
    )

    try {
        const cachedPng = await storage.getItemRaw<ArrayBuffer | ArrayBufferView>(`png:${imageId}`)
        if (cachedPng) return pngResponse(cachedPng)

        const failed = await storage.getItem(`failed:${imageId}`)
        if (failed) return notFoundResponse()

        const descriptor = parseDescriptor(await storage.getItem<string>(`descriptor:${imageId}`))
        if (!descriptor) return notFoundResponse()

        const renderStart = Date.now()
        const png = await renderAndCache(
            storage,
            imageId,
            descriptor,
            renderPng,
            renderTimeoutMs,
            renderContext,
        )
        logger.info('Image rendered on demand', {
            imageId,
            origin,
            preset: descriptor.preset,
            durationMs: Date.now() - renderStart,
        })
        return pngResponse(png)
    } catch (error: unknown) {
        logger.error('On-demand render failed', {
            imageId,
            origin,
            error: error instanceof Error ? error.message : String(error),
        })
        try {
            await putFailedMarker(storage, imageId)
        } catch {
            return storageUnavailableResponse()
        }
        return notFoundResponse()
    }
}

export async function cleanupImage(event: H3Event): Promise<Response>
export async function cleanupImage(options: CleanupImageOptions): Promise<Response>
export async function cleanupImage(input: H3Event | CleanupImageOptions) {
    const {
        body,
        env,
        imageId: rawImageId,
        storage = getOgImageStorage(),
    } = isH3Event(input)
        ? {
              body: await getEventBody(input),
              env: getOgImageEnv(input) ?? {},
              imageId: getImageIdFromEvent(input),
          }
        : input
    const secret = await validateCleanupSecret(body, env)
    if (!secret.ok) {
        logger.warn('Unauthorized cleanup request')
        return secret.response
    }

    const imageId = normalizeImageId(rawImageId)
    if (!imageIdPattern.test(imageId)) return notFoundResponse()

    try {
        const keys = cleanupKeysForImageId(imageId)
        const existingKeys = (
            await Promise.all(
                keys.map(async (key) => ((await storage.hasItem(key)) ? key : undefined)),
            )
        ).filter((key): key is string => key !== undefined)

        await Promise.all(existingKeys.map((key) => storage.removeItem(key)))

        logger.info('Image cleaned up', { imageId, deleted: existingKeys.length })
        return jsonResponse({
            imageId,
            deleted: existingKeys.length,
        })
    } catch (error: unknown) {
        logger.error('Failed to cleanup image', {
            imageId,
            error: error instanceof Error ? error.message : String(error),
        })
        return storageUnavailableResponse()
    }
}

export async function cleanupImages(event: H3Event): Promise<Response>
export async function cleanupImages(options: CleanupImagesOptions): Promise<Response>
export async function cleanupImages(input: H3Event | CleanupImagesOptions) {
    const {
        body,
        env,
        storage = getOgImageStorage(),
    } = isH3Event(input)
        ? {
              body: await getEventBody(input),
              env: getOgImageEnv(input) ?? {},
          }
        : input
    const secret = await validateCleanupSecret(body, env)
    if (!secret.ok) {
        logger.warn('Unauthorized cleanup request')
        return secret.response
    }

    try {
        const keys = [
            ...new Set(
                (await Promise.all(cleanupKeyPrefixes.map((prefix) => storage.getKeys(prefix))))
                    .flat()
                    .filter(isCleanupKey),
            ),
        ]

        await Promise.all(keys.map((key) => storage.removeItem(key)))

        logger.info('Images cleaned up', { deleted: keys.length })
        return jsonResponse({
            deleted: keys.length,
        })
    } catch (error: unknown) {
        logger.error('Failed to cleanup images', {
            error: error instanceof Error ? error.message : String(error),
        })
        return storageUnavailableResponse()
    }
}
