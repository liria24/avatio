<script lang="ts" setup>
const session = await useGetSession()
const toast = useToast()

const { data } = await useUser(session.value!.user.id)

const verifyCode = ref<string | null>(null)
const verifying = ref(false)
const unverifying = ref(false)
const modalVerify = ref(false)
const modalUnverify = ref(false)

const shopUrl = (shopId: string, platform: Platform) => {
    if (platform === 'booth') return `https://${shopId}.booth.pm`
    return undefined
}

const unverify = async (shopId: string) => {}

watch(modalVerify, async (value) => {
    if (value) {
        const data = await $fetch<{ code: string }>(
            '/api/shop-verification/code'
        )
        verifyCode.value = data.code
    } else verifyCode.value = null
})
</script>

<template>
    <UModal v-model:open="modalVerify" title="新規認証">
        <template #body>
            <div class="flex flex-col gap-4">
                <UFormField
                    label="1. 認証するショップで販売している商品 URL を入力してください"
                >
                    <UInput
                        placeholder="https://example.booth.pm"
                        class="w-full"
                    />
                </UFormField>

                <UFormField
                    label="2. 商品説明文に以下のコードを追記してください"
                >
                    <UButton
                        icon="lucide:copy"
                        :label="verifyCode || 'コードを生成中...'"
                        variant="link"
                    />
                </UFormField>
            </div>
        </template>

        <template #footer>
            <div class="flex w-full items-center justify-end gap-2">
                <UButton
                    :disabled="verifying"
                    label="キャンセル"
                    variant="ghost"
                    @click="modalVerify = false"
                />
                <UButton
                    :loading="verifying"
                    :disabled="!verifyCode"
                    label="認証"
                    color="neutral"
                />
            </div>
        </template>
    </UModal>

    <UCard>
        <template #header>
            <div class="flex w-full items-center justify-between">
                <h2 class="text-lg leading-none font-semibold text-nowrap">
                    ショップ
                </h2>

                <UButton
                    icon="lucide:plus"
                    label="新しくショップを認証"
                    color="neutral"
                    variant="soft"
                    @click="modalVerify = true"
                />
            </div>
        </template>

        <div class="flex flex-col gap-2">
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

                <UModal v-model:open="modalUnverify" title="認証解除">
                    <UTooltip text="ショップの認証を解除" :delay-duration="100">
                        <UButton
                            icon="lucide:x"
                            aria-label="ショップの認証を解除"
                            variant="ghost"
                            size="sm"
                        />
                    </UTooltip>

                    <template #body>
                        <UAlert
                            icon="lucide:trash"
                            title="ショップの認証を解除しますか？"
                            color="warning"
                            variant="subtle"
                        />
                    </template>

                    <template #footer>
                        <div class="flex w-full items-center justify-end gap-2">
                            <UButton
                                :disabled="unverifying"
                                label="キャンセル"
                                variant="ghost"
                                @click="modalUnverify = false"
                            />
                            <UButton
                                :loading="unverifying"
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
