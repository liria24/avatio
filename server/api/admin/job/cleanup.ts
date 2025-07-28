export default defineApi(
    async () => {
        const config = useRuntimeConfig()
        const event = useEvent()

        const unusedImages = await event.$fetch('/api/images/unused')
        const allImages = [
            ...unusedImages.setupImages,
            ...unusedImages.userImages,
        ]

        // Execute deletion in parallel
        const deleteResults = await Promise.allSettled(
            allImages.map(async (image) => {
                console.log('Deleting image from storage:', image.key)
                await useStorage('r2').del(image.key)
                return image.key
            })
        )

        // Categorize results
        const { successful, failed } = deleteResults.reduce(
            (acc, result, index) => {
                const imageKey = allImages[index].key

                if (result.status === 'fulfilled') {
                    acc.successful.push(imageKey)
                } else {
                    console.error(
                        'Failed to delete image:',
                        imageKey,
                        result.reason
                    )
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
            }
        )

        // Send Discord notification
        const message = 'Cleanup completed.'

        try {
            await $fetch('https://www.liria.me/api/discord/message', {
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
                                                  .map(
                                                      (f) =>
                                                          `${f.key}: ${f.error}`
                                                  )
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
            throw createError({
                statusCode: 500,
                statusMessage: 'Failed to send Discord notification',
            })
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
    },
    {
        errorMessage: 'Failed to cleanup unused images.',
        requireCron: true,
    }
)
