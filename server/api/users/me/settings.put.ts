import { userSettings } from '@@/database/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const body = z.object({
    showPrivateSetups: z.boolean().optional(),
    showNSFW: z.boolean().optional(),
})

const log = logger('/api/users/me/settings:PUT')

export default authedSessionEventHandler(async ({ session }) => {
    const data = await validateBody(body)

    await db.update(userSettings).set(data).where(eq(userSettings.userId, session.user.id))

    log.info(`User ${session.user.id} updated settings`)

    return null
})
