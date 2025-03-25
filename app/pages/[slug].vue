<script setup lang="ts">
const route = useRoute('slug');
const client = useSupabaseClient();

if (!route.params.slug)
    throw showError({ statusCode: 404, message: 'Page Not Found' });

const { data } = await client
    .from('info')
    .select(
        'slug, created_at, updated_at, title, content, thumbnail, published'
    )
    .eq('published', true)
    .eq('slug', route.params.slug.toString())
    .maybeSingle<DocumentData>();

if (data)
    useOGP({
        title: data.title,
        image: data.thumbnail,
    });
</script>

<template>
    <UiArticle v-if="data" :data="data" />

    <div v-else class="flex flex-col items-center gap-10 pt-10">
        <h2
            class="flex text-9xl font-extrabold font-['Montserrat'] text-zinc-500 dark:text-zinc-400"
        >
            404
        </h2>
        <div class="text-xl font-bold text-zinc-500 dark:text-zinc-400">
            ページが見つかりませんでした。
        </div>
    </div>
</template>
