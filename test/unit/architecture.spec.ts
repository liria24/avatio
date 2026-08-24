import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { extname, join, relative } from 'node:path'

const sourceExtensions = new Set(['.ts', '.vue'])

const sourceFiles = async (directory: string): Promise<string[]> => {
    const entries = await readdir(directory, { withFileTypes: true })
    const nested = await Promise.all(
        entries.map(async (entry) => {
            const path = join(directory, entry.name)
            if (entry.isDirectory()) return sourceFiles(path)
            return sourceExtensions.has(extname(entry.name)) ? [path] : []
        }),
    )
    return nested.flat()
}

const importedModules = (source: string) =>
    [...source.matchAll(/(?:from\s+|import\s*\()\s*['"]([^'"]+)['"]/g)].map(
        (match) => match[1] ?? '',
    )

describe('workspace architecture boundaries', () => {
    it('keeps @avatio/core framework and infrastructure independent', async () => {
        const root = join(process.cwd(), 'packages/core/src')
        const violations: string[] = []

        for (const file of await sourceFiles(root)) {
            const source = await readFile(file, 'utf8')
            const imports = importedModules(source)
            const forbiddenImport = imports.find((module) =>
                [
                    'nuxt',
                    'nitro',
                    'h3',
                    'drizzle-orm',
                    'better-auth',
                    '@better-auth/',
                    '@cloudflare/',
                    'workers-ai-provider',
                ].some((prefix) => module === prefix || module.startsWith(prefix)),
            )
            if (forbiddenImport) {
                violations.push(`${relative(process.cwd(), file)} imports ${forbiddenImport}`)
            }
            if (/\bprocess\.env\b|event\.context\.cloudflare/.test(source)) {
                violations.push(`${relative(process.cwd(), file)} reads runtime infrastructure`)
            }
        }

        expect(violations).toEqual([])
    })

    it('keeps @avatio/nuxt independent from @avatio/cloudflare', async () => {
        const root = join(process.cwd(), 'packages/nuxt/src')
        const violations: string[] = []

        for (const file of await sourceFiles(root)) {
            const source = await readFile(file, 'utf8')
            if (importedModules(source).includes('@avatio/cloudflare')) {
                violations.push(relative(process.cwd(), file))
            }
        }

        expect(violations).toEqual([])
    })

    it('keeps concrete AI model IDs out of routes and application code', async () => {
        const roots = ['app', 'server', 'packages/core/src', 'packages/nuxt/src'].map((path) =>
            join(process.cwd(), path),
        )
        const violations: string[] = []

        for (const root of roots)
            for (const file of await sourceFiles(root)) {
                const source = await readFile(file, 'utf8')
                if (/(?:openai|anthropic|google|@cf)\/[\w./-]+/.test(source))
                    violations.push(relative(process.cwd(), file))
            }

        expect(violations).toEqual([])
    })

    it('keeps process.env out of application and domain source', async () => {
        const roots = ['app', 'server', 'shared', 'packages/core/src', 'packages/nuxt/src'].map(
            (path) => join(process.cwd(), path),
        )
        const violations: string[] = []

        for (const root of roots)
            for (const file of await sourceFiles(root)) {
                const source = await readFile(file, 'utf8')
                if (/\bprocess\.env\b/.test(source)) violations.push(relative(process.cwd(), file))
            }

        expect(violations).toEqual([])
    })

    it('keeps shared HTTP contracts independent from Drizzle tables', async () => {
        const file = join(process.cwd(), 'shared/types/database.ts')
        const source = await readFile(file, 'utf8')

        expect(importedModules(source)).not.toContain('drizzle-orm')
        expect(source).not.toMatch(/database\/schema|database\\schema/)
    })

    it('localizes framework augmentations instead of restoring root types.d.ts', async () => {
        expect(existsSync(join(process.cwd(), 'types.d.ts'))).toBe(false)
        expect(existsSync(join(process.cwd(), 'shared/types/nuxtBetterAuth.d.ts'))).toBe(true)
        expect(existsSync(join(process.cwd(), 'server/types.d.ts'))).toBe(true)
    })

    it('uses the Better Auth module without duplicate runtime handlers or client state', async () => {
        const nuxtConfig = await readFile(join(process.cwd(), 'nuxt.config.ts'), 'utf8')
        const rootAuthConfig = await readFile(join(process.cwd(), 'auth.config.ts'), 'utf8')
        const handlerHelpers = await readFile(
            join(process.cwd(), 'server/utils/eventHandler.ts'),
            'utf8',
        )

        expect(nuxtConfig).toContain("'@nuxtjs/better-auth'")
        expect(existsSync(join(process.cwd(), 'server/auth.config.ts'))).toBe(true)
        expect(existsSync(join(process.cwd(), 'app/auth.config.ts'))).toBe(true)
        expect(existsSync(join(process.cwd(), 'server/api/auth/[...all].ts'))).toBe(false)
        expect(existsSync(join(process.cwd(), 'app/composables/auth.ts'))).toBe(false)
        expect(rootAuthConfig).toContain('CLI schema-generation compatibility adapter only')
        expect(handlerHelpers).not.toContain('adminSessionEventHandler')
    })

    it('guards every admin API explicitly at the server boundary', async () => {
        const root = join(process.cwd(), 'server/api/admin')
        const violations: string[] = []

        for (const file of await sourceFiles(root)) {
            const source = await readFile(file, 'utf8')
            if (
                !/requireUserSession\(event,\s*\{\s*user:\s*\{\s*role:\s*['"]admin['"]/.test(source)
            )
                violations.push(relative(process.cwd(), file))
        }

        expect(violations).toEqual([])
    })

    it('keeps provider keys out of the Setup query service', async () => {
        const source = await readFile(join(process.cwd(), 'server/utils/setupQuery.ts'), 'utf8')

        expect(source).not.toMatch(/['"]booth['"]|['"]github['"]|platformSchema/)
    })
})
