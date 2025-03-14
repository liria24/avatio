<script lang="ts" setup>
const route = useRoute();
const user = useSupabaseUser();
const client = useSupabaseClient();

const userRefresh = async () => {
    console.log('userRefresh');
    if (!user.value) return (userProfile.value.avatar = null);

    try {
        const { data } = await client
            .from('users')
            .select('id, name, avatar, badges:user_badges(name)')
            .eq('id', user.value.id)
            .maybeSingle();

        userProfile.value.id = data?.id ?? null;
        userProfile.value.name = data?.name ?? null;
        userProfile.value.avatar = data?.avatar ?? null;
        userProfile.value.badges =
            data?.badges.map((badge) => badge.name) ?? [];
    } catch {
        userProfile.value.id = null;
        userProfile.value.name = null;
        userProfile.value.avatar = null;
        userProfile.value.badges = [];
    }
};

watchEffect(async () => await userRefresh());

onMounted(async () => {
    if (user.value) await userRefresh();
});
</script>

<template>
    <div class="items-center gap-2 flex">
        <div class="items-center gap-0.5 flex">
            <Button
                v-if="user && !['/login', '/setup/edit'].includes(route.path)"
                to="/setup/edit"
                class="p-3 md:pr-6 md:pl-5 md:mr-2 outline-0 md:outline-1 md:rounded-full whitespace-nowrap hover:bg-zinc-700 hover:text-zinc-200 hover:dark:bg-zinc-300 hover:dark:text-zinc-800"
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
                class="hidden sm:block p-2.5 hover:bg-zinc-300 hover:dark:bg-zinc-600"
            />

            <Button
                v-if="user && route.path !== '/login'"
                to="/bookmarks"
                icon="lucide:bookmark"
                :icon-size="19"
                tooltip="ブックマーク"
                aria-label="ブックマーク"
                variant="flat"
                class="hidden sm:block p-2.5 hover:bg-zinc-300 hover:dark:bg-zinc-600"
            />

            <ButtonTheme class="hidden sm:block" />
        </div>

        <template v-if="route.path !== '/login'">
            <ClientOnly>
                <UiTooltip v-if="user" :text="userProfile.name ?? ''">
                    <NuxtLink
                        id="user"
                        tabindex="0"
                        :to="`/@${user?.id}`"
                        class="hidden sm:flex select-none rounded-full items-center outline-4 outline-transparent hover:outline-zinc-300 hover:dark:outline-zinc-600 transition-all ease-in-out duration-100"
                    >
                        <UiAvatar
                            :url="
                                useGetImage(userProfile.avatar, {
                                    prefix: 'avatar',
                                })
                            "
                            :alt="userProfile.name ?? ''"
                        />
                    </NuxtLink>
                </UiTooltip>

                <Button
                    v-else
                    id="login"
                    to="/login"
                    label="ログイン"
                    variant="flat"
                    class="hidden sm:block px-4 py-3 rounded-lg text-zinc-100 bg-zinc-500 dark:bg-zinc-600 hover:bg-zinc-600 hover:dark:bg-zinc-500"
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
                                    :url="userProfile.avatar ?? ''"
                                    :alt="userProfile.name ?? ''"
                                />
                                <span>{{ userProfile.name }}</span>
                            </Button>

                            <Button
                                v-else-if="route.path !== '/login'"
                                to="/login"
                                label="ログイン"
                                variant="flat"
                                class="px-4 py-3 rounded-lg text-zinc-100 bg-zinc-500 dark:bg-zinc-600 hover:bg-zinc-600 hover:dark:bg-zinc-500"
                            />
                        </ClientOnly>
                    </template>
                </div>
            </template>
        </Popup>
    </div>
</template>
