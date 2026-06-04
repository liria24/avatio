import { describe, expect, it } from 'vitest'

import avatioPreset from '../src/presets/avatio'
import { defineSvgImage } from '../src/svgImage'

const decode = (value: Uint8Array | ArrayBuffer) => new TextDecoder().decode(value)

describe('defineSvgImage', () => {
    it('injects preset-controlled root color without replacing currentColor', () => {
        const result = defineSvgImage(
            {
                src: 'avatio',
                svg: '<svg width="64" height="64" fill="currentColor"><path stroke="currentColor" /></svg>',
            },
            {
                src: 'avatio-footer-logo',
                color: '#71717b',
                width: 80,
                height: 80,
            },
        )

        const svg = decode(result.image.data)

        expect(result.image.src).toBe('avatio-footer-logo')
        expect(result.node).toEqual({
            type: 'image',
            src: 'avatio-footer-logo',
            width: 80,
            height: 80,
        })
        expect(svg).toContain('currentColor')
        expect(svg).toContain('style="color: #71717b;"')
    })

    it('merges root style color when a style attribute already exists', () => {
        const result = defineSvgImage(
            {
                src: 'icon',
                svg: '<svg style="display: block;" fill="currentColor"></svg>',
            },
            {
                color: '#18181b',
                width: 24,
                height: 24,
            },
        )

        expect(decode(result.image.data)).toContain('style="display: block; color: #18181b;"')
    })
})

describe('avatio preset SVG logo', () => {
    it('registers a colored SVG image resource and renders the matching image node', () => {
        const image = avatioPreset.persistentImages?.find(
            (persistentImage) => persistentImage.src === 'avatio-footer-logo',
        )
        const node = avatioPreset.render({ title: 'Title' })

        expect(image).toBeDefined()
        expect(image ? decode(image.data) : '').toContain('currentColor')
        expect(image ? decode(image.data) : '').toContain('style="color: #18181b;"')
        expect(JSON.stringify(node)).toContain('"src":"avatio-footer-logo"')
    })
})
