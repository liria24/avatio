import { defineConfig } from 'drizzle-kit'

export default defineConfig({
    out: './drizzle',
    dialect: 'postgresql',
    schema: './database/schema.ts',
    dbCredentials: {
        url: process?.env?.NUXT_NEON_DATABASE_URL || '',
    },
    schemaFilter: ['public', 'auth', 'bookmark', 'feedback', 'admin'],
    tablesFilter: ['*'],
})
