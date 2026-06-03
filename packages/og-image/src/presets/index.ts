import type { OgImageDescriptor } from '../schema'
import { avatioPreset } from './avatio'

export const ogImagePresets = {
    avatio: avatioPreset,
} as const

export type OgImagePreset = (typeof ogImagePresets)[keyof typeof ogImagePresets]

export const getPreset = (descriptor: OgImageDescriptor): OgImagePreset | undefined => {
    const preset = ogImagePresets[descriptor.preset]
    return preset.version === descriptor.version ? preset : undefined
}
