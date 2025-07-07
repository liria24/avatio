<script lang="ts" setup>
const route = useRoute()
const session = await useGetSession()
const id = route.params.id as string

const { data, status } = useUser(id)

if (status.value === 'success' && !data.value)
    showError({
        statusCode: 404,
        message: 'IDが無効です',
    })

const links = computed(() =>
    data.value?.links?.map((link) => {
        const attributes = linkAttributes(link)
        return {
            label: attributes.label,
            icon: attributes.icon,
            to: link,
        }
    })
)

if (data.value) {
    defineSeo({
        title: data.value.name,
        description: data.value.bio || undefined,
        image: data.value.image || undefined,
    })
    useSchemaOrg([
        defineWebPage({
            name: data.value.name,
            description: data.value.bio,
            datePublished: data.value.createdAt,
        }),
        definePerson({
            name: data.value.name,
            description: data.value.bio,
            image: data.value.image || undefined,
            sameAs: data.value.links || undefined,
        }),
    ])
}
</script>

<template>
    <div
        v-if="(status === 'success' && !data) || status === 'error'"
        class="flex w-full flex-col items-center"
    >
        <p class="mt-5 text-zinc-400">ユーザーデータの取得に失敗しました</p>
    </div>

    <div v-else-if="data" class="flex w-full flex-col gap-6 px-2">
        <div class="flex w-full flex-col items-start gap-3">
            <div
                class="flex w-full flex-col items-start justify-between gap-3 sm:flex-row sm:items-center"
            >
                <div class="flex items-center gap-6">
                    <NuxtImg
                        v-if="data.image"
                        v-slot="{ isLoaded, src, imgAttrs }"
                        :src="data.image"
                        :alt="data.name"
                        :width="80"
                        :height="80"
                        format="webp"
                        custom
                    >
                        <img
                            v-if="isLoaded"
                            v-bind="imgAttrs"
                            :src="src"
                            class="aspect-square size-14 shrink-0 rounded-full object-cover sm:size-20"
                        />
                        <USkeleton
                            v-else
                            class="aspect-square size-14 shrink-0 rounded-full sm:size-20"
                        />
                    </NuxtImg>

                    <div
                        v-else
                        class="bg-muted flex size-14 shrink-0 items-center justify-center rounded-full md:size-20"
                    >
                        <Icon
                            name="lucide:user-round"
                            size="32"
                            class="text-muted"
                        />
                    </div>

                    <div class="flex flex-col gap-1">
                        <div
                            class="flex flex-wrap items-center gap-x-3 gap-y-1"
                        >
                            <p class="text-2xl font-bold">
                                {{ data.name }}
                            </p>
                            <UserBadges
                                v-if="data.badges"
                                :badges="data.badges"
                            />
                        </div>
                        <p class="text-dimmed text-sm">
                            アカウント作成日:
                            <NuxtTime
                                :datetime="data.createdAt"
                                class="text-muted font-[Geist]"
                            />
                        </p>
                    </div>
                </div>
                <div class="flex items-center gap-1 self-end sm:self-auto">
                    <UButton
                        v-if="session?.user.id === data.id"
                        :to="$localePath('/settings')"
                        label="プロフィールを編集"
                        icon="lucide:pen-line"
                        variant="ghost"
                        size="sm"
                        class="self-end"
                    />
                    <ModalReportUser v-else-if="session" :user-id="data.id">
                        <UButton
                            label="ユーザーを報告"
                            icon="lucide:flag"
                            variant="ghost"
                            size="sm"
                            class="self-end"
                        />
                    </ModalReportUser>
                    <ModalLogin v-else>
                        <UButton
                            label="ユーザーを報告"
                            icon="lucide:flag"
                            variant="ghost"
                            size="sm"
                            class="self-end"
                        />
                    </ModalLogin>
                </div>
            </div>

            <div class="flex w-full flex-col gap-3 px-2 empty:hidden">
                <div
                    v-if="links?.length"
                    class="flex flex-wrap items-center gap-2"
                >
                    <UButton
                        v-for="(link, index) in links"
                        :key="'link-' + index"
                        :to="link.to"
                        target="_blank"
                        :icon="link.icon"
                        variant="ghost"
                    />
                </div>

                <div
                    v-if="data.bio?.length"
                    class="flex w-full flex-col gap-1 rounded-xl border border-zinc-400 px-4 py-3 dark:border-zinc-600"
                >
                    <span class="mt-[-2px] text-sm text-zinc-500">bio</span>
                    <p
                        class="text-relaxed text-sm [overflow-wrap:anywhere] break-keep whitespace-break-spaces"
                        v-html="useLineBreak(data.bio)"
                    />
                </div>
            </div>
        </div>

        <div
            v-if="data.shops?.length"
            class="mb-4 flex w-full flex-col gap-5 px-2"
        >
            <div class="flex items-center gap-2">
                <Icon name="lucide:store" size="22" class="text-muted" />
                <h2 class="text-xl leading-none font-semibold text-nowrap">
                    ショップ
                </h2>
            </div>

            <div class="flex flex-wrap items-center gap-2">
                <UButton
                    v-for="(shop, index) in data.shops"
                    :key="'shop-' + index"
                    :to="`https://${shop.shop.id}.booth.pm`"
                    target="_blank"
                    variant="soft"
                    class="gap-2 p-3"
                >
                    <NuxtImg
                        v-slot="{ isLoaded, src, imgAttrs }"
                        :src="shop.shop.image || undefined"
                        :alt="shop.shop.name"
                        :width="32"
                        :height="32"
                        format="webp"
                        fit="cover"
                    >
                        <img
                            v-if="isLoaded"
                            v-bind="imgAttrs"
                            :src="src"
                            class="ring-accented aspect-square size-8 shrink-0 rounded-lg object-cover ring-1"
                        />
                        <USkeleton
                            v-else
                            class="aspect-square size-8 shrink-0 rounded-lg"
                        />
                    </NuxtImg>
                    <div class="flex flex-col items-start gap-1">
                        <span
                            class="text-sm leading-none font-semibold text-zinc-800 dark:text-zinc-300"
                        >
                            {{ shop.shop.name }}
                        </span>
                        <span
                            class="text-xs leading-none font-normal text-zinc-500 dark:text-zinc-500"
                        >
                            {{ shop.shop.id }}.booth.pm
                        </span>
                    </div>
                </UButton>
            </div>
        </div>

        <USeparator />

        <div class="flex w-full flex-col gap-5 px-2">
            <div class="flex items-center gap-2">
                <Icon name="lucide:shirt" size="22" class="text-muted" />
                <h2 class="text-xl leading-none font-semibold text-nowrap">
                    セットアップ
                </h2>
            </div>

            <div class="flex w-full flex-col gap-3 self-center">
                <SetupsList
                    v-if="data.setups"
                    v-model:setups="data.setups"
                    v-model:status="status"
                />
            </div>
        </div>
    </div>
</template>
