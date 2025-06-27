<script lang="ts" setup>
interface Props {
    description?: string | null
    user: User
    tags?: string[]
    coauthors?: SetupCoauthor[]
    class?: string | string[]
}
const props = defineProps<Props>()
</script>

<template>
    <div :class="['flex h-fit flex-col gap-5 empty:hidden', props.class]">
        <div class="flex w-full flex-wrap justify-between gap-5">
            <div class="flex items-center gap-7 xl:flex-col xl:items-start">
                <NuxtLink
                    :to="`/@${props.user.id}`"
                    class="flex items-center gap-1"
                >
                    <UAvatar
                        :src="props.user.image || undefined"
                        :alt="props.user.name"
                    />
                    <div
                        class="flex flex-wrap items-center gap-x-1 gap-y-0.5 pl-1"
                    >
                        <p class="text-left text-sm font-semibold">
                            {{ props.user.name }}
                        </p>
                        <UserBadges
                            :badges="props.user.badges"
                            size="sm"
                            class="ml-1"
                        />
                    </div>
                </NuxtLink>
            </div>
        </div>

        <div
            v-if="props.description?.length"
            class="flex flex-col gap-2 self-stretch"
        >
            <p
                class="pl-1 text-sm/relaxed wrap-anywhere break-keep whitespace-pre-wrap"
                v-html="useLineBreak(props.description)"
            />
        </div>

        <div v-if="props.tags?.length" class="flex flex-col gap-3 self-stretch">
            <div class="flex flex-row flex-wrap items-center gap-1.5">
                <UButton
                    v-for="(tag, index) in props.tags"
                    :key="'tag-' + index"
                    :label="tag"
                    variant="outline"
                    color="neutral"
                    class="rounded-full px-3 py-2 text-xs"
                    @click="navigateTo(`/search?tag=${tag}`)"
                />
            </div>
        </div>

        <div
            v-if="props.coauthors?.length"
            class="flex flex-col gap-3 self-stretch"
        >
            <h2 class="text-toned text-sm leading-none">共同作者</h2>
            <ul class="flex flex-col gap-2 pl-1">
                <li
                    v-for="coAuthor in props.coauthors"
                    :key="coAuthor.user.id"
                    class="ring-muted flex flex-col gap-1.5 rounded-lg p-2 ring-1"
                >
                    <NuxtLink
                        :to="`/@${coAuthor.user.id}`"
                        class="flex flex-row items-center gap-2"
                    >
                        <UAvatar
                            :src="coAuthor.user.image || undefined"
                            :alt="coAuthor.user.name"
                            size="sm"
                        />
                        <p class="text-left text-sm">
                            {{ coAuthor.user.name }}
                        </p>
                        <UserBadges
                            v-if="coAuthor.user.badges?.length"
                            :badges="coAuthor.user.badges"
                            size="sm"
                        />
                    </NuxtLink>
                    <p
                        v-if="coAuthor.note?.length"
                        class="text-muted pl-1 text-sm"
                    >
                        {{ coAuthor.note }}
                    </p>
                </li>
            </ul>
        </div>
    </div>
</template>
