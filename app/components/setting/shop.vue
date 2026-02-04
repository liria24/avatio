<script lang="ts" setup>
const { getSession } = useAuth()
const session = await getSession()
const {
    shopState,
    verifiable,
    shopUrl,
    verify: verifyAction,
    unverify: unverifyAction,
    initializeShopVerification,
} = useUserSettings()

const { data, refresh } = await useUser(session.value!.user.username!)

const { copy, copied } = useClipboard({ source: shopState.value.verifyCode || '' })

const verify = async () => {
    const success = await verifyAction()
    if (success) {
        refresh()
    }
}

const unverify = async (shopId: string) => {
    const success = await unverifyAction(shopId)
    if (success) {
        refresh()
    }
}

// Initialize shop verification watcher
initializeShopVerification()
</script>

<template>
    <UModal v-model:open="shopState.modalVerify" :dismissible="false" title="新規ショップ認証">
        <template #body>
            <div class="flex flex-col gap-6">
                <UFormField
                    label="1. 認証するショップで販売しているアイテムを 1 つ選定し、URL を入力してください"
                    :error="
                        shopState.itemUrl.length && !verifiable
                            ? 'この URL は認証可能なアイテムではありません'
                            : undefined
                    "
                >
                    <div class="flex flex-col gap-2 pt-2">
                        <UInput
                            v-model="shopState.itemUrl"
                            placeholder="https://booth.pm/ja/items/1234567"
                            class="w-full"
                        />
                        <UAlert
                            icon="mingcute:information-fill"
                            description="認証に使用できるアイテムは、Avatio に登録できるアイテムのみです。非公開アイテムや、非対応プラットフォームのアイテムは使用できません。また、現在 GitHub はショップ認証に対応していません。"
                            variant="outline"
                            :ui="{
                                icon: 'size-4',
                                description: 'text-xs sentence',
                            }"
                        />
                    </div>
                </UFormField>

                <UFormField label="2. 選定したアイテムの説明文に以下のコードを追記してください">
                    <div class="flex flex-col gap-2 pt-2">
                        <UButton
                            :trailing-icon="copied ? 'mingcute:check-line' : 'mingcute:copy-2-fill'"
                            :label="shopState.verifyCode || 'コードを生成中...'"
                            variant="outline"
                            color="neutral"
                            block
                            :ui="{ base: 'gap-2', trailingIcon: 'size-4' }"
                            @click="copy(shopState.verifyCode || '')"
                        />
                        <UAlert
                            icon="mingcute:information-fill"
                            title="認証が完了した後、追記したコードは削除してください"
                            variant="subtle"
                            color="secondary"
                            :ui="{
                                icon: 'size-4',
                                title: 'text-xs font-semibold',
                            }"
                        />
                    </div>
                </UFormField>

                <USeparator />

                <UButton
                    :disabled="!verifiable"
                    :loading="shopState.verifying"
                    label="ショップを認証"
                    color="neutral"
                    size="lg"
                    block
                    @click="verify"
                />
            </div>
        </template>
    </UModal>

    <UCard>
        <template #header>
            <div class="flex w-full items-center justify-between">
                <h2 class="text-lg leading-none font-semibold text-nowrap">ショップ</h2>

                <UButton
                    icon="mingcute:add-line"
                    label="新しくショップを認証"
                    color="neutral"
                    variant="soft"
                    @click="shopState.modalVerify = true"
                />
            </div>
        </template>

        <div class="flex flex-col gap-2">
            <p v-if="!data?.shops?.length" class="text-muted self-center py-2 text-sm leading-none">
                認証済みのショップはありません
            </p>

            <div
                v-for="shop in data?.shops"
                :key="shop.shop.id"
                class="bg-muted flex items-center gap-3 rounded-xl p-3"
            >
                <ULink
                    :to="shopUrl(shop.shop.id, shop.shop.platform)"
                    class="flex grow items-center gap-3"
                >
                    <NuxtImg
                        :src="shop.shop.image || undefined"
                        :alt="shop.shop.name"
                        :width="32"
                        :height="32"
                        format="webp"
                        loading="lazy"
                        fetchpriority="low"
                        class="aspect-square size-7 shrink-0 rounded-md object-cover"
                    />

                    <p class="text-sm leading-none font-medium">
                        {{ shop.shop.name }}
                    </p>

                    <Icon
                        v-if="shop.shop.platform === 'booth'"
                        name="avatio:booth"
                        size="16"
                        class="text-muted"
                    />
                </ULink>

                <NuxtTime
                    :datetime="shop.createdAt"
                    date-style="medium"
                    time-style="short"
                    class="text-muted text-sm leading-none"
                />

                <UModal v-model:open="shopState.modalUnverify" title="認証解除">
                    <UTooltip text="ショップの認証を解除" :delay-duration="100">
                        <UButton
                            icon="mingcute:close-line"
                            aria-label="ショップの認証を解除"
                            variant="ghost"
                            size="sm"
                        />
                    </UTooltip>

                    <template #body>
                        <UAlert
                            icon="mingcute:delete-2-fill"
                            title="ショップの認証を解除しますか？"
                            color="warning"
                            variant="subtle"
                        />
                    </template>

                    <template #footer>
                        <div class="flex w-full items-center justify-end gap-2">
                            <UButton
                                :disabled="shopState.unverifying"
                                label="キャンセル"
                                variant="ghost"
                                @click="shopState.modalUnverify = false"
                            />
                            <UButton
                                :loading="shopState.unverifying"
                                label="認証解除"
                                color="error"
                                variant="solid"
                                @click="unverify(shop.shop.id)"
                            />
                        </div>
                    </template>
                </UModal>
            </div>
        </div>
    </UCard>
</template>
