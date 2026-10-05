import { randomUUID } from 'node:crypto'

import { seedSetup, fixturePng } from '../helpers/seeds'
import {
    addCatalogItem,
    authenticate,
    expect,
    labels,
    openDetails,
    openItems,
    test,
} from './fixtures'

test('login survives reload and logout revokes the browser session', async ({
    page,
    goto,
    account,
}) => {
    await goto('/en/login', { waitUntil: 'hydration' })
    // No public runtime flag override: this catches a mismatch with the actual local auth server.
    await page.locator('input[type=email]').fill(account.email)
    await page.locator('input[type=password]').fill(account.password)
    await page.getByRole('button', { name: labels.modal.login.local.login, exact: true }).click()
    await expect
        .poll(
            async () => (await (await page.request.get('/api/auth/get-session')).json())?.user?.id,
        )
        .toBe(account.id)
    await expect(page).toHaveURL(`${new URL(page.url()).origin}/en`)
    await expect(page.getByRole('button', { name: labels.header.userMenu })).toBeVisible()
    await page.reload()
    await page.waitForFunction('window.useNuxtApp?.().isHydrating === false')
    await page.getByRole('button', { name: labels.header.userMenu }).click()
    await page.getByRole('menuitem', { name: labels.header.menu.logout, exact: true }).click()
    await expect
        .poll(async () => await (await page.request.get('/api/auth/get-session')).json())
        .toBeNull()
})

test('compose saves, publishes once and edits the same Setup', async ({
    page,
    goto,
    context,
    account,
    runtime,
}) => {
    await authenticate(context, account)
    await goto('/en/setup/compose', { waitUntil: 'hydration' })
    const title = `Publish ${randomUUID()}`
    await page.getByRole('textbox', { name: labels.setup.compose.nameLabel }).fill(title)
    await openItems(page)
    const item = await addCatalogItem(page, runtime, `Catalog ${randomUUID()}`)
    await expect(page.getByTestId('draft-status')).toHaveText(
        labels.setup.compose.draftStatus.saved,
    )
    const createdResponse = page.waitForResponse(
        (response) =>
            response.url().endsWith('/api/setups') && response.request().method() === 'POST',
    )
    await page
        .getByRole('button', { name: labels.setup.compose.publishButton, exact: true })
        .click()
    const response = await createdResponse
    expect(response.status()).toBe(200)
    const setup = (await response.json()) as { id: string }
    await page
        .getByRole('dialog')
        .getByRole('link', { name: labels.modal.publishComplete.viewSetup, exact: true })
        .click()
    await expect(page).toHaveURL(new RegExp(`/en/${setup.id}$`))
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    await goto(`/en/setup/compose?edit=${setup.id}`, { waitUntil: 'hydration' })
    await page
        .getByRole('textbox', { name: labels.setup.compose.nameLabel })
        .fill(`${title} edited`)
    const editedResponse = page.waitForResponse(
        (response) =>
            response.url().endsWith(`/api/setups/${setup.id}`) &&
            response.request().method() === 'PUT',
    )
    await page.getByRole('button', { name: labels.setup.compose.updateButton, exact: true }).click()
    expect((await editedResponse).status()).toBe(200)
    await page
        .getByRole('dialog')
        .getByRole('link', { name: labels.modal.publishComplete.viewSetup, exact: true })
        .click()
    await expect(page.getByRole('heading', { name: `${title} edited`, exact: true })).toBeVisible()
    const persisted = await (await page.request.get(`/api/me/setups/${setup.id}`)).json()
    expect(persisted).toMatchObject({
        id: setup.id,
        name: `${title} edited`,
        entries: [{ catalogItem: { id: item.id } }],
    })
})

test('initial legal review accepts both documents and stays accepted after reload', async ({
    page,
    goto,
    context,
    runtime,
}) => {
    const account = await runtime.createUser({ initialLegal: true })
    await authenticate(context, account)
    await goto('/en', { waitUntil: 'hydration' })
    const dialog = page.getByRole('dialog')
    await expect(dialog).toContainText(labels.modal.agreeTerms.initial.title)
    await dialog.getByRole('button', { name: labels.modal.agreeTerms.agree, exact: true }).click()
    await expect(dialog).toBeHidden()
    await page.reload()
    await expect(page.getByRole('dialog')).toBeHidden()
    expect(
        await (await page.request.get('/api/avatio/legal/status?locale=en')).json(),
    ).toMatchObject({ needsAgreement: false })
})

test('content works through direct requests and client links in Japanese and English', async ({
    page,
    goto,
}) => {
    await goto('/faq', { waitUntil: 'hydration' })
    await expect(page.locator('main')).toContainText('Avatio')
    await goto('/en/faq', { waitUntil: 'hydration' })
    const response = await page.request.get('/api/avatio/content/terms?locale=en')
    expect(response.status()).toBe(200)
    expect(await response.json()).toMatchObject({
        locale: 'ja',
        requestedLocale: 'en',
        isFallback: true,
    })
    await page
        .getByRole('link', { name: labels.modal.login.footer.terms, exact: true })
        .first()
        .click()
    await expect(page).toHaveURL(/\/en\/terms$/)
    await expect(page.locator('main')).toContainText(labels.content.fallbackDescription)
})

