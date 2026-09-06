import {
    createDefaultSetupComposeForm,
    isEmptySetupComposeForm,
    type SetupDraftContent,
} from '@avatio/core/setups'
import { describe, expect, it, vi } from 'vitest'

import { SetupDraftWriter, type SetupDraftTransport } from '../../../app/utils/setupDraftWriter'

const content = (name: string): SetupDraftContent => ({
    ...createDefaultSetupComposeForm(),
    name,
})

const deferred = <T>() => {
    let resolve!: (value: T) => void
    const promise = new Promise<T>((done) => {
        resolve = done
    })
    return { promise, resolve }
}

describe('SetupDraftWriter', () => {
    it('serializes saves and coalesces pending snapshots to the latest value', async () => {
        const calls: Parameters<SetupDraftTransport['put']>[0][] = []
        const saves: ReturnType<typeof deferred<{ revision: number } | null>>[] = []
        const transport: SetupDraftTransport = {
            put(input) {
                calls.push(input)
                const save = deferred<{ revision: number } | null>()
                saves.push(save)
                return save.promise
            },
            delete: vi.fn(),
            isConflict: () => false,
            isOffline: () => false,
        }
        const writer = new SetupDraftWriter(transport, () => undefined)

        writer.queue(content('first'), null)
        writer.queue(content('discarded middle'), null)
        writer.queue(content('latest'), 'setup-1')
        const flushed = writer.flush()

        expect(calls).toHaveLength(1)
        saves[0]!.resolve({ revision: 1 })
        await vi.waitFor(() => expect(calls).toHaveLength(2))
        expect(calls[1]).toMatchObject({
            expectedRevision: 1,
            setupId: 'setup-1',
            content: { name: 'latest' },
        })
        saves[1]!.resolve({ revision: 2 })
        await flushed
        expect(writer.snapshot).toMatchObject({ revision: 2, status: 'saved' })
    })

    it('waits for an in-flight save before deleting, so a discarded draft cannot reappear', async () => {
        const save = deferred<{ revision: number } | null>()
        const remove = vi.fn(async () => undefined)
        const writer = new SetupDraftWriter(
            {
                put: () => save.promise,
                delete: remove,
                isConflict: () => false,
                isOffline: () => false,
            },
            () => undefined,
            undefined,
            { id: 'draft-1', revision: 0, status: 'new' },
        )

        writer.queue(content('saving'), null)
        const discarded = writer.discard()
        expect(remove).not.toHaveBeenCalled()
        save.resolve({ revision: 1 })
        await discarded

        expect(remove).toHaveBeenCalledWith('draft-1')
        expect(writer.snapshot).toMatchObject({ revision: 0, status: 'new' })
        expect(writer.snapshot.id).not.toBe('draft-1')
    })

    it('ignores an old save result after switching draft sessions', async () => {
        const save = deferred<{ revision: number } | null>()
        const writer = new SetupDraftWriter(
            {
                put: () => save.promise,
                delete: async () => undefined,
                isConflict: () => false,
                isOffline: () => false,
            },
            () => undefined,
            undefined,
            { id: 'draft-a', revision: 1, status: 'saved' },
        )

        writer.queue(content('old draft'), null)
        const switched = writer.switchSession('draft-b', 7)
        save.resolve({ revision: 2 })
        await switched
        expect(writer.snapshot).toEqual({ id: 'draft-b', revision: 7, status: 'restored' })
    })

    it('stops automatic writes on an optimistic concurrency conflict', async () => {
        const conflict = Object.assign(new Error('conflict'), { statusCode: 409 })
        const writer = new SetupDraftWriter(
            {
                put: async () => {
                    throw conflict
                },
                delete: async () => undefined,
                isConflict: (error) => error === conflict,
                isOffline: () => false,
            },
            () => undefined,
        )

        writer.queue(content('conflicting'), null)
        await writer.flush()
        expect(writer.snapshot).toMatchObject({ revision: 0, status: 'conflict' })
    })

    it('backs off while offline and retries the pending snapshot', async () => {
        vi.useFakeTimers()
        let attempts = 0
        const writer = new SetupDraftWriter(
            {
                put: async () => {
                    attempts += 1
                    if (attempts === 1) throw new Error('offline')
                    return { revision: 1 }
                },
                delete: async () => undefined,
                isConflict: () => false,
                isOffline: () => attempts === 1,
            },
            () => undefined,
            () => 10,
        )

        writer.queue(content('offline'), null)
        await writer.flush()
        expect(writer.snapshot.status).toBe('offline')
        await vi.advanceTimersByTimeAsync(10)
        await writer.flush()
        expect(writer.snapshot).toMatchObject({ revision: 1, status: 'saved' })
        vi.useRealTimers()
    })

    it('recognizes the reset form as empty', () => {
        expect(isEmptySetupComposeForm(createDefaultSetupComposeForm())).toBe(true)
        expect(isEmptySetupComposeForm(content('draft'))).toBe(false)
    })
})
