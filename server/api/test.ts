import database from '@@/database'
import { user } from '@@/database/schema'
import { eq } from 'drizzle-orm'

export default defineEventHandler(async () => {
    return await database
        .update(user)
        .set({
            banExpires: null,
        })
        .where(eq(user.id, 'f33b7516-7693-4d3b-9ca2-37c914336579'))
})
