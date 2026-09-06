import type { SetupDraftContent } from '@avatio/core/setups'

export interface SetupDraftRecoveryRecord {
    ownerId: string
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
            const transaction = database.transaction(storeName, mode)
            const request = operation(transaction.objectStore(storeName))
            let result: T
            request.addEventListener('success', () => {
                result = request.result
            })
            request.onerror = () => reject(request.error)
            transaction.oncomplete = () => resolve(result)
            transaction.onabort = () => reject(transaction.error)
        })
    } finally {
        database.close()
    }
}

export const saveSetupDraftRecovery = (record: SetupDraftRecoveryRecord) =>
    run('readwrite', (store) => store.put(record, [record.ownerId, record.id]))

export const loadSetupDraftRecovery = async (ownerId: string, id: string) => {
    // Older rows have no verifiable owner and must never be restored into an account.
    const record = await run<SetupDraftRecoveryRecord | undefined>('readonly', (store) =>
        store.get([ownerId, id]),
    )
    return record?.ownerId === ownerId && record.id === id ? record : null
}

export const deleteSetupDraftRecovery = (ownerId: string, id: string) =>
    run('readwrite', (store) => store.delete([ownerId, id]))

export const matchesSetupDraftRecovery = (
    record: Pick<SetupDraftRecoveryRecord, 'content' | 'setupId'>,
    snapshot: Pick<SetupDraftRecoveryRecord, 'content' | 'setupId'>,
) =>
    record.setupId === snapshot.setupId &&
    JSON.stringify(record.content) === JSON.stringify(snapshot.content)

export const acknowledgeSetupDraftRecovery = (
    ownerId: string,
    id: string,
    revision: number,
    snapshot: Pick<SetupDraftRecoveryRecord, 'content' | 'setupId'> & { expectedRevision: number },
) =>
    run('readwrite', (store) => {
        const key = [ownerId, id]
        const request: IDBRequest<SetupDraftRecoveryRecord | undefined> = store.get(key)
        request.addEventListener('success', () => {
            const record = request.result
            if (
                !record ||
                record.ownerId !== ownerId ||
                record.id !== id ||
                record.revision > snapshot.expectedRevision
            )
                return
            if (matchesSetupDraftRecovery(record, snapshot)) store.delete(key)
            else store.put({ ...record, revision }, key)
        })
        return request
    })
