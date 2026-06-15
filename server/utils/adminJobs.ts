import { sendMessage } from '@avatio/bot-notifier'

const reportLog = logger('/api/admin/job/report')
const cleanupLog = logger('/api/admin/job/cleanup')

interface ImageInfo {
    key: string
    lastModified: Date
}

interface UsedImageUrls {
    setup: string[]
    avatar: string[]
}

interface FailedImageOperation {
    key: string
    error: string
}

interface CleanupJobOptions {
    dryRun?: boolean
}

const IMAGE_DELETION_THRESHOLD = 24 * 60 * 60 * 1000
const STORAGE_OPERATION_CONCURRENCY = 8

const BACKUP_PREFIX = 'backup'
const BACKUP_RULE_ID = 'avatio-backup-cleanup'
const BACKUP_RETENTION_SECONDS = 3 * 24 * 60 * 60 // 3 days

interface LifecycleRule {
    id: string
    conditions: { prefix: string }
    enabled: boolean
    deleteObjectsTransition?: {
        condition: { maxAge: number; type: 'Age' }
    }
}

const getR2PublicBaseUrl = () => getRuntimeEnvString('R2_PUBLIC_BASE_URL')?.replace(/\/+$/, '')

const extractStorageKeyFromUrl = (
    url: string,
    publicBaseUrl = getR2PublicBaseUrl(),
): string | null => {
    if (!publicBaseUrl) return null

    try {
        const parsedUrl = new URL(url)
        const parsedBaseUrl = new URL(publicBaseUrl)
        if (parsedUrl.origin !== parsedBaseUrl.origin) return null

        const basePath = parsedBaseUrl.pathname.replace(/\/+$/, '')
        if (basePath && !parsedUrl.pathname.startsWith(`${basePath}/`)) return null

        const key = parsedUrl.pathname.slice(basePath.length).replace(/^\/+/, '')
        return key ? decodeURIComponent(key) : null
    } catch {
        return null
    }
}

const getUsedImageUrls = async (db: ReturnType<typeof useDB>): Promise<UsedImageUrls> => {
    const [setupImagesFromDB, setupDraftImagesFromDB, userImagesFromDB] = await Promise.all([
        db.query.setupImages.findMany({ columns: { objectKey: true } }),
        db.query.setupDraftImages.findMany({ columns: { objectKey: true } }),
        db.query.users.findMany({ columns: { image: true } }),
    ])

    return {
        setup: [
            ...setupImagesFromDB.map((image) => image.objectKey),
            ...setupDraftImagesFromDB.map((image) => image.objectKey),
        ],
        avatar: userImagesFromDB
            .map((user) => user.image)
            .filter((image): image is string => Boolean(image?.trim())),
    }
}

const imageUrlsToStorageKeys = (urls: string[], publicBaseUrl: string) =>
    new Set(
        urls
            .map((url) =>
                url.includes('://') ? extractStorageKeyFromUrl(url, publicBaseUrl) : url,
            )
            .filter((key): key is string => key !== null),
    )

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

const getCleanupCandidates = (
    storageImages: ImageInfo[],
    usedKeys: Set<string>,
    thresholdDate: Date,
) => storageImages.filter((image) => !usedKeys.has(image.key) && image.lastModified < thresholdDate)

const copyWithConcurrency = async (images: ImageInfo[], backupDate: string) => {
    const backedUp: string[] = []
    const backupFailed: FailedImageOperation[] = []
    let index = 0

    await Promise.all(
        Array.from({ length: Math.min(STORAGE_OPERATION_CONCURRENCY, images.length) }, async () => {
            while (index < images.length) {
                const current = index
                index += 1
                const image = images[current]
                if (!image) return

                try {
                    await storage.copy(image.key, `${BACKUP_PREFIX}/${backupDate}/${image.key}`)
                    backedUp.push(image.key)
                } catch (error) {
                    cleanupLog.warn('Failed to backup image before deletion:', image.key, error)
                    backupFailed.push({
                        key: image.key,
                        error: error instanceof Error ? error.message : String(error),
                    })
                }
            }
        }),
    )

    return { backedUp, backupFailed }
}

