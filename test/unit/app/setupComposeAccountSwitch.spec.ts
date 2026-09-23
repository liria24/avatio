import { createDefaultSetupComposeForm, type SetupComposeForm } from '@avatio/core/setups'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { computed, nextTick, readonly, ref, shallowRef } from 'vue'

import type { DeviceSession } from '../../../app/composables/deviceSessions'
import { useSetupCompose } from '../../../app/composables/setupCompose'

const target = {
    session: { token: 'target-token' },
    user: { id: 'target-user' },
} as DeviceSession
const imageUrl = 'https://files.example.com/setup/source-user/image.png'
const imageMetadata = {
    [imageUrl]: {
        id: 'image-id',
        objectKey: 'setup/source-user/image.png',
        width: 640,
        height: 480,
    },
}

describe('setup compose account switching', () => {
    const state = ref({ id: '00000000-0000-4000-8000-000000000001', revision: 1, status: 'saved' })
    const values = ref(createDefaultSetupComposeForm())
    const schedule = vi.fn()
    const flush = vi.fn()
    const load = vi.fn()
    const switchSession = vi.fn()
    const deleteRecovery = vi.fn()
    const switchAccount = vi.fn()
    const request = vi.fn()
    const regularFetch = vi.fn()
    const reload = vi.fn()
    const toast = vi.fn()
    let emitFormChange: (next: SetupComposeForm) => void = () => undefined
    let itemEntities: { value: Record<string, { name: string }> } | undefined

    beforeEach(() => {
        state.value = {
            id: '00000000-0000-4000-8000-000000000001',
            revision: 1,
            status: 'saved',
        }
        values.value = createDefaultSetupComposeForm()
        schedule.mockReset()
        flush.mockReset()
        load.mockReset()
        switchSession.mockReset()
        deleteRecovery.mockReset().mockResolvedValue(undefined)
        switchAccount.mockReset().mockResolvedValue(undefined)
        request.mockReset().mockResolvedValue({ id: state.value.id, revision: 2 })
        regularFetch.mockReset()
        reload.mockReset()
        toast.mockReset()
        itemEntities = undefined

        const noOp = vi.fn()
        Object.entries({
            ref,
            shallowRef,
            computed,
            readonly,
            nextTick,
            inject: () => null,
            provide: noOp,
            useRoute: () => ({ query: {} }),
            useRouter: () => ({ replace: noOp }),
            useToast: () => ({ add: toast }),
            useI18n: () => ({ t: (key: string) => key }),
            useUserSession: () => ({ user: ref({ id: 'source-user' }) }),
            useDeviceSessions: () => ({ switchAccount }),
            useRequestFetch: () => request,
            useSetupDraftController: () => ({
                state: state.value,
                schedule,
                flush,
                switchSession,
                discard: noOp,
                load,
                deleteRecovery,
                requireOwner: () => 'source-user',
            }),
            useSetupComposeForm: (onChange: (next: SetupComposeForm) => void) => {
                emitFormChange = onChange
                return {
                    values,
                    form: {
                        setFieldValue: noOp,
                        reset: (next: ReturnType<typeof createDefaultSetupComposeForm>) => {
                            values.value = next
                        },
                    },
                }
            },
            useSetupComposeEntries: (...args: unknown[]) => {
                itemEntities = args[2] as typeof itemEntities
                return {
                    entries: ref([]),
                    totalItemsCount: computed(() => 0),
                    addItem: noOp,
                    updateItem: noOp,
                    removeItem: noOp,
                    changeItemCategory: noOp,
                    addShapekey: noOp,
                    removeShapekey: noOp,
                    reorderCategory: noOp,
                }
            },
            useSetupComposeImages: () => ({
                getImageId: noOp,
                getSelectedImageMetadata: () => imageMetadata,
                uploads: ref([]),
                imageUploading: ref(false),
                processImages: noOp,
                cancelUpload: noOp,
                cancelAllUploads: noOp,
                retryUpload: noOp,
                removeImage: noOp,
                reorderImages: noOp,
            }),
            useSetupImagePointsModal: () => ({ open: noOp }),
            useFetch: () => ({ data: ref([]), status: ref('success'), refresh: noOp }),
            reloadNuxtApp: reload,
            $fetch: regularFetch,
            setupsInsertSchema: { safeParse: () => ({ success: true }) },
        }).forEach(([key, value]) => vi.stubGlobal(key, value))
    })

    afterEach(() => vi.unstubAllGlobals())

    it('hydrates draft item titles with the request-scoped fetcher', async () => {
        load.mockResolvedValue({
            id: state.value.id,
            revision: 1,
            setupId: null,
            content: {
                ...createDefaultSetupComposeForm(),
                name: 'Draft',
                items: [
                    {
                        id: 'entry-1',
                        itemId: 'item-1',
                        category: 'avatar',
                        note: '',
                        unsupported: false,
                        shapekeys: [],
                    },
                ],
            },
        })
        request.mockResolvedValue({
            id: 'item-1',
            category: 'avatar',
            primarySource: null,
            name: 'Resolved title',
            image: null,
        })
        const compose = useSetupCompose()

        await compose.initialize({ draftId: state.value.id })

        expect(request).toHaveBeenCalledWith('/api/items/resolve', {
            method: 'POST',
            body: { reference: 'item-1' },
        })
        expect(regularFetch).not.toHaveBeenCalled()
        expect(itemEntities?.value['item-1']?.name).toBe('Resolved title')
    })

    it('uses the shared account switch without creating or moving an empty draft', async () => {
        const compose = useSetupCompose()

        await compose.switchPostingAccount(target)

        expect(switchAccount).toHaveBeenCalledOnce()
        expect(schedule).not.toHaveBeenCalled()
        expect(flush).not.toHaveBeenCalled()
        expect(request).not.toHaveBeenCalled()
        expect(reload).not.toHaveBeenCalled()
    })

    it('flushes once, blocks a second switch, transfers, clears recovery, and reloads', async () => {
        values.value.name = 'Draft'
        values.value.images = [imageUrl]
        values.value.items = [
            {
                id: 'entry-1',
                itemId: 'item-1',
                category: 'avatar',
                note: '',
                unsupported: false,
                shapekeys: [],
            },
            {
                id: 'entry-2',
                itemId: 'item-2',
                category: 'accessory',
                note: '',
                unsupported: false,
                shapekeys: [],
            },
        ]
        state.value.status = 'unsaved'
        const pending = Promise.withResolvers<void>()
        flush.mockImplementation(async () => {
            await pending.promise
            state.value.status = 'saved'
        })
        const compose = useSetupCompose()

        const first = compose.switchPostingAccount(target)
        const second = compose.switchPostingAccount(target)
        emitFormChange({ ...createDefaultSetupComposeForm(), name: 'Late stale snapshot' })
        pending.resolve()
        await Promise.all([first, second])

        expect(schedule).toHaveBeenCalledOnce()
        expect(schedule).toHaveBeenCalledWith({ ...values.value, imageMetadata }, null)
        expect(flush).toHaveBeenCalledOnce()
        expect(request).toHaveBeenCalledWith(`/api/setup-drafts/${state.value.id}/transfer`, {
            method: 'POST',
            body: { targetSessionToken: 'target-token', expectedRevision: 1 },
        })
        expect(deleteRecovery).toHaveBeenCalledWith(state.value.id)
        expect(reload).toHaveBeenCalledOnce()
    })

    it('keeps the form and account when flushing does not produce a saved draft', async () => {
        values.value.name = 'Unsaved draft'
        state.value.status = 'unsaved'
        flush.mockImplementation(async () => {
            state.value.status = 'error'
        })
        const compose = useSetupCompose()

        await compose.switchPostingAccount(target)

        expect(values.value.name).toBe('Unsaved draft')
        expect(request).not.toHaveBeenCalled()
        expect(reload).not.toHaveBeenCalled()
        expect(toast).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'setup.compose.switchAccountFailed' }),
        )
        expect(compose.switchingAccount.value).toBe(false)
    })
})
