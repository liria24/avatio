import en from '../../i18n/locales/en-US.json' with { type: 'json' }
import ja from '../../i18n/locales/ja-JP.json' with { type: 'json' }
import { expect, test } from './fixtures'

for (const [locale, messages] of [
    ['ja', ja],
    ['en', en],
] as const)
    test(`content: owner warning renders and dismisses in ${locale}`, async ({ page, goto }) => {
        const path = locale === 'ja' ? '/faq' : '/en/faq'
        const hydrationErrors: string[] = []
        page.on('console', (message) => {
            if (/hydration.*(?:mismatch|error)/i.test(message.text()))
                hydrationErrors.push(message.text())
        })
        const response = await page.request.get(path)
        expect(response.status()).toBe(200)
        // The existing footer deliberately places this preference-driven banner in ClientOnly.
        expect(await response.text()).not.toMatch(/<a[^>]+mailto:[^>]+subject=/)

        await goto(path, { waitUntil: 'hydration' })
        const warning = page.getByRole('link', { name: messages.banner.ownerWarning, exact: true })
        await expect(warning).toBeVisible()
        expect(decodeURIComponent((await warning.getAttribute('href'))!)).toContain(
            `subject=${messages.banner.ownerWarningSubject}`,
        )
        // The cookie toast overlaps the footer while its entrance animation settles.
        const consent = page.getByRole('button', { name: messages.cookie.accept, exact: true })
        await consent.click()
        await expect(consent).toBeHidden()
        await warning
            .locator('..')
            .getByRole('button', { name: messages.close, exact: true })
            .click()
        await expect(warning).toBeHidden()
        await page.reload()
        await page.waitForFunction('window.useNuxtApp?.().isHydrating === false')
        await expect(warning).toBeHidden()
        expect(hydrationErrors).toEqual([])
    })
