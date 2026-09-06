import { setupDraftContentSchema, type SetupDraftContent } from '@avatio/core/setups'

const debounceMs = 2000

export const useSetupDraftController = (onDraftId: (id: string | null) => void) => {
    const { user } = useUserSession()
    const ownerId = user.value?.id
    const requestFetch = useRequestFetch()
    const requireOwner = () => {
        if (!ownerId || user.value?.id !== ownerId) throw new Error('Draft owner changed.')
        return ownerId
    }
    const state = reactive<SetupDraftWriterState>({
        id: crypto.randomUUID(),
        revision: 0,
        status: 'new',
    })
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let latest: { content: SetupDraftContent; setupId: string | null } | null = null

    const transport: SetupDraftTransport = {
        async put({ id, ...body }) {
            const owner = requireOwner()
            const result = await requestFetch<{ revision: number } | null>(
                `/api/setup-drafts/${id}`,
                {
                    method: 'PUT',
                    body,
                },
            )
            await acknowledgeSetupDraftRecovery(owner, id, result?.revision ?? 0, body).catch(
                () => null,
            )
            return result
        },
        async delete(id) {
            requireOwner()
            try {
                await requestFetch(`/api/setup-drafts/${id}`, { method: 'DELETE' })
            } catch (error) {
                if ((error as { statusCode?: number }).statusCode !== 404) throw error
            }
        },
        isConflict: (error) =>
            user.value?.id !== ownerId || (error as { statusCode?: number }).statusCode === 409,
        isOffline: () => import.meta.client && !navigator.onLine,
    }
    const writer = new SetupDraftWriter(
        transport,
        (next) => {
            Object.assign(state, next, latest ? { status: 'unsaved' } : {})
            onDraftId(state.status === 'new' ? null : state.id)
        },
        undefined,
        { ...state },
    )

    const flushLatest = () => {
        if (!latest) return
        writer.queue(latest.content, latest.setupId)
        latest = null
    }

    const schedule = (content: SetupDraftContent, setupId: string | null) => {
        const owner = requireOwner()
        latest = { content: structuredClone(content), setupId }
        onDraftId(state.id)
        void saveSetupDraftRecovery({
            ownerId: owner,
            id: state.id,
            revision: state.revision,
            setupId,
            content: latest.content,
            updatedAt: Date.now(),
        }).catch(() => null)
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = setTimeout(() => {
            debounceTimer = null
            flushLatest()
        }, debounceMs)
        state.status = 'unsaved'
    }

    const flush = async () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = null
        flushLatest()
        await writer.flush()
    }

    const switchSession = async (id: string, revision: number) => {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = null
        latest = null
        await writer.switchSession(id, revision)
    }

    const discard = async () => {
        if (debounceTimer) clearTimeout(debounceTimer)
        debounceTimer = null
        latest = null
        const id = state.id
        await writer.discard()
        await deleteSetupDraftRecovery(requireOwner(), id).catch(() => null)
    }

    const loadRecovery = async (id: string) => {
        const record = await loadSetupDraftRecovery(requireOwner(), id).catch(() => null)
        requireOwner()
        return record
    }

    const load = async (id: string): Promise<SetupDraft> => {
        requireOwner()
        let remote: SetupDraft | null = null
        let failure: unknown
        try {
            remote = await requestFetch<SetupDraft>(`/api/setup-drafts/${id}`)
        } catch (error) {
            const status = (error as { statusCode?: number }).statusCode
            if (status && status < 500 && status !== 404) throw error
            failure = error
        }
        const local = await loadRecovery(id)
        if (remote && (!local || matchesSetupDraftRecovery(local, remote))) return remote
        const missing = (failure as { statusCode?: number } | undefined)?.statusCode === 404
        if (local && (!missing || local.revision === 0))
            return {
                id: local.id,
                revision: local.revision,
                setupId: local.setupId,
                content: setupDraftContentSchema.parse(local.content),
                createdAt: new Date(local.updatedAt),
                updatedAt: new Date(local.updatedAt),
            }
        throw failure ?? new Error('Draft not found.')
    }

    return {
        state: readonly(state),
        schedule,
        flush,
        switchSession,
        discard,
        load,
        loadRecovery,
        deleteRecovery: (id: string) => deleteSetupDraftRecovery(requireOwner(), id),
        requireOwner,
    }
}
