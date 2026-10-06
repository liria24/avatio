import { randomUUID } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import AxeBuilder from '@axe-core/playwright'
import { eq } from 'drizzle-orm'

import { setupReports, users } from '../../database/schema'
import { fixturePng, seedCatalogItem, seedSetup } from '../helpers/seeds'
import {
    addCatalogItem,
    authenticate,
    expect,
    labels,
    openDetails,
    openItems,
    test,
} from './fixtures'

test.describe('point editor', () => {
    test.use({ hasTouch: true })
    test('point editing commits completed operations, cancels moves, and restores saved points at mobile width', async ({
        page,
        goto,
        context,
        account,
        runtime,
    }, testInfo) => {
        test.setTimeout(120_000)
        page.setDefaultNavigationTimeout(60_000)
        await authenticate(context, account)
        // Cold Nuxt dev hydration compiles the client graph; retain Playwright's
        // normal readiness window before enforcing the shorter interaction waits.
        await goto('/en/setup/compose', { waitUntil: 'hydration' })
        page.setDefaultTimeout(10_000)
        await page.getByRole('button', { name: labels.cookie.accept, exact: true }).click()
        const first = await addCatalogItem(page, runtime, `Point first ${randomUUID()}`)
        const second = await addCatalogItem(page, runtime, `Point second ${randomUUID()}`)
        const chooser = page.waitForEvent('filechooser')
        await page
            .getByRole('button', { name: labels.setup.compose.images.add, exact: true })
            .click()
        await (
            await chooser
        ).setFiles([
            { name: 'portrait.png', mimeType: 'image/png', buffer: fixturePng(640, 960) },
            { name: 'landscape.png', mimeType: 'image/png', buffer: fixturePng(960, 640) },
        ])
        const triggers = page.getByRole('button', {
            name: labels.setup.compose.points.title,
            exact: true,
        })
        await expect(triggers).toHaveCount(4)
        await triggers.nth(0).click()
        const dialog = page.getByRole('dialog', { name: labels.setup.compose.points.title })
        const image = dialog.getByRole('img', {
            name: labels.setup.compose.images.preview,
            exact: true,
        })
        const markers = dialog.locator('[data-point-id]')
        const pick = async (name: string) => {
            await page.getByRole('option').filter({ hasText: name }).click()
        }
        const add = async (x: number, y: number, name: string) => {
            const bounds = (await image.boundingBox())!
            await image.click({ position: { x: bounds.width * x, y: bounds.height * y } })
            await pick(name)
        }
        await expect(
            dialog.getByRole('button', { name: labels.setup.compose.points.add, exact: true }),
        ).toBeEnabled()
        await add(0.3, 0.3, first.name)
        await add(0.7, 0.6, first.name)
        await expect(markers).toHaveCount(2)
        const marker = markers.first()
        const original = await marker.getAttribute('style')
        const drag = async () => {
            const bounds = (await marker.boundingBox())!
            await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
            await page.mouse.down()
            await page.mouse.move(
                bounds.x + bounds.width / 2 + 35,
                bounds.y + bounds.height / 2 + 20,
                {
                    steps: 5,
                },
            )
        }
        await drag()
        await page.mouse.up()
        await expect(marker).not.toHaveAttribute('style', original!)
        const moved = await marker.getAttribute('style')
        await dialog
            .getByRole('button', { name: labels.setup.compose.points.undo, exact: true })
            .click()
        await expect(marker).toHaveAttribute('style', original!)
        await dialog
            .getByRole('button', { name: labels.setup.compose.points.redo, exact: true })
            .click()
        await expect(marker).toHaveAttribute('style', moved!)
        await drag()
        await marker.dispatchEvent('pointercancel', {
            pointerId: 1,
            pointerType: 'mouse',
            bubbles: true,
        })
        await page.mouse.up()
        await expect(marker).toHaveAttribute('style', moved!)
        await marker.focus()
        await page.keyboard.down('ArrowRight')
        await page.keyboard.press('Escape')
        await page.keyboard.up('ArrowRight')
        await expect(marker).toHaveAttribute('style', moved!)
        await marker.press('Shift+ArrowDown')
        await expect(marker).not.toHaveAttribute('style', moved!)
        await dialog
            .getByRole('button', { name: labels.setup.compose.points.undo, exact: true })
            .click()
        await expect(marker).toHaveAttribute('style', moved!)
        await marker.click()
        await page
            .getByRole('button', { name: labels.setup.compose.points.changeItem, exact: true })
            .click()
        await pick(second.name)
        await expect(marker).toHaveAttribute('aria-label', second.name)
        await marker.click()
        await page
            .getByRole('button', { name: labels.setup.compose.points.move, exact: true })
            .click()
        const bounds = (await image.boundingBox())!
        await image.click({ position: { x: bounds.width * 0.1, y: bounds.height * 0.8 } })
        expect(await marker.evaluate((element) => parseFloat(element.style.left))).toBeCloseTo(
            10,
            0,
        )
        expect(await marker.evaluate((element) => parseFloat(element.style.top))).toBeCloseTo(80, 0)
        const destination = await marker.getAttribute('style')
        await marker.click()
        await image.click({ position: { x: bounds.width * 0.5, y: bounds.height * 0.2 } })
        await expect(page.getByRole('option')).toHaveCount(0)
        await expect(markers).toHaveCount(2)
        await marker.click()
        await page
            .getByRole('button', { name: labels.setup.compose.points.remove, exact: true })
            .click()
        await expect(markers).toHaveCount(1)
        await dialog
            .getByRole('button', { name: labels.setup.compose.points.undo, exact: true })
            .click()
        await expect(markers).toHaveCount(2)
        await page.screenshot({ path: testInfo.outputPath('points-desktop.png') })
        await dialog
            .getByRole('button', { name: labels.setup.compose.points.done, exact: true })
            .click()
        await expect(dialog).toBeHidden()
        await triggers.nth(2).click()
        await add(0.5, 0.5, second.name)
        await expect(markers).toHaveCount(1)
        await dialog
            .getByRole('button', { name: labels.setup.compose.points.done, exact: true })
            .click()
        await expect(page.getByTestId('draft-status')).toHaveText(
            labels.setup.compose.draftStatus.saved,
        )
        const draftUrl = page.url()
        const draftId = new URL(draftUrl).searchParams.get('draftId')!
        const saved = await (await page.request.get(`/api/setup-drafts/${draftId}`)).json()
        expect(saved.content.points).toHaveLength(3)
        expect(
            new Set(saved.content.points.map((point: { imageId: string }) => point.imageId)).size,
        ).toBe(2)
        await page.setViewportSize({ width: 390, height: 844 })
        await goto(draftUrl, { waitUntil: 'hydration' })
        await openDetails(page)
        await triggers.nth(0).click()
        await expect(markers).toHaveCount(2)
        await expect(markers.first()).toHaveAttribute('style', destination!)
        await expect(
            dialog.getByRole('button', { name: labels.setup.compose.points.undo, exact: true }),
        ).toBeDisabled()
        await markers.first().tap()
        await expect(
            page.getByRole('button', { name: labels.setup.compose.points.changeItem, exact: true }),
        ).toBeVisible()
        const popover = page.getByRole('dialog', {
            name: labels.setup.compose.points.selectItem,
            exact: true,
        })
        await expect
            .poll(async () => {
                const bounds = await popover.boundingBox()
                return bounds && bounds.x >= 15 && bounds.x + bounds.width <= 375
            })
            .toBe(true)
        await expect(popover).toHaveCSS('opacity', '1')
        await page.screenshot({ path: testInfo.outputPath('points-mobile.png') })
        const accessibility = await new AxeBuilder({ page })
            .include('[role="dialog"]')
            .withTags(['wcag2a', 'wcag2aa'])
            .analyze()
        expect(accessibility.violations).toEqual([])
        await page.keyboard.press('Escape')
        await page.setViewportSize({ width: 844, height: 390 })
        await expect.poll(async () => (await image.boundingBox())?.height ?? 0).toBeGreaterThan(0)
        await expect(
            dialog.getByRole('button', { name: labels.setup.compose.points.add, exact: true }),
        ).toBeEnabled()
    })
})

