<script lang="ts" setup>
const route = useRoute('@id')
const user = useSupabaseUser()
const id = route.params.id
    ? route.params.id.toString()
    : user.value
      ? user.value.id
      : null

const modalReport = ref(false)
const modalLogin = ref(false)

const userData = ref<User | null>(null)

try {
    userData.value = await $fetch<User>(`/api/user/${id}`)
} catch {
    showError({
        statusCode: 404,
        message: 'ユーザーデータの取得に失敗しました',
    })
}

const setupsPerPage: number = 50
const page = ref(0)

const { setups, hasMore, status, fetchMoreSetups } = useFetchSetups('user', {
    query: computed(() => ({
        page: page.value,
        perPage: setupsPerPage,
        userId: userData.value?.id || null,
    })),
})

if (userData.value)
    defineSeo({
        title: userData.value.name,
        description: userData.value.bio,
        image: userData.value.avatar
            ? getImage(userData.value.avatar, { prefix: 'avatar' })
            : undefined,
    })

const onReportClick = () => {
    if (user.value) modalReport.value = true
    else modalLogin.value = true
}

const onLoginSuccess = () => {
    modalLogin.value = false
    modalReport.value = true
}
</script>

<template>
    <div v-if="!userData" class="flex w-full flex-col items-center">
        <p class="mt-5 text-zinc-400">ユーザーデータの取得に失敗しました</p>
    </div>

    <div v-else class="flex w-full flex-col gap-6 px-2">
        <div class="flex w-full flex-col gap-3">
            <div class="mb-2 grid grid-cols-2 gap-1.5 sm:hidden">
                <Button to="/settings" aria-label="プロフィールを編集">
                    プロフィール編集
                </Button>
                <Button aria-label="ログアウト" @click="useSignOut">
                    ログアウト
                </Button>
            </div>

            <div class="flex w-full items-center justify-between">
                <div class="flex items-center gap-6">
                    <UiAvatar
                        :url="getImage(userData.avatar, { prefix: 'avatar' })"
                        :alt="userData.name"
                        :icon-size="36"
                        class="size-14 sm:size-20"
                    />
                    <div class="flex flex-col gap-1">
                        <div
                            class="flex flex-wrap items-center gap-x-3 gap-y-1"
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
                            <NuxtTime
                                :datetime="userData.created_at"
                                class="text-zinc-400"
                            />
                        </p>
                    </div>
                </div>
                <div
                    v-if="user && user.id === userData.id"
                    class="hidden items-center gap-1 sm:flex"
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

            <div class="flex w-full flex-col gap-3 px-2 empty:hidden">
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
                    class="flex w-full flex-col gap-1 rounded-xl border border-zinc-400 px-4 py-3 dark:border-zinc-600"
                >
                    <span class="mt-[-2px] text-sm text-zinc-500">bio</span>
                    <p
                        class="text-relaxed text-sm [overflow-wrap:anywhere] break-keep whitespace-break-spaces"
                    >
                        {{ lineBreak(userData.bio) }}
                    </p>
                </div>
            </div>

            <Button
                v-if="!user || user.id !== userData.id"
                label="ユーザーを報告"
                icon="lucide:flag"
                :icon-size="16"
                variant="flat"
                class="self-end px-3 py-2 text-xs font-semibold text-zinc-500 hover:bg-zinc-300 dark:text-zinc-400 hover:dark:bg-zinc-700"
                icon-class="text-red-400 dark:text-red-400"
                @click="onReportClick"
            />
            <ModalReportUser v-model="modalReport" :id="userData.id" />
            <Modal v-model="modalLogin">
                <UiLogin
                    :redirect="`/@${userData.id}`"
                    @login-success="onLoginSuccess"
                />
            </Modal>
        </div>

        <div
            v-if="userData.shops?.length"
            class="mb-4 flex w-full flex-col gap-5 px-2"
        >
            <UiTitle label="ショップ" icon="lucide:store" />

            <div class="flex flex-wrap items-center gap-2 px-2">
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
                    <div class="flex flex-col items-start gap-1">
                        <span
                            class="text-sm leading-none font-semibold text-zinc-800 dark:text-zinc-300"
                        >
                            {{ i.shop.name }}
                        </span>
                        <span
                            class="text-xs leading-none font-normal text-zinc-500 dark:text-zinc-500"
                        >
                            {{ i.shop.id }}.booth.pm
                        </span>
                    </div>
                </Button>
            </div>
        </div>

        <div class="flex w-full flex-col gap-5 px-2">
            <UiTitle label="セットアップ" icon="lucide:shirt" />

            <div class="flex w-full flex-col gap-3 self-center">
                <SetupsList :setups="setups" :loading="status === 'pending'" />
                <ButtonLoadMore
                    v-if="hasMore"
                    :loading="status === 'pending'"
                    class="w-full"
                    @click="fetchMoreSetups"
                />
            </div>
        </div>
    </div>
</template>
