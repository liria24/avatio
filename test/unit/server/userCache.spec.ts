import { describe, expect, it } from 'vitest'

import { getUserCacheKey } from '../../../server/utils/cache'

describe('getUserCacheKey', () => {
    const publicUser = {
        id: 'user-1',
        banned: false,
    }

    const bannedUser = {
        ...publicUser,
        banned: true,
    }

    it('uses one shared key for public users', () => {
        expect(getUserCacheKey(publicUser, null)).toBe('user-1')
        expect(getUserCacheKey(publicUser, { user: { id: 'user-1' } })).toBe('user-1')
        expect(getUserCacheKey(publicUser, { user: { id: 'viewer-1' } })).toBe('user-1')
        expect(getUserCacheKey(publicUser, { user: { id: 'admin-1', role: 'admin' } })).toBe(
            'user-1',
        )
    })

    it('uses one banned key for the banned user and admins', () => {
        expect(getUserCacheKey(bannedUser, { user: { id: 'user-1' } })).toBe('user-1:banned')
        expect(getUserCacheKey(bannedUser, { user: { id: 'admin-1', role: 'admin' } })).toBe(
            'user-1:banned',
        )
    })

    it('rejects banned users for anonymous users and unrelated viewers', () => {
        expect(getUserCacheKey(bannedUser, null)).toBeNull()
        expect(getUserCacheKey(bannedUser, { user: { id: 'viewer-1' } })).toBeNull()
    })
})
