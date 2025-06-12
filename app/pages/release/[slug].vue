<script setup lang="ts">
const route = useRoute('release-slug')
const client = useSupabaseClient()

if (!route.params.slug)
    throw showError({ statusCode: 404, message: 'Page Not Found' })

const { data } = await client
    .from('releases')
    .select(
        'slug, created_at, updated_at, title, description, thumbnail, content, published'
    )
    .eq('slug', route.params.slug.toString())
    .maybeSingle<DocumentData>()

if (data)
    defineSeo({
        title: data.title,
        description: data.description,
        image: data.thumbnail || undefined,
    })
</script>

<template>
    <UiArticle v-if="data" :data="data" type="release" />

    <div v-else class="flex flex-col items-center gap-10 pt-10">
        <h2
            class="flex font-['Montserrat'] text-9xl font-extrabold text-zinc-500 dark:text-zinc-400"
        >
            404
        </h2>
        <div class="text-xl font-bold text-zinc-500 dark:text-zinc-400">
            ページが見つかりませんでした。
        </div>
    </div>
</template>
