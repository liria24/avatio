import { auth, type Session } from '@@/better-auth'
import { consola } from 'consola'
import { z } from 'zod/v4'

const config = useRuntimeConfig()

const checkCronAuth = async (
    session: Session | null | undefined
): Promise<void> => {
    const { authorization } = getHeaders(useEvent())

    const isCronValid = authorization === `Bearer ${process.env.CRON_SECRET}`
    const isAdminUser =
        session?.user?.role === 'admin' ||
        authorization === `Bearer ${config.adminKey}`

    if (!isCronValid && !isAdminUser)
        throw createError({
            statusCode: 401,
            message: 'Unauthorized: Invalid CRON authentication',
        })
}

const checkAdminAuth = async (
    session: Session | null | undefined
): Promise<void> => {
    const { authorization } = getHeaders(useEvent())

    const isAdminUser =
        session?.user?.role === 'admin' ||
        authorization === `Bearer ${config.adminKey}`

    if (!isAdminUser)
        throw createError({
            statusCode: 403,
            message: 'Unauthorized: Admin privileges required',
        })
}

const handleError = (
    error: unknown,
    errorMessage = 'Internal server error'
): never => {
    // 既にHTTPErrorの場合はそのまま投げる
    if (error && typeof error === 'object' && 'statusCode' in error) throw error

    // バリデーションエラー
    if (error instanceof z.ZodError) {
        consola.error('Validation error:', error.format())
        throw createError({
            statusCode: 400,
            message: `Bad request: ${error.issues.map((i) => i.message).join(', ')}`,
        })
    }

    // その他のエラー
    consola.error('Server error:', error)
    throw createError({
        statusCode: 500,
        message: errorMessage,
    })
}

type ApiOptions = {
    errorMessage?: string
    requireAdmin?: boolean
    requireSession?: boolean
    requireCron?: boolean
}

type SessionType<Options extends ApiOptions> =
    Options['requireAdmin'] extends true
        ? Session
        : Options['requireSession'] extends true
          ? Session
          : Session | null | undefined

const defaultOptions: ApiOptions = {
    errorMessage: 'Internal server error',
    requireAdmin: false,
    requireSession: false,
    requireCron: false,
}

export default <T, O extends ApiOptions = ApiOptions>(
    handler: (session: SessionType<O>) => Promise<T>,
    options: O = defaultOptions as O
) =>
    defineEventHandler(async (): Promise<T> => {
        try {
            // セッション取得処理
            const session = await auth.api.getSession({
                headers: useEvent().headers,
            })

            // CRON認証チェック
            if (options.requireCron) await checkCronAuth(session)

            // セッション必須チェック
            if (options.requireSession && !session)
                throw createError({
                    statusCode: 401,
                    message: 'Unauthorized: Session required',
                })

            // 管理者権限チェック
            if (options.requireAdmin) await checkAdminAuth(session)

            return await handler(session as SessionType<O>)
        } catch (error) {
            return handleError(error, options.errorMessage)
        }
    })
