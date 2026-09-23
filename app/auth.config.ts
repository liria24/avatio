import { defineClientAuth } from '@nuxtjs/better-auth/config'
import {
    adminClient,
    inferAdditionalFields,
    multiSessionClient,
    usernameClient,
} from 'better-auth/client/plugins'

// The Nuxt module hoists this config into its generated runtime chunk. Keep the
// small client inference fragment self-contained so a source-relative import is
// not emitted from that generated location. Runtime/schema ownership remains in
// server/auth.config.ts and shared authSchemaOptions.
const clientAdditionalFields = {
    bio: { type: 'string', required: false },
    links: { type: 'string[]', required: false },
    lastAgreedToTerms: { type: 'date', required: false },
} as const

export default defineClientAuth({
    plugins: [
        usernameClient(),
        adminClient(),
        multiSessionClient(),
        inferAdditionalFields({ user: clientAdditionalFields }),
    ],
})
