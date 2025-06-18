<script setup lang="ts">
// const session = await useGetSession()
const route = useRoute()
const toast = useToast()

const id = Number(route.params.id)

const { setup, status } = useFetchSetup(id)

if (status.value === 'success' && !id)
    showError({
        statusCode: 404,
        message: 'IDが無効です',
    })

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

const deleteSetup = async () => {
    try {
        await $fetch(`/api/setup/${id}`, {
            method: 'DELETE',
        })
        toast.add({
            title: 'セットアップが削除されました',
            description: 'セットアップが正常に削除されました。',
            color: 'success',
        })
        navigateTo('/setup')
    } catch (error) {
        toast.add({
            title: 'セットアップの削除に失敗しました',
            description:
                error instanceof Error
                    ? error.message
                    : '不明なエラーが発生しました',
            color: 'error',
        })
    }
}
</script>

<template>
    <div v-if="setup" class="flex flex-col items-start gap-5">
        <UBreadcrumb
            :items="[
                { label: setup.user.name, to: `/@${setup.user.id}` },
                { label: setup.name },
            ]"
            :ui="{
                link: 'text-xs',
                separatorIcon: 'size-4',
            }"
        />

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
            @delete="deleteSetup"
        />
    </div>
</template>
