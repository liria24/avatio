import { defineCollection, defineContentConfig } from '@nuxt/content'
import { z } from 'zod'

export default defineContentConfig({
    collections: {
        content_en: defineCollection({
            source: {
                include: 'en/**',
                prefix: '',
            },
            type: 'page',
            schema: z.object({
                image: z.string(),
            }),
        }),
        content_ja: defineCollection({
            source: {
                include: 'ja/**',
                prefix: '',
            },
            type: 'page',
            schema: z.object({
                image: z.string(),
            }),
        }),
    },
})
