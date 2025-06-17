import { adminClient } from 'better-auth/client/plugins'
import { createAuthClient } from 'better-auth/vue'

export const authClient = createAuthClient({
    baseURL: import.meta.env.NUX_PUBLIC_SITE_URL,
    plugins: [adminClient()],
})
