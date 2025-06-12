export default defineEventHandler(async () => {
    const { authorization }: { authorization?: string } =
        await getHeaders(useEvent())

    const config = useRuntimeConfig()
    if (
        authorization !== `Bearer ${config.adminKey}` ||
        authorization !== `Bearer ${import.meta.env.CRON_SECRET}`
    ) {
        console.error('Unauthorized access attempt to unused images list')
        throw createError({
            statusCode: 403,
            statusMessage: 'Forbidden.',
        })
    }

    const now = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const supabase = await getSupabaseServerClient()

    // データ取得を並列実行
    const [feedbacks, setupReports, userReports, unusedImages] =
        await Promise.all([
            supabase
                .from('feedback')
                .select('*')
                .neq('dealt', true)
                .lt('created_at', now.toISOString())
                .gt('created_at', yesterday.toISOString()),
            supabase
                .from('report_setup')
                .select('*')
                .neq('dealt', true)
                .lt('created_at', now.toISOString())
                .gt('created_at', yesterday.toISOString()),
            supabase
                .from('report_user')
                .select('*')
                .neq('dealt', true)
                .lt('created_at', now.toISOString())
                .gt('created_at', yesterday.toISOString()),
            $fetch<{
                setupImages: string[]
                userImages: string[]
            }>('/api/admin/unused-images', {
                headers: {
                    authorization: `Bearer ${config.adminKey}`,
                },
            }).catch((error) => {
                console.error('Failed to fetch unused images:', error)
                return null
            }),
        ])

    const response = {
        feedback: {
            number: feedbacks.data?.length ?? 0,
            error: feedbacks.error,
        },
        report: {
            setup: {
                number: setupReports.data?.length ?? 0,
                error: setupReports.error,
            },
            user: {
                number: userReports.data?.length ?? 0,
                error: userReports.error,
            },
        },
        unusedImages: {
            setup: unusedImages?.setupImages ?? [],
            user: unusedImages?.userImages ?? [],
            error: unusedImages === null,
        },
    }

    const contents: { name: string; value: string }[] = []

    // エラーハンドリングとログ出力
    if (response.feedback.error) {
        console.error('Failed to fetch feedback data:', response.feedback.error)
        contents.push({
            name: 'Feedback',
            value: 'Failed to fetch feedback data',
        })
    } else if (response.feedback.number > 0) {
        contents.push({
            name: 'Feedback',
            value: `Submitted feedback: **${response.feedback.number}**`,
        })
    }

    if (response.report.setup.error) {
        console.error(
            'Failed to fetch setup report data:',
            response.report.setup.error
        )
        contents.push({
            name: 'Setup Reports',
            value: 'Failed to fetch setup report data',
        })
    } else if (response.report.setup.number > 0) {
        contents.push({
            name: 'Setup Reports',
            value: `Submitted setup reports: **${response.report.setup.number}**`,
        })
    }

    if (response.report.user.error) {
        console.error(
            'Failed to fetch user report data:',
            response.report.user.error
        )
        contents.push({
            name: 'User Reports',
            value: 'Failed to fetch user report data',
        })
    } else if (response.report.user.number > 0) {
        contents.push({
            name: 'User Reports',
            value: `Submitted user reports: **${response.report.user.number}**`,
        })
    }

    if (response.unusedImages.error) {
        contents.push({
            name: 'Unused Images',
            value: 'Failed to fetch unused images data',
        })
    } else if (
        response.unusedImages.setup.length > 0 ||
        response.unusedImages.user.length > 0
    ) {
        const setupImagesList = response.unusedImages.setup
            .map((url) => {
                const imageName = url.split('/').pop() || 'unknown'
                return `- [${imageName}](https://images.avatio.me/setup/${url})`
            })
            .join('\n')

        const userImagesList = response.unusedImages.user
            .map((url) => {
                const imageName = url.split('/').pop() || 'unknown'
                return `- [${imageName}](https://images.avatio.me/avatar/${url})`
            })
            .join('\n')

        let value = ''
        if (response.unusedImages.setup.length > 0) {
            value += `**Setup Images (${response.unusedImages.setup.length}):**\n${setupImagesList}`
        }
        if (response.unusedImages.user.length > 0) {
            if (value) value += '\n\n'
            value += `**User Images (${response.unusedImages.user.length}):**\n${userImagesList}`
        }

        contents.push({
            name: 'Unused Images',
            value: value,
        })
    }

    // Discordメッセージ送信
    if (contents.length > 0) {
        const embed = {
            title: 'Avatio Report',
            color: 0xeeeeee,
            timestamp: now.toISOString(),
            fields: contents.map((content) => ({
                name: content.name,
                value: content.value,
                inline: false,
            })),
            author: {
                name: 'Avatio',
                url: 'https://avatio.me',
                icon_url: 'https://avatio.me/icon_outlined.png',
            },
            footer: {
                text: `Period: ${yesterday.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} → ${now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
            },
        }

        try {
            await $fetch('https://www.liria.me/api/discord/message', {
                method: 'POST',
                body: JSON.stringify({
                    embeds: [embed],
                }),
                headers: {
                    authorization: `Bearer ${config.liria.accessToken}`,
                },
            })
        } catch (error) {
            console.error('Failed to send Discord message:', error)
            throw createError({
                statusCode: 500,
                statusMessage: 'Failed to send Discord message',
            })
        }
    }

    return {
        success: true,
        data: response,
        messagesSent: contents.length > 0,
    }
})
