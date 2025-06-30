import database from '@@/database'
import { AwsClient } from 'aws4fetch'

interface ImageInfo {
    url: string
    key: string
    lastModified: Date
}

interface UnusedImagesResponse {
    setupImages: ImageInfo[]
    userImages: ImageInfo[]
    noNeedDeletingImages: ImageInfo[]
}

export default defineApi(
    async (): Promise<UnusedImagesResponse> => {
        const config = useRuntimeConfig()
        const IMAGE_DELETION_THRESHOLD = 24 * 60 * 60 * 1000 // 1日
        const thresholdDate = new Date(Date.now() - IMAGE_DELETION_THRESHOLD)

        const aws = new AwsClient({
            accessKeyId: config.r2.accessKey,
            secretAccessKey: config.r2.secretKey,
            service: 's3',
            region: 'auto',
        })

        // XMLパースを最適化
        const parseStorageObjects = (
            xmlText: string,
            prefix: string
        ): ImageInfo[] => {
            const contents =
                xmlText.match(/<Contents>[\s\S]*?<\/Contents>/g) || []

            return contents.reduce<ImageInfo[]>((acc, content) => {
                const keyMatch = content.match(/<Key>(.*?)<\/Key>/)
                const lastModifiedMatch = content.match(
                    /<LastModified>(.*?)<\/LastModified>/
                )

                if (!keyMatch || !lastModifiedMatch) return acc

                const key = keyMatch[1]
                const filename = key.split('/').pop()

                if (!filename?.trim()) return acc

                acc.push({
                    url: `https://images.avatio.me/${key}`,
                    key,
                    lastModified: new Date(lastModifiedMatch[1]),
                })

                return acc
            }, [])
        }

        const getStorageObjects = async (
            prefix: string
        ): Promise<ImageInfo[]> => {
            try {
                const url = `${config.r2.endpoint}/avatio?list-type=2&prefix=${prefix}/`
                const response = await aws.fetch(url)

                if (!response.ok) {
                    throw new Error(
                        `Failed to list objects: ${response.status}`
                    )
                }

                const xmlText = await response.text()
                return parseStorageObjects(xmlText, prefix)
            } catch (error) {
                console.error(
                    `Failed to get storage objects for prefix ${prefix}:`,
                    error
                )
                return []
            }
        }

        // 並列実行で高速化
        const [
            [setupImagesFromDB, userImagesFromDB],
            [allSetupImages, allUserImages],
        ] = await Promise.all([
            // DB クエリを並列実行
            Promise.all([
                database.query.setupImages.findMany({
                    columns: { url: true },
                }),
                database.query.user.findMany({
                    columns: { image: true },
                }),
            ]),
            // ストレージクエリを並列実行
            Promise.all([
                getStorageObjects('setup'),
                getStorageObjects('avatar'),
            ]),
        ])

        // Set を使って高速な検索を実現
        const usedSetupUrls = new Set(setupImagesFromDB.map((img) => img.url))
        const usedUserUrls = new Set(
            userImagesFromDB
                .map((user) => user.image)
                .filter((image): image is string => Boolean(image?.trim()))
        )

        // 未使用画像を抽出
        const unusedSetupImages = allSetupImages.filter(
            (img) => !usedSetupUrls.has(img.url)
        )
        const unusedUserImages = allUserImages.filter(
            (img) => !usedUserUrls.has(img.url)
        )

        const allUnusedImages = [...unusedSetupImages, ...unusedUserImages]

        // 削除対象と保持対象を分離
        const { oldImages, recentImages } = allUnusedImages.reduce(
            (acc, img) => {
                if (img.lastModified < thresholdDate) {
                    acc.oldImages.push(img)
                } else {
                    acc.recentImages.push(img)
                }
                return acc
            },
            { oldImages: [] as ImageInfo[], recentImages: [] as ImageInfo[] }
        )

        // 最終的な分類
        const setupImages = oldImages.filter((img) =>
            img.key.startsWith('setup/')
        )
        const userImages = oldImages.filter((img) =>
            img.key.startsWith('avatar/')
        )

        return {
            setupImages,
            userImages,
            noNeedDeletingImages: recentImages,
        }
    },
    {
        errorMessage: 'Failed to check unused images.',
        requireAdmin: true,
    }
)
