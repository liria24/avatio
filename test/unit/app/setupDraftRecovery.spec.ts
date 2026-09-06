import 'fake-indexeddb/auto'
import { createDefaultSetupComposeForm } from '@avatio/core/setups'
import { afterEach, describe, expect, it } from 'vitest'

import {
    acknowledgeSetupDraftRecovery,
    deleteSetupDraftRecovery,
    loadSetupDraftRecovery,
    saveSetupDraftRecovery,
} from '../../../app/utils/setupDraftRecovery'

const id = '00000000-0000-4000-8000-000000000001'
const ownerId = 'user-a'

describe('setup draft local recovery', () => {
    afterEach(async () => {
        await deleteSetupDraftRecovery(ownerId, id)
        await deleteSetupDraftRecovery('user-b', id)
    })

    it('round-trips the latest editable snapshot without image binaries', async () => {
        const record = {
            ownerId,
            id,
            revision: 3,
            setupId: null,
            content: { ...createDefaultSetupComposeForm(), name: 'offline' },
            updatedAt: 1,
        }
        await saveSetupDraftRecovery(record)
        await expect(loadSetupDraftRecovery(ownerId, id)).resolves.toEqual(record)
    })

    it('isolates reads and deletes between owners, even for the same draft ID', async () => {
        const record = {
            ownerId,
            id,
            revision: 0,
            setupId: null,
            content: { ...createDefaultSetupComposeForm(), name: 'private to A' },
            updatedAt: 1,
        }
        await saveSetupDraftRecovery(record)
        await expect(loadSetupDraftRecovery('user-b', id)).resolves.toBeNull()
        await deleteSetupDraftRecovery('user-b', id)
        await expect(loadSetupDraftRecovery(ownerId, id)).resolves.toEqual(record)
        await saveSetupDraftRecovery({
            ...record,
            ownerId: 'user-b',
            content: { ...record.content, name: 'B' },
        })
        await expect(loadSetupDraftRecovery(ownerId, id)).resolves.toEqual(record)
        await expect(loadSetupDraftRecovery('user-b', id)).resolves.toMatchObject({
            ownerId: 'user-b',
            content: { name: 'B' },
        })
    })

    it('retains newer edits when an older snapshot is acknowledged', async () => {
        const first = { ...createDefaultSetupComposeForm(), name: 'first' }
        const latest = { ...first, name: 'newer offline edit' }
        await saveSetupDraftRecovery({
            ownerId,
            id,
            revision: 3,
            setupId: null,
            content: latest,
            updatedAt: 2,
        })
        await acknowledgeSetupDraftRecovery(ownerId, id, 4, {
            content: first,
            setupId: null,
            expectedRevision: 3,
        })
        await expect(loadSetupDraftRecovery(ownerId, id)).resolves.toMatchObject({
            revision: 4,
            content: latest,
        })
        await acknowledgeSetupDraftRecovery(ownerId, id, 5, {
            content: latest,
            setupId: null,
            expectedRevision: 4,
        })
        await expect(loadSetupDraftRecovery(ownerId, id)).resolves.toBeNull()
    })

    it('rebases newer local edits to a new draft after an empty snapshot deleted the server draft', async () => {
        const latest = { ...createDefaultSetupComposeForm(), name: 'new edit after clearing' }
        await saveSetupDraftRecovery({
            ownerId,
            id,
            revision: 3,
            setupId: null,
            content: latest,
            updatedAt: 2,
        })
        await acknowledgeSetupDraftRecovery(ownerId, id, 0, {
            content: createDefaultSetupComposeForm(),
            setupId: null,
            expectedRevision: 3,
        })
        await expect(loadSetupDraftRecovery(ownerId, id)).resolves.toMatchObject({
            revision: 0,
            content: latest,
        })
    })

    it('does not rebase recovery written against a later server revision', async () => {
        const latest = { ...createDefaultSetupComposeForm(), name: 'another tab' }
        await saveSetupDraftRecovery({
            ownerId,
            id,
            revision: 5,
            setupId: null,
            content: latest,
            updatedAt: 2,
        })
        await acknowledgeSetupDraftRecovery(ownerId, id, 4, {
            content: createDefaultSetupComposeForm(),
            setupId: null,
            expectedRevision: 3,
        })
        await expect(loadSetupDraftRecovery(ownerId, id)).resolves.toMatchObject({
            revision: 5,
            content: latest,
        })
    })

    it('does not restore an older row with no owner or a mismatched owner field', async () => {
        const database = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open('avatio-setup-draft-recovery', 1)
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
        })
        await new Promise<void>((resolve, reject) => {
            const transaction = database.transaction('setup-draft-recovery', 'readwrite')
            const store = transaction.objectStore('setup-draft-recovery')
            const record = {
                id,
                revision: 1,
                setupId: null,
                content: createDefaultSetupComposeForm(),
                updatedAt: 1,
            }
            store.put(record, id)
            store.put({ ...record, ownerId: 'user-b' }, [ownerId, id])
            transaction.oncomplete = () => resolve()
            transaction.onabort = () => reject(transaction.error)
        })
        database.close()
        await expect(loadSetupDraftRecovery(ownerId, id)).resolves.toBeNull()
        await expect(loadSetupDraftRecovery('user-b', id)).resolves.toBeNull()
    })
})
