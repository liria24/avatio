import { defineCollection, defineContentConfig } from '@nuxt/content'
import { defineRobotsSchema } from '@nuxtjs/robots/content'
import { defineSitemapSchema } from '@nuxtjs/sitemap/content'
import { defineOgImageSchema } from 'nuxt-og-image/content'
import { defineSchemaOrgSchema } from 'nuxt-schema-org/content'
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
                image: z.string().optional(),
                updatedAt: z.string().optional(),
                effectiveDate: z.string().optional(),
                commitLogPath: z.string().optional(),
                schemaOrg: defineSchemaOrgSchema(),
                sitemap: defineSitemapSchema(),
                robots: defineRobotsSchema(),
                ogImage: defineOgImageSchema(),
            }),
        }),
        content_ja: defineCollection({
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
                schemaOrg: defineSchemaOrgSchema(),
                sitemap: defineSitemapSchema(),
                robots: defineRobotsSchema(),
                ogImage: defineOgImageSchema(),
            }),
        }),
    },
})