test('catalog input handles IME and Enter, retains focus after the first item, and survives a viewport remount', async ({
    page,
    goto,
    context,
    account,
    runtime,
}) => {
    await authenticate(context, account)
    await goto('/en/setup/compose', { waitUntil: 'hydration' })
    const first = await addCatalogItem(page, runtime, `Search first ${randomUUID()}`)
    const search = page.getByRole('combobox', {
        name: labels.commandPalette.itemSearch.placeholder,
    })
    await expect(search).toBeFocused()
    await expect(search).toHaveValue('')
    const second = await seedCatalogItem(runtime, `Keyboard second ${randomUUID()}`)
    await search.dispatchEvent('compositionstart')
    await search.fill(second.name)
    await search.press('Enter')
    await expect(page.locator('[data-entry-id]')).toHaveCount(1)
    await search.dispatchEvent('compositionend')
    await expect(page.getByRole('option', { name: second.name, exact: true })).toBeVisible()
    await search.press('ArrowDown')
    await search.press('Enter')
    await expect(page.locator('[data-entry-id]')).toHaveCount(2)
    await expect(search).toHaveValue('')
    await search.fill(first.name)
    await expect(page.getByRole('option').filter({ hasText: first.name })).toHaveAttribute(
        'data-disabled',
        '',
    )
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(
        page.getByRole('tab', { name: labels.setup.compose.mobile.items, exact: true }),
    ).toBeVisible()
    await openItems(page)
    await expect(search).toHaveValue(first.name)
    await search.fill('')
    await search.press('Escape')
    await expect(page.getByRole('option')).toHaveCount(0)
})

