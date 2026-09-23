import 'fake-indexeddb/auto'
import { createDefaultSetupComposeForm } from '@avatio/core/setups'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { reactive, readonly, ref } from 'vue'

import { useSetupDraftController } from '../../../app/composables/setupDraftController'
import * as recovery from '../../../app/utils/setupDraftRecovery'
import { SetupDraftWriter } from '../../../app/utils/setupDraftWriter'

const ownerId = 'user-a'
const id = '00000000-0000-4000-8000-000000000001'
const user = ref<{ id: string } | null>({ id: ownerId })
const requestFetch = vi.fn()
const content = (name: string) => ({ ...createDefaultSetupComposeForm(), name })
const record = (name = 'private to A', revision = 0) => ({
    ownerId,
    id,
    revision,
    setupId: null,
    content: content(name),
    updatedAt: 1,
})

describe('setup draft controller owner and recovery boundary', () => {
    beforeEach(() => {
        user.value = { id: ownerId }
        requestFetch.mockReset()
        vi.stubGlobal('reactive', reactive)
        vi.stubGlobal('readonly', readonly)
        vi.stubGlobal('useUserSession', () => ({ user }))
        vi.stubGlobal('useRequestFetch', () => requestFetch)
        vi.stubGlobal('SetupDraftWriter', SetupDraftWriter)
        for (const [name, implementation] of Object.entries(recovery))
            vi.stubGlobal(name, implementation)
    })
    afterEach(async () => {
        vi.useRealTimers()
        vi.unstubAllGlobals()
        await recovery.deleteSetupDraftRecovery(ownerId, id)
        await recovery.deleteSetupDraftRecovery('user-b', id)
    })

    it('keeps the initial URL, recovery key and PUT ID identical on first-save failure', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        requestFetch.mockRejectedValue(Object.assign(new Error('conflict'), { statusCode: 409 }))
        const onDraftId = vi.fn()
        const controller = useSetupDraftController(onDraftId)
        const initialId = controller.state.id
        controller.schedule(content('unsaved'), null)
        await controller.flush()
        expect(controller.state.id).toBe(initialId)
        expect(onDraftId).toHaveBeenLastCalledWith(initialId)
        expect(requestFetch).toHaveBeenCalledWith(
            `/api/setup-drafts/${initialId}`,
            expect.objectContaining({ method: 'PUT' }),
        )
        await expect(controller.loadRecovery(initialId)).resolves.toMatchObject({
            ownerId,
            id: initialId,
            content: { name: 'unsaved' },
        })
        await recovery.deleteSetupDraftRecovery(ownerId, initialId)
    })

    it('binds the draft owner when the hydrated session arrives before the first edit', async () => {
        user.value = null
        requestFetch.mockResolvedValue({ revision: 1 })
        const controller = useSetupDraftController(() => {})

        user.value = { id: ownerId }
        controller.schedule(content('first hydrated edit'), null)
        await controller.flush()

        expect(requestFetch).toHaveBeenCalledWith(
            `/api/setup-drafts/${controller.state.id}`,
            expect.objectContaining({
                method: 'PUT',
                body: expect.objectContaining({
                    content: expect.objectContaining({ name: 'first hydrated edit' }),
                }),
            }),
        )
    })

    it('does not use A recovery when B receives an ownership 404 for A URL', async () => {
        await recovery.saveSetupDraftRecovery(record())
        user.value = { id: 'user-b' }
        const denied = Object.assign(new Error('not found'), { statusCode: 404 })
        requestFetch.mockRejectedValue(denied)
        await expect(useSetupDraftController(() => {}).load(id)).rejects.toBe(denied)
        await expect(recovery.loadSetupDraftRecovery(ownerId, id)).resolves.toEqual(record())
    })

    it.each([401, 403, 400])(
        'does not fall back after authoritative HTTP %s',
        async (statusCode) => {
            await recovery.saveSetupDraftRecovery(record())
            const denied = Object.assign(new Error('denied'), { statusCode })
            requestFetch.mockRejectedValue(denied)
            await expect(useSetupDraftController(() => {}).load(id)).rejects.toBe(denied)
        },
    )

    it.each([undefined, 503, 404])(
        'recovers same-owner unsaved first writes after %s',
        async (statusCode) => {
            await recovery.saveSetupDraftRecovery(record())
            requestFetch.mockRejectedValue(Object.assign(new Error('unavailable'), { statusCode }))
            await expect(useSetupDraftController(() => {}).load(id)).resolves.toMatchObject({
                id,
                revision: 0,
                content: { name: 'private to A' },
                recoveredLocally: true,
            })
        },
    )

    it('does not recreate a previously saved draft after an authoritative 404', async () => {
        await recovery.saveSetupDraftRecovery(record('deleted remotely', 3))
        const missing = Object.assign(new Error('not found'), { statusCode: 404 })
        requestFetch.mockRejectedValue(missing)
        await expect(useSetupDraftController(() => {}).load(id)).rejects.toBe(missing)
    })

    it('preserves local pending edits and their expected revision when the server responds', async () => {
        await recovery.saveSetupDraftRecovery(record('newer local edit', 3))
        requestFetch.mockResolvedValue({
            ...record('older server content', 4),
            createdAt: new Date(0),
            updatedAt: new Date(2),
        })
        await expect(useSetupDraftController(() => {}).load(id)).resolves.toMatchObject({
            revision: 3,
            content: { name: 'newer local edit' },
        })
    })

    it('rejects an owner change while a remote load is in flight', async () => {
        await recovery.saveSetupDraftRecovery(record())
        let finish!: () => void
        requestFetch.mockImplementation(
            () =>
                new Promise((resolve) => {
                    finish = () => resolve(null)
                }),
        )
        const controller = useSetupDraftController(() => {})
        const loaded = controller.load(id)
        user.value = { id: 'user-b' }
        finish()
        await expect(loaded).rejects.toThrow('Draft owner changed')
    })

    it('keeps a debounced edit recoverable when an earlier save finishes', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        let acknowledge!: (result: { revision: number }) => void
        requestFetch.mockImplementationOnce(
            () =>
                new Promise((resolve) => {
                    acknowledge = resolve
                }),
        )
        const controller = useSetupDraftController(() => {})
        controller.schedule(content('first'), null)
        const saved = controller.flush()
        controller.schedule(content('newer pending'), null)
        acknowledge({ revision: 1 })
        await saved
        await expect(controller.loadRecovery(controller.state.id)).resolves.toMatchObject({
            revision: 1,
            content: { name: 'newer pending' },
        })
        expect(controller.state.status).toBe('unsaved')
        await recovery.deleteSetupDraftRecovery(ownerId, controller.state.id)
        vi.clearAllTimers()
    })

    it('shows saving while the request is in flight and does not mark a newer edit saved', async () => {
        vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
        const first = Promise.withResolvers<{ revision: number }>()
        const second = Promise.withResolvers<{ revision: number }>()
        requestFetch
            .mockImplementationOnce(() => first.promise)
            .mockImplementationOnce(() => second.promise)
        const controller = useSetupDraftController(() => {})

        controller.schedule(content('first'), null)
        await vi.advanceTimersByTimeAsync(2000)
        expect(controller.state.status).toBe('saving')

        controller.schedule(content('second'), null)
        first.resolve({ revision: 1 })
        await first.promise
        await vi.waitFor(() => expect(controller.state.status).toBe('unsaved'))

        await vi.advanceTimersByTimeAsync(2000)
        await vi.waitFor(() => expect(requestFetch).toHaveBeenCalledTimes(2))
        expect(controller.state.status).toBe('saving')
        second.resolve({ revision: 2 })
        await second.promise
        await vi.waitFor(() => expect(controller.state.status).toBe('saved'))
        expect(requestFetch).toHaveBeenLastCalledWith(
            `/api/setup-drafts/${controller.state.id}`,
            expect.objectContaining({
                body: expect.objectContaining({
                    content: expect.objectContaining({ name: 'second' }),
                }),
            }),
        )
    })
})
