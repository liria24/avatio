import type { SetupDraftContent } from '@avatio/core/setups'

const debounceMs = 2000

export const useSetupDraftController = (onDraftId: (id: string | null) => void) => {
    const state = reactive<SetupDraftWriterState>({
        id: crypto.randomUUID(),
        revision: 0,
        status: 'new',
    })
    let debounceTimer: ReturnType<typeof setTimeout> | null = null
    let latest: { content: SetupDraftContent; setupId: string | null } | null = null

    const transport: SetupDraftTransport = {
        put: ({ id, ...body }) =>
            $fetch<{ revision: number } | null>(`/api/setup-drafts/${id}`, {
                method: 'PUT',
                body,
            }),
        async delete(id) {
            try {
                await $fetch(`/api/setup-drafts/${id}`, { method: 'DELETE' })
            } catch (error) {
                if ((error as { statusCode?: number }).statusCode !== 404) throw error
            }
        },
        isConflict: (error) => (error as { statusCode?: number }).statusCode === 409,
        isOffline: () => import.meta.client && !navigator.onLine,
    }
    const writer = new SetupDraftWriter(transport, (next) => {
        Object.assign(state, next)
        onDraftId(next.status === 'new' ? null : next.id)
        if (next.status === 'saved' || next.status === 'new')
            void deleteSetupDraftRecovery(next.id).catch(() => null)
    })

    const flushLatest = () => {
        if (!latest) return
        writer.queue(latest.content, latest.setupId)
        latest = null
    }

    const schedule = (content: SetupDraftContent, setupId: string | null) => {
        latest = { content: structuredClone(content), setupId }
        onDraftId(state.id)
        void saveSetupDraftRecovery({
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
        await deleteSetupDraftRecovery(id).catch(() => null)
    }

    return {
        state: readonly(state),
        schedule,
        flush,
        switchSession,
        discard,
        loadRecovery: loadSetupDraftRecovery,
    }
}
