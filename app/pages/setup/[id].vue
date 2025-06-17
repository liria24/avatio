<script setup lang="ts">
// const session = await useGetSession()
const route = useRoute('setup-id')

const id = Number(route.params.id)
// const bookmark = ref(false)

const modalLogin = ref(false)
// const modalReport = ref(false)

const { setup, status } = useFetchSetup(id)

if (status.value === 'success' && !id)
    showError({
        statusCode: 404,
        message: 'IDが無効です',
    })

// const onReportClick = () => {
//     if (session.value) modalReport.value = true
//     else modalLogin.value = true
// }

// const onLoginSuccess = async () => {
//     modalLogin.value = false
//     if (!setup.value) return
//     bookmark.value = await useCheckBookmark(id)
// }

// onMounted(async () => {
//     bookmark.value = await useCheckBookmark(id)
// })

if (setup.value) {
    defineSeo({
        title: `${setup.value.name} @${setup.value.user.name}`,
        description: setup.value.description || undefined,
        image:
            setup.value.images?.length && setup.value.images[0]
                ? setup.value.images[0].url
                : 'https://avatio.me/ogp.png',
    })
    useSchemaOrg([
        defineWebPage({
            name: setup.value.name,
            description: setup.value.description,
            datePublished: setup.value.createdAt,
            author: {
                '@type': 'Person',
                name: setup.value.user.name,
                url: `/@${setup.value.user.id}`,
            },
            primaryImageOfPage: setup.value.images?.[0]?.url,
            breadcrumb: defineBreadcrumb({
                itemListElement: [
                    { name: 'ホーム', item: '/' },
                    { name: 'セットアップ', item: '/setup' },
                    { name: setup.value.name, item: `/setup/${id}` },
                ],
            }),
            inLanguage: 'ja-JP',
        }),
    ])
}
</script>

<template>
    <div v-if="setup" class="flex flex-col items-start gap-5">
        <!-- <UiBreadcrumb
            :items="[
                { text: setup.user.name, href: `/@${setup.user.id}` },
                { text: setup.name },
            ]"
        /> -->

        <SetupsViewer
            :setup-id="id"
            :created-at="setup.createdAt"
            :title="setup.name"
            :description="setup.description"
            :images="setup.images"
            :tags="setup.tags"
            :co-authors="setup.coauthors"
            :user="setup.user"
            :items="setup.items"
            @login="modalLogin = true"
        />

        <!-- <ModalReportSetup v-model="modalReport" :id="Number(id)" /> -->
    </div>
</template>
