<script lang="ts" setup>
interface Props {
    tags?: string[];
    description?: string | null;
    coAuthors?: (Partial<Pick<CoAuthor, 'badges'>> &
        Omit<CoAuthor, 'badges'>)[];
    unity?: string | null;
    class?: string | string[];
}
const {
    tags,
    description,
    coAuthors,
    unity,
    class: propClass,
} = defineProps<Props>();
</script>

<template>
    <div :class="['empty:hidden self-stretch flex flex-col gap-3', propClass]">
        <div
            v-if="tags?.length"
            class="items-center gap-1.5 flex flex-row flex-wrap"
        >
            <Button
                v-for="tag in tags"
                :key="useId()"
                :label="tag"
                class="rounded-full"
                @click="navigateTo(`/search?tag=${tag}`)"
            />
        </div>

        <div
            v-if="description?.length"
            class="self-stretch rounded-lg flex flex-col gap-1.5"
        >
            <h2 class="text-zinc-500 text-sm mt-1 leading-none">説明</h2>
            <p
                class="pl-1 text-sm/relaxed whitespace-pre-wrap break-keep [overflow-wrap:anywhere] text-zinc-900 dark:text-zinc-100"
            >
                {{ useSentence(description) }}
            </p>
        </div>

        <div
            v-if="coAuthors?.length"
            class="self-stretch rounded-lg flex flex-col gap-3"
        >
            <h2 class="text-zinc-500 text-sm mt-1 leading-none">共同作者</h2>
            <ul class="flex flex-col gap-2 pl-1">
                <li
                    v-for="coAuthor in coAuthors"
                    :key="coAuthor.id"
                    class="p-2 rounded-lg flex flex-col gap-1.5 ring-1 ring-zinc-300 dark:ring-zinc-700"
                >
                    <NuxtLink
                        :to="`/@${coAuthor.id}`"
                        class="flex flex-row gap-2 items-center"
                    >
                        <UiAvatar
                            :url="
                                useGetImage(coAuthor.avatar, {
                                    prefix: 'avatar',
                                })
                            "
                            :alt="coAuthor.name"
                        />
                        <p
                            class="pl-1 text-black dark:text-white pb-0.5 text-left font-normal"
                        >
                            {{ coAuthor.name }}
                        </p>
                        <BadgeUser
                            v-if="coAuthor.badges?.length"
                            :badges="coAuthor.badges"
                            size="sm"
                        />
                    </NuxtLink>
                    <p
                        v-if="coAuthor.note.length"
                        class="pl-1 text-sm text-zinc-600 dark:text-zinc-400"
                    >
                        {{ coAuthor.note }}
                    </p>
                </li>
            </ul>
        </div>

        <div
            v-if="unity?.length"
            class="self-stretch rounded-lg flex flex-col gap-1.5"
        >
            <h2 class="text-zinc-500 text-sm mt-1 leading-none">
                Unity バージョン
            </h2>
            <p
                class="pl-1 text-sm/relaxed whitespace-pre-wrap break-keep [overflow-wrap:anywhere] text-zinc-900 dark:text-zinc-100"
            >
                {{ useSentence(unity) }}
            </p>
        </div>
    </div>
</template>
