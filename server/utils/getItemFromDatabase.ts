export default defineCachedFunction(
    async (id: string) => {
        const item = await db.query.items
            .findFirst({
                where: {
                    id: { eq: id },
                },
                columns: {
                    id: true,
                    updatedAt: true,
                    name: true,
                    niceName: true,
                    image: true,
                    category: true,
                    price: true,
                    likes: true,
                    nsfw: true,
                    outdated: true,
                    platform: true,
                },
                with: {
                    shop: {
                        columns: {
                            id: true,
                            platform: true,
                            name: true,
                            image: true,
                            verified: true,
                        },
                    },
                },
            })
            .catch(() => undefined)

        return item || null
    },
    {
        maxAge: ITEM_DATABASE_CACHE_TTL,
        name: 'itemFromDatabase',
    },
)
