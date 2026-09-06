import type { SetupDraftContent } from '@avatio/core/setups'

export type SetupDraftSaveStatus =
    | 'new'
    | 'restoring'
    | 'restored'
    | 'unsaved'
    | 'saving'
    | 'saved'
    | 'offline'
    | 'conflict'
    | 'error'

export interface SetupDraftWriterState {
    id: string
    revision: number
    status: SetupDraftSaveStatus
}

export interface SetupDraftTransport {
    put(input: {
        id: string
        expectedRevision: number
        setupId: string | null
        content: SetupDraftContent
    }): Promise<{ revision: number } | null>
    delete(id: string): Promise<void>
    isConflict(error: unknown): boolean
    isOffline(): boolean
}

interface PendingSave {
    generation: number
    setupId: string | null
    content: SetupDraftContent
}

export class SetupDraftWriter {
    #generation = 0
    #pending: PendingSave | null = null
    #running: Promise<void> | null = null
    #retryTimer: ReturnType<typeof setTimeout> | null = null
    #retryCount = 0

    constructor(
        private readonly transport: SetupDraftTransport,
        private readonly onChange: (state: SetupDraftWriterState) => void,
        private readonly retryDelay = (attempt: number) => Math.min(1000 * 2 ** attempt, 30_000),
        private state: SetupDraftWriterState = {
            id: crypto.randomUUID(),
            revision: 0,
            status: 'new',
        },
    ) {}

    get snapshot() {
        return { ...this.state }
    }

    #emit(update: Partial<SetupDraftWriterState>) {
        this.state = { ...this.state, ...update }
        this.onChange(this.snapshot)
    }

    queue(content: SetupDraftContent, setupId: string | null) {
        this.#pending = { generation: this.#generation, setupId, content }
        this.#emit({ status: 'unsaved' })
        this.#start()
    }

    #start() {
        if (this.#running || !this.#pending) return
        this.#running = this.#drain().finally(() => {
            this.#running = null
            if (this.#pending && !this.#retryTimer) this.#start()
        })
    }

    async #drain() {
        while (this.#pending) {
            const save = this.#pending
            this.#pending = null
            this.#emit({ status: 'saving' })
            try {
                const result = await this.transport.put({
                    id: this.state.id,
                    expectedRevision: this.state.revision,
                    setupId: save.setupId,
                    content: save.content,
                })
                if (save.generation !== this.#generation) continue
                this.#retryCount = 0
                this.#emit(
                    result
                        ? { revision: result.revision, status: 'saved' }
                        : { revision: 0, status: 'new' },
                )
            } catch (error) {
                if (save.generation !== this.#generation) continue
                if (this.transport.isConflict(error)) {
                    this.#emit({ status: 'conflict' })
                    return
                }

                this.#pending ??= save
                this.#emit({ status: this.transport.isOffline() ? 'offline' : 'error' })
                const delay = this.retryDelay(this.#retryCount++)
                this.#retryTimer = setTimeout(() => {
                    this.#retryTimer = null
                    this.#start()
                }, delay)
                return
            }
        }
    }

    async flush() {
        if (this.#retryTimer) {
            clearTimeout(this.#retryTimer)
            this.#retryTimer = null
        }
        while (true) {
            this.#start()
            const running = this.#running
            if (!running) return
            await running
            if (this.#retryTimer) return
        }
    }

    async switchSession(id: string, revision: number, status: SetupDraftSaveStatus = 'restored') {
        this.#generation += 1
        this.#pending = null
        if (this.#retryTimer) clearTimeout(this.#retryTimer)
        this.#retryTimer = null
        await this.#running
        this.#retryCount = 0
        this.#emit({ id, revision, status })
    }

    async discard() {
        const discardedId = this.state.id
        this.#generation += 1
        this.#pending = null
        if (this.#retryTimer) clearTimeout(this.#retryTimer)
        this.#retryTimer = null
        await this.#running
        await this.transport.delete(discardedId)
        this.#retryCount = 0
        this.#emit({ id: crypto.randomUUID(), revision: 0, status: 'new' })
    }
}
