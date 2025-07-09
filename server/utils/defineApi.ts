import type { Session } from '@@/better-auth'
import { auth } from '@@/better-auth'
import { consola } from 'consola'
import { z } from 'zod/v4'

const config = useRuntimeConfig()

/**
 * 認証権限をチェックする汎用関数
 */
const checkAuth = (
    session: Session | null | undefined,
    options: {
        requireAdmin?: boolean
        requireCron?: boolean
    }
): void => {
    const { authorization } = getHeaders(useEvent())

    // 権限チェック
    const isAdmin =
        session?.user?.role === 'admin' ||
        authorization === `Bearer ${config.adminKey}`
    const isCronValid = authorization === `Bearer ${process.env.CRON_SECRET}`

    // CRON認証が必要で、CRONとしても管理者としても認証されていない場合
    if (options.requireCron && !isCronValid && !isAdmin) {
        throw createError({
            statusCode: 401,
            message: 'Unauthorized: Invalid CRON authentication',
        })
    }

    // 管理者権限が必要で、管理者として認証されていない場合
    if (options.requireAdmin && !isAdmin) {
        throw createError({
            statusCode: 403,
            message: 'Unauthorized: Admin privileges required',
        })
    }
}

/**
 * エラーハンドリング関数
 */
const handleError = (
    error: unknown,
    errorMessage = 'Internal server error'
): never => {
    // HTTPエラーの場合はそのまま投げる
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
    rejectBannedUser?: boolean
}

type ApiContext<Options extends ApiOptions> = {
    session: SessionType<Options>
    // 他のコンテキスト情報も追加可能
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
    rejectBannedUser: false,
}

type MergeOptions<O extends ApiOptions> = O extends undefined
    ? typeof defaultOptions
    : O & typeof defaultOptions

export default function defineApi<T, O extends ApiOptions = object>(
    handler: (context: ApiContext<MergeOptions<O>>) => Promise<T>,
    options?: O
) {
    // optionsが未指定の場合はdefaultOptionsを使う
    const mergedOptions = { ...defaultOptions, ...options } as MergeOptions<O>
    return defineEventHandler(async (): Promise<T> => {
        try {
            const event = useEvent()
            const { authorization } = getHeaders(event)
            const session = await auth.api.getSession({
                headers: event.headers,
            })

            // requireSessionまたはrequireAdminが必要な場合の認証判定
            if (mergedOptions.requireAdmin) {
                // adminKeyによる認証を許可
                const isAdminKey = authorization === `Bearer ${config.adminKey}`
                if (!session && !isAdminKey)
                    throw createError({
                        statusCode: 401,
                        message: 'Unauthorized: Session or adminKey required',
                    })
            } else if (mergedOptions.requireSession && !session)
                throw createError({
                    statusCode: 401,
                    message: 'Unauthorized: Session required',
                })

            checkAuth(session, {
                requireAdmin: mergedOptions.requireAdmin,
                requireCron: mergedOptions.requireCron,
            })

            if (mergedOptions.rejectBannedUser && session?.user?.banned)
                throw createError({
                    statusCode: 403,
                    message: 'Forbidden: User account is banned',
                })

            return await handler({
                session: (mergedOptions.requireSession ||
                mergedOptions.requireAdmin
                    ? session!
                    : session) as SessionType<MergeOptions<O>>,
            })
        } catch (error) {
            return handleError(error, mergedOptions.errorMessage)
        }
    })
}
