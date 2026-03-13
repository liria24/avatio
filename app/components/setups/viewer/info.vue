<script lang="ts" setup>
interface Props {
    setup: Serialized<Setup>
    sidebar?: boolean
}
const { setup, sidebar } = defineProps<Props>()

const { locale } = useI18n()
const { session } = useAuth()
const { toggle: toggleBookmarkAction, getBookmarkStatus } = useBookmarks()
const { login, setupDelete, setupHide, setupUnhide } = useAppOverlay()

const {
    isBookmarked,
    status: bookmarkStatus,
    refresh: bookmarkRefresh,
} = await getBookmarkStatus(setup.id, !!session.value)

const toggleBookmark = async () => {
    const success = await toggleBookmarkAction(setup.id, isBookmarked.value)
    if (success) await bookmarkRefresh()
}
</script>

<template>
    <div class="flex h-fit flex-col gap-6 empty:hidden">
        <h1 v-if="!sidebar" class="text-highlighted sentence text-3xl font-bold">
            {{ setup.name }}
        </h1>

        <div :class="cn('grid gap-4 sm:grid-cols-2', !sidebar && 'lg:hidden')">
            <div class="flex items-center gap-2 lg:col-span-2">
                <NuxtLink :to="`/@${setup.user.username}`">
                    <UUser
                        :avatar="{
                            src: setup.user.image || undefined,
                            alt: '',
                            icon: 'mingcute:user-3-fill',
                        }"
                        :description="`@${setup.user.username}`"
                        size="sm"
                        :ui="{
                            name: 'flex gap-1 items-center text-sm',
                            description: 'line-clamp-1 break-all wrap-anywhere',
                        }"
                    >
                        <template #name>
                            <span>{{ setup.user.name }}</span>
                            <LazyUserBadges
                                v-if="setup.user.badges?.length"
                                :badges="setup.user.badges"
                                size="sm"
                            />
                        </template>
                    </UUser>
                </NuxtLink>
            </div>

            <div
                :class="
                    cn('ml-1.5 flex flex-wrap items-center gap-2 lg:col-span-2', sidebar && 'grid')
                "
            >
                <div class="text-muted flex items-center gap-1.5">
                    <Icon name="mingcute:calendar-2-fill" size="16" />
                    <NuxtTime
                        :datetime="setup.createdAt"
                        date-style="short"
                        time-style="short"
                        :locale
                        class="font-mono text-sm leading-none text-nowrap"
                    />
                </div>

                <UTooltip v-if="setup.updatedAt !== setup.createdAt" :delay-duration="50">
                    <div class="text-dimmed flex items-center gap-1.5">
                        <Icon name="mingcute:edit-3-fill" size="16" />
                        <span class="text-xs leading-none text-nowrap">
                            <NuxtTime :datetime="setup.updatedAt" relative :locale />
                            {{ $t('setup.viewer.updatedAt') }}
                        </span>
                    </div>

                    <template #content>
                        <NuxtTime
                            :datetime="setup.updatedAt"
                            date-style="short"
                            time-style="short"
                            :locale
                            class="text-muted font-mono text-xs leading-none text-nowrap"
                        />
                        <span class="text-muted text-xs leading-none text-nowrap">
                            {{ $t('setup.viewer.editedAt') }}
                        </span>
                    </template>
                </UTooltip>
            </div>

            <div class="ml-auto flex items-center sm:col-span-2">
                <UButton
                    v-if="session?.user.role === 'admin'"
                    :icon="setup.hidAt ? 'mingcute:eye-2-fill' : 'mingcute:eye-close-fill'"
                    :aria-label="setup.hidAt ? $t('setup.viewer.show') : $t('setup.viewer.hide')"
                    variant="ghost"
                    size="sm"
                    class="p-2"
                    @click="
                        setup.hidAt
                            ? setupUnhide.open({ setupId: setup.id })
                            : setupHide.open({ setupId: setup.id })
                    "
                />

                <UButton
                    loading-auto
                    :loading="bookmarkStatus === 'pending'"
                    :icon="isBookmarked ? 'mingcute:bookmark-fill' : 'mingcute:bookmark-line'"
                    :aria-label="
                        isBookmarked ? $t('setup.viewer.unbookmark') : $t('setup.viewer.bookmark')
                    "
                    :color="isBookmarked ? 'secondary' : 'primary'"
                    variant="ghost"
                    size="sm"
                    class="p-2"
                    @click="session ? toggleBookmark() : login.open()"
                />

                <template v-if="session?.user.username === setup.user.username">
                    <UButton
                        :to="`/setup/compose?edit=${setup.id}`"
                        :aria-label="$t('edit')"
                        icon="mingcute:edit-3-fill"
                        variant="ghost"
                        size="sm"
                        class="p-2"
                    />

                    <UButton
                        :aria-label="$t('delete')"
                        icon="mingcute:delete-2-fill"
                        variant="ghost"
                        size="sm"
                        class="p-2"
                        @click="setupDelete.open({ setupId: setup.id })"
                    />
                </template>

                <ButtonShare
                    id="setup-info-share"
                    :title="setup.name"
                    :description="setup.description"
                    :image="setup.images?.[0]?.url"
                />
            </div>
        </div>

        <p
            v-if="!sidebar && setup.description?.length"
            class="sentence pl-1 text-sm/relaxed whitespace-pre-wrap"
        >
            {{ setup.description }}
        </p>

        <div
            v-if="!sidebar && setup.tags?.length"
            class="flex flex-row flex-wrap items-center gap-1.5"
        >
            <UButton
                v-for="(tag, index) in setup.tags"
                :key="'tag-' + index"
                :label="tag"
                variant="outline"
                color="neutral"
                class="rounded-full px-3.5 py-2 text-xs"
                @click="navigateTo(`/search?tag=${tag}`)"
            />
        </div>

        <div
            v-if="setup.coauthors?.length"
            :class="cn('flex flex-col gap-3 self-stretch', !sidebar && 'lg:hidden')"
        >
            <h2 class="text-toned text-sm leading-none">{{ $t('setup.viewer.coauthors') }}</h2>
            <ul class="grid gap-2 pl-1 md:grid-cols-2 lg:grid-cols-1">
                <li
                    v-for="coAuthor in setup.coauthors"
                    :key="coAuthor.user.username"
                    class="ring-muted flex flex-col gap-1.5 rounded-lg p-2 ring-1"
                >
                    <NuxtLink
                        :to="`/@${coAuthor.user.username}`"
                        class="flex flex-row items-center gap-2"
                    >
                        <UAvatar
                            :src="coAuthor.user.image || undefined"
                            alt=""
                            icon="mingcute:user-3-fill"
                            size="sm"
                        />
                        <p class="text-left text-sm">
                            {{ coAuthor.user.name }}
                        </p>
                        <LazyUserBadges
                            v-if="coAuthor.user.badges?.length"
                            :badges="coAuthor.user.badges"
                            size="sm"
                        />
                    </NuxtLink>

                    <p
                        v-if="coAuthor.note?.length"
                        class="sentence pl-1 text-sm whitespace-pre-wrap"
                    >
                        {{ coAuthor.note }}
                    </p>
                </li>
            </ul>
        </div>
    </div>
</template>
