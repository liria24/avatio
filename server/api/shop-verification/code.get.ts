import crypto from 'crypto'

import { userShopVerifications } from '@@/database/schema'
import { eq } from 'drizzle-orm'

const generateSecureRandomString = (length: number): string =>
    crypto
        .randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length)

export default authedSessionEventHandler<{ code: string }>(async ({ session }) => {
    const code = generateSecureRandomString(32)

    await db.delete(userShopVerifications).where(eq(userShopVerifications.userId, session!.user.id))

    const [result] = await db
        .insert(userShopVerifications)
        .values({
            code,
            userId: session!.user.id,
        })
        .returning({ code: userShopVerifications.code })

    if (!result)
        throw createError({
            status: 500,
            statusText: 'Failed to create verification code',
        })

    return result
})
