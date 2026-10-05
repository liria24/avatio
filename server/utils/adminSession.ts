import type { H3Event } from '@nuxt/nitro-server/h3'

export const requireAdminSession = async (event: H3Event) => {
    const session = await requireUserSession(event, { user: { role: 'admin' } })
    assertSessionNotBanned(session)
    return session
}