test('catalog URL imports require an explicit action and retain partial failures across viewport changes', async ({
    page,
    goto,
    context,
    account,
    runtime,
}) => {
    await authenticate(context, account)
    await goto('/en/setup/compose', { waitUntil: 'hydration' })
    const item = await seedCatalogItem(runtime, `URL item ${randomUUID()}`)
    const data = await (await page.request.get(`/api/items/${item.id}`)).json()
    const requests: string[] = []
    const finish = Promise.withResolvers<void>()
    await context.route('**/api/items/resolve', async (route) => {
        const { reference } = route.request().postDataJSON() as { reference: string }
        requests.push(reference)
        await finish.promise
        await route.fulfill({
            status: reference.endsWith('/failed') ? 503 : 200,
            contentType: 'application/json',
            body: JSON.stringify(reference.endsWith('/failed') ? { statusCode: 503 } : data),
        })
    })
    const search = page.getByRole('combobox', {
        name: labels.commandPalette.itemSearch.placeholder,
    })
    await search.fill(
        'https://example.test/first https://example.test/duplicate https://example.test/failed',
    )
    await expect(page.getByRole('option', { name: 'Add 3 URLs', exact: true })).toBeVisible()
    expect(requests).toEqual([])
    await search.press('ArrowDown')
    await search.press('Enter')
    await expect.poll(() => requests.length).toBe(3)
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(
        page.getByRole('tab', { name: labels.setup.compose.mobile.items, exact: true }),
    ).toBeVisible()
    await openItems(page)
    finish.resolve()
    await expect(page.locator('[data-entry-id]')).toHaveCount(1)
    await expect(
        page.getByText(labels.commandPalette.itemSearch.resolveFailed, { exact: true }),
    ).toBeVisible()
    await expect(
        page.getByText(labels.commandPalette.itemSearch.duplicate, { exact: true }),
    ).toBeVisible()
    await expect(search).toHaveValue('')
    await context.unroute('**/api/items/resolve')
    await context.route('**/api/items/resolve', (route) =>
        route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) }),
    )
    await page.getByRole('button', { name: labels.content.retry, exact: true }).click()
    await expect(
        page.getByText(labels.commandPalette.itemSearch.resolveFailed, { exact: true }),
    ).toHaveCount(0)
    await expect(page.locator('[data-entry-id]')).toHaveCount(1)
})

