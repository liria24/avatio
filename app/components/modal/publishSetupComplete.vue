<script lang="ts" setup>
import confetti from 'canvas-confetti'

interface Props {
    setupId: number
}
const props = defineProps<Props>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
    (e: 'continue'): void
}>()

const { app } = useAppConfig()

const link = `${app.site}/setup/${props.setupId}`

const { data } = await useSetup(props.setupId)

const { copy, copied, isSupported } = useClipboard({ source: link })

onMounted(() => {
    confetti({
        particleCount: 80,
        spread: 100,
        origin: { x: 0, y: 0.7 },
    })
    confetti({
        particleCount: 80,
        spread: 100,
        origin: { x: 1, y: 0.7 },
    })
})
</script>

<template>
    <UModal
        v-model:open="open"
        :title="$t('modal.publishComplete.title')"
        :close="false"
        :dismissible="false"
    >
        <template #body>
            <div v-if="data" class="flex flex-col items-center gap-3">
                <div
                    class="ring-accented flex w-full flex-col items-center gap-2 rounded-lg p-3 ring-1"
                >
                    <NuxtImg
                        v-if="data.images?.length"
                        :src="data.images[0]?.url"
                        class="max-h-64 rounded-lg"
                    />
                    <p class="text-toned text-sm font-bold">{{ data.name }}</p>
                </div>

                <div class="flex items-center gap-1">
                    <NuxtLink
                        :to="link"
                        target="_blank"
                        class="text-muted text-sm leading-none text-nowrap"
                    >
                        {{ link }}
                    </NuxtLink>
                    <UButton
                        v-if="isSupported"
                        :icon="copied ? 'mingcute:check-line' : 'mingcute:copy-2-fill'"
                        variant="ghost"
                        size="sm"
                        @click="copy(link)"
                    />
                    <DropdownMenuShareSetup :setup="data">
                        <UButton icon="mingcute:share-2-fill" variant="ghost" size="sm" />
                    </DropdownMenuShareSetup>
                </div>
            </div>
        </template>

        <template #footer>
            <div class="flex w-full gap-1">
                <UButton
                    icon="mingcute:add-line"
                    :label="$t('modal.publishComplete.continuePosting')"
                    variant="soft"
                    color="neutral"
                    size="lg"
                    block
                    @click="emit('continue')"
                />
                <UButton
                    :to="props.setupId ? `/setup/${props.setupId}` : undefined"
                    :disabled="!props.setupId"
                    trailing-icon="mingcute:arrow-right-line"
                    :label="$t('modal.publishComplete.viewSetup')"
                    color="neutral"
                    size="lg"
                    block
                    :prefetch="false"
                />
            </div>
        </template>
    </UModal>
</template>
