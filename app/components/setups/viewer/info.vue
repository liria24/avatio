<script lang="ts" setup>
interface Props {
    title: string;
    description?: string | null;
    tags?: string[];
    coAuthors?: (Partial<Pick<CoAuthor, 'badges'>> &
        Omit<CoAuthor, 'badges'>)[];
    unity?: string | null;
    author: Author;
    class?: string | string[];
}
const {
    author,
    tags,
    description,
    coAuthors,
    unity,
    class: propClass,
} = defineProps<Props>();
</script>

<template>
    <div :class="['empty:hidden h-fit flex flex-col gap-5', propClass]">
        <div class="w-full flex flex-wrap gap-5 justify-between">
            <div class="flex xl:flex-col items-center xl:items-start gap-7">
                <NuxtLink
                    :to="{
                        name: '@id',
                        params: { id: author.id },
                    }"
                    class="flex gap-1 items-center"
                >
                    <UiAvatar
                        :url="useGetImage(author.avatar, { prefix: 'avatar' })"
                        :alt="author.name"
                        class="size-9"
                    />
                    <div
                        class="pl-1 flex flex-wrap gap-x-1 gap-y-0.5 items-center"
                    >
                        <p
                            class="pb-0.5 text-left font-semibold text-zinc-800 dark:text-zinc-200"
                        >
                            {{ author.name }}
                        </p>
                        <BadgeUser :badges="author.badges" size="sm" />
                    </div>
                </NuxtLink>
            </div>
        </div>

        <div
            v-if="description?.length"
            class="self-stretch flex flex-col gap-2"
        >
            <p
                class="pl-1 text-sm/relaxed whitespace-pre-wrap break-keep [overflow-wrap:anywhere] text-zinc-900 dark:text-zinc-100"
            >
                {{ useSentence(description) }}
            </p>
        </div>

        <div v-if="tags?.length" class="self-stretch flex flex-col gap-3">
            <div class="items-center gap-1.5 flex flex-row flex-wrap">
                <Button
                    v-for="tag in tags"
                    :key="useId()"
                    :label="tag"
                    class="rounded-full text-xs px-3 py-2"
                    @click="navigateTo(`/search?tag=${tag}`)"
                />
            </div>
        </div>

        <div
            v-if="unity?.length"
            class="w-fit px-3 py-2 rounded-full flex items-center gap-2 ring-1 ring-zinc-300 dark:ring-zinc-700"
        >
            <Icon
                name="simple-icons:unity"
                :size="14"
                class="shrink-0 text-zinc-800 dark:text-zinc-200"
            />
            <p
                class="text-xs leading-none whitespace-pre-wrap break-keep [overflow-wrap:anywhere] text-zinc-700 dark:text-zinc-300"
            >
                {{ useSentence(unity) }}
            </p>
        </div>

        <div v-if="coAuthors?.length" class="self-stretch flex flex-col gap-3">
            <h2 class="text-zinc-500 text-sm leading-none">共同作者</h2>
            <ul class="flex flex-col gap-2 pl-1">
                <li
                    v-for="coAuthor in coAuthors"
                    :key="coAuthor.id"
                    class="p-2 rounded-lg flex flex-col gap-1.5 ring-1 ring-zinc-300 dark:ring-zinc-700"
                >
                    <NuxtLink
                        :to="{
                            name: '@id',
                            params: { id: coAuthor.id },
                        }"
                        class="flex flex-row gap-2 items-center"
                    >
                        <UiAvatar
                            :url="
                                useGetImage(coAuthor.avatar, {
                                    prefix: 'avatar',
                                })
                            "
                            :alt="coAuthor.name"
                            class="size-9"
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
    </div>
</template>
