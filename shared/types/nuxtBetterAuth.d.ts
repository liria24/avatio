declare module '#nuxt-better-auth' {
    interface AuthUser {
        username?: string | null
        displayUsername?: string | null
        role?: string | null
        banned?: boolean | null
        banReason?: string | null
        banExpires?: Date | null
        bio?: string | null
        links?: string[] | null
        lastAgreedToTerms?: Date | null
    }
}
