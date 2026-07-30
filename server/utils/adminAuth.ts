export const isAdminSession = (session: Session | null): session is NonNullable<Session> =>
    session?.user.role === 'admin'

export const assertAdminSession = (
    session: Session | null,
): asserts session is NonNullable<Session> => {
    if (!isAdminSession(session)) throw serverError.forbidden()
}