test('pointer sorting persists after the item list is unmounted and mounted again', async ({
    page,
    goto,
    context,
    account,
    runtime,
}) => {
    await authenticate(context, account)
    await goto('/en/setup/compose', { waitUntil: 'hydration' })
    const first = await addCatalogItem(page, runtime, `Drag first ${randomUUID()}`)
    const second = await addCatalogItem(page, runtime, `Drag second ${randomUUID()}`)
    const rows = page.locator('[data-entry-id]')
    await rows.nth(1).locator('.draggable').dragTo(rows.nth(0).locator('.draggable'))
    await expect(rows.first()).toContainText(second.name)
    await expect(page.getByTestId('draft-status')).toHaveText(
        labels.setup.compose.draftStatus.saved,
    )
    const draftUrl = page.url()
    const draftId = new URL(draftUrl).searchParams.get('draftId')!
    expect(draftId).toBeTruthy()
    const persistedItems = async () => {
        const response = await page.request.get(`/api/setup-drafts/${draftId}`)
        expect(response.status()).toBe(200)
        const draft = await response.json()
        return draft.content.items.map((item: { itemId: string }) => item.itemId)
    }
    await expect.poll(persistedItems).toEqual([second.id, first.id])
    await page.locator('header a[href="/en"]').click()
    await expect(page).toHaveURL(`${runtime.origin}/en`)
    await expect(rows).toHaveCount(0)
    await page.goBack()
    await expect(page).toHaveURL(draftUrl)
    await expect(rows.first()).toContainText(second.name)
    await rows.nth(1).locator('.draggable').dragTo(rows.nth(0).locator('.draggable'))
    await expect(rows.first()).toContainText(first.name)
    await expect(page.getByTestId('draft-status')).toHaveText(
        labels.setup.compose.draftStatus.saved,
    )
    await expect.poll(persistedItems).toEqual([first.id, second.id])
})

test('shared catalog search preserves admin selection focus and search-filter IDs', async ({
    page,
    goto,
    context,
    runtime,
}) => {
    await authenticate(context, runtime.admin)
    const item = await seedCatalogItem(runtime, `Shared search ${randomUUID()}`)
    await goto('/en/admin/config', { waitUntil: 'hydration' })
    const search = page.getByRole('combobox', {
        name: labels.commandPalette.itemSearch.placeholder,
    })
    await search.fill('https://example.test/none')
    await expect(page.getByRole('option', { name: 'Add 1 URL', exact: true })).toHaveCount(0)
    await search.fill(item.name)
    await page.getByRole('option', { name: item.name, exact: true }).click()
    const row = page.locator(`[data-override-id="${item.id}"]`)
    await expect(row).toBeVisible()
    await expect(row.getByRole('combobox')).toBeFocused()
    await goto('/en/search', { waitUntil: 'hydration' })
    await page.getByRole('button', { name: labels.search.options.title, exact: true }).click()
    await page.getByRole('button', { name: labels.search.options.addItem, exact: true }).click()
    await search.fill(item.name)
    await page.getByRole('option', { name: item.name, exact: true }).click()
    await expect.poll(() => new URL(page.url()).searchParams.get('itemId')).toBe(item.id)
    await expect(search).toBeHidden()
})

test('IndexedDB recovery survives failed draft saves and stays isolated by owner', async ({
    page,
    goto,
    context,
    account,
    runtime,
}) => {
    await authenticate(context, account)
    await context.route('**/api/setup-drafts/*', (route) =>
        route.request().method() === 'PUT'
            ? route.fulfill({
                  status: 503,
                  contentType: 'application/json',
                  body: JSON.stringify({ statusCode: 503 }),
              })
            : route.continue(),
    )
    await goto('/en/setup/compose', { waitUntil: 'hydration' })
    const title = `Recovered ${randomUUID()}`
    const input = page.getByRole('textbox', { name: labels.setup.compose.nameLabel })
    await input.fill(title)
    await expect(page.getByTestId('draft-status')).toHaveText(
        labels.setup.compose.draftStatus.error,
    )
    const draftUrl = page.url()
    const id = new URL(draftUrl).searchParams.get('draftId')!
    expect(id).toBeTruthy()
    // Only the save endpoint fails. HTML/assets stay online so reload tests real IndexedDB recovery.
    await page.reload()
    await expect(input).toHaveValue(title)
    await context.unroute('**/api/setup-drafts/*')
    await input.fill(`${title} online`)
    await expect(page.getByTestId('draft-status')).toHaveText(
        labels.setup.compose.draftStatus.saved,
    )
    expect(await (await page.request.get(`/api/setup-drafts/${id}`)).json()).toMatchObject({
        content: { name: `${title} online` },
    })
    const other = await runtime.createUser()
    await context.clearCookies()
    await authenticate(context, other)
    await goto(draftUrl, { waitUntil: 'hydration' })
    await expect(input).not.toHaveValue(`${title} online`)
    expect((await page.request.get(`/api/setup-drafts/${id}`)).status()).toBe(404)
    expect((await runtime.db.query.setupDrafts.findFirst({ where: { id } }))?.userId).toBe(
        account.id,
    )
})

