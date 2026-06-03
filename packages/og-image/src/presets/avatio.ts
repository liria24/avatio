import notoSansJp100 from '@fontsource-variable/noto-sans-jp/files/noto-sans-jp-100-wght-normal.woff2'
import notoSansJp101 from '@fontsource-variable/noto-sans-jp/files/noto-sans-jp-101-wght-normal.woff2'
import notoSansJp102 from '@fontsource-variable/noto-sans-jp/files/noto-sans-jp-102-wght-normal.woff2'
import notoSansJp103 from '@fontsource-variable/noto-sans-jp/files/noto-sans-jp-103-wght-normal.woff2'
import notoSansJp104 from '@fontsource-variable/noto-sans-jp/files/noto-sans-jp-104-wght-normal.woff2'
import notoSansJp105 from '@fontsource-variable/noto-sans-jp/files/noto-sans-jp-105-wght-normal.woff2'
import notoSansJp106 from '@fontsource-variable/noto-sans-jp/files/noto-sans-jp-106-wght-normal.woff2'
import notoSansJp107 from '@fontsource-variable/noto-sans-jp/files/noto-sans-jp-107-wght-normal.woff2'
import notoSansJp108 from '@fontsource-variable/noto-sans-jp/files/noto-sans-jp-108-wght-normal.woff2'
import notoSansJp109 from '@fontsource-variable/noto-sans-jp/files/noto-sans-jp-109-wght-normal.woff2'
import notoSansJp110 from '@fontsource-variable/noto-sans-jp/files/noto-sans-jp-110-wght-normal.woff2'
import notoSansJp111 from '@fontsource-variable/noto-sans-jp/files/noto-sans-jp-111-wght-normal.woff2'
import notoSansJp112 from '@fontsource-variable/noto-sans-jp/files/noto-sans-jp-112-wght-normal.woff2'
import notoSansJp113 from '@fontsource-variable/noto-sans-jp/files/noto-sans-jp-113-wght-normal.woff2'
import notoSansJp114 from '@fontsource-variable/noto-sans-jp/files/noto-sans-jp-114-wght-normal.woff2'
import notoSansJp115 from '@fontsource-variable/noto-sans-jp/files/noto-sans-jp-115-wght-normal.woff2'
import notoSansJp116 from '@fontsource-variable/noto-sans-jp/files/noto-sans-jp-116-wght-normal.woff2'
import notoSansJp117 from '@fontsource-variable/noto-sans-jp/files/noto-sans-jp-117-wght-normal.woff2'
import notoSansJp118 from '@fontsource-variable/noto-sans-jp/files/noto-sans-jp-118-wght-normal.woff2'
import notoSansJp119 from '@fontsource-variable/noto-sans-jp/files/noto-sans-jp-119-wght-normal.woff2'
import notoSansJpLatin from '@fontsource-variable/noto-sans-jp/files/noto-sans-jp-latin-wght-normal.woff2'
import type { Node } from '@takumi-rs/wasm'

import { defineFont } from '../fonts'
import { avatioImagePropsSchema, type AvatioImageProps } from '../schema'
import { presetCacheKeys } from './cache'

const WIDTH = 1200
const HEIGHT = 630
const fontFamily = 'Noto Sans JP Variable'
const notoSansJpFonts = [
    ['latin', notoSansJpLatin],
    ['100', notoSansJp100],
    ['101', notoSansJp101],
    ['102', notoSansJp102],
    ['103', notoSansJp103],
    ['104', notoSansJp104],
    ['105', notoSansJp105],
    ['106', notoSansJp106],
    ['107', notoSansJp107],
    ['108', notoSansJp108],
    ['109', notoSansJp109],
    ['110', notoSansJp110],
    ['111', notoSansJp111],
    ['112', notoSansJp112],
    ['113', notoSansJp113],
    ['114', notoSansJp114],
    ['115', notoSansJp115],
    ['116', notoSansJp116],
    ['117', notoSansJp117],
    ['118', notoSansJp118],
    ['119', notoSansJp119],
] as const

const render = ({ title, description }: AvatioImageProps): Node => ({
    type: 'container',
    style: {
        width: WIDTH,
        height: HEIGHT,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '72px',
        backgroundColor: '#111113',
        color: '#f4f4f5',
        fontFamily,
    },
    children: [
        {
            type: 'container',
            style: {
                display: 'flex',
                flexDirection: 'column',
                gap: '24px',
            },
            children: [
                {
                    type: 'text',
                    text: title,
                    style: {
                        fontSize: '68px',
                        fontWeight: 800,
                        lineHeight: 1.12,
                        letterSpacing: '0px',
                        maxWidth: '960px',
                    },
                },
                ...(description
                    ? [
                          {
                              type: 'text' as const,
                              text: description,
                              style: {
                                  fontSize: '34px',
                                  fontWeight: 500,
                                  lineHeight: 1.45,
                                  color: '#d4d4d8',
                                  maxWidth: '900px',
                              },
                          },
                      ]
                    : []),
            ],
        },
        {
            type: 'container',
            style: {
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            },
            children: [
                {
                    type: 'text',
                    text: 'Avatio',
                    style: {
                        fontSize: '34px',
                        fontWeight: 800,
                        color: '#ffffff',
                    },
                },
                {
                    type: 'text',
                    text: 'avatio.liria.me',
                    style: {
                        fontSize: '24px',
                        fontWeight: 500,
                        color: '#a1a1aa',
                    },
                },
            ],
        },
    ],
})

export const avatioPreset = {
    id: 'avatio',
    version: 'v1',
    cacheKey: presetCacheKeys.avatio.v1,
    schema: avatioImagePropsSchema,
    fonts: notoSansJpFonts.map(([key, data]) =>
        defineFont(`noto-sans-jp-${key}`, fontFamily, data)
    ),
    render,
    renderOptions: {
        width: WIDTH,
        height: HEIGHT,
        format: 'png',
        devicePixelRatio: 1,
    },
} as const
