export const runReportJob = async (
    scope: ServerBackgroundScope = createBackgroundScope('task'),
) => {
    const stage = scope.stage

    const now = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

    const digest = await scope.moderationReports.readPendingDigest({ from: yesterday, to: now })

    const response = {
        feedback: digest.feedbacks,
        report: {
            setup: digest.setupReports,
            user: digest.userReports,
        },
    }

    const contents: { name: string; value: string }[] = []
    const embedsFeedback = []

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

    if (contents.length > 0) {
        const embed = {
            title: `Avatio Report [${stage}]`,
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
                text: `Period: ${yesterday.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} -> ${now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
            },
        }

        try {
            await scope.discordNotifier.send({ embeds: [embed, ...embedsFeedback] })
        } catch (error) {
            throw serverError.internalServerError({
                log: {
                    tag: '/api/admin/job/report',
                    message: `Failed to send report to Discord: ${error instanceof Error ? error.message : String(error)}`,
                },
            })
        }
    }

    return {
        success: true,
        data: response,
        messagesSent: contents.length > 0,
    }
}
