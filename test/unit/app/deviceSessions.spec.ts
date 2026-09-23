import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readonly, ref } from 'vue'

import { type DeviceSession, useDeviceSessions } from '../../../app/composables/deviceSessions'

const currentUser = ref<{ id: string } | null>({ id: 'user-a' })
const switching = ref(false)
const setActive = vi.fn()
const reload = vi.fn()
const target = {
    session: { token: 'target-token' },
    user: { id: 'user-b' },
} as DeviceSession

describe('device session account switching', () => {
    beforeEach(() => {
        currentUser.value = { id: 'user-a' }
        switching.value = false
        setActive.mockReset()
        reload.mockReset()
        vi.stubGlobal('readonly', readonly)
        vi.stubGlobal('useState', () => switching)
        vi.stubGlobal('useUserSession', () => ({ user: currentUser }))
        vi.stubGlobal('useAuthClient', () => ({
            multiSession: { setActive },
            revokeOtherSessions: vi.fn(),
        }))
        vi.stubGlobal('useAsyncData', () => ({
            data: ref([target]),
            error: ref(null),
            status: ref('success'),
            pending: ref(false),
            clear: vi.fn(),
            execute: vi.fn(),
            refresh: vi.fn(),
        }))
        vi.stubGlobal('reloadNuxtApp', reload)
    })

    afterEach(() => vi.unstubAllGlobals())

    it('reloads only after Better Auth accepts the target session', async () => {
        setActive.mockResolvedValue({ data: {}, error: null })
        const sessions = useDeviceSessions()

        await sessions.switchAccount(target)

        expect(setActive).toHaveBeenCalledWith({ sessionToken: 'target-token' })
        expect(reload).toHaveBeenCalledWith({ force: true })
        expect(sessions.switching.value).toBe(true)
    })

    it('keeps the current page active when Better Auth returns an error', async () => {
        setActive.mockResolvedValue({ data: null, error: { message: 'Invalid session token' } })
        const sessions = useDeviceSessions()

        await expect(sessions.switchAccount(target)).rejects.toThrow('Invalid session token')

        expect(reload).not.toHaveBeenCalled()
        expect(sessions.switching.value).toBe(false)
    })
})
