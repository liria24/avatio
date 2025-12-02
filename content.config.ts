import { defineCollection, defineContentConfig } from '@nuxt/content'

export default defineContentConfig({
    collections: {
        general: defineCollection({
            source: 'general/*.md',
            type: 'page',
        }),
    },
})
