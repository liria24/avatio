import {
    MissingServerServiceError,
    requireServerService,
    type AdminDiscordNotifier,
    type AiServiceBundle,
    type AvatioBackgroundScope,
    type AvatioExecutionScope,
    type AvatioRequestScope,
    type BackgroundTaskScheduler,
    type ConfiguredCatalogItemClassifier,
    type ExecutionScopeKind,
    type ModerationFeedbackDigestItem,
    type ModerationReportDigest,
    type ModerationReportReader,
    type ViewerIdentity,
} from '@avatio/core'
import { createError, eventHandler, type H3Event } from '@nuxt/nitro-server/h3'
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
    createBackgroundScope,
    createRequestScope,
    getRequestScope,
    requireRequestScope,
    type ServerBackgroundScope,
    type ServerRequestScope,
} from '../../../server/utils/composition'

const makeEvent = (env: Record<string, unknown> = {}) =>
    ({
        context: { cloudflare: { env } },
        waitUntil: vi.fn(),
    }) as unknown as H3Event

describe('server composition root and execution scopes', () => {
    afterEach(() => {
        vi.resetModules()
        vi.unstubAllGlobals()
    })

    it('fails closed when a required service or request scope is missing', () => {
        expect(requireServerService('ok', 'flags')).toBe('ok')
        expect(() => requireServerService(null, 'rateLimiter')).toThrow(MissingServerServiceError)
        expect(() => requireServerService(null, 'rateLimiter')).toThrow(
            expect.objectContaining({
                name: 'MissingServerServiceError',
                serviceName: 'rateLimiter',
            }),
        )
        expect(() => requireServerService(undefined, 'ai')).toThrow(
            'Required server service "ai" is unavailable in this execution scope.',
        )

        const event = { context: {} } as unknown as H3Event
        expect(getRequestScope(event)).toBeNull()
        expect(() => requireRequestScope(event)).toThrow(
            'Required server service "requestScope" is unavailable in this execution scope.',
        )
    })

    it('isolates concurrent requests and resolves bindings lazily with per-scope memoization', () => {
        const dbReads = vi.fn(() => ({ id: Symbol('db') }))
        const flagReads = vi.fn((event?: H3Event) => ({
            isEnabled: async () => event?.context?.cloudflare?.env?.STAGE === 'production',
        }))
        const aiBundle: AiServiceBundle = {
            catalogDisplayNameGenerator: { generate: async () => 'short' },
            changelogTranslator: {
                translate: async (input) => ({ title: input.title, content: input.content }),
            },
            changelogSlugGenerator: { generate: async () => 'release' },
        }
        const classifierBundle: ConfiguredCatalogItemClassifier = {
            classifier: {
                classify: async () => ({
                    category: 'avatar',
                    confidence: 0.99,
                    probabilities: { avatar: 0.99 },
                    model: 'typesafe/jev',
                }),
            },
            model: 'typesafe/jev',
        }
        const useAiCapabilities = vi.fn(() => aiBundle)
        const getCatalogItemClassifier = vi.fn(() => classifierBundle)
        const invalidateStub = vi.fn(async () => undefined)
        const getCacheInvalidator = vi.fn(() => ({ invalidate: invalidateStub }))
        const getFileStorage = vi.fn(() => ({
            importFromUrl: async () => ({ key: 'avatar/a.jpg', url: 'https://cdn.example/a.jpg' }),
        }))

        vi.stubGlobal('useDB', dbReads)
        vi.stubGlobal('executeAppBatch', vi.fn())
        vi.stubGlobal('getFeatureFlags', flagReads)
        vi.stubGlobal('useAiCapabilities', useAiCapabilities)
        vi.stubGlobal('getCatalogItemClassifier', getCatalogItemClassifier)
        vi.stubGlobal('getCacheInvalidator', getCacheInvalidator)
        vi.stubGlobal('getFileStorage', getFileStorage)

        const eventA = makeEvent({ STAGE: 'development' })
        const eventB = makeEvent({ STAGE: 'production' })
        const viewerA: ViewerIdentity = { id: 'user-a', role: 'user', banned: false }
        const viewerB: ViewerIdentity = { id: 'user-b', role: 'admin', banned: false }

        const scopeA: ServerRequestScope = createRequestScope(eventA, viewerA)
        const scopeB: ServerRequestScope = createRequestScope(eventB, viewerB)
        const abstractScopeA: AvatioRequestScope = scopeA
        const abstractBaseB: AvatioExecutionScope = scopeB

        // Lazy resolution: creating scopes must not eagerly touch bindings or DB.
        expect(dbReads).not.toHaveBeenCalled()
        expect(flagReads).not.toHaveBeenCalled()
        expect(useAiCapabilities).not.toHaveBeenCalled()

        expect(getRequestScope(eventA)).toBe(scopeA)
        expect(getRequestScope(eventB)).toBe(scopeB)
        expect(requireRequestScope(eventA)).not.toBe(requireRequestScope(eventB))
        expect(abstractScopeA.viewer).toEqual(viewerA)
        expect(scopeB.viewer).toEqual(viewerB)
        expect(scopeA.stage).toBe('development')
        expect(abstractBaseB.stage).toBe('production')

        // Memoized per scope: repeated access reuses the same instance.
        const dbA1 = scopeA.db
        const dbA2 = scopeA.db
        const dbB = scopeB.db
        expect(dbA1).toBe(dbA2)
        expect(dbA1).not.toBe(dbB)
        expect(dbReads).toHaveBeenCalledTimes(2)

        expect(scopeA.getFeatureFlags()).toBe(scopeA.getFeatureFlags())
        expect(scopeB.getFeatureFlags()).not.toBe(scopeA.getFeatureFlags())
        expect(flagReads).toHaveBeenCalledTimes(2)

        expect(scopeA.getAiCapabilities()).toBe(aiBundle)
        expect(scopeA.getCatalogItemClassifier()).toBe(classifierBundle)
        expect(scopeA.getFileStorage()).toBe(scopeA.getFileStorage())
        expect(scopeA.getCacheInvalidator()).toBe(scopeA.getCacheInvalidator())
    })

    it('attaches request scopes in event handlers, enforces banned policy, and maps conflicts to 409', async () => {
        const fakeDb = { tag: 'fake-db' }
        vi.stubGlobal('useDB', () => fakeDb)
        vi.stubGlobal('createError', createError)
        vi.stubGlobal('eventHandler', eventHandler)
        vi.stubGlobal(
            'isDatabaseUniqueConflict',
            (error: unknown) => error instanceof Error && error.message === 'unique',
        )

        const handlers = new Map<string, (event: H3Event) => Promise<unknown>>()
        const getRequestSessionMock = vi.fn<() => Promise<{ user: ViewerIdentity } | null>>(
            async () => ({
                user: { id: 'viewer-1', role: 'admin', banned: false },
            }),
        )
        const requireUserSessionMock = vi.fn<() => Promise<{ user: ViewerIdentity }>>(async () => ({
            user: { id: 'viewer-2', role: 'user', banned: true },
        }))
        vi.stubGlobal('getRequestSession', getRequestSessionMock)
        vi.stubGlobal('requireUserSession', requireUserSessionMock)

        const { promiseEventHandler, sessionEventHandler, authedSessionEventHandler } =
            await import('../../../server/utils/eventHandler')

        const publicRoute = promiseEventHandler(({ db, services }) => {
            expect(db).toBe(fakeDb)
            expect(services.viewer).toBeNull()
            return services
        })
        const sessionRoute = sessionEventHandler(({ session, services }) => ({
            session,
            services,
        }))
        const guardedSessionRoute = sessionEventHandler(({ services }) => services, {
            rejectBannedUser: true,
        })
        const authedRoute = authedSessionEventHandler(({ session, db, services }) => ({
            session,
            db,
            services,
        }))
        const guardedAuthedRoute = authedSessionEventHandler(
            ({ session, db, services }) => ({ session, db, services }),
            {
                rejectBannedUser: true,
            },
        )
        const conflictRoute = promiseEventHandler(() => {
            throw new Error('unique')
        })
        handlers.set('public', publicRoute as (event: H3Event) => Promise<unknown>)

        const publicEvent = makeEvent()
        const publicScope = await handlers.get('public')!(publicEvent)
        expect(getRequestScope(publicEvent)).toBe(publicScope)

        const sessionEvent = makeEvent()
        const sessionResult = await (
            sessionRoute as unknown as (
                event: H3Event,
            ) => Promise<{ session: { user: ViewerIdentity } | null; services: ServerRequestScope }>
        )(sessionEvent)
        expect(sessionResult.services.viewer).toEqual({
            id: 'viewer-1',
            role: 'admin',
            banned: false,
        })
        expect(getRequestScope(sessionEvent)).toBe(sessionResult.services)

        getRequestSessionMock.mockResolvedValueOnce(null)
        const anonymousSessionEvent = makeEvent()
        const anonymousSessionResult = await (
            sessionRoute as unknown as (
                event: H3Event,
            ) => Promise<{ session: { user: ViewerIdentity } | null; services: ServerRequestScope }>
        )(anonymousSessionEvent)
        expect(anonymousSessionResult.session).toBeNull()
        expect(anonymousSessionResult.services.viewer).toBeNull()

        getRequestSessionMock.mockResolvedValueOnce({
            user: { id: 'viewer-banned', role: 'user', banned: true },
        })
        const unguardedBannedSessionResult = await (
            sessionRoute as unknown as (
                event: H3Event,
            ) => Promise<{ session: { user: ViewerIdentity } | null; services: ServerRequestScope }>
        )(makeEvent())
        expect(unguardedBannedSessionResult.session?.user.id).toBe('viewer-banned')
        expect(unguardedBannedSessionResult.services.viewer?.banned).toBe(true)

        getRequestSessionMock.mockResolvedValueOnce({
            user: { id: 'viewer-banned', role: 'user', banned: true },
        })
        await expect(
            (guardedSessionRoute as unknown as (event: H3Event) => Promise<unknown>)(makeEvent()),
        ).rejects.toMatchObject({ statusCode: 403 })

        const unguardedAuthedEvent = makeEvent()
        const unguardedAuthedResult = await (
            authedRoute as unknown as (event: H3Event) => Promise<{
                session: { user: ViewerIdentity }
                db: unknown
                services: ServerRequestScope
            }>
        )(unguardedAuthedEvent)
        expect(unguardedAuthedResult.db).toBe(fakeDb)
        expect(unguardedAuthedResult.session.user.id).toBe('viewer-2')
        expect(unguardedAuthedResult.services.viewer?.banned).toBe(true)
        expect(getRequestScope(unguardedAuthedEvent)).toBe(unguardedAuthedResult.services)

        await expect(
            (guardedAuthedRoute as unknown as (event: H3Event) => Promise<unknown>)(makeEvent()),
        ).rejects.toMatchObject({ statusCode: 403 })

        requireUserSessionMock.mockResolvedValueOnce({
            user: { id: 'viewer-3', role: 'user', banned: false },
        })
        const activeAuthedEvent = makeEvent()
        const activeAuthedResult = await (
            guardedAuthedRoute as unknown as (event: H3Event) => Promise<{
                session: { user: ViewerIdentity }
                db: unknown
                services: ServerRequestScope
            }>
        )(activeAuthedEvent)
        expect(activeAuthedResult.db).toBe(fakeDb)
        expect(activeAuthedResult.services.viewer).toEqual({
            id: 'viewer-3',
            role: 'user',
            banned: false,
        })
        expect(getRequestScope(activeAuthedEvent)).toBe(activeAuthedResult.services)

        await expect(
            (conflictRoute as unknown as (event: H3Event) => Promise<unknown>)(makeEvent()),
        ).rejects.toMatchObject({
            statusCode: 409,
            statusMessage: 'Conflict',
            message: 'The requested database state conflicts with an existing resource.',
        })
    })

    it('executes background scopes and runReportJob without any H3 HTTP event context', async () => {
        vi.stubGlobal('useEvent', () => {
            throw new Error('HTTP event must not be accessed from background scopes')
        })
        const loggerMock = { error: vi.fn(), info: vi.fn(), warn: vi.fn() }
        vi.stubGlobal('logger', () => loggerMock)

        for (const kind of ['queue', 'email', 'task'] as const satisfies readonly Exclude<
            ExecutionScopeKind,
            'request'
        >[]) {
            const bg: AvatioBackgroundScope = createBackgroundScope(kind)
            expect(bg.kind).toBe(kind)
        }

        const feedback: ModerationFeedbackDigestItem = {
            id: 1,
            createdAt: new Date('2026-11-21T00:00:00.000Z'),
            fingerprint: 'fp-123',
            contextPath: '/setup/1',
            comment: 'Great layout',
        }
        const digest: ModerationReportDigest = {
            feedbacks: { data: [feedback], error: false },
            setupReports: { data: [{ id: 'sr-1' }], error: false },
            userReports: { data: [], error: false },
        }
        const readPendingDigest = vi.fn<ModerationReportReader['readPendingDigest']>(
            async () => digest,
        )
        const discordSend = vi.fn<AdminDiscordNotifier['send']>(async () => undefined)
        const schedule = vi.fn<BackgroundTaskScheduler['schedule']>()

        const baseTaskScope = createBackgroundScope('task')
        const mockReportScope = Object.create(
            baseTaskScope,
            Object.getOwnPropertyDescriptors({
                stage: 'production' as const,
                isDev: false,
                background: { schedule },
                discordNotifier: { send: discordSend },
                moderationReports: { readPendingDigest },
            }),
        ) as ServerBackgroundScope

        const { runReportJob } = await import('../../../layers/admin/server/utils/jobs/report')
        const result = await runReportJob(mockReportScope)

        expect(readPendingDigest).toHaveBeenCalledOnce()
        expect(readPendingDigest).toHaveBeenCalledWith({
            from: expect.any(Date),
            to: expect.any(Date),
        })
        expect(discordSend).toHaveBeenCalledWith({
            embeds: expect.arrayContaining([
                expect.objectContaining({
                    title: 'Avatio Report [production]',
                    fields: expect.arrayContaining([
                        expect.objectContaining({
                            name: 'Feedback',
                            value: 'Submitted feedback: **1**',
                        }),
                        expect.objectContaining({
                            name: 'Setup Reports',
                            value: 'Submitted setup reports: **1**',
                        }),
                    ]),
                }),
                expect.objectContaining({
                    description: 'Great layout',
                    author: { name: 'fp-123' },
                }),
            ]),
        })
        expect(result).toEqual({
            success: true,
            data: {
                feedback: digest.feedbacks,
                report: { setup: digest.setupReports, user: digest.userReports },
            },
            messagesSent: true,
        })

        // Skips Discord send when there are no pending items or fetch errors.
        readPendingDigest.mockResolvedValueOnce({
            feedbacks: { data: [], error: false },
            setupReports: { data: [], error: false },
            userReports: { data: [], error: false },
        })
        discordSend.mockClear()
        const emptyResult = await runReportJob(mockReportScope)
        expect(discordSend).not.toHaveBeenCalled()
        expect(emptyResult.messagesSent).toBe(false)
    })

    it('gates setup item points rollout through pure viewer identity and request scope', async () => {
        const { canViewerUseSetupItemPoints } = await import('@avatio/core/setups')
        const { canUseSetupItemPoints } =
            await import('../../../server/utils/setups/itemPointsRollout')

        const flagEnabled = vi.fn(
            async (flag: 'maintenance' | 'itemPoints') => flag === 'itemPoints',
        )
        vi.stubGlobal('getFeatureFlags', () => ({ isEnabled: flagEnabled }))

        await expect(
            canViewerUseSetupItemPoints(
                { id: 'a', role: 'admin', banned: false },
                { isEnabled: flagEnabled },
            ),
        ).resolves.toBe(true)
        await expect(
            canViewerUseSetupItemPoints(
                { id: 'a', role: 'admin', banned: true },
                { isEnabled: flagEnabled },
            ),
        ).resolves.toBe(false)
        await expect(
            canViewerUseSetupItemPoints(
                { id: 'u', role: 'user', banned: false },
                { isEnabled: flagEnabled },
            ),
        ).resolves.toBe(false)
        await expect(canViewerUseSetupItemPoints(null, { isEnabled: flagEnabled })).resolves.toBe(
            false,
        )

        const adminScope = createRequestScope(makeEvent({ STAGE: 'production' }), {
            id: 'admin-1',
            role: 'admin',
            banned: false,
        })
        await expect(canUseSetupItemPoints(adminScope)).resolves.toBe(true)

        flagEnabled.mockResolvedValueOnce(false)
        const offAdminScope = createRequestScope(makeEvent({ STAGE: 'production' }), {
            id: 'admin-2',
            role: 'admin',
            banned: false,
        })
        await expect(canUseSetupItemPoints(offAdminScope)).resolves.toBe(false)
    })

    it('validates and batches setup item point statements', async () => {
        vi.stubGlobal('createError', createError)
        const { createSetupPointStatements } =
            await import('../../../server/utils/setups/itemPoints')

        const values = vi.fn((rows: unknown) => ({ rows }))
        const insert = vi.fn(() => ({ values }))
        const fakeDb = { insert } as unknown as Parameters<typeof createSetupPointStatements>[0]

        const statements = createSetupPointStatements(
            fakeDb,
            'setup-1',
            [{ id: 'pt-1', entryId: 'entry-1', imageId: 'img-1', x: 0.25, y: 0.5 }],
            ['entry-1'],
            ['img-1'],
        )
        expect(statements).toHaveLength(1)
        expect(values).toHaveBeenCalledWith([
            {
                id: 'pt-1',
                setupId: 'setup-1',
                setupEntryId: 'entry-1',
                imageId: 'img-1',
                x: 0.25,
                y: 0.5,
            },
        ])

        expect(() =>
            createSetupPointStatements(
                fakeDb,
                'setup-1',
                [
                    { id: 'dup', entryId: 'entry-1', imageId: 'img-1', x: 0.1, y: 0.2 },
                    { id: 'dup', entryId: 'entry-1', imageId: 'img-1', x: 0.3, y: 0.4 },
                ],
                ['entry-1'],
                ['img-1'],
            ),
        ).toThrow('Duplicate point ID.')

        expect(() =>
            createSetupPointStatements(
                fakeDb,
                'setup-1',
                [{ id: 'pt-2', entryId: 'missing-entry', imageId: 'img-1', x: 0.2, y: 0.2 }],
                ['entry-1'],
                ['img-1'],
            ),
        ).toThrow('Point references must belong to this setup.')

        expect(() =>
            createSetupPointStatements(
                fakeDb,
                'setup-1',
                [{ id: 'pt-3', entryId: 'entry-1', imageId: 'missing-image', x: 0.2, y: 0.2 }],
                ['entry-1'],
                ['img-1'],
            ),
        ).toThrow('Point references must belong to this setup.')
    })
})
