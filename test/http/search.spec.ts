import { randomUUID } from 'node:crypto'

import { eq } from 'drizzle-orm'

import { users } from '../../database/schema'
import { startTestRuntime } from '../helpers/runtime'
import { seedCatalogItem } from '../helpers/seeds'

it('searches long, multibyte and literal wildcard text through local D1', async () => {
    const runtime = await startTestRuntime()
    try {
        for (const prefix of ['Long catalog item', '日本語の商品名を正しく検索', 'Literal_%']) {
            const item = await seedCatalogItem(runtime, `${prefix} ${randomUUID()}`)
            const unrelated = await seedCatalogItem(runtime, item.name.replaceAll('_%', 'XYZ'))
            const response = await fetch(
                `${runtime.origin}/api/items?q=${encodeURIComponent(item.name)}&page=1&limit=24`,
            )
            expect(response.status, runtime.diagnostics()).toBe(200)
            const body = (await response.json()) as { data: { id: string }[] }
            const ids = body.data.map((value) => value.id)
            expect(ids).toContain(item.id)
            if (prefix === 'Literal_%') expect(ids).not.toContain(unrelated.id)
        }
        const user = await runtime.createUser()
        const name = `Prefix 日本語の検索対象名_${randomUUID()} Suffix`
        await runtime.db.update(users).set({ name }).where(eq(users.id, user.id))
        for (const [operator, value, found] of [
            ['contains', name.slice(7, -7), true],
            ['starts_with', name.slice(0, -7).toLowerCase(), true],
            ['ends_with', name.slice(7).toUpperCase(), true],
            ['starts_with', name.slice(7), false],
            ['ends_with', name.slice(0, -7), false],
        ] as const) {
            const query = new URLSearchParams({
                searchField: 'name',
                searchOperator: operator,
                searchValue: value,
            })
            const response = await fetch(`${runtime.origin}/api/admin/user?${query}`, {
                headers: runtime.admin.headers,
            })
            expect(response.status, runtime.diagnostics()).toBe(200)
            const body = (await response.json()) as { id: string }[]
            const ids = body.map((value) => value.id)
            expect(ids.includes(user.id)).toBe(found)
        }
        for (const route of [
            'setups',
            'setups/tags',
            'users',
            'changelogs',
            'admin/setups',
            'admin/changelogs',
            'admin/feedbacks',
            'admin/audit-log',
        ]) {
            const response = await fetch(
                `${runtime.origin}/api/${route}?q=${encodeURIComponent(name)}`,
                { headers: runtime.admin.headers },
            )
            expect(response.status, runtime.diagnostics()).toBe(200)
        }
    } finally {
        await runtime.clean()
    }
}, 120_000)
