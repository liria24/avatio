import { sql } from 'drizzle-orm'
import { integer, text } from 'drizzle-orm/sqlite-core'

export const now = sql`(unixepoch() * 1000)`
export const timestamp = () => integer({ mode: 'timestamp_ms' })
export const boolean = () => integer({ mode: 'boolean' })
export const identity = () => integer().primaryKey({ autoIncrement: true })
export const uuid = () => text().$defaultFn(() => crypto.randomUUID())
