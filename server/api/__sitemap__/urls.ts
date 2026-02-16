import type { SitemapUrlInput } from '#sitemap/types'

export default defineSitemapEventHandler(async () => {
    const permanent = [
        {
            loc: '/',
            images: [{ loc: '/ogp.png' }],
        },
        { loc: '/faq' },
        { loc: '/terms' },
        { loc: '/privacy-policy' },
    ]

    const setups = await db.query.setups.findMany({
        where: {
            hidAt: { isNull: true },
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

    const users = await db.query.user.findMany({
        columns: {
            updatedAt: true,
            image: true,
            username: true,
        },
    })

    defineCacheControl({ cdnAge: 60 * 60, clientAge: 60 })

    return [
        ...permanent,
        ...setups.map(
            (setup): SitemapUrlInput => ({
                loc: `/setup/${setup.id}`,
                lastmod: setup.updatedAt,
                images: setup.images?.length
                    ? setup.images.map((image) => ({
                          loc: image.url,
                      }))
                    : undefined,
            }),
        ),
        ...users.map(
            (user): SitemapUrlInput => ({
                loc: `/@${user.username}`,
                lastmod: user.updatedAt,
                images: user.image ? [{ loc: user.image }] : undefined,
            }),
        ),
    ]
})
