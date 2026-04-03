<script lang="ts" setup>
definePageMeta({
    middleware: 'authed',
})

const { locale, t } = useI18n()
const toast = useToast()
const { data: currentUser, refresh: refreshCurrentUser } = await useCurrentUser()

const itemUrl = ref('')
const code = ref<string | null>(null)
const processing = ref(false)

const verifiable = computed(() => {
    const result = extractItemId(itemUrl.value)
    return result?.platform === 'booth'
})

const modalVerify = ref(false)
const modalUnverify = ref(false)

const { copy, copied } = useClipboard({ source: computed(() => code.value ?? '') })

const verify = async () => {
    if (!verifiable.value) return

    processing.value = true

    try {
        await $fetch('/api/shop-verification', {
            method: 'POST',
            body: { url: itemUrl.value },
        })
        toast.add({
            icon: 'mingcute:check-line',
            title: t('settings.shop.toast.verified'),
            color: 'success',
        })
        await refreshCurrentUser()
        modalVerify.value = false
    } catch (error) {
        console.error('Error verifying shop:', error)
        toast.add({
            icon: 'mingcute:close-line',
            title: t('settings.shop.toast.verifyFailed'),
            color: 'error',
        })
    } finally {
        processing.value = false
    }
}

const unverify = async (shopId: string) => {
    processing.value = true

    try {
        await $fetch('/api/shop-verification', {
            method: 'DELETE',
            body: { shopId },
        })
        toast.add({
            icon: 'mingcute:check-line',
            title: t('settings.shop.toast.unverified'),
            color: 'success',
        })
        await refreshCurrentUser()
        modalUnverify.value = false
    } catch (error) {
        console.error('Error unverifying shop:', error)
        toast.add({
            icon: 'mingcute:close-line',
            title: t('settings.shop.toast.unverifyFailed'),
            color: 'error',
        })
    } finally {
        processing.value = false
    }
}

watch(modalVerify, async (value) => {
    if (!value) return (code.value = null)
    try {
        const data = await $fetch<{ code: string }>('/api/shop-verification/code')
        code.value = data.code
    } catch (error) {
        console.error('Error generating verification code:', error)
        code.value = null
    }
})

useSeo({
    title: t('settings.title'),
    description: t('settings.description'),
})
</script>

<template>
    <NuxtLayout name="settings" :title="$t('settings.shop.title')">
        <UModal
            v-model:open="modalVerify"
            :dismissible="false"
            :title="$t('settings.shop.newShop')"
        >
            <template #body>
                <div class="flex flex-col gap-6">
                    <UFormField
                        :label="$t('settings.shop.step1')"
                        :error="
                            itemUrl.length && !verifiable
                                ? $t('settings.shop.notVerifiable')
                                : undefined
                        "
                    >
                        <div class="flex flex-col gap-2 pt-2">
                            <UInput
                                v-model="itemUrl"
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
                                :trailing-icon="
                                    copied ? 'mingcute:check-line' : 'mingcute:copy-2-fill'
                                "
                                :label="code || $t('settings.shop.generatingCode')"
                                variant="outline"
                                color="neutral"
                                block
                                :ui="{ base: 'gap-2', trailingIcon: 'size-4' }"
                                @click="copy()"
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
                        :loading="processing"
                        :label="$t('settings.shop.verify')"
                        color="neutral"
                        size="lg"
                        block
                        @click="verify()"
                    />
                </div>
            </template>
        </UModal>

        <div class="flex flex-col gap-2">
            <p
                v-if="!currentUser?.shops?.length"
                class="text-muted self-center py-2 text-sm leading-none"
            >
                {{ $t('settings.shop.noVerifiedShops') }}
            </p>

            <div
                v-for="shopItem in currentUser?.shops"
                :key="shopItem.shop.id"
                class="bg-muted flex items-center gap-3 rounded-lg p-3"
            >
                <ULink
                    :to="resolveShopUrl(shopItem.shop.id, shopItem.shop.platform)"
                    class="flex grow items-center gap-3"
                >
                    <NuxtImg
                        :src="shopItem.shop.image || undefined"
                        alt=""
                        :width="32"
                        :height="32"
                        format="webp"
                        loading="lazy"
                        fetchpriority="low"
                        class="aspect-square size-7 shrink-0 rounded-md object-cover"
                    />

                    <p class="text-highlighted text-sm leading-none font-medium">
                        {{ shopItem.shop.name }}
                    </p>

                    <Icon
                        :name="getPlatformData(shopItem.shop.platform)?.icon"
                        size="16"
                        class="text-muted"
                    />
                </ULink>

                <NuxtTime
                    :datetime="shopItem.createdAt"
                    date-style="medium"
                    time-style="short"
                    :locale
                    class="text-muted text-sm leading-none"
                />

                <UModal v-model:open="modalUnverify" :title="$t('settings.shop.unverify')">
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
                                :disabled="processing"
                                :label="$t('cancel')"
                                variant="ghost"
                                @click="modalUnverify = false"
                            />
                            <UButton
                                :loading="processing"
                                :label="$t('settings.shop.unverify')"
                                color="error"
                                variant="solid"
                                @click="unverify(shopItem.shop.id)"
                            />
                        </div>
                    </template>
                </UModal>
            </div>

            <UButton
                icon="mingcute:add-line"
                :label="$t('settings.shop.newShop')"
                variant="ghost"
                block
                class="rounded-lg"
                @click="modalVerify = true"
            />
        </div>
    </NuxtLayout>
</template>
