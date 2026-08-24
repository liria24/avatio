import { publisherVerificationChallenges, userShopVerifications } from '@@/database/schema'

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
        columns: { id: true, code: true, createdAt: true },
    })
    if (existing) {
        await db
            .insert(publisherVerificationChallenges)
            .values({ ...existing, userId: session.user.id })
            .onConflictDoNothing({ target: publisherVerificationChallenges.userId })
        return { code: existing.code }
    }

    const code = generateSecureRandomString(32)
    const id = crypto.randomUUID()
    const createdAt = new Date()
    const [createdRows] = await executeD1Batch(db, [
        db
            .insert(userShopVerifications)
            .values({ id, code, createdAt, userId: session.user.id })
            .onConflictDoNothing({ target: userShopVerifications.userId })
            .returning({ code: userShopVerifications.code }),
        db
            .insert(publisherVerificationChallenges)
            .values({ id, code, createdAt, userId: session.user.id })
            .onConflictDoNothing({ target: publisherVerificationChallenges.userId }),
    ])
    const created = (createdRows as { code: string }[] | undefined)?.[0]

    if (created) return created

    const raced = await db.query.userShopVerifications.findFirst({
        where: { userId: { eq: session.user.id } },
        columns: { id: true, code: true, createdAt: true },
    })
    if (!raced) throw serverError.internalServerError()
    await db
        .insert(publisherVerificationChallenges)
        .values({ ...raced, userId: session.user.id })
        .onConflictDoNothing({ target: publisherVerificationChallenges.userId })
    return { code: raced.code }
})
