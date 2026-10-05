import { test as nuxtTest, expect } from '@nuxt/test-utils/playwright'
import type { BrowserContext, Page } from '@playwright/test'

import labels from '../../i18n/locales/en-US.json' with { type: 'json' }
import { startTestRuntime, type FixtureUser, type TestRuntime } from '../helpers/runtime'
import { seedCatalogItem } from '../helpers/seeds'

export { expect, labels }
export const authenticate = async (context: BrowserContext, user: FixtureUser) => {
    await context.addCookies(user.cookies)
}
export const test = nuxtTest.extend<{ account: FixtureUser }, { runtime: TestRuntime }>({
    runtime: [
        // Playwright requires an object pattern even when a fixture has no dependencies.
        // eslint-disable-next-line no-empty-pattern
        async ({}, use) => {
            const runtime = await startTestRuntime()
            try {
                await use(runtime)
            } finally {
                await runtime.clean()
            }
        },
        { scope: 'worker', timeout: 150_000 },
    ],
    nuxt: [
        async ({ runtime }, use) => {
            await use({ rootDir: runtime.root, host: runtime.origin, browser: false, dev: true })
        },
        { scope: 'worker' },
    ],
    account: async ({ runtime }, use) => {
        await use(await runtime.createUser())
    },
    context: async ({ context }, use) => {
        await context.route('**/*', async (route) => {
            const url = new URL(route.request().url())
            if (['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) await route.continue()
            else await route.abort('blockedbyclient')
        })
        await use(context)
    },
})

export const addCatalogItem = async (page: Page, runtime: TestRuntime, name: string) => {
    const item = await seedCatalogItem(runtime, name)
    const search = page.getByRole('textbox', { name: labels.commandPalette.itemSearch.placeholder })
    await search.fill(item.name)
    await page.getByRole('button', { name: item.name, exact: true }).click()
    return item
}
export const openItems = async (page: Page) => {
    const tab = page.getByRole('tab', { name: labels.setup.compose.mobile.items, exact: true })
    if (await tab.isVisible()) await tab.click()
}
export const openDetails = async (page: Page) => {
    const tab = page.getByRole('tab', { name: labels.setup.compose.mobile.details, exact: true })
    if (await tab.isVisible()) await tab.click()
}
