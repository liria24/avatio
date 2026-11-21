import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'
import { pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import type { D1Database } from '@cloudflare/workers-types'
import { hashPassword } from 'better-auth/crypto'
import { drizzle } from 'drizzle-orm/d1'
import { getPlatformProxy } from 'wrangler'

import { getLocalD1Paths } from '../../config/localD1'
import { relations } from '../../database/relations'
import { accounts } from '../../database/schema'
import { createTestAuth } from './auth'

const sourceRoot = resolve(import.meta.dirname, '../..')
const fixtureOrigin = 'http://localhost:3000'
// Nuxt's component scanner requires fixtures and the linked node_modules on the same Windows drive.
const fixtureParent = join(sourceRoot, '.data')
const fixturePrefix = join(fixtureParent, 'avatio-http-')

const childEnvironment = () => {
    const env: NodeJS.ProcessEnv = {}
    for (const name of [
        'PATH',
        'Path',
        'HOME',
        'USERPROFILE',
        'SYSTEMROOT',
        'SystemRoot',
        'TEMP',
        'TMP',
        'COMSPEC',
    ])
        if (process.env[name]) env[name] = process.env[name]
    return {
        ...env,
        NODE_ENV: 'development',
        CI: '1',
        VITEST: '1',
        NUXT_TELEMETRY_DISABLED: '1',
        // Nitro's supported TCP dev-worker transport also works in Unix-socket-restricted executors.
        NITRO_NO_UNIX_SOCKET: '1',
        NODE_OPTIONS: `--max-old-space-size=4096 --import=${pathToFileURL(join(sourceRoot, 'test/helpers/runtimeNetwork.mjs')).href}`,
    }
}

const stopChild = async (child: ChildProcess) => {
    const signalGroup = (signal: NodeJS.Signals) => {
        if (process.platform !== 'win32' && child.pid) {
            try {
                process.kill(-child.pid, signal)
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error
            }
        } else child.kill(signal)
    }
    if (child.exitCode !== null) {
        signalGroup('SIGTERM')
        return
    }
    const exited = new Promise<void>((resolveExit) => child.once('exit', () => resolveExit()))
    signalGroup('SIGTERM')
    await Promise.race([exited, delay(5_000)])
    if (child.exitCode === null) {
        signalGroup('SIGKILL')
        await exited
    }
}

export const startTestRuntime = async () => {
    // Leave time for failure logs and child cleanup before the 120-second HTTP hook expires.
    const deadline = Date.now() + 110_000
    await mkdir(fixtureParent, { recursive: true })
    const root = await mkdtemp(fixturePrefix)
    // Never recursively delete a caller-supplied path or the normal workspace/local state.
    if (dirname(root) !== fixtureParent || !root.startsWith(fixturePrefix))
        throw new Error('Unsafe test root')
    let child: ChildProcess | undefined
    let proxy: Awaited<ReturnType<typeof getPlatformProxy<{ APP_DB: D1Database }>>> | undefined
    const clean = async () => {
        if (child) await stopChild(child)
        await proxy?.dispose()
        await rm(root, { recursive: true, force: true })
    }
    try {
        let occupied = false
        try {
            await fetch(fixtureOrigin, { signal: AbortSignal.timeout(1_000) })
            occupied = true
        } catch {
            /* No existing listener. */
        }
        if (occupied) throw new Error('Test port 3000 is occupied; refusing to use an existing app')
        for (const path of [
            'app',
            'layers',
            'server',
            'shared',
            'database',
            'drizzle',
            'config',
            'deployment',
            'scripts',
            'packages',
            'i18n',
            'public',
            'content',
            'package.json',
            'files.config.ts',
            'nuxt.config.ts',
            'vite.config.ts',
            'bunfig.toml',
        ])
            await cp(join(sourceRoot, path), join(root, path), { recursive: true })
        await symlink(
            join(sourceRoot, 'node_modules'),
            join(root, 'node_modules'),
            process.platform === 'win32' ? 'junction' : 'dir',
        )
        const applicationConfig = await readFile(join(root, 'nuxt.config.ts'), 'utf8')
        await writeFile(join(root, 'application.config.ts'), applicationConfig)
        await writeFile(
            join(root, 'nuxt.config.ts'),
            `
import application from './application.config.ts'
export default defineNuxtConfig({
    ...application,
    devtools: { enabled: false },
    fonts: { providers: { google: false, googleicons: false, bunny: false, fontshare: false, fontsource: false, adobe: false } },
    pwa: { ...application.pwa, disable: true },
})
`,
        )
        await writeFile(join(root, '.env'), '')
        const marker = randomUUID()
        await writeFile(
            join(root, 'server/middleware/00-test-fixture.ts'),
            `export default defineEventHandler(event => setResponseHeader(event, 'x-avatio-test-fixture', ${JSON.stringify(marker)}))`,
        )
        for (const document of ['terms', 'privacy-policy']) {
            const path = join(root, `content/ja/${document}.md`)
            const content = await readFile(path, 'utf8')
            await writeFile(
                path,
                content
                    .replace(/^version:.*$/m, "version: '2020-01-01'")
                    .replace(/^effectiveDate:.*$/m, "effectiveDate: '2020-01-01'"),
            )
        }
        const log: string[] = []
        await promisify(execFile)(
            process.execPath,
            [
                '--input-type=module',
                '--eval',
                `import { prepareLocalD1 } from './scripts/localDevelopment.ts'; prepareLocalD1()`,
            ],
            { cwd: root, env: childEnvironment(), windowsHide: true },
        )
        child = spawn(
            process.execPath,
            [
                join(sourceRoot, 'node_modules/nuxt/bin/nuxt.mjs'),
                'dev',
                root,
                '--port',
                '3000',
                '--no-fork',
            ],
            {
                cwd: root,
                env: childEnvironment(),
                windowsHide: true,
                detached: process.platform !== 'win32',
                stdio: ['ignore', 'pipe', 'pipe'],
            },
        )
        child.stdout?.on('data', (chunk: Buffer) => log.push(chunk.toString()))
        child.stderr?.on('data', (chunk: Buffer) => log.push(chunk.toString()))
        let ready = false
        while (Date.now() < deadline && child.exitCode === null) {
            try {
                const response = await fetch(`${fixtureOrigin}/api/avatio/legal/status`, {
                    signal: AbortSignal.timeout(2_000),
                })
                if (
                    response.headers.get('x-avatio-test-fixture') === marker &&
                    [200, 401].includes(response.status)
                ) {
                    ready = true
                    break
                }
            } catch {
                /* The listener is not ready yet. */
            }
            await delay(250)
        }
        if (!ready)
            throw new Error(`Isolated Nuxt did not become ready:\n${log.join('').slice(-12_000)}`)
        // Nitro can report ready even after Vite's initial dependency scan has failed.
        if (
            /vite:dep-scan:resolve|Failed to scan for dependencies|Missing "#components" specifier/.test(
                log.join(''),
            )
        )
            throw new Error(`Nuxt dependency discovery failed:\n${log.join('').slice(-12_000)}`)
        const paths = getLocalD1Paths(root)
        proxy = await getPlatformProxy<{ APP_DB: D1Database }>({
            configPath: paths.configPath,
            persist: { path: paths.proxyPersistencePath },
            remoteBindings: false,
        })
        const db = drizzle(proxy.env.APP_DB, { relations })
        const auth = createTestAuth(
            db,
            (await readFile(join(root, '.data/local-auth-secret'), 'utf8')).trim(),
        )
        const helpers = (await auth.$context).test
        const createUser = async (
            overrides: { role?: string; banned?: boolean; initialLegal?: boolean } = {},
        ) => {
            const suffix = randomUUID().replaceAll('-', '')
            const username = `test_${suffix.slice(0, 20)}`
            const user = await helpers.saveUser(
                helpers.createUser({
                    id: suffix,
                    email: `${suffix}@example.test`,
                    name: username,
                    username,
                    displayUsername: username,
                    role: overrides.role ?? 'user',
                    banned: overrides.banned ?? false,
                    lastAgreedToTerms: overrides.initialLegal ? null : new Date(),
                }),
            )
            const password = `Test-only-${suffix}`
            await db.insert(accounts).values({
                id: randomUUID(),
                userId: user.id,
                providerAccountId: user.id,
                providerId: 'credential',
                password: await hashPassword(password),
                createdAt: new Date(),
                updatedAt: new Date(),
            })
            const login = await helpers.login({ userId: user.id })
            return {
                ...user,
                username,
                password,
                cookies: login.cookies,
                headers: login.headers,
                session: login.session,
            }
        }
        // The first-user trigger is exercised in this private fixture, never a deployed database.
        const admin = await createUser({ role: 'admin' })
        if ((await db.query.users.findFirst({ where: { id: admin.id } }))?.role !== 'admin')
            throw new Error('Fixture admin was not created')
        return {
            root,
            db,
            admin,
            createUser,
            auth,
            clean,
            diagnostics: () => log.join(''),
            origin: fixtureOrigin,
        }
    } catch (error) {
        await clean()
        throw error
    }
}

export type TestRuntime = Awaited<ReturnType<typeof startTestRuntime>>
export type FixtureUser = Awaited<ReturnType<TestRuntime['createUser']>>
