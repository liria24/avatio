import type { SetupDraftContent } from '@avatio/core/setups'

export interface SetupDraftRecoveryRecord {
    id: string
    revision: number
    setupId: string | null
    content: SetupDraftContent
    updatedAt: number
}

const databaseName = 'avatio-setup-draft-recovery'
const storeName = 'setup-draft-recovery'

const openRecoveryDatabase = () =>
    new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(databaseName, 1)
        request.onupgradeneeded = () => request.result.createObjectStore(storeName)
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
    })

const run = async <T>(
    mode: IDBTransactionMode,
    operation: (store: IDBObjectStore) => IDBRequest<T>,
) => {
    if (!('indexedDB' in globalThis)) return null
    const database = await openRecoveryDatabase()
    try {
        return await new Promise<T>((resolve, reject) => {
            const request = operation(database.transaction(storeName, mode).objectStore(storeName))
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
        })
    } finally {
        database.close()
    }
}

export const saveSetupDraftRecovery = (record: SetupDraftRecoveryRecord) =>
    run('readwrite', (store) => store.put(record, record.id))

export const loadSetupDraftRecovery = (id: string) =>
    run<SetupDraftRecoveryRecord | undefined>('readonly', (store) => store.get(id))

export const deleteSetupDraftRecovery = (id: string) =>
    run('readwrite', (store) => store.delete(id))
