import { glob } from 'node:fs/promises'

import { fetch, setup } from '@nuxt/test-utils/e2e'

const endpointFromFile = (file: string) => {
    const match = file
        .replaceAll('\\', '/')
        .match(/server\/api\/(.+?)(?:\.(get|post|put|patch|delete))?\.ts$/)
    if (!match?.[1]) throw new Error(`Unsupported API route filename: ${file}`)

    const route = match[1].replace(/\/index$/, '').replace(/\[\.\.\.[^\]]+\]|\[[^\]]+\]/g, 'test')
    return { path: `/api/${route}`, method: (match[2] ?? 'get').toUpperCase() }
}

const endpoints = await Array.fromAsync(glob('server/api/admin/**/*.ts'), endpointFromFile)

describe('admin API authorization', async () => {
    await setup({ rootDir: process.cwd(), dev: true, browser: false, port: 3000 })

    it.each(endpoints)(
        '$method $path rejects unauthenticated requests',
        async ({ path, method }) => {
            expect((await fetch(path, { method })).status).toBe(401)
        },
    )
})
