<script lang="ts" setup>
interface Props {
    data: DocumentData;
    index: number;
}
const props = defineProps<Props>();

const category: Record<string, string> = {
    news: 'ニュース',
    update: 'アップデート',
    event: 'イベント',
    blog: 'ブログ',
};
</script>

<template>
    <div class="group relative grid grid-flow-row sm:grid-cols-2 gap-5">
        <div
            :data-index="props.index"
            class="absolute left-[13px] h-full w-0.5 bg-zinc-700 data-[index=0]:top-6"
        />

        <div class="relative flex">
            <div class="sticky top-0 left-0 h-fit pt-6 pb-12 gap-4 flex">
                <div
                    class="size-7 shrink-0 rounded-full flex items-center justify-center bg-zinc-900"
                >
                    <div class="size-3 rounded-full bg-zinc-300" />
                </div>

                <div class="h-fit flex flex-col gap-3">
                    <h2
                        class="text-2xl font-bold break-keep [overflow-wrap:anywhere;]"
                    >
                        {{ useSentence(props.data.title) }}
                    </h2>
                    <div class="flex items-center gap-2">
                        <span class="text-sm text-zinc-400 whitespace-nowrap">
                            {{
                                useLocaledDate(new Date(props.data.created_at))
                            }}
                        </span>
                        <UiBadge v-if="props.data.category" class="text-xs">
                            {{ category[props.data.category] }}
                        </UiBadge>
                    </div>
                    <p
                        v-if="props.data.description?.length"
                        class="text-sm text-zinc-400 break-keep [overflow-wrap:anywhere;]"
                    >
                        {{ useSentence(props.data.description) }}
                    </p>
                </div>
            </div>
        </div>

        <div class="pb-32 group-last:pb-0 pl-12 sm:pl-0 gap-8 flex flex-col">
            <NuxtImg
                v-if="props.data.thumbnail?.length"
                :src="useGetImage(props.data.thumbnail, { prefix: 'release' })"
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
