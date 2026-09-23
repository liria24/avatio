import { defineConfig } from 'drizzle-kit'

export default defineConfig({
    out: './drizzle',
    dialect: 'sqlite',
    schema: './database/schema.ts',
})
