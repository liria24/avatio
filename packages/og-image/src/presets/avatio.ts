import * as v from 'valibot'

import { images } from '#og-image-images'

import { definePreset } from '../definePreset'
import { defineSvgImage } from '../svgImage'

const footerLogo = defineSvgImage(images.avatio, {
    src: 'avatio-footer-logo',
    color: '#18181b',
    width: 80,
    height: 80,
})

export default definePreset({
    version: 'v1',
    props: v.object({
        title: v.pipe(v.string(), v.trim(), v.minLength(1), v.maxLength(120)),
        description: v.optional(v.pipe(v.string(), v.trim(), v.maxLength(240))),
    }),
    fonts: [
        { family: 'Geist', options: { weight: '100..900' } },
        { family: 'Noto Sans JP', options: { weight: '100..900' } },
    ],
    persistentImages: [footerLogo.image],
    fontText: ({ title, description }) => [title, description],
    render: ({ title, description }) => ({
        type: 'container',
        style: {
            width: '100%',
            height: '100%',
            display: 'flex',
            padding: '24px',
            backgroundColor: '#b7b7c0',
            color: '#18181b',
            fontFamily: 'Geist, Noto Sans JP',
        },
        children: [
            {
                type: 'container',
                style: {
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    padding: '72px',
                    borderRadius: '36px',
                    backgroundColor: '#ffffff',
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
                                              color: '#71717b',
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
                            justifyContent: 'flex-end',
                        },
                        children: [footerLogo.node],
                    },
                ],
            },
        ],
    }),
})
