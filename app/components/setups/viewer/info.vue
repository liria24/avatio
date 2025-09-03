<script lang="ts" setup>
interface Props {
    setup: Setup
    class?: string | string[]
}
const props = defineProps<Props>()
</script>

<template>
    <div :class="['flex h-fit flex-col gap-5 empty:hidden', props.class]">
        <div
            v-if="props.setup.description?.length"
            class="flex flex-col gap-2 self-stretch"
        >
            <p
                class="pl-1 text-sm/relaxed wrap-anywhere break-keep whitespace-pre-wrap"
                v-html="useLineBreak(props.setup.description)"
            />
        </div>

        <div
            v-if="props.setup.tags?.length"
            class="flex flex-col gap-3 self-stretch"
        >
            <div class="flex flex-row flex-wrap items-center gap-1.5">
                <UButton
                    v-for="(tag, index) in props.setup.tags"
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
            v-if="props.setup.coauthors?.length"
            class="flex flex-col gap-3 self-stretch"
        >
            <h2 class="text-toned text-sm leading-none">共同作者</h2>
            <ul class="flex flex-col gap-2 pl-1">
                <li
                    v-for="coAuthor in props.setup.coauthors"
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
                            icon="lucide:user-round"
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
