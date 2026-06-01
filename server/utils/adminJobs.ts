import { sendMessage } from '@avatio/bot-notifier'

const reportLog = logger('/api/admin/job/report')
const cleanupLog = logger('/api/admin/job/cleanup')

interface ImageInfo {
    key: string
    lastModified: Date
}

interface CleanupJobOptions {
    dryRun?: boolean
}

const IMAGE_DELETION_THRESHOLD = 24 * 60 * 60 * 1000

const extractKeyFromUrl = (url: string): string | null => {
    try {
        return new URL(url).pathname.slice(1) || null
    } catch {
        return null
    }
}

const getStorageObjects = async (prefix: string): Promise<ImageInfo[]> => {
    const items: ImageInfo[] = []

    try {
        for await (const obj of storage.listAll({ prefix: `${prefix}/` }))
            items.push({
                key: obj.key,
                lastModified: new Date(obj.lastModified ?? Date.now()),
            })
    } catch (error) {
        cleanupLog.error(`Failed to get storage objects for prefix ${prefix}:`, error)
    }

    return items
}

export const runReportJob = async () => {
    const db = useDB()

    const now = new Date()
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)

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
                reportLog.error('Failed to fetch feedback data:', error)
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
                reportLog.error('Failed to fetch setup report data:', error)
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
                reportLog.error('Failed to fetch user report data:', error)
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
                text: `Period: ${yesterday.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} -> ${now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })}`,
            },
        }

        try {
            await sendMessage({ embeds: [embed, ...embedsFeedback] })
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

export const runCleanupJob = async ({ dryRun = false }: CleanupJobOptions = {}) => {
    const thresholdDate = new Date(Date.now() - IMAGE_DELETION_THRESHOLD)
    const db = useDB()

    const [
        [setupImagesFromDB, setupDraftImagesFromDB, userImagesFromDB],
        [allSetupImages, allUserImages],
    ] = await Promise.all([
        Promise.all([
            db.query.setupImages.findMany({ columns: { url: true } }),
            db.query.setupDraftImages.findMany({ columns: { url: true } }),
            db.query.users.findMany({ columns: { image: true } }),
        ]),
        Promise.all([getStorageObjects('setup'), getStorageObjects('avatar')]),
    ])

    if (
        allSetupImages.length > 0 &&
        setupImagesFromDB.length === 0 &&
        setupDraftImagesFromDB.length === 0
    )
        throw serverError.internalServerError({
            responseMessage:
                'Aborting cleanup: setup images exist in storage but DB returned no records. This may indicate a DB connectivity issue.',
        })

    if (allUserImages.length > 0 && userImagesFromDB.length === 0)
        throw serverError.internalServerError({
            responseMessage:
                'Aborting cleanup: user images exist in storage but DB returned no records. This may indicate a DB connectivity issue.',
        })

    const usedSetupKeys = new Set([
        ...setupImagesFromDB
            .map((img) => extractKeyFromUrl(img.url))
            .filter((key): key is string => key !== null),
        ...setupDraftImagesFromDB
            .map((img) => extractKeyFromUrl(img.url))
            .filter((key): key is string => key !== null),
    ])
    const usedUserKeys = new Set(
        userImagesFromDB
            .map((user) => user.image)
            .filter((image): image is string => Boolean(image?.trim()))
            .map((url) => extractKeyFromUrl(url))
            .filter((key): key is string => key !== null),
    )

    cleanupLog.info('Used setup image keys from DB:', Array.from(usedSetupKeys))
    cleanupLog.info('Used user image keys from DB:', Array.from(usedUserKeys))

    const allUnusedImages = [
        ...allSetupImages.filter((img) => !usedSetupKeys.has(img.key)),
        ...allUserImages.filter((img) => !usedUserKeys.has(img.key)),
    ]

    const allImages = allUnusedImages.filter((img) => img.lastModified < thresholdDate)

    if (dryRun) {
        cleanupLog.info(
            `[DRY RUN] Would delete ${allImages.length} image(s):`,
            allImages.map((img) => img.key),
        )
        return {
            success: true,
            dryRun: true,
            message: 'Dry run completed. No images were deleted.',
            data: {
                wouldDelete: allImages.map((img) => img.key),
                totalWouldProcess: allImages.length,
            },
        }
    }

    for (const image of allImages) cleanupLog.info('Deleting image from storage:', image.key)

    const deleteResults =
        allImages.length > 0
            ? await storage.delete(allImages.map((image) => image.key))
            : { deleted: [], errors: undefined }
    const successful = deleteResults.deleted
    const failed = (deleteResults.errors ?? []).map(({ key, error }) => {
        cleanupLog.error('Failed to delete image:', key, error)
        return {
            key,
            error: error.message || 'Unknown error',
        }
    })

    const message = 'Cleanup completed.'

    if (allImages.length > 0) {
        try {
            await sendMessage({
                embeds: [
                    {
                        title: 'Avatio Data Cleanup',
                        description: message,
                        color: 0xeeeeee,
                        timestamp: new Date().toISOString(),
                        fields: [
                            {
                                name: 'Total Processed',
                                value: allImages.length.toString(),
                                inline: true,
                            },
                            {
                                name: 'Successfully Deleted',
                                value: successful.length.toString(),
                                inline: true,
                            },
                            {
                                name: 'Failed',
                                value: failed.length.toString(),
                                inline: true,
                            },
                            ...(failed.length
                                ? [
                                      {
                                          name: 'Failed Images',
                                          value: failed
                                              .map((f) => `${f.key}: ${f.error}`)
                                              .join('\n')
                                              .slice(0, 1024),
                                          inline: false,
                                      },
                                  ]
                                : []),
                        ],
                        author: {
                            name: 'Avatio',
                            url: 'https://avatio.me',
                            icon_url: 'https://avatio.me/icon_outlined.png',
                        },
                    },
                ],
            })
        } catch (error) {
            cleanupLog.error('Failed to send Discord notification:', error)
        }
    }

    return {
        success: true,
        message,
        data: {
            successfulDeletes: successful,
            failedDeletes: failed,
            totalProcessed: allImages.length,
        },
    }
}
