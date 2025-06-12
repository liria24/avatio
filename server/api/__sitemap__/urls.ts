import type { SitemapUrlInput } from '#sitemap/types'

export default defineEventHandler(async () => {
    const supabase = await getSupabaseServerClient()

    const permanent = [
        {
            loc: '/',
            images: [
                {
                    loc: '/ogp.png',
                    changefreq: 'never',
                    title: 'Avatio',
                },
            ],
        },
        {
            loc: '/faq',
            images: [{ loc: '/ogp.png', changefreq: 'never', title: 'FAQ' }],
        },
        {
            loc: '/terms',
            images: [
                {
                    loc: '/ogp.png',
                    changefreq: 'never',
                    title: '利用規約',
                },
            ],
        },
        {
            loc: '/privacy-policy',
            images: [
                {
                    loc: '/ogp.png',
                    changefreq: 'never',
                    title: 'プライバシーポリシー',
                },
            ],
        },
    ]

    const { data: setupsData, error: setupsError } = await supabase
        .from('setups')
        .select('id, created_at, name, images:setup_images(name)')
        .order('created_at', { ascending: true })

    const setups = setupsError
        ? []
        : setupsData.map(
              (setup: {
                  id: number
                  created_at: string
                  name: string
                  images: { name: string }[]
              }) => {
                  const image = setup.images[0]?.name

                  return {
                      loc: `/setup/${setup.id}`,
                      lastmod: setup.created_at,
                      images: image ? [{ loc: image, title: setup.name }] : [],
                      changefreq: 'never',
                  }
              }
          )

    const { data: usersData, error: usersError } = await supabase
        .from('users')
        .select('id')

    const users = usersError
        ? []
        : usersData.map((user: { id: string }) => {
              return { loc: `/@${user.id}` }
          })

    return [...permanent, ...setups, ...users] satisfies SitemapUrlInput[]
})
