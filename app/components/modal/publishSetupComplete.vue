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

const link = `https://avatio.me/setup/${props.setupId}`

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
        title="投稿が完了しました！"
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
                        :icon="copied ? 'lucide:check' : 'lucide:copy'"
                        variant="ghost"
                        size="sm"
                        @click="copy(link)"
                    />
                    <DropdownMenuShareSetup :setup="data">
                        <UButton
                            icon="lucide:share-2"
                            variant="ghost"
                            size="sm"
                        />
                    </DropdownMenuShareSetup>
                </div>
            </div>
        </template>

        <template #footer>
            <div class="flex w-full gap-1">
                <UButton
                    icon="lucide:plus"
                    label="続けて投稿"
                    variant="soft"
                    color="neutral"
                    size="lg"
                    block
                    @click="emit('continue')"
                />
                <UButton
                    :to="`/setup/${props.setupId}`"
                    trailing-icon="lucide:arrow-right"
                    label="投稿したセットアップを見る"
                    color="neutral"
                    size="lg"
                    block
                    :prefetch="false"
                />
            </div>
        </template>
    </UModal>
</template>
