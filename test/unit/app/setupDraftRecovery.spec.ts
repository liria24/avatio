import 'fake-indexeddb/auto'
import { createDefaultSetupComposeForm } from '@avatio/core/setups'
import { afterEach, describe, expect, it } from 'vitest'

import {
    deleteSetupDraftRecovery,
    loadSetupDraftRecovery,
    saveSetupDraftRecovery,
} from '../../../app/utils/setupDraftRecovery'

const id = '00000000-0000-4000-8000-000000000001'

describe('setup draft local recovery', () => {
    afterEach(() => deleteSetupDraftRecovery(id))

    it('round-trips the latest editable snapshot without image binaries', async () => {
        const record = {
            id,
            revision: 3,
            setupId: null,
            content: { ...createDefaultSetupComposeForm(), name: 'offline' },
            updatedAt: 1,
        }
        await saveSetupDraftRecovery(record)
        await expect(loadSetupDraftRecovery(id)).resolves.toEqual(record)
    })
})
