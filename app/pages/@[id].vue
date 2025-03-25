<script lang="ts" setup>
const route = useRoute('@id');
const client = useSupabaseClient();
const user = useSupabaseUser();
const id = route.params.id
    ? route.params.id.toString()
    : user.value
      ? user.value.id
      : null;

const modalReport = ref(false);
const modalLogin = ref(false);

const { data: userData } = await client
    .from('users')
    .select(
        `
        id,
        name,
        avatar,
        bio,
        links,
        created_at,
        badges:user_badges(created_at, name),
        shops:user_shops(shop:shop_id(id, name, thumbnail, verified))
        `
    )
    .eq('id', id || '')
    .maybeSingle<User>();

if (userData)
    useOGP({
        title: userData.name,
        description: userData.bio,
        image: userData.avatar
            ? useGetImage(userData.avatar, { prefix: 'avatar' })
            : null,
    });
</script>

<template>
    <div v-if="!userData" class="w-full flex flex-col items-center">
        <p class="text-zinc-400 mt-5">ユーザーデータの取得に失敗しました</p>
    </div>

    <div v-else class="w-full flex flex-col px-2 gap-6">
        <div class="w-full flex flex-col gap-3">
            <div class="mb-2 grid sm:hidden grid-cols-2 gap-1.5">
                <Button to="/settings" aria-label="プロフィールを編集">
                    プロフィール編集
                </Button>
                <Button aria-label="ログアウト" @click="useSignOut">
                    ログアウト
                </Button>
            </div>

            <div class="w-full flex items-center justify-between">
                <div class="flex gap-6 items-center">
                    <UiAvatar
                        :url="
                            userData.avatar
                                ? useGetImage(userData.avatar, {
                                      prefix: 'avatar',
                                  })
                                : ''
                        "
                        :alt="userData.name"
                        :icon-size="36"
                        class="size-14 sm:size-20"
                    />
                    <div class="flex flex-col gap-1">
                        <div
                            class="flex flex-wrap gap-x-3 gap-y-1 items-center"
                        >
                            <p class="text-2xl font-bold">
                                {{ userData.name }}
                            </p>
                            <BadgeUser
                                v-if="userData.badges"
                                :badges="userData.badges"
                            />
                        </div>
                        <p class="text-sm text-zinc-500">
                            アカウント作成日 :
                            {{ useLocaledDate(new Date(userData.created_at)) }}
                        </p>
                    </div>
                </div>
                <div
                    v-if="user && user.id === userData.id"
                    class="hidden sm:flex items-center gap-1"
                >
                    <Button
                        to="/settings"
                        icon="lucide:pen-line"
                        :icon-size="19"
                        tooltip="プロフィールを編集"
                        aria-label="プロフィールを編集"
                        variant="flat"
                    />
                    <Button
                        icon="lucide:log-out"
                        :icon-size="19"
                        tooltip="ログアウト"
                        aria-label="ログアウト"
                        variant="flat"
                        icon-class="text-red-500 dark:text-red-400"
                        @click="useSignOut"
                    />
                </div>
            </div>

            <div class="empty:hidden w-full px-2 flex flex-col gap-3">
                <div
                    v-if="userData.links?.length"
                    class="flex flex-wrap items-center gap-2"
                >
                    <ButtonLink
                        v-for="i in userData.links"
                        :link="i"
                        :key="useId()"
                    />
                </div>

                <div
                    v-if="userData.bio?.length"
                    class="w-full rounded-xl px-4 py-3 gap-1 flex flex-col border border-zinc-400 dark:border-zinc-600"
                >
                    <span class="text-zinc-500 text-sm mt-[-2px]">bio</span>
                    <p
                        class="text-sm text-relaxed break-keep whitespace-break-spaces [overflow-wrap:anywhere]"
                    >
                        {{ useSentence(userData.bio) }}
                    </p>
                </div>
            </div>

            <Button
                v-if="!user || user.id !== userData.id"
                label="ユーザーを報告"
                icon="lucide:flag"
                :icon-size="16"
                variant="flat"
                class="self-end px-3 py-2 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:bg-zinc-300 hover:dark:bg-zinc-700"
                icon-class="text-red-400 dark:text-red-400"
                @click="
                    if (user) modalReport = true;
                    else modalLogin = true;
                "
            />
            <ModalReportUser v-model="modalReport" :id="userData.id" />
            <Modal v-model="modalLogin">
                <UiLogin
                    :redirect="`/@${userData.id}`"
                    @login-success="
                        modalLogin = false;
                        modalReport = true;
                    "
                />
            </Modal>
        </div>

        <div
            v-if="userData.shops?.length"
            class="w-full mb-4 flex flex-col gap-5 px-2"
        >
            <UiTitle label="ショップ" icon="lucide:store" />

            <div class="px-2 flex flex-wrap items-center gap-2">
                <Button
                    v-for="i in userData.shops"
                    :key="useId()"
                    :to="`https://${i.shop.id}.booth.pm`"
                    new-tab
                    variant="flat"
                    class="p-2"
                >
                    <NuxtImg
                        :src="i.shop.thumbnail ?? ''"
                        :alt="i.shop.name"
                        :width="32"
                        :height="32"
                        format="webp"
                        fit="cover"
                        class="rounded-lg ring-1 ring-zinc-300 dark:ring-zinc-700"
                    />
                    <div class="flex flex-col gap-1 items-start">
                        <span
                            class="text-sm font-semibold leading-none text-zinc-800 dark:text-zinc-300"
                        >
                            {{ i.shop.name }}
                        </span>
                        <span
                            class="text-xs font-normal leading-none text-zinc-500 dark:text-zinc-500"
                        >
                            {{ i.shop.id }}.booth.pm
                        </span>
                    </div>
                </Button>
            </div>
        </div>

        <div class="w-full flex flex-col gap-5 px-2">
            <UiTitle label="セットアップ" icon="lucide:shirt" />

            <SetupsListUser :user-id="userData.id" />
        </div>
    </div>
</template>
