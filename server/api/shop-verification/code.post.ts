import { userShopVerifications } from '@@/database/schema'

const generateSecureRandomString = (length: number) => {
    const bytes = crypto.getRandomValues(new Uint8Array(Math.ceil(length / 2)))
    return [...bytes]
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('')
        .slice(0, length)
}

export default authedSessionEventHandler<{ code: string }>(async ({ session, db }) => {
    await enforceRateLimit({
        binding: 'RATE_LIMIT_USER_ACTION',
        key: `shop-verification-code:${session.user.id}`,
    })

    const existing = await db.query.userShopVerifications.findFirst({
        where: { userId: { eq: session.user.id } },
        columns: { code: true },
    })
    if (existing) return existing

    const code = generateSecureRandomString(32)
    const [created] = await db
        .insert(userShopVerifications)
        .values({ code, userId: session.user.id })
        .onConflictDoNothing({ target: userShopVerifications.userId })
        .returning({ code: userShopVerifications.code })

    if (created) return created

    const raced = await db.query.userShopVerifications.findFirst({
        where: { userId: { eq: session.user.id } },
        columns: { code: true },
    })
    if (!raced) throw serverError.internalServerError()
    return raced
})
