<script lang="ts" setup>
interface Props {
    data: DocumentData
    index: number
}
const props = defineProps<Props>()

const category: Record<string, string> = {
    news: 'ニュース',
    update: 'アップデート',
    event: 'イベント',
    blog: 'ブログ',
}
</script>

<template>
    <div class="group relative grid grid-flow-row gap-5 sm:grid-cols-2">
        <div
            :data-index="props.index"
            class="absolute left-[13px] h-full w-0.5 bg-zinc-700 data-[index=0]:top-6"
        />

        <div class="relative flex">
            <div class="sticky top-0 left-0 flex h-fit gap-4 pt-6 pb-12">
                <div
                    class="flex size-7 shrink-0 items-center justify-center rounded-full bg-zinc-900"
                >
                    <div class="size-3 rounded-full bg-zinc-300" />
                </div>

                <div class="flex h-fit flex-col gap-3">
                    <h2
                        class="[overflow-wrap:anywhere;] text-2xl font-bold break-keep"
                    >
                        {{ lineBreak(props.data.title) }}
                    </h2>
                    <div class="flex items-center gap-2">
                        <NuxtTime
                            :datetime="props.data.created_at"
                            class="text-sm whitespace-nowrap text-zinc-400"
                        />
                        <UBadge
                            v-if="props.data.category"
                            :label="category[props.data.category]"
                        />
                    </div>
                    <p
                        v-if="props.data.description?.length"
                        class="[overflow-wrap:anywhere;] text-sm break-keep text-zinc-400"
                    >
                        {{ lineBreak(props.data.description) }}
                    </p>
                </div>
            </div>
        </div>

        <div class="flex flex-col gap-8 pb-32 pl-12 group-last:pb-0 sm:pl-0">
            <NuxtImg
                v-if="props.data.thumbnail?.length"
                :src="getImage(props.data.thumbnail, { prefix: 'release' })"
                fit="cover"
                class="rounded-lg"
            />

            <div class="first:mt-5">
                <UiMarkdown
                    v-if="props.data.content"
                    :content="props.data.content"
                    class="prose-sm max-h-full overflow-clip"
                />
            </div>
        </div>
    </div>
</template>
