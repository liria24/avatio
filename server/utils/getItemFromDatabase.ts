import database from '@@/database'

export default defineCachedFunction(
    async (id: string) => {
        const item = await database.query.items
            .findFirst({
                where: (items, { eq }) => eq(items.id, id),
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
        maxAge: 5,
        name: 'itemFromDatabase',
    }
)
