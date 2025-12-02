<script lang="ts" setup>
const { data: page } = await useAsyncData(() =>
    queryCollection('general').path('/general/terms').first()
)

defineSeo({
    title: '利用規約',
    description: 'Avatio のご利用における規約',
    image: 'https://avatio.me/ogp.png',
})
</script>

<template>
    <UPage>
        <ContentRenderer v-if="page" :value="page" />

        <template #right>
            <UContentToc :links="page?.body?.toc?.links" />
        </template>
    </UPage>
</template>
