import { describe, expect, it } from 'vitest'

import { getSetupCacheKey } from '../../../server/utils/cache'

describe('getSetupCacheKey', () => {
    const publicSetup = {
        id: 'setup-1',
        userId: 'owner-1',
        hidAt: null,
    }

    const hiddenSetup = {
        ...publicSetup,
        hidAt: new Date('2026-06-05T00:00:00.000Z'),
    }

    it('uses one shared key for visible setups', () => {
        expect(getSetupCacheKey(publicSetup, null)).toBe('setup-1')
        expect(getSetupCacheKey(publicSetup, { user: { id: 'owner-1' } })).toBe('setup-1')
        expect(getSetupCacheKey(publicSetup, { user: { id: 'viewer-1' } })).toBe('setup-1')
        expect(getSetupCacheKey(publicSetup, { user: { id: 'admin-1', role: 'admin' } })).toBe(
            'setup-1',
        )
    })

    it('uses one shared hidden key for owners and admins', () => {
        expect(getSetupCacheKey(hiddenSetup, { user: { id: 'owner-1' } })).toBe('setup-1:hidden')
        expect(getSetupCacheKey(hiddenSetup, { user: { id: 'admin-1', role: 'admin' } })).toBe(
            'setup-1:hidden',
        )
    })

    it('rejects hidden setups for anonymous users and unrelated viewers', () => {
        expect(getSetupCacheKey(hiddenSetup, null)).toBeNull()
        expect(getSetupCacheKey(hiddenSetup, { user: { id: 'viewer-1' } })).toBeNull()
    })
})
