export default cronEventHandler(async () => {
    const config = useRuntimeConfig()

    const now = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    // データ取得を並列実行
    const [feedbacksData, setupReportsData, userReportsData] = await Promise.all([
        db.query.feedbacks
            .findMany({
                where: {
                    isClosed: { eq: false },
                    createdAt: { gte: yesterday, lt: now },
                },
                orderBy: {
                    createdAt: 'desc',
                },
                columns: {
                    id: true,
                    createdAt: true,
                    fingerprint: true,
                    contextPath: true,
                    comment: true,
                },
            })
            .catch((error) => {
                console.error('Failed to fetch feedback data:', error)
                return null
            }),
        db.query.setupReports
            .findMany({
                where: {
                    isResolved: { eq: false },
                    createdAt: { gte: yesterday, lt: now },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            })
            .catch((error) => {
                console.error('Failed to fetch setup report data:', error)
                return null
            }),
        db.query.userReports
            .findMany({
                where: {
                    isResolved: { eq: false },
                    createdAt: { gte: yesterday, lt: now },
                },
                orderBy: {
                    createdAt: 'desc',
                },
            })
            .catch((error) => {
                console.error('Failed to fetch user report data:', error)
                return null
            }),
    ])

    const response = {
        feedback: {
            data: feedbacksData,
            error: feedbacksData === null,
        },
        report: {
            setup: {
                data: setupReportsData,
                error: setupReportsData === null,
            },
            user: {
                data: userReportsData,
                error: userReportsData === null,
            },
        },
    }

    const contents: { name: string; value: string }[] = []
    const embedsFeedback = []

    // エラーハンドリングとログ出力
    if (response.feedback.error)
        contents.push({
            name: 'Feedback',
            value: 'Failed to fetch feedback data',
        })
    else if (response.feedback.data?.length) {
        contents.push({
            name: 'Feedback',
            value: `Submitted feedback: **${response.feedback.data.length}**`,
        })
        for (const feedback of response.feedback.data) {
            embedsFeedback.push({
                description: feedback.comment,
                timestamp: feedback.createdAt.toISOString(),
                color: 0xeeeeee,
                author: {
                    name: feedback.fingerprint,
                },
            })
        }
    }

    if (response.report.setup.error)
        contents.push({
            name: 'Setup Reports',
            value: 'Failed to fetch setup report data',
        })
    else if (response.report.setup.data?.length)
        contents.push({
            name: 'Setup Reports',
            value: `Submitted setup reports: **${response.report.setup.data.length}**`,
        })

    if (response.report.user.error)
        contents.push({
            name: 'User Reports',
            value: 'Failed to fetch user report data',
        })
    else if (response.report.user.data?.length)
        contents.push({
            name: 'User Reports',
            value: `Submitted user reports: **${response.report.user.data.length}**`,
        })

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
            await $fetch(config.liria.discordEndpoint, {
                method: 'POST',
                body: JSON.stringify({
                    embeds: [embed, ...embedsFeedback],
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