test('two browser tabs surface stale saves without overwriting the committed draft', async ({
    page,
    goto,
    context,
    account,
}) => {
    await authenticate(context, account)
    await goto('/en/setup/compose', { waitUntil: 'hydration' })
    const input = page.getByRole('textbox', { name: labels.setup.compose.nameLabel })
    await input.fill('Original two-tab draft')
    await expect(page.getByTestId('draft-status')).toHaveText(
        labels.setup.compose.draftStatus.saved,
    )
    const id = new URL(page.url()).searchParams.get('draftId')!
    const second = await context.newPage()
    try {
        await second.goto(page.url())
        await second.waitForFunction('window.useNuxtApp?.().isHydrating === false')
        const secondInput = second.getByRole('textbox', {
            name: labels.setup.compose.nameLabel,
        })
        await expect(secondInput).toHaveValue('Original two-tab draft')
        await input.fill('Committed in first tab')
        await expect(page.getByTestId('draft-status')).toHaveText(
            labels.setup.compose.draftStatus.saved,
        )
        await secondInput.fill('Stale edit in second tab')
        await expect(second.getByTestId('draft-status')).toHaveText(
            labels.setup.compose.draftStatus.conflict,
        )
        await expect(secondInput).toHaveValue('Stale edit in second tab')
        expect(await (await page.request.get(`/api/setup-drafts/${id}`)).json()).toMatchObject({
            content: { name: 'Committed in first tab' },
        })
    } finally {
        await second.close()
    }
})

test('real signed device sessions transfer a saved draft and image to the selected owner', async ({
    page,
    goto,
    context,
    account,
    runtime,
}) => {
    const target = await runtime.createUser()
    // Actual sign-ins create the signed aggregate device cookie; tokens alone cannot prove membership.
    for (const user of [account, target, account]) {
        const response = await context.request.post(`${runtime.origin}/api/auth/sign-in/email`, {
            data: { email: user.email, password: user.password },
            headers: { origin: runtime.origin },
        })
        expect(response.status()).toBe(200)
    }
    await goto('/en/setup/compose', { waitUntil: 'hydration' })
    await page
        .getByRole('textbox', { name: labels.setup.compose.nameLabel })
        .fill('Transferred image draft')
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: labels.setup.compose.images.add, exact: true }).click()
    await (
        await chooser
    ).setFiles({ name: 'transfer.png', mimeType: 'image/png', buffer: fixturePng() })
    await expect(
        page.getByRole('img', { name: `${labels.setup.compose.images.preview} 1`, exact: true }),
    ).toBeVisible()
    await expect(page.getByTestId('draft-status')).toHaveText(
        labels.setup.compose.draftStatus.saved,
    )
    const id = new URL(page.url()).searchParams.get('draftId')!
    const before = (await (await page.request.get(`/api/setup-drafts/${id}`)).json()) as {
        revision: number
        content: { images: string[] }
    }
    await page.getByRole('button', { name: labels.header.menu.switchAccount, exact: true }).click()
    await page.getByRole('menuitem', { name: target.name, exact: true }).click()
    await expect
        .poll(
            async () => (await (await page.request.get('/api/auth/get-session')).json())?.user?.id,
        )
        .toBe(target.id)
    await expect(page.getByRole('textbox', { name: labels.setup.compose.nameLabel })).toHaveValue(
        'Transferred image draft',
    )
    const transferred = (await (await page.request.get(`/api/setup-drafts/${id}`)).json()) as {
        revision: number
        content: { images: string[]; imageMetadata: Record<string, { objectKey: string }> }
    }
    expect(transferred.revision).toBeGreaterThan(before.revision)
    expect(transferred.content.images).toHaveLength(1)
    const image = transferred.content.images[0]!
    expect(
        transferred.content.imageMetadata[image]?.objectKey.startsWith(`setup/${target.id}/`),
    ).toBe(true)
    expect((await page.request.get(image)).status()).toBe(200)
    expect((await runtime.db.query.setupDrafts.findFirst({ where: { id } }))?.userId).toBe(
        target.id,
    )
    // A different user's signed session without this device's cookie cannot authorize a transfer.
    const forged = await page.request.post(`/api/setup-drafts/${id}/transfer`, {
        data: { targetSessionToken: account.session.token, expectedRevision: transferred.revision },
    })
    expect(forged.status()).toBe(401)
    expect((await runtime.db.query.setupDrafts.findFirst({ where: { id } }))?.userId).toBe(
        target.id,
    )
    await page.reload()
    await expect(page.getByRole('textbox', { name: labels.setup.compose.nameLabel })).toHaveValue(
        'Transferred image draft',
    )
})

