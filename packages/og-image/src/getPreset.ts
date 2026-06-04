import { allPresets } from '#og-image-presets'

import type { OgImagePreset } from './definePreset'
import type { OgImageDescriptor } from './schema'

export type { OgImagePreset }

const presetMap: Record<string, OgImagePreset> = Object.fromEntries(
    allPresets.map((preset) => [preset.id, preset]),
)

export const getPreset = (descriptor: OgImageDescriptor): OgImagePreset | undefined => {
    const preset = presetMap[descriptor.preset]
    return preset?.version === descriptor.version ? preset : undefined
}
