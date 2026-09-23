const BETTER_AUTH_SESSION_COOKIE_NAMES = new Set([
    'better-auth.session_token',
    '__Secure-better-auth.session_token',
    'better-auth-session-token',
])

export const hasBetterAuthSessionCookie = (cookieHeader?: string | null) =>
    Boolean(
        cookieHeader?.split(';').some((cookie) => {
            const separator = cookie.indexOf('=')
            return (
                separator > 0 &&
                BETTER_AUTH_SESSION_COOKIE_NAMES.has(cookie.slice(0, separator).trim())
            )
        }),
    )
