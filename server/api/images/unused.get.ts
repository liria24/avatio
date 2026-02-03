interface ImageInfo {
    url: string
    key: string
    lastModified: Date
}

interface UnusedImagesResponse {
    setup: ImageInfo[]
    user: ImageInfo[]
    noNeedDeleting: ImageInfo[]
}

const IMAGE_DELETION_THRESHOLD = 24 * 60 * 60 * 1000 // 1日

export default adminSessionEventHandler<UnusedImagesResponse>(async () => {
    const thresholdDate = new Date(Date.now() - IMAGE_DELETION_THRESHOLD)

    const getStorageObjects = async (prefix: string): Promise<ImageInfo[]> => {
        try {
            const result = await s3.list({ prefix: `${prefix}/` })

            if (!result || !result.contents) return []

            return result.contents
                .filter((obj) => obj.key?.split('/').pop()?.trim())
                .map((obj) => ({
                    url: `https://images.avatio.me/${obj.key}`,
                    key: obj.key,
                    lastModified: new Date(obj.lastModified!),
                }))
        } catch (error) {
            console.error(`Failed to get storage objects for prefix ${prefix}:`, error)
            return []
        }
    }

    // 並列実行で高速化
    const [
        [setupImagesFromDB, setupDraftImagesFromDB, userImagesFromDB],
        [allSetupImages, allUserImages],
    ] = await Promise.all([
        // DB クエリを並列実行
        Promise.all([
            db.query.setupImages.findMany({
                columns: { url: true },
            }),
            db.query.setupDraftImages.findMany({
                columns: { url: true },
            }),
            db.query.user.findMany({
                columns: { image: true },
            }),
        ]),
        // ストレージクエリを並列実行
        Promise.all([getStorageObjects('setup'), getStorageObjects('avatar')]),
    ])

    // Set を使って高速な検索を実現
    const usedSetupUrls = new Set([
        ...setupImagesFromDB.map((img) => img.url),
        ...setupDraftImagesFromDB.map((img) => img.url),
    ])
    const usedUserUrls = new Set(
        userImagesFromDB
            .map((user) => user.image)
            .filter((image): image is string => Boolean(image?.trim()))
    )

    // 未使用画像を抽出
    const unusedSetupImages = allSetupImages.filter((img) => !usedSetupUrls.has(img.url))
    const unusedUserImages = allUserImages.filter((img) => !usedUserUrls.has(img.url))

    const allUnusedImages = [...unusedSetupImages, ...unusedUserImages]

    // 削除対象と保持対象を分離
    const { oldImages, recentImages } = allUnusedImages.reduce(
        (acc, img) => {
            if (img.lastModified < thresholdDate) acc.oldImages.push(img)
            else acc.recentImages.push(img)

            return acc
        },
        { oldImages: [] as ImageInfo[], recentImages: [] as ImageInfo[] }
    )

    // 最終的な分類
    const setup = oldImages.filter((img) => img.key.startsWith('setup/'))
    const user = oldImages.filter((img) => img.key.startsWith('avatar/'))

    return {
        setup,
        user,
        noNeedDeleting: recentImages,
    }
})
