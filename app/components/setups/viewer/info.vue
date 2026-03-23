<script lang="ts" setup>
interface Props {
    setup: Serialized<Setup>
    sidebar?: boolean
}
const { setup, sidebar } = defineProps<Props>()

const { session } = useAuth()
const { setupDelete } = useAppOverlay()

const { locale } = useI18n()
</script>

<template>
    <div :class="cn('grid gap-5', !sidebar && 'lg:hidden')">
        <div v-if="session?.user.username === setup.user.username" class="grid grid-cols-2 gap-1">
            <UButton
                :to="`/setup/compose?edit=${setup.id}`"
                :label="$t('edit')"
                icon="mingcute:edit-3-fill"
                variant="soft"
                color="neutral"
                block
                class="rounded-full p-2"
            />

            <UButton
                :label="$t('delete')"
                icon="mingcute:delete-2-fill"
                variant="soft"
                color="neutral"
                block
                class="rounded-full p-2"
                @click="setupDelete.open({ setupId: setup.id })"
            />
        </div>

        <div class="flex items-center gap-1">
            <NuxtLink :to="`/@${setup.user.username}`">
                <UUser
                    :avatar="{
                        src: setup.user.image || undefined,
                        alt: '',
                        icon: 'mingcute:user-3-fill',
                    }"
                    size="sm"
                    :ui="{
                        name: 'flex gap-1 items-center text-sm break-all line-clamp-1',
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

            <template v-if="setup.coauthors?.length">
                <Icon name="mingcute:add-line" size="16" class="text-muted ml-3 shrink-0" />

                <UPopover
                    :content="{ align: 'end' }"
                    :ui="{ content: 'flex flex-col gap-2 p-4 max-w-md rounded-lg' }"
                >
                    <UAvatarGroup
                        size="sm"
                        :max="2"
                        :ui="{ base: '-ml-3' }"
                        class="ml-3 cursor-pointer"
                    >
                        <UAvatar
                            v-for="coAuthor in setup.coauthors.slice(0, 2)"
                            :key="coAuthor.user.username"
                            :src="coAuthor.user.image || undefined"
                            alt=""
                            icon="mingcute:user-3-fill"
                        />
                    </UAvatarGroup>

                    <template #content>
                        <div class="flex items-center gap-1.5">
                            <Icon name="mingcute:group-2-fill" size="18" class="text-muted" />
                            <span class="text-sm leading-none font-medium">
                                {{ $t('setup.viewer.coauthors') }}
                            </span>
                        </div>

                        <div
                            v-for="coAuthor in setup.coauthors"
                            :key="coAuthor.user.username"
                            class="ring-muted flex flex-col items-start gap-2 rounded-md p-3 ring-1"
                        >
                            <NuxtLink :to="`/@${coAuthor.user.username}`">
                                <UUser
                                    :avatar="{
                                        src: coAuthor.user.image || undefined,
                                        alt: '',
                                        icon: 'mingcute:user-3-fill',
                                    }"
                                    size="sm"
                                    :ui="{ name: 'flex gap-1 items-center text-sm' }"
                                >
                                    <template #name>
                                        <span>{{ coAuthor.user.name }}</span>
                                        <LazyUserBadges
                                            v-if="coAuthor.user.badges?.length"
                                            :badges="coAuthor.user.badges"
                                            size="sm"
                                        />
                                    </template>
                                </UUser>
                            </NuxtLink>

                            <p class="text-toned text-xs">
                                {{ coAuthor.note }}
                            </p>
                        </div>
                    </template>
                </UPopover>
            </template>
        </div>

        <div class="text-muted flex items-center gap-1.5">
            <Icon name="mingcute:calendar-2-fill" size="16" />
            <NuxtTime
                :datetime="setup.createdAt"
                date-style="short"
                time-style="short"
                :locale
                class="font-mono text-sm leading-none text-nowrap"
            />

            <UTooltip v-if="setup.updatedAt !== setup.createdAt" :delay-duration="50">
                <div class="bg-muted flex rounded-md p-1">
                    <Icon name="mingcute:edit-3-fill" size="12" />
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

        <div v-if="setup.tags?.length" class="flex flex-wrap items-center gap-2.5 empty:hidden">
            <UButton
                v-for="(tag, index) in setup.tags"
                :key="'tag-' + index"
                :label="tag"
                variant="link"
                color="neutral"
                class="before:text-dimmed gap-1 rounded-full p-0 before:font-mono before:content-['#']"
                @click="navigateTo(`/search?tag=${tag}`)"
            />
        </div>
    </div>
</template>
