import type { SitemapUrlInput } from '#sitemap/types'

export default defineSitemapEventHandler(async () => {
    const db = useDB()

    const setups = await db.query.setups.findMany({
        where: {
            hidAt: { isNull: true },
            public: { eq: true },
            user: {
                OR: [{ banned: { eq: false } }, { banned: { isNull: true } }],
            },
        },
        columns: {
            id: true,
            updatedAt: true,
        },
        with: {
            images: {
                columns: {
                    objectKey: true,
                },
            },
        },
    })

    const users = await db.query.users.findMany({
        where: {
            banned: { OR: [{ eq: false }, { isNull: true }] },
            setups: true,
        },
        columns: {
            updatedAt: true,
            image: true,
            username: true,
        },
    })

    return [
        ...(await Promise.all(
            setups.map(async (setup): Promise<SitemapUrlInput> => ({
                loc: `/setup/${setup.id}`,
                lastmod: setup.updatedAt,
                images: setup.images?.length
                    ? (await withSetupImageUrls(setup.images)).map((image) => ({
                          loc: image.url,
                      }))
                    : undefined,
                _i18nTransform: true,
            })),
        )),
        ...users.map((user): SitemapUrlInput => ({
            loc: `/@${user.username}`,
            lastmod: user.updatedAt,
            images: user.image ? [{ loc: user.image }] : undefined,
            _i18nTransform: true,
        })),
    ]
})
