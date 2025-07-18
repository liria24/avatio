import type { SitemapUrlInput } from '#sitemap/types'
import database from '@@/database'

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

    const setups = await database.query.setups.findMany({
        where: (setups, { isNull }) => isNull(setups.hidAt),
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

    const users = await database.query.user.findMany({
        columns: {
            id: true,
            updatedAt: true,
            image: true,
        },
    })

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
            })
        ),
        ...users.map(
            (user): SitemapUrlInput => ({
                loc: `/user/${user.id}`,
                lastmod: user.updatedAt,
                images: user.image ? [{ loc: user.image }] : undefined,
            })
        ),
    ]
})
