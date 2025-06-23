<script setup lang="ts">
const route = useRoute()
const toast = useToast()

const id = Number(route.params.id)

const { data, status } = await useSetup(id)

if (status.value === 'success' && !id)
    showError({
        statusCode: 400,
        message: 'IDが無効です',
    })

if (status.value === 'error' || (status.value === 'success' && !data.value))
    showError({
        statusCode: 404,
        message: 'セットアップが見つかりません',
    })

if (data.value) {
    defineSeo({
        title: `${data.value.name} @${data.value.user.name}`,
        description: data.value.description || undefined,
        image:
            data.value.images?.length && data.value.images[0]
                ? data.value.images[0].url
                : 'https://avatio.me/ogp.png',
    })
    useSchemaOrg([
        defineWebPage({
            name: data.value.name,
            description: data.value.description,
            datePublished: data.value.createdAt,
            author: {
                '@type': 'Person',
                name: data.value.user.name,
                url: `/@${data.value.user.id}`,
            },
            primaryImageOfPage: data.value.images?.[0]?.url,
            breadcrumb: defineBreadcrumb({
                itemListElement: [
                    { name: 'ホーム', item: '/' },
                    { name: 'セットアップ', item: '/setup' },
                    { name: data.value.name, item: `/setup/${id}` },
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
    <div v-if="data" class="flex flex-col items-start gap-5">
        <UBreadcrumb
            :items="[
                { label: data.user.name, to: `/@${data.user.id}` },
                { label: data.name },
            ]"
            :ui="{
                link: 'text-xs',
                separatorIcon: 'size-4',
            }"
        />

        <SetupsViewer
            :setup-id="id"
            :created-at="data.createdAt"
            :updated-at="data.updatedAt"
            :user="data.user"
            :name="data.name"
            :description="data.description"
            :images="data.images"
            :tags="data.tags"
            :coauthors="data.coauthors"
            :tools="data.tools"
            :items="data.items"
            :failed-items-count="data.failedItemsCount"
            @delete="deleteSetup"
        />
    </div>
</template>
