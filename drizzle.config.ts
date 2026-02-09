import { defineConfig } from 'drizzle-kit'

export default defineConfig({
    out: './drizzle',
    dialect: 'postgresql',
    schema: './database/schema.ts',
    dbCredentials: {
        url: process?.env?.NEON_DATABASE_URL || '',
    },
    schemaFilter: ['public', 'auth', 'personal', 'feedback', 'admin'],
    tablesFilter: ['*'],
})
