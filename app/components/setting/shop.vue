<script lang="ts" setup>
const { locale, t } = useI18n()
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
    <UModal
        v-model:open="shopState.modalVerify"
        :dismissible="false"
        :title="$t('settings.shop.newShop')"
    >
        <template #body>
            <div class="flex flex-col gap-6">
                <UFormField
                    :label="$t('settings.shop.step1')"
                    :error="
                        shopState.itemUrl.length && !verifiable
                            ? $t('settings.shop.notVerifiable')
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
                            :description="$t('settings.shop.stepDescription')"
                            variant="outline"
                            :ui="{
                                icon: 'size-4',
                                description: 'text-xs sentence',
                            }"
                        />
                    </div>
                </UFormField>

                <UFormField :label="$t('settings.shop.step2')">
                    <div class="flex flex-col gap-2 pt-2">
                        <UButton
                            :trailing-icon="copied ? 'mingcute:check-line' : 'mingcute:copy-2-fill'"
                            :label="shopState.verifyCode || t('settings.shop.generatingCode')"
                            variant="outline"
                            color="neutral"
                            block
                            :ui="{ base: 'gap-2', trailingIcon: 'size-4' }"
                            @click="copy(shopState.verifyCode || '')"
                        />
                        <UAlert
                            icon="mingcute:information-fill"
                            :title="$t('settings.shop.deleteCodeNote')"
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
                    :label="$t('settings.shop.verify')"
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
                <h2 class="text-lg leading-none font-semibold text-nowrap">
                    {{ $t('settings.shop.title') }}
                </h2>

                <UButton
                    icon="mingcute:add-line"
                    :label="$t('settings.shop.newShop')"
                    color="neutral"
                    variant="soft"
                    @click="shopState.modalVerify = true"
                />
            </div>
        </template>

        <div class="flex flex-col gap-2">
            <p v-if="!data?.shops?.length" class="text-muted self-center py-2 text-sm leading-none">
                {{ $t('settings.shop.noVerifiedShops') }}
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
                    :locale
                    class="text-muted text-sm leading-none"
                />

                <UModal
                    v-model:open="shopState.modalUnverify"
                    :title="$t('settings.shop.unverify')"
                >
                    <UTooltip :text="$t('settings.shop.unverify')" :delay-duration="100">
                        <UButton
                            icon="mingcute:close-line"
                            :aria-label="$t('settings.shop.unverify')"
                            variant="ghost"
                            size="sm"
                        />
                    </UTooltip>

                    <template #body>
                        <UAlert
                            icon="mingcute:delete-2-fill"
                            :title="$t('settings.shop.unverifyConfirm')"
                            color="warning"
                            variant="subtle"
                        />
                    </template>

                    <template #footer>
                        <div class="flex w-full items-center justify-end gap-2">
                            <UButton
                                :disabled="shopState.unverifying"
                                :label="$t('cancel')"
                                variant="ghost"
                                @click="shopState.modalUnverify = false"
                            />
                            <UButton
                                :loading="shopState.unverifying"
                                :label="$t('settings.shop.unverify')"
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
