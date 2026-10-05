import { randomUUID } from 'node:crypto'
import { readFile, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import AxeBuilder from '@axe-core/playwright'
import { eq } from 'drizzle-orm'

import { setupReports, users } from '../../database/schema'
import { fixturePng, seedSetup } from '../helpers/seeds'
import { addCatalogItem, authenticate, expect, labels, test } from './fixtures'

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
    await goto('/en/faq', { waitUntil: 'hydration' })
    await goto(draftUrl, { waitUntil: 'hydration' })
    await expect(rows.first()).toContainText(second.name)
    await rows.nth(1).locator('.draggable').dragTo(rows.nth(0).locator('.draggable'))
    await expect(rows.first()).toContainText(first.name)
    await expect(page.getByTestId('draft-status')).toHaveText(
        labels.setup.compose.draftStatus.saved,
    )
    await expect.poll(persistedItems).toEqual([first.id, second.id])
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
