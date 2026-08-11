import { describe, expect, it } from 'vitest'

import { hasBetterAuthSessionCookie } from '../../../shared/utils/authCookie'

describe('hasBetterAuthSessionCookie', () => {
    it('matches only supported session cookie names', () => {
        expect(hasBetterAuthSessionCookie('i18n_redirected=ja')).toBe(false)
        expect(hasBetterAuthSessionCookie('better-auth.session_token-extra=value')).toBe(false)
        expect(hasBetterAuthSessionCookie('unrelated-better-auth=value')).toBe(false)
        expect(hasBetterAuthSessionCookie('theme=dark; better-auth.session_token=value')).toBe(true)
        expect(hasBetterAuthSessionCookie('__Secure-better-auth.session_token=value')).toBe(true)
        expect(hasBetterAuthSessionCookie('better-auth-session-token=value')).toBe(true)
    })
})
