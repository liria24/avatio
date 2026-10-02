import { mockNuxtImport, mountSuspended, registerEndpoint } from '@nuxt/test-utils/runtime'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import AdminReportsPage from '~/pages/admin/reports.vue'

const mocks = vi.hoisted(() => ({
    resolveReport: vi.fn(),
    unbanUser: vi.fn(),
    banOpen: vi.fn(),
    hideOpen: vi.fn(),
    unhideOpen: vi.fn(),
    changeNameOpen: vi.fn(),
    user: { value: { id: 'admin-user', role: 'admin' } },
}))

mockNuxtImport('useAdmin', () => () => ({
    resolveReport: mocks.resolveReport,
    unbanUser: mocks.unbanUser,
}))
mockNuxtImport('useBanUserModal', () => () => ({ open: mocks.banOpen }))
mockNuxtImport('useSetupHideModal', () => () => ({ open: mocks.hideOpen }))
mockNuxtImport('useSetupUnhideModal', () => () => ({ open: mocks.unhideOpen }))
mockNuxtImport('useChangeItemNiceNameModal', () => () => ({ open: mocks.changeNameOpen }))
mockNuxtImport('useUserSession', () => () => ({ user: mocks.user }))

const requests: Array<{ type: 'user' | 'setup' | 'item'; query: URLSearchParams }> = []
let responseMode: 'data' | 'empty' | 'error' = 'data'

const pagination = (page: number, total = 45) => ({
    page,
    limit: 20,
    total,
    totalPages: Math.ceil(total / 20),
    hasPrev: page > 1,
    hasNext: page * 20 < total,
})

const userReport = {
    id: 12,
    count: 45,
    createdAt: '2026-09-20T00:00:00.000Z',
    spam: true,
    hate: false,
    infringe: false,
    badImage: false,
    other: false,
    comment: 'Reported comment',
    isResolved: false,
    reportee: {
        id: 'reported-user',
        username: 'reported',
        name: 'Reported user',
        image: null,
        banned: false,
    },
    reporter: {
        id: 'reporter-user',
        username: 'reporter',
        name: 'Reporter',
        image: null,
    },
}

const setupReport = {
    ...userReport,
    setup: { id: 'setup-id', name: 'Reported setup', hidAt: null, images: [] },
}
const itemReport = {
    ...userReport,
    nameError: true,
    irrelevant: false,
    item: {
        id: 'item-id',
        name: 'Reported item',
        displayNameOverride: null,
        primarySource: null,
        image: null,
        category: 'other',
    },
}
const reports = { user: userReport, setup: setupReport, item: itemReport }

const registerReportsEndpoint = (type: 'user' | 'setup' | 'item') =>
    registerEndpoint(`/api/admin/reports/${type}`, {
        method: 'GET',
        handler: (event) => {
            const url = new URL(event.node.req.url ?? '/', 'http://localhost')
            requests.push({ type, query: new URLSearchParams(url.searchParams) })
            if (responseMode === 'error') throw new Error('Temporary failure')

            const page = Number(url.searchParams.get('page') ?? 1)
            return {
                data: responseMode === 'data' ? [reports[type]] : [],
                pagination: pagination(page, responseMode === 'data' ? 45 : 0),
            }
        },
    })

registerReportsEndpoint('user')
registerReportsEndpoint('setup')
registerReportsEndpoint('item')

