import type { SitemapUrlInput } from '#sitemap/types'

export default defineSitemapEventHandler(async () => {
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
                    url: true,
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

    defineCacheControl({ cdnAge: 60 * 60, clientAge: 60 })

    return [
        ...setups.map(
            (setup): SitemapUrlInput => ({
                loc: `/setup/${setup.id}`,
                lastmod: setup.updatedAt,
                images: setup.images?.length
                    ? setup.images.map((image) => ({
                          loc: image.url,
                      }))
                    : undefined,
                _i18nTransform: true,
            }),
        ),
        ...users.map(
            (user): SitemapUrlInput => ({
                loc: `/@${user.username}`,
                lastmod: user.updatedAt,
                images: user.image ? [{ loc: user.image }] : undefined,
                _i18nTransform: true,
            }),
        ),
    ]
})
