import { userShopVerification } from '@@/database/schema'
import crypto from 'crypto'
import { eq } from 'drizzle-orm'

const generateSecureRandomString = (length: number): string =>
    crypto
        .randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length)

export default authedSessionEventHandler<{ code: string }>(async ({ session }) => {
    const code = generateSecureRandomString(32)

    await db.delete(userShopVerification).where(eq(userShopVerification.userId, session!.user.id))

    const [result] = await db
        .insert(userShopVerification)
        .values({
            code,
            userId: session!.user.id,
        })
        .returning({ code: userShopVerification.code })

    if (!result)
        throw createError({
            status: 500,
            statusText: 'Failed to create verification code',
        })

    return result
})
