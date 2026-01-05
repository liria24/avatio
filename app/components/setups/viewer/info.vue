<script lang="ts" setup>
import {
    LazyModalSetupDelete,
    LazyModalLogin,
    LazyModalSetupHide,
    LazyModalSetupUnhide,
} from '#components'

interface Props {
    setup: SerializedSetup
    sidebar?: boolean
    class?: string | string[]
}
const props = defineProps<Props>()

const toast = useToast()
const overlay = useOverlay()
const { $session } = useNuxtApp()
const session = await $session()

const modalLogin = overlay.create(LazyModalLogin)
const modalHide = overlay.create(LazyModalSetupHide, {
    props: { setupId: props.setup.id },
})
const modalUnhide = overlay.create(LazyModalSetupUnhide, {
    props: { setupId: props.setup.id },
})
const modalDelete = overlay.create(LazyModalSetupDelete, {
    props: { setupId: props.setup.id },
})

const {
    data: bookmark,
    status: bookmarkStatus,
    refresh: bookmarkRefresh,
} = await useFetch('/api/setups/bookmarks', {
    query: { setupId: props.setup.id, limit: 1 },
    transform: (data) => data.data.length > 0,
    dedupe: 'defer',
    default: () => false,
    immediate: !!session.value,
})

const toggleBookmark = async () => {
    try {
        if (!bookmark.value)
            await $fetch(`/api/setups/bookmarks/${props.setup.id}`, {
                method: 'POST',
            })
        else
            await $fetch(`/api/setups/bookmarks/${props.setup.id}`, {
                method: 'DELETE',
            })

        await bookmarkRefresh()

        toast.add({
            title: bookmark.value
                ? 'ブックマークしました'
                : 'ブックマークを解除しました',
            color: bookmark.value ? 'success' : 'info',
        })
    } catch (error) {
        console.error('ブックマークの変更に失敗:', error)
        toast.add({
            title: 'ブックマークの変更に失敗しました',
            color: 'error',
        })
        return
    }
}

onBeforeRouteLeave(() => {
    modalLogin.close()
    modalHide.close()
    modalUnhide.close()
    modalDelete.close()
})
</script>

