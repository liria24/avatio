import { list, remove } from '@tigrisdata/storage'

interface ImageInfo {
    key: string
    lastModified: Date
}

const IMAGE_DELETION_THRESHOLD = 24 * 60 * 60 * 1000 // 1日

// URLからストレージキー（パス部分）を抽出する
// 例: https://images.avatio.me/setup/abc.jpg → setup/abc.jpg
const extractKeyFromUrl = (url: string): string | null => {
    try {
        return new URL(url).pathname.slice(1) || null
    } catch {
        return null
    }
}

// ページネーションを考慮してストレージオブジェクトを全件取得する
const getStorageObjects = async (prefix: string): Promise<ImageInfo[]> => {
    const items: ImageInfo[] = []
    let paginationToken: string | undefined

    try {
        do {
            const result = await list({
                prefix: `${prefix}/`,
                ...(paginationToken ? { paginationToken } : {}),
            })

            if (result.error) {
                console.error(`Failed to list storage objects for prefix ${prefix}:`, result.error)
                break
            }
            if (!result.data?.items) break

            for (const obj of result.data.items) {
                items.push({
                    key: obj.name,
                    lastModified: new Date(obj.lastModified!),
                })
            }

            paginationToken = result.data.hasMore ? result.data.paginationToken : undefined
        } while (paginationToken)
    } catch (error) {
        console.error(`Failed to get storage objects for prefix ${prefix}:`, error)
    }

    return items
}

export default cronEventHandler(async ({ event }) => {
    const config = useRuntimeConfig()
    const { dryRun: dryRunParam } = getQuery(event)
    const isDryRun = dryRunParam === 'true' || dryRunParam === '1'

    const thresholdDate = new Date(Date.now() - IMAGE_DELETION_THRESHOLD)

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

    // Bug 2: DB結果が空かつストレージに画像がある場合は誤判定のリスクがあるため処理中断
    if (
        allSetupImages.length > 0 &&
        setupImagesFromDB.length === 0 &&
        setupDraftImagesFromDB.length === 0
    ) {
        throw createError({
            status: 500,
            statusText:
                'Aborting cleanup: setup images exist in storage but DB returned no records. This may indicate a DB connectivity issue.',
        })
    }
    if (allUserImages.length > 0 && userImagesFromDB.length === 0) {
        throw createError({
            status: 500,
            statusText:
                'Aborting cleanup: user images exist in storage but DB returned no records. This may indicate a DB connectivity issue.',
        })
    }

    // Bug 1: URLではなくストレージキー（パス）で比較することでドメイン変更の影響を受けなくする
    const usedSetupKeys = new Set([
        ...setupImagesFromDB
            .map((img) => extractKeyFromUrl(img.url))
            .filter((k): k is string => k !== null),
        ...setupDraftImagesFromDB
            .map((img) => extractKeyFromUrl(img.url))
            .filter((k): k is string => k !== null),
    ])
    const usedUserKeys = new Set(
        userImagesFromDB
            .map((user) => user.image)
            .filter((image): image is string => Boolean(image?.trim()))
            .map((url) => extractKeyFromUrl(url))
            .filter((k): k is string => k !== null),
    )
    console.log('Used setup image keys from DB:', Array.from(usedSetupKeys))
    console.log('Used user image keys from DB:', Array.from(usedUserKeys))

    const allUnusedImages = [
        ...allSetupImages.filter((img) => !usedSetupKeys.has(img.key)),
        ...allUserImages.filter((img) => !usedUserKeys.has(img.key)),
    ]

    const allImages = allUnusedImages.filter((img) => img.lastModified < thresholdDate)

    if (isDryRun) {
        console.log(
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

    // Bug 4: remove() の戻り値のエラーを確認してから throw することで
    //         Promise.allSettled が失敗を正しく rejected として検出できるようにする
    const deleteResults = await Promise.allSettled(
        allImages.map(async (image) => {
            console.log('Deleting image from storage:', image.key)
            const result = await remove(image.key)
            if (result.error) throw result.error
            return image.key
        }),
    )

    // Categorize results
    const { successful, failed } = deleteResults.reduce(
        (acc, result, index) => {
            const image = allImages[index]
            if (!image) return acc
            const imageKey = image.key

            if (result.status === 'fulfilled') {
                acc.successful.push(imageKey)
            } else {
                console.error('Failed to delete image:', imageKey, result.reason)
                acc.failed.push({
                    key: imageKey,
                    error: result.reason?.message || 'Unknown error',
                })
            }
            return acc
        },
        {
            successful: [] as string[],
            failed: [] as Array<{ key: string; error: string }>,
        },
    )

    const message = 'Cleanup completed.'

    // 処理対象の画像がある場合のみDiscord通知を送信
    if (allImages.length > 0) {
        try {
            await $fetch(config.liria.discordEndpoint, {
                method: 'POST',
                body: {
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
                },
                headers: {
                    authorization: `Bearer ${config.liria.accessToken}`,
                },
            })
        } catch (error) {
            console.error('Failed to send Discord notification:', error)
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
})
