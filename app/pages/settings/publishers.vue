<script lang="ts" setup>
definePageMeta({ auth: 'user' })

interface Ownership {
    id: string
    method: string
    verifiedAt: string
    source: {
        id: string
        providerKey: string
        externalId: string
        canonicalUrl: string
        name: string
        image: string | null
    }
}

interface Challenge {
    id: string
    code: string
    instruction: { type: string; url: string }
}

const { locale, t } = useI18n()
const toast = useToast()
const itemUrl = ref('')
const challenge = ref<Challenge | null>(null)
const processing = ref(false)
const modalVerify = ref(false)
const pendingRemoval = ref<Ownership | null>(null)
const { copy, copied } = useClipboard({ source: computed(() => challenge.value?.code ?? '') })
const { data: ownerships, refresh } = await useFetch<Ownership[]>('/api/me/publisher-ownerships', {
    default: () => [],
})

const createChallenge = async () => {
    processing.value = true
    try {
        challenge.value = await $fetch<Challenge>('/api/publisher-verification-challenges', {
            method: 'POST',
            body: { url: itemUrl.value },
        })
    } catch (error) {
        console.error('Failed to create publisher verification challenge:', error)
        toast.add({
            icon: 'mingcute:close-line',
            title: t('settings.publisher.toast.challengeFailed'),
            color: 'error',
        })
    } finally {
        processing.value = false
    }
}

const verify = async () => {
    if (!challenge.value) return
    processing.value = true
    try {
        await $fetch(`/api/publisher-verification-challenges/${challenge.value.id}/verify`, {
            method: 'POST',
            body: { url: itemUrl.value },
        })
        await refresh()
        modalVerify.value = false
        toast.add({
            icon: 'mingcute:check-line',
            title: t('settings.publisher.toast.verified'),
            color: 'success',
        })
    } catch (error) {
        console.error('Failed to verify publisher:', error)
        toast.add({
            icon: 'mingcute:close-line',
            title: t('settings.publisher.toast.verifyFailed'),
            color: 'error',
        })
    } finally {
        processing.value = false
    }
}

const removeOwnership = async () => {
    if (!pendingRemoval.value) return
    processing.value = true
    try {
        await $fetch(`/api/me/publisher-ownerships/${pendingRemoval.value.id}`, {
            method: 'DELETE',
        })
        await refresh()
        pendingRemoval.value = null
        toast.add({
            icon: 'mingcute:check-line',
            title: t('settings.publisher.toast.unverified'),
            color: 'success',
        })
    } catch (error) {
        console.error('Failed to remove publisher ownership:', error)
        toast.add({
            icon: 'mingcute:close-line',
            title: t('settings.publisher.toast.unverifyFailed'),
            color: 'error',
        })
    } finally {
        processing.value = false
    }
}

watch(modalVerify, (open) => {
    if (open) return
    itemUrl.value = ''
    challenge.value = null
})

useSeo({ title: t('settings.title'), description: t('settings.description') })
</script>

<template>
    <NuxtLayout name="settings" :title="$t('settings.publisher.title')">
        <UModal
            v-model:open="modalVerify"
            :dismissible="false"
            :title="$t('settings.publisher.newPublisher')"
        >
            <template #body>
                <div class="flex flex-col gap-6">
                    <UFormField :label="$t('settings.publisher.step1')" required>
                        <UInput
                            v-model="itemUrl"
                            type="url"
                            placeholder="https://booth.pm/items/1234567"
                            class="w-full"
                            :disabled="Boolean(challenge)"
                        />
                    </UFormField>

                    <UButton
                        v-if="!challenge"
                        :disabled="!itemUrl"
                        :loading="processing"
                        :label="$t('settings.publisher.createChallenge')"
                        color="neutral"
                        block
                        @click="createChallenge"
                    />

                    <template v-else>
                        <UFormField :label="$t('settings.publisher.step2')">
                            <div class="flex flex-col gap-2 pt-2">
                                <UButton
                                    :trailing-icon="
                                        copied ? 'mingcute:check-line' : 'mingcute:copy-2-fill'
                                    "
                                    :label="challenge.code"
                                    variant="outline"
                                    color="neutral"
                                    block
                                    @click="copy()"
                                />
                                <UAlert
                                    icon="mingcute:information-fill"
                                    :description="$t('settings.publisher.instruction')"
                                    variant="outline"
                                />
                            </div>
                        </UFormField>

                        <UButton
                            :loading="processing"
                            :label="$t('settings.publisher.verify')"
                            color="neutral"
                            size="lg"
                            block
                            @click="verify"
                        />
                    </template>
                </div>
            </template>
        </UModal>

        <div class="flex flex-col gap-2">
            <p v-if="!ownerships.length" class="text-muted self-center py-2 text-sm leading-none">
                {{ $t('settings.publisher.none') }}
            </p>

            <div
                v-for="ownership in ownerships"
                :key="ownership.id"
                class="bg-muted flex items-center gap-3 rounded-lg p-3"
            >
                <ULink
                    :to="ownership.source.canonicalUrl"
                    target="_blank"
                    external
                    class="flex grow items-center gap-3"
                >
                    <NuxtImg
                        :src="ownership.source.image || undefined"
                        alt=""
                        :width="32"
                        :height="32"
                        format="avif"
                        class="aspect-square size-7 shrink-0 rounded-md object-cover"
                    />
                    <p class="text-highlighted text-sm leading-none font-medium">
                        {{ ownership.source.name }}
                    </p>
                    <Icon
                        :name="
                            ownership.source.providerKey === 'booth'
                                ? 'avatio:booth'
                                : 'mingcute:store-fill'
                        "
                        size="16"
                        class="text-muted"
                    />
                </ULink>

                <NuxtTime
                    :datetime="ownership.verifiedAt"
                    date-style="medium"
                    time-style="short"
                    :locale
                    class="text-muted text-sm leading-none"
                />
                <UButton
                    icon="mingcute:close-line"
                    :aria-label="$t('settings.publisher.unverify')"
                    variant="ghost"
                    size="sm"
                    @click="pendingRemoval = ownership"
                />
            </div>

            <UButton
                icon="mingcute:add-line"
                :label="$t('settings.publisher.newPublisher')"
                variant="ghost"
                block
                class="rounded-lg"
                @click="modalVerify = true"
            />
        </div>

        <UModal
            :open="Boolean(pendingRemoval)"
            :title="$t('settings.publisher.unverify')"
            @update:open="(open) => !open && (pendingRemoval = null)"
        >
            <template #body>
                <UAlert
                    icon="mingcute:delete-2-fill"
                    :title="$t('settings.publisher.unverifyConfirm')"
                    color="warning"
                    variant="subtle"
                />
            </template>
            <template #footer>
                <div class="flex w-full justify-end gap-2">
                    <UButton :label="$t('cancel')" variant="ghost" @click="pendingRemoval = null" />
                    <UButton
                        :loading="processing"
                        :label="$t('settings.publisher.unverify')"
                        color="error"
                        @click="removeOwnership"
                    />
                </div>
            </template>
        </UModal>
    </NuxtLayout>
</template>
