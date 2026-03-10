import { defineCollection, defineContentConfig } from '@nuxt/content'
import { asSchemaOrgCollection } from 'nuxt-schema-org/content'
import { z } from 'zod'

export default defineContentConfig({
    collections: {
        content_en: defineCollection(
            asSchemaOrgCollection({
                source: {
                    include: 'en/**',
                    prefix: '',
                },
                type: 'page',
                schema: z.object({
                    image: z.string().optional(),
                    updatedAt: z.string().optional(),
                    effectiveDate: z.string().optional(),
                    commitLogPath: z.string().optional(),
                }),
            }),
        ),
        content_ja: defineCollection(
            asSchemaOrgCollection({
                source: {
                    include: 'ja/**',
                    prefix: '',
                },
                type: 'page',
                schema: z.object({
                    image: z.string().optional(),
                    updatedAt: z.string().optional(),
                    effectiveDate: z.string().optional(),
                    commitLogPath: z.string().optional(),
                }),
            }),
        ),
    },
})
