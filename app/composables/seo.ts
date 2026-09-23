interface Args {
    title?: string
    titleTemplate?: string
    description?: string
    image?: string
    type?: 'website' | 'article'
    twitterCard?: 'summary' | 'summary_large_image'
    schemaOrg?: {
        webSite?: boolean
        webPage?: {
            datePublished?: string | Date
            dateModified?: string | Date
            author?: {
                username: string
                name: string
                description?: string
                image?: string
            }
            breadcrumb?: {
                name: string
                item: string
            }[]
        }
        image?:
            | boolean
            | {
                  url: string
              }
        person?: {
            image?: string
            sameAs?: string[]
        }
    }
}

export const useSeo = ({
    title,
    titleTemplate,
    description,
    image,
    type,
    twitterCard,
    schemaOrg,
}: Args) => {
    const config = useRuntimeConfig()
    const route = useRoute()
    const { localeProperties } = useI18n()
    const routeBaseName = useRouteBaseName()

    useSeoMeta({
        title: title,
        ogTitle: title,
        titleTemplate: titleTemplate,
        description,
        ogDescription: description,
        twitterTitle: title,
        twitterDescription: description,
        twitterCard: twitterCard || 'summary',
    })
    useHead({
        meta: [
            {
                property: 'og:type',
                content: type || (routeBaseName(route) === 'index' ? 'website' : 'article'),
            },
        ],
        link: [{ rel: 'icon', href: '/favicon.ico' }],
    })

    let ogImage: string | undefined = undefined

    if (image) {
        ogImage = image.startsWith('/') ? `${config.public.siteUrl}${image}` : image
        useSeoMeta({
            ogImage: ogImage,
            twitterImage: ogImage,
        })
    }

    const schemaOrgItems = []

    if (schemaOrg?.webSite)
        schemaOrgItems.push(
            defineWebSite({
                name: title,
                description,
                inLanguage: localeProperties.value.language,
                potentialAction: defineSearchAction({
                    target: '/search?q={search_term_string}',
                }),
            }),
        )
    if (schemaOrg?.webPage)
        schemaOrgItems.push(
            defineWebPage({
                name: title,
                description,
                datePublished: schemaOrg.webPage.datePublished,
                dateModified: schemaOrg.webPage.dateModified,
                author: schemaOrg.webPage.author
                    ? definePerson({
                          url: `/@${schemaOrg.webPage.author.username}`,
                          name: schemaOrg.webPage.author.name,
                          description: schemaOrg.webPage.author.description,
                          image: schemaOrg.webPage.author.image,
                      })
                    : undefined,
                breadcrumb: schemaOrg.webPage.breadcrumb
                    ? defineBreadcrumb({
                          itemListElement: schemaOrg.webPage.breadcrumb,
                      })
                    : undefined,
                primaryImageOfPage: ogImage,
                inLanguage: localeProperties.value.language,
            }),
        )
    if (schemaOrg?.image)
        schemaOrgItems.push(
            defineImage({
                url: typeof schemaOrg.image === 'boolean' ? ogImage : schemaOrg.image.url,
                description,
            }),
        )
    if (schemaOrg?.person)
        schemaOrgItems.push(
            definePerson({
                name: title,
                description,
                image: schemaOrg.person.image || ogImage,
                sameAs: schemaOrg.person.sameAs,
            }),
        )

    if (schemaOrg) {
        useSchemaOrg(schemaOrgItems)
    }
}
