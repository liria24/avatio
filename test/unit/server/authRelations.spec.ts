import { drizzle } from 'drizzle-orm/neon-serverless'
import { describe, expect, it } from 'vitest'

import { relations } from '../../../database/relations'

describe('Better Auth relations', () => {
    it('builds the session query with its joined user', () => {
        const db = drizzle.mock({ relations })

        const query = db.query.sessions
            .findFirst({
                where: { token: { eq: 'session-token' } },
                with: { user: true },
            })
            .toSQL()

        expect(query.sql).toContain('"user"."sessions"')
        expect(query.sql).toContain('"user"."users"')
    })
})