test('failed account transfers retain the source owner and browser session', async ({
    page,
    goto,
    context,
    account,
    runtime,
}) => {
    await authenticate(context, account)
    await goto('/en/setup/compose', { waitUntil: 'hydration' })
    await page
        .getByRole('textbox', { name: labels.setup.compose.nameLabel })
        .fill('Retained source draft')
    await expect(page.getByTestId('draft-status')).toHaveText(
        labels.setup.compose.draftStatus.saved,
    )
    const id = new URL(page.url()).searchParams.get('draftId')!
    const draft = (await (await page.request.get(`/api/setup-drafts/${id}`)).json()) as {
        revision: number
    }
    const target = await runtime.createUser()
    const response = await page.request.post(`/api/setup-drafts/${id}/transfer`, {
        data: { targetSessionToken: target.session.token, expectedRevision: draft.revision },
    })
    expect(response.status()).toBe(401)
    expect((await runtime.db.query.setupDrafts.findFirst({ where: { id } }))?.userId).toBe(
        account.id,
    )
    expect((await (await page.request.get('/api/auth/get-session')).json())?.user?.id).toBe(
        account.id,
    )
    await page.reload()
    await expect(page.getByRole('textbox', { name: labels.setup.compose.nameLabel })).toHaveValue(
        'Retained source draft',
    )
})

test('legal review refreshes after a stale version and a temporary source failure', async ({
    page,
    goto,
    context,
    runtime,
}) => {
    const account = await runtime.createUser({ initialLegal: true })
    await authenticate(context, account)
    await goto('/en', { waitUntil: 'hydration' })
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText('2020-01-01')
    const path = join(runtime.root, 'content/ja/terms.md')
    const original = await readFile(path, 'utf8')
    try {
        await writeFile(path, original.replace(/^version:.*$/m, "version: '2021-01-01'"))
        const stale = page.waitForResponse(
            (response) =>
                response.url().includes('/api/avatio/legal/accept') && response.status() === 409,
        )
        await dialog
            .getByRole('button', { name: labels.modal.agreeTerms.agree, exact: true })
            .click()
        await stale
        await expect(dialog).toContainText('2021-01-01')
        await expect(dialog).toContainText(labels.content.loadError)
        await dialog
            .getByRole('button', { name: labels.modal.agreeTerms.agree, exact: true })
            .click()
        await expect(dialog).toBeHidden()
        await runtime.db
            .update(users)
            .set({ lastAgreedToTerms: null })
            .where(eq(users.id, account.id))
        // Next independently activated document requires review, regardless of the accepted Terms.
        const privacy = join(runtime.root, 'content/ja/privacy-policy.md')
        const privacyOriginal = await readFile(privacy, 'utf8')
        try {
            await writeFile(
                privacy,
                privacyOriginal.replace(/^version:.*$/m, "version: '2021-01-01'"),
            )
            await page.reload()
            await expect(dialog).toContainText('2021-01-01')
            // A missing source makes acceptance unavailable and the document endpoint return 404.
            // Removing it avoids racing a request against an in-place, partially written file.
            const unavailablePath = join(runtime.root, `privacy-unavailable-${randomUUID()}.md`)
            await rename(privacy, unavailablePath)
            const unavailable = page.waitForResponse(
                (response) =>
                    response.url().includes('/api/avatio/legal/accept') &&
                    response.status() === 503,
            )
            const unavailablePage = page.waitForResponse(
                (response) =>
                    response.url().includes('/api/avatio/content/privacy-policy') &&
                    response.status() === 404,
            )
            await dialog
                .getByRole('button', { name: labels.modal.agreeTerms.agree, exact: true })
                .click()
            await unavailable
            await unavailablePage
            await expect(dialog.getByRole('button', { name: labels.content.retry })).toBeVisible()
            await rename(unavailablePath, privacy)
            await dialog.getByRole('button', { name: labels.content.retry }).click()
            await dialog
                .getByRole('button', { name: labels.modal.agreeTerms.agree, exact: true })
                .click()
            await expect(dialog).toBeHidden()
        } finally {
            await writeFile(privacy, privacyOriginal)
        }
    } finally {
        await writeFile(path, original)
    }
})

