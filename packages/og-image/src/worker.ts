import * as v from 'valibot'

import {
    issueAvatioImageRequestSchema,
    ogImageDescriptorSchema,
    type OgImageDescriptor,
    type OgImageEnv,
    type WaitUntil,
} from './schema'
import { getOgImageStorage, type OgImageStorage } from './storage'
import { getPresetCacheKey } from './presets/cache'

export const PNG_TTL_SECONDS = 60 * 60 * 24 * 30
export const FAILED_TTL_SECONDS = 60 * 5
export const RENDER_TIMEOUT_MS = 15_000
export const SUCCESS_CACHE_CONTROL = 'public, max-age=31536000, immutable'
export const FAILURE_CACHE_CONTROL = 'no-store'

const imageIdPattern = /^[a-f0-9]{64}$/
const pngExtensionPattern = /\.png$/i

type CanonicalValue =
    | string
    | number
    | boolean
    | null
    | CanonicalValue[]
    | { [key: string]: CanonicalValue }

export type RenderPng = (descriptor: OgImageDescriptor, signal?: AbortSignal) => Promise<Uint8Array>

export interface RenderDependencies {
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
    imageId: string
}

const canonicalize = (value: unknown): CanonicalValue => {
    if (value === null) return null

    if (Array.isArray(value)) return value.map((item) => canonicalize(item))

    if (typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .filter(([, entry]) => entry !== undefined)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([key, entry]) => [key, canonicalize(entry)]),
        )
    }

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
        return value

    return null
}

export const canonicalJson = (value: unknown) => JSON.stringify(canonicalize(value))

export const descriptorPayload = (descriptor: OgImageDescriptor) =>
    canonicalJson({
        preset: descriptor.preset,
        version: descriptor.version,
        cacheKey: getPresetCacheKey(descriptor),
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

const defaultRenderPng: RenderPng = async (descriptor, signal) => {
    const { renderDescriptor } = await import('./render')
    return renderDescriptor(descriptor, signal)
}

const resolveRenderDependencies = ({
    renderPng = defaultRenderPng,
    renderTimeoutMs = RENDER_TIMEOUT_MS,
    storage = getOgImageStorage(),
}: RenderDependencies = {}) => ({
    renderPng,
    renderTimeoutMs,
    storage,
})

const withRenderTimeout = async (
    descriptor: OgImageDescriptor,
    renderPng: RenderPng,
    timeoutMs = RENDER_TIMEOUT_MS,
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

        return await Promise.race([renderPng(descriptor, controller.signal), timeoutPromise])
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
) => {
    const png = await withRenderTimeout(descriptor, renderPng, renderTimeoutMs)
    await storage.setItemRaw(`png:${imageId}`, pngBytes(png), {
        ttl: PNG_TTL_SECONDS,
    })
    return png
}

const putFailedMarker = (storage: OgImageStorage, imageId: string) =>
    storage.setItem(`failed:${imageId}`, '1', {
        ttl: FAILED_TTL_SECONDS,
    })

const logBackgroundFailure = (imageId: string, error: unknown) => {
    console.error(
        JSON.stringify({
            level: 'error',
            message: 'OG image pre-render failed',
            imageId,
            error: error instanceof Error ? error.message : 'Unknown error',
        }),
    )
}

export const issueAvatioImage = async ({
    body,
    origin,
    env,
    waitUntil,
    ...dependencies
}: IssueAvatioImageOptions) => {
    const bodyResult = v.safeParse(issueAvatioImageRequestSchema, body)
    if (!bodyResult.success) return jsonResponse({ error: 'Invalid request' }, 400)

    const validSecret = await timingSafeEqual(bodyResult.output.secret, env.OG_IMAGE_SECRET)
    if (!validSecret) return jsonResponse({ error: 'Unauthorized' }, 401)

    const descriptor: OgImageDescriptor = {
        preset: 'avatio',
        version: 'v1',
        props: bodyResult.output.props,
    }
    const imageId = await imageIdForDescriptor(descriptor)

    try {
        const { renderPng, renderTimeoutMs, storage } = resolveRenderDependencies(dependencies)
        await storage.setItem(`descriptor:${imageId}`, descriptorPayload(descriptor))

        waitUntil(
            renderAndCache(storage, imageId, descriptor, renderPng, renderTimeoutMs).catch(
                (error: unknown) => logBackgroundFailure(imageId, error),
            ),
        )
    } catch {
        return jsonResponse({ error: 'Unable to issue image URL' }, 500)
    }

    return jsonResponse({ url: `${origin}/v1/images/${imageId}.png` }, 202)
}

export const getImage = async ({ imageId: rawImageId, ...dependencies }: GetImageOptions) => {
    const imageId = normalizeImageId(rawImageId)
    if (!imageIdPattern.test(imageId)) return notFoundResponse()

    const { renderPng, renderTimeoutMs, storage } = resolveRenderDependencies(dependencies)

    try {
        const cachedPng = await storage.getItemRaw<ArrayBuffer | ArrayBufferView>(
            `png:${imageId}`,
        )
        if (cachedPng) return pngResponse(cachedPng)

        const failed = await storage.getItem(`failed:${imageId}`)
        if (failed) return notFoundResponse()

        const descriptor = parseDescriptor(await storage.getItem<string>(`descriptor:${imageId}`))
        if (!descriptor) return notFoundResponse()

        return pngResponse(
            await renderAndCache(storage, imageId, descriptor, renderPng, renderTimeoutMs),
        )
    } catch {
        try {
            await putFailedMarker(storage, imageId)
        } catch {
            return storageUnavailableResponse()
        }
        return notFoundResponse()
    }
}