describe('Admin reports UI', () => {
    beforeEach(() => {
        clearNuxtData()
        responseMode = 'data'
        requests.length = 0
        vi.clearAllMocks()
    })

    it.each([
        ['user', 'Reported user', 'spam', 'malicious'],
        ['setup', 'Reported setup', 'spam', 'extreme'],
        ['item', 'Reported item', 'wrongName', 'unrelated'],
    ])('renders %s reasons and its action menu', async (tab, name, reason, absentReason) => {
        const wrapper = await mountSuspended(AdminReportsPage, { route: `/?tab=${tab}` })
        try {
            expect(wrapper.text()).toContain(name)
            expect(wrapper.text()).toContain(`admin.reports.${tab}.reasons.${reason}`)
            expect(wrapper.text()).not.toContain(`admin.reports.${tab}.reasons.${absentReason}`)
            expect(wrapper.find('button[aria-label="admin.reports.actions.label"]').exists()).toBe(
                true,
            )
        } finally {
            wrapper.unmount()
        }
    })

    it('syncs filters and pagination through the route and only loads the active report type', async () => {
        const wrapper = await mountSuspended(AdminReportsPage, {
            route: '/?status=closed&sort=asc&page=2',
        })

        expect(requests).toHaveLength(1)
        expect(requests[0]?.type).toBe('user')
        expect(Object.fromEntries(requests[0]?.query ?? [])).toMatchObject({
            status: 'closed',
            sort: 'asc',
            page: '2',
            limit: '20',
        })
        expect(wrapper.get('[data-testid="report-pagination"]').attributes('data-testid')).toBe(
            'report-pagination',
        )

        await navigateTo('/?status=all&sort=asc&page=2')
        await vi.waitFor(() => {
            expect(Object.fromEntries(requests.at(-1)?.query ?? [])).toMatchObject({
                status: 'all',
                sort: 'asc',
                page: '1',
            })
        })

        await navigateTo('/?tab=setup&status=all&sort=asc&page=2')
        await vi.waitFor(() => {
            expect(requests.at(-1)?.type).toBe('setup')
            expect(requests.at(-1)?.query.get('page')).toBe('1')
        })

        wrapper.setupState.page.value = 2
        await nextTick()
        await vi.waitFor(() => expect(requests.at(-1)?.query.get('page')).toBe('2'))
        wrapper.unmount()
    })

    it('shows empty and retryable error states', async () => {
        responseMode = 'empty'
        const wrapper = await mountSuspended(AdminReportsPage, {
            route: '/?status=all',
        })
        expect(wrapper.get('[data-testid="report-empty"]').attributes('data-testid')).toBe(
            'report-empty',
        )

        responseMode = 'error'
        await wrapper.setupState.refresh()
        await vi.waitFor(() =>
            expect(wrapper.get('[data-testid="report-error"]').attributes('data-testid')).toBe(
                'report-error',
            ),
        )
        wrapper.unmount()
    })

    it('reuses moderation actions without resolving the report', async () => {
        const wrapper = await mountSuspended(AdminReportsPage, {
            route: '/',
        })

        wrapper.setupState.userReportActions(userReport)[1][0].onSelect()
        expect(mocks.banOpen).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'reported-user',
                username: 'reported',
                onSuccess: expect.any(Function),
            }),
        )
        const requestCount = requests.length
        mocks.banOpen.mock.calls[0]?.[0].onSuccess()
        await vi.waitFor(() => expect(requests.length).toBeGreaterThan(requestCount))

        wrapper.setupState
            .userReportActions({
                ...userReport,
                reportee: { ...userReport.reportee, banned: true },
            })[1][0]
            .onSelect()
        expect(mocks.unbanUser).toHaveBeenCalledWith(
            expect.objectContaining({
                userId: 'reported-user',
                onSuccess: expect.any(Function),
            }),
        )

        wrapper.setupState
            .setupReportActions({
                setup: { id: 'setup-id', hidAt: null },
            })[1][0]
            .onSelect()
        expect(mocks.hideOpen).toHaveBeenCalledWith(
            expect.objectContaining({ setupId: 'setup-id', onSuccess: expect.any(Function) }),
        )

        wrapper.setupState
            .setupReportActions({
                setup: { id: 'hidden-setup-id', hidAt: '2026-09-20T00:00:00.000Z' },
            })[1][0]
            .onSelect()
        expect(mocks.unhideOpen).toHaveBeenCalledWith(
            expect.objectContaining({
                setupId: 'hidden-setup-id',
                onSuccess: expect.any(Function),
            }),
        )

        wrapper.setupState
            .itemReportActions({
                item: { id: 'item-id', displayNameOverride: 'Current', primarySource: null },
            })[1][0]
            .onSelect()
        expect(mocks.changeNameOpen).toHaveBeenCalledWith(
            expect.objectContaining({ itemId: 'item-id', onSuccess: expect.any(Function) }),
        )
        expect(mocks.resolveReport).not.toHaveBeenCalled()

        wrapper.setupState.page.value = 2
        await nextTick()
        wrapper.setupState.resolve(userReport.id, true)
        expect(mocks.resolveReport).toHaveBeenCalledWith(
            expect.objectContaining({ id: userReport.id, isResolved: true }),
        )
        mocks.resolveReport.mock.calls.at(-1)?.[0].onSuccess()
        expect(wrapper.setupState.page.value).toBe(1)
        wrapper.unmount()
    })
})