<template>
    <div :class="['flex h-fit flex-col gap-6 empty:hidden', props.class]">
        <LineBreak
            v-if="!props.sidebar"
            :content="props.setup.name"
            as="h1"
            class="text-highlighted text-3xl font-bold wrap-anywhere break-keep"
        />

        <div
            :class="
                cn(
                    'grid gap-4',
                    !props.sidebar && 'flex items-center lg:hidden'
                )
            "
        >
            <NuxtLink :to="`/@${props.setup.user.username}`">
                <UUser
                    :name="props.setup.user.name"
                    :avatar="{
                        src: props.setup.user.image || undefined,
                        icon: 'lucide:user-round',
                    }"
                    size="sm"
                    :ui="{ name: 'text-sm' }"
                >
                    <template #description>
                        <UserBadges
                            v-if="props.setup.user.badges?.length"
                            :badges="props.setup.user.badges"
                            size="xs"
                        />
                    </template>
                </UUser>
            </NuxtLink>

            <div
                :class="
                    cn(
                        'ml-1.5 flex flex-wrap items-center gap-2',
                        props.sidebar && 'grid'
                    )
                "
            >
                <div class="text-muted flex items-center gap-1.5">
                    <Icon name="lucide:calendar" size="16" />
                    <NuxtTime
                        :datetime="props.setup.createdAt"
                        locale="ja-JP"
                        year="numeric"
                        month="2-digit"
                        day="2-digit"
                        hour="2-digit"
                        minute="2-digit"
                        class="font-[Geist] text-sm leading-none text-nowrap"
                    />
                </div>

                <UTooltip
                    v-if="props.setup.updatedAt !== props.setup.createdAt"
                    :delay-duration="50"
                >
                    <div class="text-dimmed flex items-center gap-1.5">
                        <Icon name="lucide:pen-line" size="16" />
                        <span class="text-xs leading-none text-nowrap">
                            <NuxtTime
                                :datetime="props.setup.updatedAt"
                                relative
                            />
                            に更新
                        </span>
                    </div>

                    <template #content>
                        <NuxtTime
                            :datetime="props.setup.updatedAt"
                            locale="ja-JP"
                            year="numeric"
                            month="2-digit"
                            day="2-digit"
                            hour="2-digit"
                            minute="2-digit"
                            class="text-muted font-[Geist] text-xs leading-none text-nowrap"
                        />
                        <span
                            class="text-muted text-xs leading-none text-nowrap"
                        >
                            に編集
                        </span>
                    </template>
                </UTooltip>
            </div>

            <div class="ml-auto flex items-center gap-0.5">
                <UButton
                    v-if="session?.user.role === 'admin'"
                    :icon="props.setup.hidAt ? 'lucide:eye' : 'lucide:eye-off'"
                    variant="ghost"
                    size="sm"
                    class="p-2"
                    @click="
                        props.setup.hidAt
                            ? modalUnhide.open()
                            : modalHide.open()
                    "
                />

                <UButton
                    loading-auto
                    :loading="bookmarkStatus === 'pending'"
                    :icon="
                        bookmark ? 'lucide:bookmark-check' : 'lucide:bookmark'
                    "
                    :aria-label="
                        bookmark ? 'ブックマークから削除' : 'ブックマーク'
                    "
                    :color="bookmark ? 'secondary' : 'primary'"
                    variant="ghost"
                    size="sm"
                    class="p-2"
                    @click="session ? toggleBookmark() : modalLogin.open()"
                />

                <template
                    v-if="session?.user.username === props.setup.user.username"
                >
                    <UButton
                        :to="`/setup/compose?edit=${props.setup.id}`"
                        aria-label="編集"
                        icon="lucide:pen"
                        variant="ghost"
                        size="sm"
                        class="p-2"
                    />

                    <UButton
                        aria-label="削除"
                        icon="lucide:trash"
                        variant="ghost"
                        size="sm"
                        class="p-2"
                        @click="modalDelete.open()"
                    />
                </template>

                <ShareButton
                    :title="props.setup.name"
                    :description="props.setup.description"
                    :image="props.setup.images?.[0]?.url"
                />
            </div>
        </div>

        <LineBreak
            v-if="!props.sidebar && props.setup.description?.length"
            :content="props.setup.description"
            as="p"
            class="pl-1 text-sm/relaxed whitespace-pre-wrap"
        />

        <div
            v-if="!props.sidebar && props.setup.tags?.length"
            class="flex flex-row flex-wrap items-center gap-1.5"
        >
            <UButton
                v-for="(tag, index) in props.setup.tags"
                :key="'tag-' + index"
                :label="tag"
                variant="outline"
                color="neutral"
                class="rounded-full px-3.5 py-2 text-xs"
                @click="navigateTo(`/search?tag=${tag}`)"
            />
        </div>

        <div
            v-if="props.setup.coauthors?.length"
            :class="
                cn(
                    'flex flex-col gap-3 self-stretch',
                    !props.sidebar && 'lg:hidden'
                )
            "
        >
            <h2 class="text-toned text-sm leading-none">共同作者</h2>
            <ul class="grid gap-2 pl-1 md:grid-cols-2 lg:grid-cols-1">
                <li
                    v-for="coAuthor in props.setup.coauthors"
                    :key="coAuthor.user.username"
                    class="ring-muted flex flex-col gap-1.5 rounded-lg p-2 ring-1"
                >
                    <NuxtLink
                        :to="`/@${coAuthor.user.username}`"
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
                    <LineBreak
                        v-if="coAuthor.note?.length"
                        :content="coAuthor.note"
                        as="p"
                        class="text-muted pl-1 text-sm"
                    />
                </li>
            </ul>
        </div>
    </div>
</template>
