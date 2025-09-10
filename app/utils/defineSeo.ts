export default ({
    title,
    titleTemplate,
    description,
    image,
    type,
    twitterCard,
}: {
    title?: string
    titleTemplate?: string
    description?: string
    image?: string
    type?: 'website' | 'article'
    twitterCard?: 'summary' | 'summary_large_image'
}) => {
    useSeoMeta({
        title: title,
        titleTemplate: titleTemplate,
        description: description,
        ogDescription: description,
        ogImage: image,
        twitterTitle: title,
        twitterDescription: description,
        twitterImage: image,
        twitterCard: twitterCard || 'summary',
    })
    useHead({
        meta: [{ property: 'og:type', content: type || 'article' }],
        link: [{ rel: 'icon', href: '/favicon.ico' }],
    })
}
