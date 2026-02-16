<script lang="ts" setup>
interface Props {
    sectionId: string
}
const { sectionId } = defineProps<Props>()

const { locale } = useI18n()

const { data: currentUser } = await useCurrentUser()
const { state, verifiable, url, generateVerificationCode, verify, unverify } =
    await useUserSettingsShop()

const modalVerify = ref(false)
const modalUnverify = ref(false)

const { copy, copied } = useClipboard({ source: state.value.verifyCode || '' })

const handleVerify = async () => {
    const success = await verify()
    if (success) modalVerify.value = false
}

const handleUnverify = async (shopId: string) => {
    const success = await unverify(shopId)
    if (success) modalUnverify.value = false
}

watch(modalVerify, async (value) => {
    if (value) {
        const code = await generateVerificationCode()
        state.value.verifyCode = code
    } else {
        state.value.verifyCode = null
    }
})
</script>

<template>
    <UModal v-model:open="modalVerify" :dismissible="false" :title="$t('settings.shop.newShop')">
        <template #body>
            <div class="flex flex-col gap-6">
                <UFormField
                    :label="$t('settings.shop.step1')"
                    :error="
                        state.itemUrl.length && !verifiable
                            ? $t('settings.shop.notVerifiable')
                            : undefined
                    "
                >
                    <div class="flex flex-col gap-2 pt-2">
                        <UInput
                            v-model="state.itemUrl"
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
                            :label="state.verifyCode || $t('settings.shop.generatingCode')"
                            variant="outline"
                            color="neutral"
                            block
                            :ui="{ base: 'gap-2', trailingIcon: 'size-4' }"
                            @click="copy(state.verifyCode || '')"
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
                    :loading="state.verifying"
                    :label="$t('settings.shop.verify')"
                    color="neutral"
                    size="lg"
                    block
                    @click="handleVerify()"
                />
            </div>
        </template>
    </UModal>

    <section :id="sectionId" class="flex flex-col gap-4">
        <h1 class="text-muted text-sm leading-none font-semibold text-nowrap">
            {{ $t('settings.shop.title') }}
        </h1>

        <UCard>
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
                        :to="url(shopItem.shop.id, shopItem.shop.platform)"
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

                        <p class="text-sm leading-none font-medium">
                            {{ shopItem.shop.name }}
                        </p>

                        <Icon
                            v-if="shopItem.shop.platform === 'booth'"
                            name="avatio:booth"
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
                                    :disabled="state.unverifying"
                                    :label="$t('cancel')"
                                    variant="ghost"
                                    @click="modalUnverify = false"
                                />
                                <UButton
                                    :loading="state.unverifying"
                                    :label="$t('settings.shop.unverify')"
                                    color="error"
                                    variant="solid"
                                    @click="handleUnverify(shopItem.shop.id)"
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
        </UCard>
    </section>
</template>
