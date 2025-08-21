<script lang="ts" setup>
const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits(['load'])

const nuxtApp = useNuxtApp()

const fetching = ref(false)
const drafts = ref<SetupDraft[]>([])

onMounted(async () => {
    fetching.value = true

    try {
        const response = await $fetch<SetupDraft[]>(`/api/setups/drafts`, {
            headers:
                import.meta.server && nuxtApp.ssrContext?.event.headers
                    ? nuxtApp.ssrContext.event.headers
                    : undefined,
        })
        drafts.value = response
    } catch (error) {
        console.error('Error fetching drafts:', error)
    } finally {
        fetching.value = false
    }
})
</script>

<template>
    <UModal v-model:open="open" title="下書き">
        <slot />

        <template #body>
            <div class="flex flex-col gap-2">
                <UButton
                    v-for="draft in drafts"
                    :key="draft.id"
                    variant="outline"
                    @click="
                        () => {
                            emit('load', draft.id)
                            open = false
                        }
                    "
                >
                    <div class="flex w-full flex-col gap-1 p-1">
                        <div class="flex items-center gap-2">
                            <span
                                v-if="draft.createdAt === draft.updatedAt"
                                class="text-xs"
                            >
                                <NuxtTime
                                    :datetime="draft.createdAt"
                                    relative
                                />
                                に作成
                            </span>
                            <span v-else class="text-xs">
                                <NuxtTime
                                    :datetime="draft.updatedAt"
                                    relative
                                />
                                に更新
                            </span>
                        </div>

                        <span
                            :data-notitle="!draft.content.name"
                            class="text-toned data-[notitle=true]:text-dimmed text-left"
                        >
                            {{ draft.content.name || '無題' }}
                        </span>
                    </div>
                </UButton>
            </div>
        </template>

        <template #footer>
            <div class="flex w-full items-center justify-end gap-1.5">
                <UButton
                    label="閉じる"
                    variant="ghost"
                    color="neutral"
                    size="lg"
                    @click="open = false"
                />
            </div>
        </template>
    </UModal>
</template>
