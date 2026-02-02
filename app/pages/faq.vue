<script lang="ts" setup>
const { app } = useAppConfig()

const { data: page } = await useAsyncData('page-faq', () =>
    queryCollection('general').path('/general/faq').first()
)
if (!page.value)
    showError({
        status: 404,
        statusText: 'Page Not Found.',
    })

defineSeo({
    title: 'FAQ',
    description: 'よくある質問',
    image: `${app.site}/ogp.png`,
})
</script>

<template>
    <UPage>
        <ContentRenderer v-if="page" :value="page" class="sentence" />

        <template #right>
            <UContentToc :links="page?.body?.toc?.links" />
        </template>
    </UPage>
</template>