test('keyboard item reordering and removal preserve focus and mobile tab search', async ({
    page,
    goto,
    context,
    account,
    runtime,
}) => {
    await authenticate(context, account)
    await goto('/en/setup/compose', { waitUntil: 'hydration' })
    await openItems(page)
    const first = await addCatalogItem(page, runtime, `First ${randomUUID()}`)
    const second = await addCatalogItem(page, runtime, `Second ${randomUUID()}`)
    const reorder = page.getByRole('button', {
        name: labels.reorder.label.replace('{name}', second.name),
    })
    await reorder.focus()
    await page.keyboard.press('Enter')
    await page.getByRole('menuitem', { name: labels.reorder.up, exact: true }).focus()
    await page.keyboard.press('Enter')
    await expect(reorder).toBeFocused()
    await expect(page.locator('[data-entry-id]').first()).toContainText(second.name)
    const remove = page.getByRole('button', {
        name: labels.dynamicFields.remove.replace('{name}', second.name),
        exact: true,
    })
    await remove.focus()
    await page.keyboard.press('Enter')
    await expect(
        page.getByRole('button', {
            name: labels.dynamicFields.remove.replace('{name}', first.name),
            exact: true,
        }),
    ).toBeFocused()
    const search = page.getByRole('combobox', {
        name: labels.commandPalette.itemSearch.placeholder,
    })
    await search.fill('retained search')
    await openDetails(page)
    await openItems(page)
    await expect(search).toHaveValue('retained search')
})

test('image upload renders, publishes and opens a keyboard-accessible gallery', async ({
    page,
    goto,
    context,
    account,
    runtime,
}) => {
    await authenticate(context, account)
    await goto('/en/setup/compose', { waitUntil: 'hydration' })
    const title = `Image ${randomUUID()}`
    await page.getByRole('textbox', { name: labels.setup.compose.nameLabel }).fill(title)
    const chooser = page.waitForEvent('filechooser')
    await page.getByRole('button', { name: labels.setup.compose.images.add, exact: true }).click()
    await (
        await chooser
    ).setFiles({ name: 'fixture.png', mimeType: 'image/png', buffer: fixturePng() })
    await expect(
        page.getByRole('img', { name: `${labels.setup.compose.images.preview} 1`, exact: true }),
    ).toBeVisible()
    await openItems(page)
    await addCatalogItem(page, runtime, `Image item ${randomUUID()}`)
    const publish = page.getByRole('button', {
        name: labels.setup.compose.publishButton,
        exact: true,
    })
    await expect(publish).toBeInViewport({ ratio: 1 })
    await publish.click()
    await page
        .getByRole('dialog')
        .getByRole('link', { name: labels.modal.publishComplete.viewSetup, exact: true })
        .click()
    await expect(page.getByRole('heading', { name: title, exact: true })).toBeVisible()
    const trigger = page.getByRole('button', {
        name: labels.imageViewer.open.replace('{name}', title).replace('{index}', '1'),
        exact: true,
    })
    await trigger.focus()
    await page.keyboard.press('Enter')
    await expect(
        page.getByRole('dialog', { name: `${title}${labels.setup.viewer.imageAlt}`, exact: true }),
    ).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(trigger).toBeFocused()
})

test('private Setup remains visible only to its owner in a browser', async ({
    page,
    goto,
    context,
    account,
    runtime,
    browser,
}) => {
    const setup = await seedSetup(runtime, account, { public: false })
    await authenticate(context, account)
    await goto(`/en/${setup.id}`, { waitUntil: 'hydration' })
    await expect(page.getByRole('heading', { name: 'Fixture Setup', exact: true })).toBeVisible()
    const anonymous = await browser.newContext({ serviceWorkers: 'block' })
    try {
        await anonymous.route('**/*', (route) =>
            ['localhost', '127.0.0.1'].includes(new URL(route.request().url()).hostname)
                ? route.continue()
                : route.abort(),
        )
        const page = await anonymous.newPage()
        const response = await page.goto(`${runtime.origin}/en/${setup.id}`)
        expect(response?.status()).toBe(404)
        await expect(page.getByRole('heading', { name: 'Fixture Setup', exact: true })).toHaveCount(
            0,
        )
    } finally {
        await anonymous.close()
    }
})

test('admin report tabs activate only when selected with the keyboard', async ({
    page,
    goto,
    context,
    runtime,
}) => {
    await authenticate(context, runtime.admin)
    await goto('/en/admin/reports', { waitUntil: 'hydration' })
    const tabs = page.getByRole('tab')
    await expect(tabs).toHaveCount(3)
    await tabs.nth(0).focus()
    await page.keyboard.press('ArrowRight')
    await expect(tabs.nth(1)).toBeFocused()
    await expect(tabs.nth(0)).toHaveAttribute('aria-selected', 'true')
    await page.keyboard.press('Enter')
    await expect(tabs.nth(1)).toHaveAttribute('aria-selected', 'true')
    await expect(page).toHaveURL(/tab=setup/)
    await expect(page.getByRole('tabpanel')).toBeVisible()
})