const ensureBackupLifecycleRule = async () => {
    const config = useRuntimeConfig()
    const accountId = config.cloudflare?.accountId
    const apiToken = config.cloudflare?.apiToken
    const bucket = process.env.R2_BUCKET ?? 'avatio'

    if (!accountId || !apiToken) {
        cleanupLog.warn('Cloudflare credentials not configured; skipping lifecycle rule setup')
        return
    }

    const baseUrl = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/lifecycle`
    const headers = {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
    }

    let existingRules: LifecycleRule[] = []
    try {
        const res = await $fetch<{ result: { rules?: LifecycleRule[] }; success: boolean }>(
            baseUrl,
            { headers },
        )
        if (res.success) existingRules = res.result.rules ?? []
    } catch (error) {
        cleanupLog.warn('Failed to fetch existing lifecycle rules:', error)
    }

    const backupRule: LifecycleRule = {
        id: BACKUP_RULE_ID,
        conditions: { prefix: `${BACKUP_PREFIX}/` },
        enabled: true,
        deleteObjectsTransition: {
            condition: { maxAge: BACKUP_RETENTION_SECONDS, type: 'Age' },
        },
    }

    const mergedRules = [...existingRules.filter((r) => r.id !== BACKUP_RULE_ID), backupRule]

    try {
        await $fetch(baseUrl, {
            method: 'PUT',
            headers,
            body: { rules: mergedRules },
        })
        cleanupLog.info('Backup lifecycle rule ensured on R2 bucket')
    } catch (error) {
        cleanupLog.warn('Failed to set lifecycle rules:', error)
    }
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
    const publicBaseUrl = getR2PublicBaseUrl()

    if (!publicBaseUrl) {
        const message = 'R2_PUBLIC_BASE_URL is not configured. Cleanup skipped.'
        cleanupLog.error(message)
        return dryRun
            ? {
                  success: false,
                  dryRun: true,
                  message,
                  data: {
                      candidates: [],
                      wouldDelete: [],
                      wouldBackupTo: [],
                      totalWouldProcess: 0,
                  },
              }
            : {
                  success: false,
                  message,
                  data: {
                      candidates: [],
                      backedUp: [],
                      backupFailed: [],
                      backupFailures: [],
                      skippedBecauseBackupFailed: [],
                      successfulDeletes: [],
                      failedDeletes: [],
                      totalProcessed: 0,
                  },
              }
    }

    const db = useDB()

    const [usedImageUrls, [allSetupImages, allUserImages]] = await Promise.all([
        getUsedImageUrls(db),
        Promise.all([getStorageObjects('setup'), getStorageObjects('avatar')]),
    ])

    const usedSetupKeys = imageUrlsToStorageKeys(usedImageUrls.setup, publicBaseUrl)
    const usedUserKeys = imageUrlsToStorageKeys(usedImageUrls.avatar, publicBaseUrl)

    cleanupLog.info('Used setup image keys from DB:', Array.from(usedSetupKeys))
    cleanupLog.info('Used user image keys from DB:', Array.from(usedUserKeys))

    const allImages = [
        ...getCleanupCandidates(allSetupImages, usedSetupKeys, thresholdDate),
        ...getCleanupCandidates(allUserImages, usedUserKeys, thresholdDate),
    ]
    const candidates = allImages.map((image) => image.key)

    const today = new Date().toISOString().slice(0, 10)

    if (dryRun) {
        cleanupLog.info(`[DRY RUN] Would delete ${allImages.length} image(s):`, candidates)
        return {
            success: true,
            dryRun: true,
            message: 'Dry run completed. No images were deleted.',
            data: {
                candidates,
                wouldDelete: candidates,
                wouldBackupTo: candidates.map((key) => `${BACKUP_PREFIX}/${today}/${key}`),
                totalWouldProcess: allImages.length,
            },
        }
    }

    await ensureBackupLifecycleRule()

    const { backedUp, backupFailed: backupFailures } = await copyWithConcurrency(allImages, today)
    const backedUpSet = new Set(backedUp)
    const imagesToDelete = allImages.filter((image) => backedUpSet.has(image.key))
    const backupFailed = backupFailures.map((failure) => failure.key)
    const skippedBecauseBackupFailed = backupFailed

    for (const image of imagesToDelete) cleanupLog.info('Deleting image from storage:', image.key)

    const deleteResults =
        imagesToDelete.length > 0
            ? await storage.delete(
                  imagesToDelete.map((image) => image.key),
                  { concurrency: STORAGE_OPERATION_CONCURRENCY },
              )
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
                                name: 'Backed Up',
                                value: backedUp.length.toString(),
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
                            ...(skippedBecauseBackupFailed.length
                                ? [
                                      {
                                          name: 'Skipped Because Backup Failed',
                                          value: skippedBecauseBackupFailed
                                              .join('\n')
                                              .slice(0, 1024),
                                          inline: false,
                                      },
                                  ]
                                : []),
                            ...(backupFailures.length
                                ? [
                                      {
                                          name: 'Backup Failed',
                                          value: backupFailures
                                              .map((f) => `${f.key}: ${f.error}`)
                                              .join('\n')
                                              .slice(0, 1024),
                                          inline: false,
                                      },
                                  ]
                                : []),
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
            candidates,
            backedUp,
            backupFailed,
            backupFailures,
            skippedBecauseBackupFailed,
            successfulDeletes: successful,
            failedDeletes: failed,
            totalProcessed: allImages.length,
        },
    }
}
