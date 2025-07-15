import database from '@@/database'
import { userShopVerification } from '@@/database/schema'
import crypto from 'crypto'
import { eq } from 'drizzle-orm'

const generateSecureRandomString = (length: number): string =>
    crypto
        .randomBytes(Math.ceil(length / 2))
        .toString('hex')
        .slice(0, length)

export default defineApi<
    { code: string },
    {
        errorMessage: 'Failed to get item.'
        requireSession: true
    }
>(async ({ session }) => {
    const code = generateSecureRandomString(32)

    await database
        .delete(userShopVerification)
        .where(eq(userShopVerification.userId, session.user.id))

    const result = await database
        .insert(userShopVerification)
        .values({
            code,
            userId: session.user.id,
        })
        .returning({ code: userShopVerification.code })

    return result[0]
})
