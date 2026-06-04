import type { ImageNode, ImageSource } from '@takumi-rs/wasm'

export interface SvgImageAsset {
    src: string
    svg: string
}

interface DefineSvgImageOptions {
    color: string
    width: number
    height: number
    src?: string
}

export const defineSvgImage = (
    asset: SvgImageAsset,
    { color, height, src = asset.src, width }: DefineSvgImageOptions,
): { image: ImageSource; node: ImageNode } => ({
    image: {
        src,
        data: new TextEncoder().encode(withSvgRootColor(asset.svg, color)),
    },
    node: {
        type: 'image',
        src,
        width,
        height,
    },
})

const withSvgRootColor = (svg: string, color: string) => {
    let foundSvgRoot = false
    const replaced = svg.replace(/<svg\b([^>]*)>/i, (_tag, attributes: string) => {
        foundSvgRoot = true
        const nextAttributes = attributes.match(/\sstyle=(["'])(.*?)\1/i)
            ? attributes.replace(
                  /\sstyle=(["'])(.*?)\1/i,
                  (_style, quote: string, style: string) =>
                      ` style=${quote}${escapeAttribute(setStyleColor(style, color))}${quote}`,
              )
            : `${attributes} style="color: ${escapeAttribute(color)};"`

        return `<svg${nextAttributes}>`
    })

    if (!foundSvgRoot) throw new Error('SVG root element was not found.')

    return replaced
}

const setStyleColor = (style: string, color: string) => {
    const normalizedStyle = style.trim().replace(/;+$/, '')
    const nextStyle = normalizedStyle.match(/(^|;)\s*color\s*:/i)
        ? normalizedStyle.replace(/(^|;)\s*color\s*:[^;]*/i, `$1 color: ${color}`)
        : [normalizedStyle, `color: ${color}`].filter(Boolean).join('; ')

    return nextStyle.trim().replace(/;?$/, ';')
}

const escapeAttribute = (value: string) =>
    value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