test('admin hiding and resolving reports stay independent, with ban and session revocation enforced', async ({
    page,
    goto,
    context,
    runtime,
}) => {
    const owner = await runtime.createUser(),
        reporter = await runtime.createUser()
    const setup = await seedSetup(runtime, owner)
    const [report] = await runtime.db
        .insert(setupReports)
        .values({
            setupId: setup.id,
            reporterId: reporter.id,
            spam: true,
            comment: 'Synthetic moderation report',
        })
        .returning()
    await authenticate(context, runtime.admin)
    await goto('/en/admin/reports?tab=setup', { waitUntil: 'hydration' })
    await expect(page.getByRole('tabpanel')).toContainText('Synthetic moderation report')
    await page
        .getByRole('button', { name: labels.admin.reports.actions.label, exact: true })
        .click()
    await page
        .getByRole('menuitem', { name: labels.admin.reports.actions.hideSetup, exact: true })
        .click()
    const dialog = page.getByRole('dialog', { name: labels.admin.modal.hideSetup.title })
    await dialog
        .getByRole('textbox', { name: labels.admin.modal.hideSetup.reason })
        .fill('Synthetic moderation reason')
    await dialog
        .getByRole('button', { name: labels.admin.modal.hideSetup.button, exact: true })
        .click()
    await expect(dialog).toBeHidden()
    await expect
        .poll(
            async () =>
                (await runtime.db.query.setups.findFirst({ where: { id: setup.id } }))?.hidAt,
        )
        .toBeTruthy()
    expect(
        (await runtime.db.query.setupReports.findFirst({ where: { id: report!.id } }))?.isResolved,
    ).toBe(false)
    await page
        .getByRole('button', { name: labels.admin.reports.actions.resolve, exact: true })
        .click()
    await expect
        .poll(
            async () =>
                (await runtime.db.query.setupReports.findFirst({ where: { id: report!.id } }))
                    ?.isResolved,
        )
        .toBe(true)
    expect(
        (
            await page.request.patch(`/api/admin/user/${owner.id}`, {
                data: { ban: true, banReason: 'Synthetic ban' },
            })
        ).status(),
    ).toBe(204)
    expect((await runtime.db.query.users.findFirst({ where: { id: owner.id } }))?.banned).toBe(true)
    const ownerRequest = await runtime.createUser()
    expect(
        (
            await page.request.patch(`/api/admin/user/${ownerRequest.id}`, {
                data: { revokeUserSessions: true },
            })
        ).status(),
    ).toBe(204)
    const revoked = await context.request.get(`${runtime.origin}/api/setup-drafts`, {
        headers: Object.fromEntries(ownerRequest.headers),
    })
    expect(revoked.status()).toBe(401)
})

test('compose and dialog accessibility are checked in a real browser', async ({
    page,
    goto,
    context,
    account,
    runtime,
}) => {
    await authenticate(context, account)
    await goto('/en/setup/compose', { waitUntil: 'hydration' })
    const consent = page.getByRole('button', { name: labels.cookie.accept, exact: true })
    await consent.click()
    await expect(consent).toBeHidden()
    const empty = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(empty.violations).toEqual([])
    await addCatalogItem(page, runtime, `Accessible item ${randomUUID()}`)
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()
    expect(results.violations).toEqual([])
    const trigger = page.getByRole('button', {
        name: labels.reorder.label.replace(
            '{name}',
            (await page.locator('[data-entry-id]').first().getAttribute('aria-label')) ?? '',
        ),
    })
    await trigger.click()
    const menu = await new AxeBuilder({ page })
        .include('[role=menu]')
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()
    expect(menu.violations).toEqual([])
})
