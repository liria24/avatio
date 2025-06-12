<script lang="ts" setup>
interface Props {
    title: string
    description?: string | null
    tags?: string[]
    coAuthors?: (Partial<Pick<CoAuthor, 'badges'>> & Omit<CoAuthor, 'badges'>)[]
    unity?: string | null
    author: Author
    class?: string | string[]
}
const props = defineProps<Props>()
</script>

<template>
    <div :class="['flex h-fit flex-col gap-5 empty:hidden', props.class]">
        <div class="flex w-full flex-wrap justify-between gap-5">
            <div class="flex items-center gap-7 xl:flex-col xl:items-start">
                <NuxtLink
                    :to="{
                        name: '@id',
                        params: { id: props.author.id },
                    }"
                    class="flex items-center gap-1"
                >
                    <UiAvatar
                        :url="
                            getImage(props.author.avatar, {
                                prefix: 'avatar',
                            })
                        "
                        :alt="props.author.name"
                        class="size-9"
                    />
                    <div
                        class="flex flex-wrap items-center gap-x-1 gap-y-0.5 pl-1"
                    >
                        <p
                            class="pb-0.5 text-left font-semibold text-zinc-800 dark:text-zinc-200"
                        >
                            {{ props.author.name }}
                        </p>
                        <BadgeUser :badges="props.author.badges" size="sm" />
                    </div>
                </NuxtLink>
            </div>
        </div>

        <div
            v-if="props.description?.length"
            class="flex flex-col gap-2 self-stretch"
        >
            <p
                class="pl-1 text-sm/relaxed [overflow-wrap:anywhere] break-keep whitespace-pre-wrap text-zinc-900 dark:text-zinc-100"
            >
                {{ lineBreak(props.description) }}
            </p>
        </div>

        <div v-if="props.tags?.length" class="flex flex-col gap-3 self-stretch">
            <div class="flex flex-row flex-wrap items-center gap-1.5">
                <Button
                    v-for="tag in props.tags"
                    :key="useId()"
                    :label="tag"
                    class="rounded-full px-3 py-2 text-xs"
                    @click="navigateTo(`/search?tag=${tag}`)"
                />
            </div>
        </div>

        <div
            v-if="props.unity?.length"
            class="flex w-fit items-center gap-2 rounded-full px-3 py-2 ring-1 ring-zinc-300 dark:ring-zinc-700"
        >
            <Icon
                name="simple-icons:unity"
                :size="14"
                class="shrink-0 text-zinc-800 dark:text-zinc-200"
            />
            <p
                class="text-xs leading-none [overflow-wrap:anywhere] break-keep whitespace-pre-wrap text-zinc-700 dark:text-zinc-300"
            >
                {{ lineBreak(props.unity) }}
            </p>
        </div>

        <div
            v-if="props.coAuthors?.length"
            class="flex flex-col gap-3 self-stretch"
        >
            <h2 class="text-sm leading-none text-zinc-500">共同作者</h2>
            <ul class="flex flex-col gap-2 pl-1">
                <li
                    v-for="coAuthor in props.coAuthors"
                    :key="coAuthor.id"
                    class="flex flex-col gap-1.5 rounded-lg p-2 ring-1 ring-zinc-300 dark:ring-zinc-700"
                >
                    <NuxtLink
                        :to="{
                            name: '@id',
                            params: { id: coAuthor.id },
                        }"
                        class="flex flex-row items-center gap-2"
                    >
                        <UiAvatar
                            :url="
                                getImage(coAuthor.avatar, {
                                    prefix: 'avatar',
                                })
                            "
                            :alt="coAuthor.name"
                            class="size-9"
                        />
                        <p
                            class="pb-0.5 pl-1 text-left font-normal text-black dark:text-white"
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
