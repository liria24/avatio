import type { OgImageDescriptor } from '../schema'

export const presetCacheKeys = {
    avatio: {
        v1: 'avatio:v1:noto-sans-jp-shards-100-119',
    },
} as const

export const getPresetCacheKey = (descriptor: OgImageDescriptor) =>
    presetCacheKeys[descriptor.preset][descriptor.version] ?? `${descriptor.preset}:${descriptor.version}`
