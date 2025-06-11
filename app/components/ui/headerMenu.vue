<script lang="ts" setup>
const route = useRoute()
const user = useSupabaseUser()
const client = useSupabaseClient<Database>()

const userRefresh = async () => {
    if (!user.value) return (userProfile.value.avatar = null)

    try {
        const { data } = await client
            .from('users')
            .select('id, name, avatar, badges:user_badges(name, created_at)')
            .eq('id', user.value.id)
            .maybeSingle()

        userProfile.value.id = data?.id ?? null
        userProfile.value.name = data?.name ?? null
        userProfile.value.avatar = data?.avatar ?? null
        userProfile.value.badges = data?.badges ?? []
    } catch {
        userProfile.value.id = null
        userProfile.value.name = null
        userProfile.value.avatar = null
        userProfile.value.badges = []
    }
}

watchEffect(async () => await userRefresh())

onMounted(async () => {
    if (user.value) await userRefresh()
})
</script>

<template>
    <div class="flex items-center gap-2">
        <div class="flex items-center gap-0.5">
            <Button
                v-if="
                    user && !['/login', '/setup/compose'].includes(route.path)
                "
                to="/setup/compose"
                class="p-3 whitespace-nowrap outline-0 hover:bg-zinc-700 hover:text-zinc-200 md:mr-2 md:rounded-full md:pr-6 md:pl-5 md:outline-1 hover:dark:bg-zinc-300 hover:dark:text-zinc-800"
            >
                <Icon name="lucide:plus" :size="18" />
                <span class="hidden md:block">セットアップを投稿</span>
            </Button>

            <Button
                v-if="route.path !== '/login'"
                to="/search"
                tooltip="検索"
                aria-label="検索"
                icon="lucide:search"
                variant="flat"
                class="hidden p-2.5 hover:bg-zinc-300 sm:block hover:dark:bg-zinc-600"
            />

            <Button
                v-if="user && route.path !== '/login'"
                to="/bookmarks"
                icon="lucide:bookmark"
                :icon-size="19"
                tooltip="ブックマーク"
                aria-label="ブックマーク"
                variant="flat"
                class="hidden p-2.5 hover:bg-zinc-300 sm:block hover:dark:bg-zinc-600"
            />

            <ButtonTheme class="hidden sm:block" />
        </div>

        <template v-if="route.path !== '/login'">
            <ClientOnly>
                <PopupMe v-if="user">
                    <div
                        class="hidden cursor-pointer items-center rounded-full outline-4 outline-transparent transition-all duration-100 ease-in-out select-none hover:outline-zinc-300 sm:flex hover:dark:outline-zinc-600"
                    >
                        <UiAvatar
                            :url="
                                getImage(userProfile.avatar, {
                                    prefix: 'avatar',
                                })
                            "
                            :alt="userProfile.name ?? ''"
                            class="size-8"
                        />
                    </div>
                </PopupMe>

                <Button
                    v-else
                    id="login"
                    to="/login"
                    label="ログイン"
                    variant="flat"
                    class="hidden rounded-lg bg-zinc-500 px-4 py-3 text-zinc-100 hover:bg-zinc-600 sm:block dark:bg-zinc-600 hover:dark:bg-zinc-500"
                />
            </ClientOnly>
        </template>

        <Popup>
            <template #trigger>
                <Button icon="lucide:menu" variant="flat" class="sm:hidden" />
            </template>
            <template #content>
                <div class="flex flex-col items-center gap-1">
                    <Button
                        to="/search"
                        label="検索"
                        icon="lucide:search"
                        variant="flat"
                        class="p-2.5 hover:bg-zinc-300 hover:dark:bg-zinc-600"
                    />

                    <Button
                        v-if="user && route.path !== '/login'"
                        to="/bookmarks"
                        icon="lucide:bookmark"
                        label="ブックマーク"
                        aria-label="ブックマーク"
                        variant="flat"
                        class="p-2.5 hover:bg-zinc-300 hover:dark:bg-zinc-600"
                    />

                    <ButtonTheme :label="true" />

                    <template v-if="route.path !== '/login'">
                        <ClientOnly>
                            <Button
                                v-if="user"
                                :to="`/@${user?.id}`"
                                variant="flat"
                                class="p-2.5 hover:bg-zinc-300 hover:dark:bg-zinc-600"
                            >
                                <UiAvatar
                                    :url="
                                        getImage(userProfile.avatar, {
                                            prefix: 'avatar',
                                        })
                                    "
                                    :alt="userProfile.name ?? ''"
                                    class="size-8"
                                />
                                <span>{{ userProfile.name }}</span>
                            </Button>

                            <Button
                                v-else-if="route.path !== '/login'"
                                to="/login"
                                label="ログイン"
                                variant="flat"
                                class="rounded-lg bg-zinc-500 px-4 py-3 text-zinc-100 hover:bg-zinc-600 dark:bg-zinc-600 hover:dark:bg-zinc-500"
                            />
                        </ClientOnly>
                    </template>
                </div>
            </template>
        </Popup>
    </div>
</template>
