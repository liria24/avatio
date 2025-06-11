export default ({
    title,
    titleTemplate,
    description,
    image,
    type,
}: {
    title?: string
    titleTemplate?: string
    description?: string
    image?: string
    type?: 'website' | 'article'
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
    })
    useHead({
        meta: [{ property: 'og:type', content: type || 'article' }],
        link: [{ rel: 'icon', href: '/favicon.ico' }],
    })
}
