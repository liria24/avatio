import { sql, type SQLWrapper } from 'drizzle-orm'

// D1 limits LIKE patterns to 50 bytes; user searches are literal text.
export const searchText = (
    column: SQLWrapper,
    value: string,
    operator: 'contains' | 'starts_with' | 'ends_with' = 'contains',
) => {
    if (operator === 'ends_with')
        return sql`substr(lower(${column}), -length(${value})) = lower(${value})`
    const position = sql`instr(lower(${column}), lower(${value}))`
    return operator === 'starts_with' ? sql`${position} = 1` : sql`${position} > 0`
}
